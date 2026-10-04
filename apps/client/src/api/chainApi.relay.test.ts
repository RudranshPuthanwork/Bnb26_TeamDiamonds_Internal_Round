// Submit path against a tiny mock relayer. The chain client is faked, so no anvil is needed.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { decodeFunctionData, verifyTypedData, zeroHash, type Hex } from 'viem';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { heirloomRegistryAbi as abi } from '@heirloom/abi';
import { Action, buildTypedData } from '@heirloom/auth';
import { ChainClient, RelayError } from './chainApi';
import { accountFor } from '../dev/devSigner';
import { describeError } from '../errors';
import { COPY } from '../copy';

const REGISTRY = '0x4ed7c70f96b99c776995fb64377f0d4ab3b0e1c1' as const;
const VAULT = `0x${'1'.padStart(64, '0')}` as Hex;
const TX = `0x${'ab'.repeat(32)}` as Hex;
const domain = { name: 'HeirloomRegistry', version: '1', chainId: 31337n, verifyingContract: REGISTRY };

let server: Server;
let url: string;
let seen: { path: string; body: { chainId: number; to: string; data: Hex } }[];
let reply: { status: number; json: unknown };
let directCalls: number;

function makeClient(relayerUrl?: string) {
  const c = new ChainClient({ rpcUrl: 'http://127.0.0.1:1', registry: REGISTRY, deployBlock: 0n, chainId: 31337, relayerUrl });
  (c as unknown as { pub: object }).pub = {
    readContract: async ({ functionName }: { functionName: string }) =>
      functionName === 'eip712Domain' ? ['0x0f', domain.name, domain.version, domain.chainId, REGISTRY, zeroHash, []] : 0n,
    getBlock: async () => ({ timestamp: 1000n }),
    waitForTransactionReceipt: async () => ({ status: 'success', logs: [] }),
    simulateContract: async () => {
      directCalls++;
      throw new Error('DIRECT_PATH');
    },
  };
  return c;
}

beforeEach(async () => {
  seen = [];
  directCalls = 0;
  reply = { status: 200, json: { txHash: TX } };
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (d) => (raw += d));
    req.on('end', () => {
      seen.push({ path: req.url ?? '', body: JSON.parse(raw) });
      res.writeHead(reply.status, { 'content-type': 'application/json' }).end(JSON.stringify(reply.json));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(() => new Promise((r) => server.close(r)));

describe('ChainClient submit path', () => {
  it('with a relayer: signs EOA_SIG as the acting account and posts calldata to /relay', async () => {
    const hash = await makeClient(url).heartbeat(VAULT);
    expect(hash).toBe(TX);
    expect(directCalls).toBe(0);
    expect(seen).toHaveLength(1);
    expect(seen[0].path).toBe('/relay');
    expect(seen[0].body).toMatchObject({ chainId: 31337, to: REGISTRY });
    const { functionName, args } = decodeFunctionData({ abi, data: seen[0].body.data }) as unknown as {
      functionName: string;
      args: [Hex, { kind: number; signer: Hex; nonce: bigint; deadline: bigint; sig: Hex }];
    };
    const auth = args[1];
    expect(functionName).toBe('heartbeat');
    expect(auth.kind).toBe(1);
    expect(auth.signer).toBe(accountFor(0).address);
    expect(auth.deadline).toBe(1600n);
    expect(
      await verifyTypedData({
        address: auth.signer,
        ...buildTypedData(domain, Action.Heartbeat, VAULT, zeroHash, auth.nonce, auth.deadline),
        signature: auth.sig,
      })
    ).toBe(true);
  });

  it('without a relayer: DIRECT, nothing is posted', async () => {
    await expect(makeClient().heartbeat(VAULT)).rejects.toThrow('DIRECT_PATH');
    expect(directCalls).toBe(1);
    expect(seen).toHaveLength(0);
  });

  it('a contract revert from the relayer shows the existing plain-language copy and offers no direct button', async () => {
    reply = { status: 422, json: { error: { name: 'NotAuthorized', message: 'reverted' } } };
    const c = makeClient(url);
    const err = await c.heartbeat(VAULT).catch((e) => e);
    expect(err).toBeInstanceOf(RelayError);
    expect(describeError(err).message).toBe(COPY.errors.reverts.NotAuthorized[0]);
    expect(c.relayerFailed).toBe(false);
    expect(directCalls).toBe(0);
  });

  it('a relayer outage never falls back silently; direct only after the user chooses it, once', async () => {
    reply = { status: 503, json: { error: { name: 'ChainUnavailable', message: 'rpc down' } } };
    const c = makeClient(url);
    const err = await c.heartbeat(VAULT).catch((e) => e);
    expect(describeError(err).message).toBe(COPY.errors.relayer.ChainUnavailable[0]);
    expect(c.relayerFailed).toBe(true);
    expect(directCalls).toBe(0);

    await expect(c.heartbeat(VAULT)).rejects.toBeInstanceOf(RelayError); // retry still uses the relayer
    expect(directCalls).toBe(0);

    c.chooseDirect();
    await expect(c.heartbeat(VAULT)).rejects.toThrow('DIRECT_PATH'); // the chosen direct submit
    expect(directCalls).toBe(1);
    expect(seen).toHaveLength(2);

    await expect(c.heartbeat(VAULT)).rejects.toBeInstanceOf(RelayError); // choice was one-shot
    expect(seen).toHaveLength(3);
  });

  it('an unreachable relayer is a failure to show, not a reason to go direct', async () => {
    const c = makeClient('http://127.0.0.1:1');
    const err = await c.heartbeat(VAULT).catch((e) => e);
    expect(describeError(err).message).toBe(COPY.errors.relayer.Unreachable[0]);
    expect(c.relayerFailed).toBe(true);
    expect(directCalls).toBe(0);
  });
});
