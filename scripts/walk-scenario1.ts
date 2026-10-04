// Scenario 1 end to end against a running anvil, using the same adapters as the client.
// Run: npx tsx scripts/walk-scenario1.ts   (anvil running, `npm run dev:deploy` done)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChainClient } from '../apps/client/src/api/chainApi';
import { MemoryBundleStore } from '../apps/client/src/api/bundleStore';
import { MemoryKv } from '../apps/client/src/api/localKv';
import { Reason, Status, STATUS_NAMES, type Hex32 } from '../apps/client/src/api/types';
import { ACCOUNT } from '../apps/client/src/dev/devSigner';
import { addDemoAsset, createDemoVault } from '../apps/client/src/dev/seed';
import { advanceTime } from '../apps/client/src/dev/timeControl';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dep = JSON.parse(readFileSync(join(root, 'deployments', 'anvil.json'), 'utf8')) as {
  chainId: number;
  address: `0x${string}`;
  deployBlock: number;
};
const DAY = 86400;

const kv = new MemoryKv();
const client = new ChainClient(
  { rpcUrl: process.env.RPC_URL ?? 'http://127.0.0.1:8545', registry: dep.address, deployBlock: BigInt(dep.deployBlock), chainId: dep.chainId },
  { bundles: new MemoryBundleStore(), kv }
);

let n = 0;
const log = (msg: string) => console.log(`[${String(++n).padStart(2, '0')}] ${msg}`);
function check(ok: boolean, msg: string): asserts ok {
  if (!ok) throw new Error(`MISMATCH: ${msg}`);
}
async function expectStatus(v: Hex32, a: Hex32, want: Status) {
  const got = await client.status(v, a);
  check(got === want, `status ${STATUS_NAMES[got]}, expected ${STATUS_NAMES[want]}`);
  log(`status is ${STATUS_NAMES[got]}`);
}

async function main() {
  const info = await client.getChainInfo();
  check(info.chainId === 31337, 'the walk needs the local anvil chain (31337)');
  log(`chain ${info.chainId}, TIME_UNIT ${info.timeUnit}, block ${info.blockNumber}`);

  // ---- Branch A: release and claim ----
  const secret = crypto.getRandomValues(new Uint8Array(312));
  const vault = await createDemoVault(client);
  log(`created vault #${Number(BigInt(vault))} (5 guardians, t=3)`);
  const asset = await addDemoAsset(client, vault, secret);
  log(`sealed and added a ${secret.length}-byte asset ${asset.slice(0, 10)}…`);
  await expectStatus(vault, asset, Status.Sealed);

  for (const g of [1, 2, 3]) {
    client.useAccount(ACCOUNT.guardian(g));
    await client.attest(vault, Reason.DECEASED);
    log(`guardian ${g} attested DECEASED`);
  }
  await expectStatus(vault, asset, Status.Armed); // quorum in, silence not yet

  await advanceTime(client, 31 * DAY);
  log('advanced 31 days (past silence)');
  await expectStatus(vault, asset, Status.Cooling);

  await advanceTime(client, 8 * DAY);
  log('advanced 8 days (past the window)');
  check(await client.isReleasable(vault, asset), 'asset should be releasable');
  log('isReleasable is true');

  for (const g of [1, 2, 3]) {
    client.useAccount(ACCOUNT.guardian(g));
    await client.submitShare(vault, asset);
    log(`guardian ${g} submitted a re-encrypted share`);
  }

  client.useAccount(ACCOUNT.beneficiary);
  const progress = await client.getClaimProgress(vault, asset);
  check(progress?.step === 'ready', `claim step ${progress?.step}, expected ready`);
  const got = await client.reconstruct(vault, asset);
  check(got.bytes.length === secret.length && got.bytes.every((b, i) => b === secret[i]), 'plaintext differs from the original');
  log(`beneficiary reconstructed ${got.bytes.length} bytes, equal to the original`);

  await client.markClaimed(vault, asset);
  await expectStatus(vault, asset, Status.Claimed);

  // ---- Branch B: the owner cancels before release ----
  const vault2 = await createDemoVault(client);
  const asset2 = await addDemoAsset(client, vault2, crypto.getRandomValues(new Uint8Array(312)));
  log(`branch B: created vault #${Number(BigInt(vault2))} with one asset`);
  for (const g of [1, 2, 3]) {
    client.useAccount(ACCOUNT.guardian(g));
    await client.attest(vault2, Reason.DECEASED);
  }
  await expectStatus(vault2, asset2, Status.Armed);
  client.useAccount(ACCOUNT.owner);
  await client.cancel(vault2);
  log('owner cancelled');
  await expectStatus(vault2, asset2, Status.Sealed);
  const marks = await client.getAttestations(vault2);
  check(marks.every((m) => m.reason === Reason.NONE), 'attestations should be void after cancel');
  log('all attestations are void');
}

main().then(
  () => console.log('PASS: scenario 1 walk complete'),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
