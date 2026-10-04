// Relayer + storage + watchtower against a running anvil with the registry deployed.
// Run: npm run smoke:services   (anvil running, `npm run dev:deploy` done). Exits non-zero on any failure.
import { spawn } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createPublicClient, encodeFunctionData, http, toFunctionSelector, toHex } from 'viem';
import { heirloomRegistryAbi as abi } from '@heirloom/abi';
import { Action, eoaKeyId, fetchDomain, fetchNonce, signAction } from '@heirloom/auth';
import { fetchBundle, MemoryBundleStore, pinBundle, idOf, canonical } from '@heirloom/storage';
import { ChainClient } from '../apps/client/src/api/chainApi';
import { MemoryKv } from '../apps/client/src/api/localKv';
import { Reason } from '../apps/client/src/api/types';
import { ACCOUNT, accountFor } from '../apps/client/src/dev/devSigner';
import { addDemoAsset, createDemoVault } from '../apps/client/src/dev/seed';
import { advanceTime } from '../apps/client/src/dev/timeControl';
import { startWatchtower } from '../services/watchtower/src/watchtower';
import { contactMessage } from '../services/watchtower/src/contacts';
import { renderEmail } from '../services/watchtower/templates/email';

const root = join(import.meta.dirname, '..');
const RPC = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
const RELAYER_PORT = 18787;
const RELAYER = `http://127.0.0.1:${RELAYER_PORT}`;
const DATA = join(root, '.data');
const OUTBOX = join(DATA, 'outbox.jsonl');
const DAY = 86400;
const BANNED = ['seamless', 'unlock', 'supercharge', 'elevate', 'empower', 'streamline', 'leverage', 'robust', 'effortless', 'next-generation', 'world-class'];

let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (path, body) =>
  fetch(RELAYER + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const dep = JSON.parse(readFileSync(join(root, 'deployments', 'anvil.json'), 'utf8'));
const pub = createPublicClient({ transport: http(RPC) });
const up = await pub.getCode({ address: dep.address }).catch(() => undefined);
if (!up || up === '0x') {
  console.error(`No registry at ${dep.address} on ${RPC}. Start anvil, then run \`npm run dev:deploy\`.`);
  process.exit(1);
}

const outboxLines = () => (existsSync(OUTBOX) ? readFileSync(OUTBOX, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const startLines = outboxLines().length;
const fresh = () => outboxLines().slice(startLines);
const countBy = (lines) => lines.reduce((m, l) => ({ ...m, [l.type]: (m[l.type] ?? 0) + 1 }), {});
async function waitFor(pred, what, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (pred()) return true;
    await sleep(150);
  }
  check(false, `timed out waiting for ${what}`);
  return false;
}

for (const f of ['state.json', 'contacts.enc']) rmSync(join(DATA, f), { force: true });

// ---- relayer (separate process) ----
const relayerKey = toHex(accountFor(9).getHdKey().privateKey);
const relayerProc = spawn(process.execPath, [join(root, 'node_modules/tsx/dist/cli.mjs'), join(root, 'services/relayer/src/index.ts')], {
  cwd: root,
  env: { ...process.env, REGISTRY_ADDRESS: dep.address, CHAIN_ID: String(dep.chainId), RELAYER_PRIVATE_KEY: relayerKey, PORT: String(RELAYER_PORT), RATE_LIMIT_PER_MIN: '1000', DATA_DIR: DATA, RPC_URL: RPC },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let relayerLog = '';
relayerProc.stdout.on('data', (d) => (relayerLog += d));
relayerProc.stderr.on('data', (d) => (relayerLog += d));

let wt;
try {
  const healthy = await waitFor(() => relayerLog.includes('relayer on'), 'relayer start');
  if (!healthy) throw new Error(relayerLog.split('\n').slice(-20).join('\n'));
  const health = await (await fetch(`${RELAYER}/health`)).json();
  check(health.ok === true && BigInt(health.relayerBalance) > 0n, `relayer healthy, balance ${health.relayerBalance} wei`);

  // ---- watchtower (in this process, so the synthetic event below can reach it) ----
  const head = await pub.getBlockNumber();
  wt = await startWatchtower({
    rpcUrl: RPC, chainId: dep.chainId, registry: dep.address, fromBlock: head + 1n, clientUrl: 'http://localhost:5173',
    contactsKey: crypto.getRandomValues(new Uint8Array(32)), allowedOrigins: [], port: 0,
    leadSeconds: 5 * DAY, drillGraceSeconds: 10 * DAY, tickMs: 0, pollMs: 200, dataDir: DATA, resendFrom: 'Heirloom <test@heirloom.invalid>',
  });
  check(true, `watchtower started on :${wt.port}, from block ${head + 1n}`);

  // ---- contacts: signed registration ----
  const reg = async (acctIndex, channel, target, signer = acctIndex) => {
    const a = accountFor(acctIndex);
    const message = contactMessage(eoaKeyId(a.address), { channel, target });
    const signature = await accountFor(signer).signMessage({ message });
    return fetch(`http://127.0.0.1:${wt.port}/contacts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: a.address, channel, target, signature }) });
  };
  check((await reg(ACCOUNT.owner, 'email', 'curator@heirloom.test', 5)).status === 400, 'contact signed by another key is rejected');
  check((await reg(ACCOUNT.owner, 'email', 'curator@heirloom.test')).ok, 'owner email contact registered');
  check((await reg(ACCOUNT.backupOwner, 'telegram', '1000001')).ok, 'backup owner telegram contact registered');
  for (let g = 1; g <= 5; g++) await reg(ACCOUNT.guardian(g), 'telegram', String(2000000 + g));
  check((await reg(ACCOUNT.beneficiary, 'email', 'heir@heirloom.test')).ok, 'beneficiary email contact registered');

  // ---- storage: pin, fetch, tamper ----
  const bundle = { v: 'heirloom.bundle.v1', vaultId: toHex(99n, { size: 32 }), assetId: toHex(7n, { size: 32 }), version: 1, C: 'c2VhbGVk', guardians: [], beneficiaries: [], participants: { guardians: [], beneficiaries: [] } };
  const id = await pinBundle(RELAYER, bundle);
  check(id === idOf(canonical(bundle)), `pinned bundle, id ${id.slice(0, 10)}…`);
  const back = await fetchBundle(id, { relayerUrl: RELAYER, gateways: ['http://127.0.0.1:9/dead'] });
  check(canonical(back) === canonical(bundle), 'fetched it back (dead gateway skipped, relayer used)');
  const pinFile = join(DATA, 'pins', `${id}.json`);
  writeFileSync(pinFile, readFileSync(pinFile, 'utf8').replace('c2VhbGVk', 'dGFtcGVy'));
  check((await fetch(`${RELAYER}/pin/${id}`)).status === 404, 'relayer refuses to serve a tampered pin');
  const evil = (await import('node:http')).createServer((_, res) => res.end(readFileSync(pinFile, 'utf8')));
  await new Promise((ok) => evil.listen(0, ok));
  const rejected = await fetchBundle(id, { gateways: [`http://127.0.0.1:${evil.address().port}`] }).then(() => false, () => true);
  evil.close();
  check(rejected, 'fetchBundle rejects tampered bytes from a gateway');
  check((await post('/pin', { bundle: { v: 'nope' } })).status === 400, 'POST /pin rejects a non-bundle');

  // ---- chain actions: vault A ----
  const client = new ChainClient(
    { rpcUrl: RPC, registry: dep.address, deployBlock: BigInt(dep.deployBlock), chainId: dep.chainId },
    { bundles: new MemoryBundleStore({ relayerUrl: RELAYER }), kv: new MemoryKv() }
  );
  const vaultA = await createDemoVault(client);
  await addDemoAsset(client, vaultA, crypto.getRandomValues(new Uint8Array(64)));
  check(true, `vault A #${Number(BigInt(vaultA))} created with one item (bundle pinned through the relayer)`);

  // ---- relay a signed heartbeat ----
  const owner = accountFor(ACCOUNT.owner);
  const now = async () => (await pub.getBlock()).timestamp;
  const signedHeartbeat = async () => {
    const auth = await signAction(owner, await fetchDomain(pub, dep.address), Action.Heartbeat, vaultA, {}, await fetchNonce(pub, dep.address, eoaKeyId(owner.address)), (await now()) + 600n);
    return encodeFunctionData({ abi, functionName: 'heartbeat', args: [vaultA, auth] });
  };
  const data = await signedHeartbeat();
  const res = await post('/relay', { chainId: dep.chainId, to: dep.address, data });
  const out = await res.json();
  check(res.ok && /^0x[0-9a-f]{64}$/.test(out.txHash), `relayed signed heartbeat, tx ${String(out.txHash).slice(0, 10)}…`);
  const tx = await pub.getTransaction({ hash: out.txHash });
  check(tx.from.toLowerCase() === accountFor(9).address.toLowerCase(), 'tx was sent by the relayer account, not the owner');
  const replay = await post('/relay', { chainId: dep.chainId, to: dep.address, data });
  const replayBody = await replay.json();
  check(replay.status === 422 && replayBody.error.name === 'BadNonce', `replay maps to the contract error (${replay.status} ${replayBody.error?.name})`);
  const nonces = toFunctionSelector('nonces(bytes32)');
  const notAllowed = await post('/relay', { chainId: dep.chainId, to: dep.address, data: nonces + '00'.repeat(32) });
  check(notAllowed.status === 400 && (await notAllowed.json()).error.name === 'SelectorNotAllowed', 'a non-allowlisted selector is rejected');
  check((await post('/relay', { chainId: 1, to: dep.address, data })).status === 400, 'wrong chain is rejected');

  // ---- pre-lapse, first attestation, dispute, drill ----
  await advanceTime(client, 26 * DAY);
  await wt.tick();
  const A = () => countBy(fresh().filter((l) => l.vaultId === vaultA));
  check(A()['pre-lapse'] === 2, `pre-lapse reminder to both owners (${A()['pre-lapse']})`);

  for (const g of [1, 2, 3]) {
    client.useAccount(ACCOUNT.guardian(g));
    await client.attest(vaultA, Reason.DECEASED);
  }
  await waitFor(() => (A()['first-attestation'] ?? 0) >= 7, 'first-attestation alerts');
  await sleep(600); // a second and third attestation must add nothing
  check(A()['first-attestation'] === 7, `first attestation alerted owners and all guardians once (${A()['first-attestation']})`);

  await advanceTime(client, 5 * DAY);
  client.useAccount(ACCOUNT.guardian(4));
  await client.dispute(vaultA);
  await waitFor(() => (A().dispute ?? 0) >= 7, 'dispute alerts');
  check(A().dispute === 7, `dispute alerted owners and all guardians (${A().dispute})`);

  // the contract's drill() is a stub until Phase 7, so no guardian is ready: slack is negative
  await wt.tick();
  check(A()['drill-overdue'] === 5 && A()['drill-slack'] === 2, `drill alerts: ${A()['drill-overdue']} overdue, ${A()['drill-slack']} slack`);

  // ---- queued change: the contract stub reverts NotImplemented, so feed the watchtower a synthetic log ----
  await wt.handleLog({ eventName: 'ChangeQueued', args: { vaultId: vaultA, changeId: toHex(5n, { size: 32 }), applyAfter: BigInt(await now()) + 86400n }, blockNumber: await pub.getBlockNumber(), logIndex: 9999, transactionHash: toHex(1n, { size: 32 }) });
  check(A()['change-queued'] === 2, `queued change alerted both owners (${A()['change-queued']}, synthetic log)`);

  // ---- vault B: release ----
  const vaultB = await createDemoVault(client);
  await addDemoAsset(client, vaultB, crypto.getRandomValues(new Uint8Array(64)));
  for (const g of [1, 2, 3]) {
    client.useAccount(ACCOUNT.guardian(g));
    await client.attest(vaultB, Reason.DECEASED);
  }
  await advanceTime(client, 39 * DAY);
  await waitFor(() => fresh().some((l) => l.vaultId === vaultB && l.type === 'first-attestation'), 'vault B events');
  await wt.tick();
  const B = countBy(fresh().filter((l) => l.vaultId === vaultB));
  check(B.release === 8, `release notice to 2 owners, 5 guardians, 1 beneficiary (${B.release})`);

  // ---- copy checks on everything written ----
  const lines = fresh();
  const text = lines.map((l) => l.text.toLowerCase()).join('\n');
  check(!BANNED.some((w) => text.includes(w)), 'no banned words in any alert');
  const toGuardians = lines.filter((l) => l.type === 'first-attestation' && l.to.startsWith('20000'));
  check(toGuardians.length > 0 && toGuardians.every((l) => !/Guardian 0x/.test(l.text)), 'guardian messages never name another guardian');
  const toOwner = lines.find((l) => l.type === 'first-attestation' && l.to === 'curator@heirloom.test');
  check(!!toOwner && /Guardian 0x[0-9a-f]{4}….{4}/i.test(toOwner.text) && toOwner.text.includes('UTC') && toOwner.text.includes('HL-'), 'owner message names the actor by short key hash, UTC time and accession');
  check(lines.filter((l) => l.vaultId === vaultA && l.type === 'first-attestation' && l.text.includes('?cancel=')).length === 2, 'owner messages carry the cancel link');
  const html = renderEmail({ subject: 'S', lines: ['a & b'], action: { label: 'Cancel', link: 'http://x/#/?cancel=1' } });
  check(html.includes('#15181C') && html.includes('background:#000000') && html.includes('Georgia') && !/<img|gradient/.test(html), 'email is plain: ink text, black button, serif stack, no images or gradients');

  // ---- table ----
  const all = countBy(fresh());
  const TYPES = ['pre-lapse', 'first-attestation', 'dispute', 'release', 'drill-overdue', 'drill-slack', 'change-queued'];
  console.log('\nalert type          count');
  for (const t of TYPES) console.log(`${t.padEnd(19)} ${all[t] ?? 0}`);
  check(TYPES.every((t) => (all[t] ?? 0) > 0), 'every alert type was produced at least once');
} catch (e) {
  failed++;
  console.error(e instanceof Error ? (e.stack ?? e.message).split('\n').slice(0, 15).join('\n') : e);
} finally {
  await wt?.stop();
  relayerProc.kill();
}
console.log(failed ? `\nFAIL: ${failed} check(s) failed` : '\nPASS: services smoke');
process.exit(failed ? 1 : 0);
