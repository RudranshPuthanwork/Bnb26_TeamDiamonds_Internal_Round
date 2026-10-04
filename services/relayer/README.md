# Heirloom relayer

Stateless. Pays gas for signed (`EOA_SIG`) registry calls and pins bundles. It holds one funded key and no database. It can censor or delay; it cannot forge, because the registry verifies the participant's EIP-712 signature. API: `specs/relayer-api.md`.

Run (repo root): `REGISTRY_ADDRESS=0x… RELAYER_PRIVATE_KEY=0x… npm start -w @heirloom/relayer`

| Env | Default | |
|---|---|---|
| `RPC_URL` | `http://127.0.0.1:8545` | |
| `CHAIN_ID` | `31337` | |
| `REGISTRY_ADDRESS`, `RELAYER_PRIVATE_KEY` | required | `RELAYER_KEY` also accepted |
| `PINATA_JWT` | unset | unset: pins are files under `$DATA_DIR/pins` |
| `PINATA_GATEWAY` | `https://gateway.pinata.cloud` | read side for Pinata |
| `ALLOWED_ORIGINS` | none | comma-separated CORS origins |
| `RATE_LIMIT_PER_MIN` | `30` | per IP, `/relay` and `/pin` |
| `GAS_CAP`, `MIN_BALANCE_WEI`, `PORT`, `DATA_DIR` | `3000000`, `0`, `8787`, `.data` | |

Pin ids are `sha256` of the canonical bundle JSON (`0x` + 64 hex), the same rule as `@heirloom/storage`. `GET /pin/:id` re-hashes before answering.

## Submit directly without the relayer

If the relayer is down or censoring, send the same signed call from any funded wallet. The signature in `auth` is what authorises the action, not the sender.

```ts
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { heirloomRegistryAbi as abi } from '@heirloom/abi';
import { Action, eoaKeyId, fetchDomain, fetchNonce, signAction } from '@heirloom/auth';

const registry = '0x…'; // deployments/<network>.json
const vaultId = '0x…';
const owner = privateKeyToAccount('0x…');   // signs the action
const sender = privateKeyToAccount('0x…');  // any funded account, pays gas

const pub = createPublicClient({ transport: http(RPC_URL) });
const wallet = createWalletClient({ account: sender, transport: http(RPC_URL) });

const auth = await signAction(
  owner,
  await fetchDomain(pub, registry),
  Action.Heartbeat,
  vaultId,
  {},
  await fetchNonce(pub, registry, eoaKeyId(owner.address)),
  BigInt(Math.floor(Date.now() / 1000) + 600) // short deadline
);
const hash = await wallet.writeContract({ address: registry, abi, functionName: 'heartbeat', args: [vaultId, auth], chain: null });
```

If `owner` is also the sender, skip the signature and pass `DIRECT_AUTH` from `@heirloom/auth`.
