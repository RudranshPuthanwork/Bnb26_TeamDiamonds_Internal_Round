// Deploy HeirloomRegistry to a local anvil (TIME_UNIT=1) and point the client at it.
// Usage (repo root, anvil running): npm run dev:deploy
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RPC = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
// Anvil account 0 (public test key from the standard anvil mnemonic). Never use on a real chain.
const ANVIL_KEY_0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TIME_UNIT = '1';

const run = spawnSync(
  'forge',
  ['script', 'contracts/script/Deploy.s.sol', '--root', 'contracts', '--rpc-url', RPC, '--broadcast', '--private-key', ANVIL_KEY_0],
  { cwd: root, env: { ...process.env, TIME_UNIT }, encoding: 'utf8', shell: process.platform === 'win32' }
);
if (run.status !== 0) {
  console.error((run.stdout + run.stderr).split('\n').slice(-40).join('\n'));
  console.error('Deploy failed. Is anvil running at ' + RPC + '?');
  process.exit(1);
}

// Broadcast file: contracts/broadcast/Deploy.s.sol/<chainId>/run-latest.json
const chainId = await fetch(RPC, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
})
  .then((r) => r.json())
  .then((j) => parseInt(j.result, 16));
const file = join(root, 'contracts', 'broadcast', 'Deploy.s.sol', String(chainId), 'run-latest.json');
const b = JSON.parse(readFileSync(file, 'utf8'));
const tx = b.transactions.find((t) => t.transactionType === 'CREATE' && t.contractName === 'HeirloomRegistry');
if (!tx) throw new Error('No HeirloomRegistry CREATE in ' + file);
const receipt = b.receipts.find((r) => r.transactionHash === tx.hash);
const address = tx.contractAddress;
const deployBlock = parseInt(receipt.blockNumber, 16);

mkdirSync(join(root, 'deployments'), { recursive: true });
writeFileSync(
  join(root, 'deployments', 'anvil.json'),
  JSON.stringify({ chainId, address, deployBlock, timeUnit: Number(TIME_UNIT) }, null, 2) + '\n'
);
writeFileSync(
  join(root, 'apps', 'client', '.env.local'),
  [
    `VITE_RPC_URL=${RPC}`,
    `VITE_REGISTRY_ADDRESS=${address}`,
    `VITE_DEPLOY_BLOCK=${deployBlock}`,
    `VITE_CHAIN_ID=${chainId}`,
    `VITE_TIME_UNIT=${TIME_UNIT}`,
    '',
  ].join('\n')
);
console.log(`HeirloomRegistry ${address} at block ${deployBlock} on chain ${chainId}`);
console.log('Wrote deployments/anvil.json and apps/client/.env.local');
