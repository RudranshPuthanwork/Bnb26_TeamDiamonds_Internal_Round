import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import express from 'express';
import { createPublicClient, defineChain, http, type Address, type Hex } from 'viem';
import { heirloomRegistryAbi as abi } from '@heirloom/abi';
import { deliver, type ChannelConfig } from './channels.js';
import { Contacts, type Channel } from './contacts.js';
import { compose, shortHash, type AlertType, type Audience, type Facts } from '../templates/messages.js';

export interface Config extends ChannelConfig {
  rpcUrl: string;
  chainId: number;
  registry: Address;
  /** First block to read when there is no saved state. */
  fromBlock: bigint;
  clientUrl: string;
  contactsKey: Uint8Array;
  allowedOrigins: string[];
  port: number;
  /** Seconds before a lapse at which the reminder goes out. */
  leadSeconds: number;
  /** Seconds after an item is catalogued (or the last passed drill) before a missing drill counts as overdue. */
  drillGraceSeconds: number;
  /** ms between interval jobs; 0 = none (tests call tick()). */
  tickMs: number;
  pollMs: number;
}

interface VaultState { assets: Record<string, number>; firstAttested: boolean }
interface State { lastBlock: number; seen: string[]; sent: string[]; vaults: Record<string, VaultState> }

type Log = { eventName?: string; args?: Record<string, unknown>; blockNumber: bigint; logIndex: number; transactionHash: Hex };

const SEEN_KEEP = 5000;
const pad4 = (v: string) => String(Number(BigInt(v))).padStart(4, '0');

export async function startWatchtower(cfg: Config) {
  const pub = createPublicClient({
    chain: defineChain({ id: cfg.chainId, name: `Chain ${cfg.chainId}`, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [cfg.rpcUrl] } } }),
    transport: http(cfg.rpcUrl),
    pollingInterval: cfg.pollMs,
  });
  const contacts = await Contacts.open(join(cfg.dataDir, 'contacts.enc'), cfg.contactsKey);
  const stateFile = join(cfg.dataDir, 'state.json');
  const state: State = await readFile(stateFile, 'utf8').then(JSON.parse, () => ({ lastBlock: -1, seen: [], sent: [], vaults: {} }));
  const seen = new Set(state.seen);
  const sent = new Set(state.sent);
  const persist = async () => {
    state.seen = [...seen].slice(-SEEN_KEEP);
    state.sent = [...sent];
    await mkdir(cfg.dataDir, { recursive: true });
    await writeFile(stateFile, JSON.stringify(state));
  };

  const read = <T>(functionName: string, args: unknown[] = []) =>
    pub.readContract({ address: cfg.registry, abi, functionName, args } as never) as Promise<T>;
  const unit = Number(await read<bigint>('TIME_UNIT'));
  const nowChain = async () => Number((await pub.getBlock()).timestamp);
  const blockTime = async (n: bigint) => Number((await pub.getBlock({ blockNumber: n })).timestamp);
  const vaultOf = async (id: string) => {
    const [owners, guardians, t, , , lastHeartbeat, absentUntil] = await read<readonly [Hex[], Hex[], number, number, number, number, number]>('getVault', [id]);
    return { owners, guardians, t, lastHeartbeat: Number(lastHeartbeat), absentUntil: Number(absentUntil) };
  };
  const vs = (id: string): VaultState => (state.vaults[id] ??= { assets: {}, firstAttested: false });

  type Recipient = { keyId: Hex; who: Audience };

  /** Send one alert to every contact of every recipient. A failed channel is logged and does not stop the others. */
  async function notify(type: AlertType, vaultId: string, to: Recipient[], facts: (who: Audience) => Facts) {
    const link = (kind: string) => `${cfg.clientUrl}/#/?${kind}=${vaultId}`;
    const done = new Set<string>();
    for (const r of to) {
      if (done.has(r.keyId.toLowerCase())) continue;
      done.add(r.keyId.toLowerCase());
      for (const contact of await contacts.list(r.keyId)) {
        try {
          await deliver(cfg, { type, vaultId, keyId: r.keyId, contact, msg: compose(type, r.who, facts(r.who), link) });
        } catch (e) {
          console.error(`alert ${type} to ${shortHash(r.keyId)} via ${contact.channel} failed: ${(e as Error).message}`);
        }
      }
    }
  }

  const owners = (v: { owners: Hex[] }): Recipient[] => v.owners.map((keyId) => ({ keyId, who: 'owner' }));
  const guardians = (v: { guardians: Hex[] }): Recipient[] => v.guardians.map((keyId) => ({ keyId, who: 'guardian' }));

  // ---------- events ----------

  async function handle(log: Log) {
    const key = `${log.transactionHash}:${log.logIndex}`;
    if (seen.has(key) || !log.args) return;
    seen.add(key);
    state.lastBlock = Math.max(state.lastBlock, Number(log.blockNumber));
    const a = log.args;
    const vaultId = a.vaultId as string | undefined;
    if (vaultId) {
      const v = vs(vaultId);
      const at = await blockTime(log.blockNumber);
      const collection = `HL-${pad4(vaultId)}`;
      switch (log.eventName) {
        case 'AssetAdded':
          v.assets[a.assetId as string] = at;
          break;
        case 'Heartbeat':
        case 'Cancelled':
          v.firstAttested = false;
          break;
        case 'Attested': {
          if (v.firstAttested) break;
          v.firstAttested = true;
          const info = await vaultOf(vaultId);
          const actor = info.guardians[Number(a.guardian)];
          const reason = ['NONE', 'INCAPACITATED', 'DECEASED', 'MISSING'][Number(a.reason)];
          await notify('first-attestation', vaultId, [...owners(info), ...guardians(info)], (who) => ({
            collection, at, reason, actor: who === 'owner' && actor ? shortHash(actor) : undefined,
          }));
          break;
        }
        case 'Disputed': {
          const info = await vaultOf(vaultId);
          const actor = info.guardians[Number(a.guardian)];
          await notify('dispute', vaultId, [...owners(info), ...guardians(info)], (who) => ({
            collection, at, actor: who === 'owner' && actor ? shortHash(actor) : undefined,
          }));
          break;
        }
        case 'ChangeQueued': {
          const info = await vaultOf(vaultId);
          await notify('change-queued', vaultId, owners(info), () => ({
            collection, at, change: shortHash(a.changeId as string), applyAfter: Number(a.applyAfter),
          }));
          break;
        }
      }
    }
    await persist();
  }

  // One queue: catch-up and live logs never interleave.
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(fn: () => Promise<T>) => {
    const run = queue.then(fn);
    queue = run.catch((e) => console.error(`watchtower: ${(e as Error).message}`));
    return run;
  };
  const handleLog = (log: Log) => enqueue(() => handle(log));

  // ---------- interval jobs: pre-lapse, release, drill ----------

  const once = (key: string) => (sent.has(key) ? false : (sent.add(key), true));

  async function tickOnce() {
    const now = await nowChain();
    for (const [vaultId, vs_] of Object.entries(state.vaults)) {
      const assetIds = Object.keys(vs_.assets);
      if (!assetIds.length) continue;
      const info = await vaultOf(vaultId);
      const collection = `HL-${pad4(vaultId)}`;
      const rows = await Promise.all(
        assetIds.map(async (id) => {
          const [policy, , claimed] = await read<readonly [{ minInactivity: number; primaryBenef: Hex; version: number }, boolean, boolean]>('getAsset', [vaultId, id]);
          return { id, policy, claimed, releasable: await read<boolean>('isReleasable', [vaultId, id]) };
        })
      );

      // pre-lapse: lastHeartbeat + the shortest minInactivity, unless an absence is declared
      const live = rows.filter((r) => !r.claimed);
      if (live.length && info.absentUntil <= now) {
        const lapseAt = info.lastHeartbeat + Math.min(...live.map((r) => Number(r.policy.minInactivity))) * unit;
        if (now < lapseAt && now >= lapseAt - cfg.leadSeconds && once(`pre-lapse:${vaultId}:${info.lastHeartbeat}`)) {
          await notify('pre-lapse', vaultId, owners(info), () => ({ collection, at: now, lapseAt, lastSigned: info.lastHeartbeat, remaining: lapseAt - now }));
        }
      }

      for (const r of rows) {
        if (r.releasable && !r.claimed && once(`release:${vaultId}:${r.id}`)) {
          const benef: Recipient[] = [{ keyId: r.policy.primaryBenef, who: 'beneficiary' }];
          await notify('release', vaultId, [...owners(info), ...guardians(info), ...benef], () => ({ collection, at: now, item: shortHash(r.id) }));
        }
      }

      // drill: the contract counts a guardian ready when lastDrill.version == the asset version
      const version = Math.max(...rows.map((r) => Number(r.policy.version)));
      const firstAdded = Math.min(...Object.values(vs_.assets));
      const last = await Promise.all(info.guardians.map((_, i) => read<readonly [number, number]>('lastDrill', [vaultId, i])));
      let ready = 0;
      for (const [i, [v, at]] of last.entries()) {
        const ok = Number(v) === version;
        if (ok) ready++;
        const lastAt = ok ? Number(at) : 0;
        if (now - Math.max(lastAt, firstAdded) > cfg.drillGraceSeconds && once(`drill-overdue:${vaultId}:${i}:${lastAt}`)) {
          const g: Recipient[] = [{ keyId: info.guardians[i], who: 'guardian' }];
          await notify('drill-overdue', vaultId, g, () => ({ collection, at: now, lastDrill: lastAt || undefined }));
        }
      }
      if (ready - info.t < 1 && now - firstAdded > cfg.drillGraceSeconds && once(`drill-slack:${vaultId}:${version}:${ready}`)) {
        await notify('drill-slack', vaultId, owners(info), () => ({ collection, at: now, ready, t: info.t, n: info.guardians.length }));
      }
    }
    await persist();
  }
  const tick = () => enqueue(tickOnce);

  // ---------- start: live watch first, then catch-up, so no block falls between them ----------

  const unwatch = pub.watchContractEvent({
    address: cfg.registry, abi, pollingInterval: cfg.pollMs,
    onLogs: (logs) => void logs.forEach((l) => void handleLog(l as unknown as Log)),
    onError: (e) => console.error(`watchtower: watch error ${e.message}`),
  });
  const head = await pub.getBlockNumber();
  const STEP = 2000n;
  for (let from = state.lastBlock >= 0 ? BigInt(state.lastBlock) + 1n : cfg.fromBlock; from <= head; from += STEP) {
    const to = from + STEP - 1n < head ? from + STEP - 1n : head;
    const logs = await pub.getContractEvents({ address: cfg.registry, abi, fromBlock: from, toBlock: to });
    for (const l of logs) await handleLog(l as unknown as Log);
  }
  state.lastBlock = Math.max(state.lastBlock, Number(head));
  await enqueue(persist);
  const timer = cfg.tickMs ? setInterval(() => void tick(), cfg.tickMs) : undefined;

  // ---------- contact registration ----------

  const app = express();
  app.use((req, res, next) => {
    const o = req.headers.origin;
    if (o && cfg.allowedOrigins.includes(o)) {
      res.setHeader('Access-Control-Allow-Origin', o);
      res.setHeader('Access-Control-Allow-Headers', 'content-type');
      res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    }
    if (req.method === 'OPTIONS') return void res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '4kb' }));
  app.post('/contacts', async (req, res) => {
    const { address, channel, target, signature } = req.body ?? {};
    try {
      const keyId = await contacts.register(address, { channel: channel as Channel, target }, signature);
      res.json({ keyId });
    } catch (e) {
      const name = (e as Error).message === 'BadContact' ? 'BadContact' : 'BadSignature';
      res.status(400).json({ error: { name, message: name === 'BadContact' ? 'The channel or target is not valid.' : 'The signature does not match the address.' } });
    }
  });
  const server = await new Promise<import('node:http').Server>((ok) => {
    const s = app.listen(cfg.port, () => ok(s));
  });

  return {
    contacts, handleLog, tick,
    port: (server.address() as { port: number }).port,
    stop: async () => {
      unwatch();
      if (timer) clearInterval(timer);
      await queue;
      await new Promise((ok) => server.close(ok));
    },
  };
}
