import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  createPublicClient, createWalletClient, decodeErrorResult, decodeFunctionData, defineChain, http, isHex,
  toFunctionSelector, type Address, type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { heirloomRegistryAbi as abi } from '@heirloom/abi';

export interface Config {
  rpcUrl: string;
  chainId: number;
  registry: Address;
  relayerKey: Hex;
  pinataJwt?: string;
  pinataGateway: string;
  minBalanceWei: bigint;
  ratePerMin: number;
  allowedOrigins: string[];
  gasCap: bigint;
  dataDir: string;
}

/** Every registry function a signed payload may call. Anything else is rejected before simulation. */
const ALLOWED = [
  'attest', 'heartbeat', 'cancel', 'dispute', 'submitShare', 'markClaimed', 'setAbsence', 'drill', 'createVault',
  'addAsset', 'queueChange', 'applyChange', 'revokeChange', 'rekey', 'claimContingent',
];
const fns = abi.filter((x) => x.type === 'function' && ALLOWED.includes(x.name));
const selectors = new Set(fns.map((f) => toFunctionSelector(f as never)));

class HttpError extends Error {
  constructor(readonly status: number, readonly errName: string, message: string, readonly headers: Record<string, string> = {}) {
    super(message);
  }
}
const bad = (name: string, message: string) => new HttpError(400, name, message);

const MAX_DATA_BYTES = 64 * 1024;
const MAX_BODY = '8mb';
const ID = /^0x[0-9a-f]{64}$/;
const sha256 = (s: string) => `0x${createHash('sha256').update(s).digest('hex')}`;

/** Hex revert data from whatever viem threw, or undefined if the error is not a contract revert. */
function revertData(e: unknown): Hex | undefined {
  const w = (e as { walk?: (f: (x: unknown) => boolean) => unknown }).walk?.(
    (x) => typeof (x as { data?: unknown }).data === 'string' && /^0x[0-9a-f]{8,}$/i.test((x as { data: string }).data)
  );
  return (w as { data?: Hex } | undefined)?.data;
}

export function createApp(cfg: Config) {
  const chain = defineChain({
    id: cfg.chainId, name: `Chain ${cfg.chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [cfg.rpcUrl] } },
  });
  const account = privateKeyToAccount(cfg.relayerKey);
  const pub = createPublicClient({ chain, transport: http(cfg.rpcUrl), pollingInterval: 250 });
  const wallet = createWalletClient({ account, chain, transport: http(cfg.rpcUrl) });
  const pinDir = join(cfg.dataDir, 'pins');

  // One hot key: transactions are sent one at a time, so nonces never collide.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {});
    return run;
  };

  // ponytail: fixed window per IP in memory, resets on restart; use a shared store if the relayer is ever replicated.
  const hits = new Map<string, { n: number; reset: number }>();
  const limit = (req: Request) => {
    const now = Date.now();
    const ip = req.ip ?? 'unknown';
    let h = hits.get(ip);
    if (!h || h.reset <= now) hits.set(ip, (h = { n: 0, reset: now + 60_000 }));
    if (++h.n > cfg.ratePerMin) {
      throw new HttpError(429, 'RateLimited', 'Too many requests. Retry later.', { 'Retry-After': String(Math.ceil((h.reset - now) / 1000)) });
    }
  };
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset <= now) hits.delete(k); }, 60_000).unref();

  const app = express();
  app.set('trust proxy', false);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && cfg.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'content-type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    }
    if (req.method === 'OPTIONS') return void res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: MAX_BODY }));

  const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

  app.get('/health', wrap(async (_req, res) => {
    let balance = 0n, ok = false;
    try { balance = await pub.getBalance({ address: account.address }); ok = balance >= cfg.minBalanceWei; } catch { /* rpc down */ }
    res.json({ ok, chainId: cfg.chainId, registry: cfg.registry, relayerBalance: balance.toString() });
  }));

  app.post('/relay', wrap(async (req, res) => {
    const { chainId, to, data } = (req.body ?? {}) as { chainId?: unknown; to?: unknown; data?: unknown };
    if (chainId !== cfg.chainId) throw bad('WrongChain', `This relayer serves chain ${cfg.chainId}.`);
    if (typeof to !== 'string' || to.toLowerCase() !== cfg.registry.toLowerCase()) throw bad('WrongTarget', 'Only the Heirloom registry can be called.');
    if (!isHex(data) || data.length < 10 || (data.length - 2) / 2 > MAX_DATA_BYTES) throw bad('BadRequest', 'data must be hex, 4 bytes to 64 KiB.');
    if (!selectors.has(data.slice(0, 10).toLowerCase() as Hex)) throw bad('SelectorNotAllowed', 'That function is not relayed.');
    try { decodeFunctionData({ abi, data }); } catch { throw bad('BadRequest', 'data does not decode for that function.'); }
    limit(req);

    try {
      // estimateGas runs the call, so a revert surfaces here and nothing is sent.
      const est = await pub.estimateGas({ account, to: cfg.registry, data });
      if (est > cfg.gasCap) throw bad('BadRequest', 'That call needs more gas than the relayer allows.');
      const txHash = await serial(async () => {
        const hash = await wallet.sendTransaction({ to: cfg.registry, data, gas: (est * 12n) / 10n > cfg.gasCap ? cfg.gasCap : (est * 12n) / 10n });
        const r = await pub.waitForTransactionReceipt({ hash });
        if (r.status !== 'success') throw new HttpError(502, 'Reverted', 'The transaction reverted on chain.');
        return hash;
      });
      res.json({ txHash });
    } catch (e) {
      if (e instanceof HttpError) throw e;
      const rd = revertData(e);
      if (rd) {
        let name = 'Reverted';
        try { name = decodeErrorResult({ abi, data: rd }).errorName; } catch { /* unknown selector */ }
        throw new HttpError(422, name, `The registry rejected the call: ${name}.`);
      }
      const msg = String((e as Error).message ?? e).toLowerCase();
      if (msg.includes('insufficient funds')) throw new HttpError(503, 'RelayerUnfunded', 'The relayer account has no funds for gas.');
      throw new HttpError(503, 'ChainUnavailable', 'The chain did not answer.');
    }
  }));

  // ---- pinning: id = sha256 of the canonical bundle JSON; the relayer only ever holds ciphertext ----
  const metaKey = 'heirloomId';
  const pinata = (path: string, init: RequestInit = {}) =>
    fetch(`https://api.pinata.cloud${path}`, { ...init, headers: { authorization: `Bearer ${cfg.pinataJwt}`, ...init.headers } });

  async function storePin(id: string, text: string) {
    if (!cfg.pinataJwt) {
      await mkdir(pinDir, { recursive: true });
      return void (await writeFile(join(pinDir, `${id}.json`), text));
    }
    const r = await pinata('/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pinataContent: JSON.parse(text), pinataMetadata: { name: id, keyvalues: { [metaKey]: id } } }),
    });
    if (!r.ok) throw new HttpError(502, 'ChainUnavailable', 'The pinning service did not accept the bundle.');
  }

  async function loadPin(id: string): Promise<string | undefined> {
    if (!cfg.pinataJwt) return readFile(join(pinDir, `${id}.json`), 'utf8').catch(() => undefined);
    // ponytail: Pinata does not store our id as a CID, so look the pin up by metadata. Not exercised without an account.
    const q = `/data/pinList?status=pinned&metadata[keyvalues]=${encodeURIComponent(JSON.stringify({ [metaKey]: { value: id, op: 'eq' } }))}`;
    const row = (await (await pinata(q)).json().catch(() => ({ rows: [] }))) as { rows?: { ipfs_pin_hash: string }[] };
    const hash = row.rows?.[0]?.ipfs_pin_hash;
    if (!hash) return undefined;
    const g = await fetch(`${cfg.pinataGateway}/ipfs/${hash}`);
    return g.ok ? g.text() : undefined;
  }

  app.post('/pin', wrap(async (req, res) => {
    limit(req);
    const bundle = (req.body ?? {}).bundle as { v?: unknown } | undefined;
    if (!bundle || bundle.v !== 'heirloom.bundle.v1') throw bad('BadRequest', 'bundle.v must be heirloom.bundle.v1.');
    const text = JSON.stringify(bundle);
    const cid = sha256(text);
    await storePin(cid, text);
    res.json({ cid });
  }));

  app.get('/pin/:cid', wrap(async (req, res) => {
    limit(req);
    const cid = String(req.params.cid).toLowerCase();
    if (!ID.test(cid)) throw bad('BadRequest', 'cid must be a 0x-prefixed 32-byte hex id.');
    const text = await loadPin(cid);
    // Verify before serving: a corrupted or swapped file is reported as missing, never returned.
    if (text === undefined || sha256(text) !== cid) throw new HttpError(404, 'NotFound', 'No bundle with that id is pinned here.');
    res.type('application/json').send(text);
  }));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err as { type?: string; status?: number };
    let h: HttpError;
    if (err instanceof HttpError) h = err;
    else if (e.type === 'entity.too.large') h = new HttpError(413, 'TooLarge', 'The body is over 8 MiB.');
    else if (e.type === 'entity.parse.failed') h = bad('BadRequest', 'The body is not valid JSON.');
    else h = new HttpError(500, 'Internal', 'Unexpected relayer error.');
    for (const [k, v] of Object.entries(h.headers)) res.setHeader(k, v);
    res.status(h.status).json({ error: { name: h.errName, message: h.message } });
  });

  return app;
}
