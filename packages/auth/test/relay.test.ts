// Signed relays against a local anvil (TIME_UNIT=1). Skipped with a message if anvil is not running.
// Tags: [I2] no single signal releases, [I3] owner always wins, [I4] correctness never depends on the relayer,
// [1c N4] relayer replay only in nonce order, [1c N6] createVault id front-run.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, defineChain, http, keccak256, toHex, type Hex } from 'viem';
import { generatePrivateKey, mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import { beforeAll, describe, expect, it } from 'vitest';
import { heirloomRegistryAbi as abi } from '@heirloom/abi';
import { Action, eoaKeyId, fetchDomain, fetchNonce, signAction, type Auth, type Domain } from '../src/index.js';

const RPC = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
const up = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' })
  .then((r) => r.ok).catch(() => false);
if (!up) console.warn(`SKIPPED: anvil is not running at ${RPC}. Start it with \`anvil\` and re-run.`);

const chain = defineChain({ id: 31337, name: 'Anvil', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const acct = (i: number) => mnemonicToAccount('test test test test test test test test test test test junk', { addressIndex: i });
const [owner, g1, g2, g3, benef, relayer] = [acct(0), acct(2), acct(3), acct(4), acct(7), acct(9)];
const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = createWalletClient({ account: relayer, chain, transport: http(RPC) });
const kid = (a: { address: Hex }) => eoaKeyId(a.address);
const rpc = (method: string, params: unknown[] = []) => (pub as unknown as { request: (a: object) => Promise<unknown> }).request({ method, params });

let registry: Hex, domain: Domain, vaultId: Hex;
const assetId = keccak256(toHex('asset-1'));
const now = async () => (await pub.getBlock()).timestamp;

/** Submit from the relayer account only. Returns the revert error name instead of throwing. */
async function relay(functionName: string, args: unknown[]): Promise<string> {
  try {
    const { request } = await pub.simulateContract({ address: registry, abi, functionName, args, account: relayer } as never);
    const hash = await wallet.writeContract(request as never);
    const r = await pub.waitForTransactionReceipt({ hash });
    expect((await pub.getTransaction({ hash })).from.toLowerCase()).toBe(relayer.address.toLowerCase());
    return r.status;
  } catch (e) {
    const w = (e as { walk?: (f: (x: unknown) => boolean) => { data?: { errorName?: string } } }).walk?.((x) => !!(x as { data?: { errorName?: string } }).data?.errorName);
    return w?.data?.errorName ?? String(e).slice(0, 200);
  }
}

async function sign(who: typeof owner, action: Action, params: Record<string, unknown> = {}, over: { domain?: Domain; deadline?: bigint; vault?: Hex } = {}): Promise<Auth> {
  const nonce = await fetchNonce(pub, registry, kid(who));
  return signAction(who, over.domain ?? domain, action, over.vault ?? vaultId, params, nonce, over.deadline ?? (await now()) + 600n);
}

describe.skipIf(!up)('EOA_SIG relay: real participant signs, a different funded account submits', () => {
  beforeAll(async () => {
    const art = '../../../contracts/out/HeirloomRegistry.sol/HeirloomRegistry.json';
    const file = new URL(art, import.meta.url);
    try { readFileSync(file); } catch { spawnSync('forge', ['build', '--root', 'contracts'], { cwd: new URL('../../..', import.meta.url), shell: true }); }
    const { bytecode } = JSON.parse(readFileSync(file, 'utf8'));
    const hash = await wallet.deployContract({ abi, bytecode: bytecode.object, args: [1n] } as never);
    registry = (await pub.waitForTransactionReceipt({ hash })).contractAddress as Hex;
    domain = await fetchDomain(pub, registry);
    vaultId = toHex(1n, { size: 32 });
  });

  const owners = () => [kid(owner), kid(acct(1))] as const;
  const guardians = () => [kid(g1), kid(g2), kid(g3)];
  const policy = () => ({
    reasonsMask: 0x0e, kAttest: 1, requireEvidence: false, minInactivity: 1, window: 1, claimDeadline: 0,
    primaryBenef: kid(benef), contingentBenef: toHex(0n, { size: 32 }), bundleCid: keccak256(toHex('cid')), version: 1,
    shareCommitments: guardians().map((_g, i) => keccak256(toHex(i))),
  });

  it('[1c N6] createVault signed for a stale vaultId is BadAuth and burns no nonce', async () => {
    const p = { owners: owners(), guardians: guardians(), t: 2, policyDelay: 1 };
    const stale = await sign(owner, Action.CreateVault, p, { vault: toHex(99n, { size: 32 }) });
    expect(await relay('createVault', [p.owners, p.guardians, p.t, p.policyDelay, stale])).toBe('BadAuth');
    expect(await fetchNonce(pub, registry, kid(owner))).toBe(0n);
  });

  it('[I4] createVault: owner signature, relayer pays', async () => {
    const p = { owners: owners(), guardians: guardians(), t: 2, policyDelay: 1 };
    expect(await relay('createVault', [p.owners, p.guardians, p.t, p.policyDelay, await sign(owner, Action.CreateVault, p)])).toBe('success');
  });

  it('[I4] addAsset: owner signature covers the whole policy struct', async () => {
    const p = { assetId, policy: policy() };
    expect(await relay('addAsset', [vaultId, assetId, p.policy, await sign(owner, Action.AddAsset, p)])).toBe('success');
  });

  it('[I3] heartbeat: owner signature, relayer pays', async () => {
    expect(await relay('heartbeat', [vaultId, await sign(owner, Action.Heartbeat)])).toBe('success');
  });

  it('[I3] setAbsence: owner signature', async () => {
    expect(await relay('setAbsence', [vaultId, 0, await sign(owner, Action.SetAbsence, { until: 0 })])).toBe('success');
  });

  it('[I2] dispute: guardian signature', async () => {
    expect(await relay('dispute', [vaultId, await sign(g2, Action.Dispute)])).toBe('success');
  });

  it('[I3] cancel: owner signature voids the dispute epoch', async () => {
    expect(await relay('cancel', [vaultId, await sign(owner, Action.Cancel)])).toBe('success');
  });

  it('[I2] attest: guardian signature', async () => {
    const p = { reason: 2, evidenceHash: toHex(0n, { size: 32 }) };
    expect(await relay('attest', [vaultId, p.reason, p.evidenceHash, await sign(g1, Action.Attest, p)])).toBe('success');
  });

  it('[I1] submitShare: guardian signature, relayer cannot swap the share', async () => {
    await rpc('evm_increaseTime', [10]); await rpc('evm_mine');
    const p = { assetId, claimantKeyId: kid(benef), encShare: toHex(new Uint8Array(113).fill(7)) as Hex };
    const auth = await sign(g1, Action.SubmitShare, p);
    const swapped = toHex(new Uint8Array(113).fill(8)) as Hex;
    expect(await relay('submitShare', [vaultId, assetId, p.claimantKeyId, swapped, auth])).toBe('BadAuth');
    expect(await relay('submitShare', [vaultId, assetId, p.claimantKeyId, p.encShare, auth])).toBe('success');
  });

  it('[I5] markClaimed: beneficiary signature', async () => {
    expect(await relay('markClaimed', [vaultId, assetId, await sign(benef, Action.MarkClaimed, { assetId })])).toBe('success');
  });

  it('[1c N4] reused nonce is BadNonce', async () => {
    const auth = await sign(owner, Action.Heartbeat);
    expect(await relay('heartbeat', [vaultId, auth])).toBe('success');
    expect(await relay('heartbeat', [vaultId, auth])).toBe('BadNonce');
  });

  it('[1c N4] a later signed payload cannot jump the nonce order', async () => {
    const n = await fetchNonce(pub, registry, kid(owner));
    const second = await signAction(owner, domain, Action.Heartbeat, vaultId, {}, n + 1n, (await now()) + 600n);
    expect(await relay('heartbeat', [vaultId, second])).toBe('BadNonce');
  });

  it('[I1] tampered params (attest reason raised by the relayer) is BadAuth', async () => {
    const p = { reason: 1, evidenceHash: toHex(0n, { size: 32 }) };
    const auth = await sign(g1, Action.Attest, p);
    expect(await relay('attest', [vaultId, 2, p.evidenceHash, auth])).toBe('BadAuth');
  });

  it('[I4] wrong chainId in the signed domain is BadAuth', async () => {
    const auth = await sign(owner, Action.Heartbeat, {}, { domain: { ...domain, chainId: domain.chainId + 1n } });
    expect(await relay('heartbeat', [vaultId, auth])).toBe('BadAuth');
  });

  it('[1c N4] expired deadline is Expired', async () => {
    const auth = await sign(owner, Action.Heartbeat, {}, { deadline: (await now()) - 1n });
    expect(await relay('heartbeat', [vaultId, auth])).toBe('Expired');
  });

  it('[I1] signer who is not a participant is NotAuthorized', async () => {
    const stranger = privateKeyToAccount(generatePrivateKey());
    expect(await relay('heartbeat', [vaultId, await sign(stranger as never, Action.Heartbeat)])).toBe('NotAuthorized');
  });

  it('[I1] a guardian signature presented as the owner is BadAuth', async () => {
    const auth = { ...(await sign(g1, Action.Heartbeat)), signer: owner.address };
    auth.nonce = await fetchNonce(pub, registry, kid(owner));
    expect(await relay('heartbeat', [vaultId, auth])).toBe('BadAuth');
  });
});
