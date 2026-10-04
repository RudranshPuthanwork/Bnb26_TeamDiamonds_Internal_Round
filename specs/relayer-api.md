# Relayer API (stateless; implements services.md 7.2 and 7.4)

Purpose: pay gas for signed (`AuthKind.EOA_SIG`) registry calls and pin bundles. It holds one funded key and no database. It can censor and delay, never forge or alter: the contract verifies the EIP-712 signature (D2), and the signature covers vault, action, paramsHash, nonce and deadline. Direct submission always remains possible (I4).

The relayer never decodes params. It checks the selector allowlist, simulates, and sends.

All bodies are JSON. Hex is 0x-prefixed lowercase. Errors always use `{ "error": { "name": string, "message": string } }`.

## POST /relay
Body: `{ "chainId": number, "to": address, "data": hex }`. `data` is the full calldata of ONE registry function, including its Auth struct.

Checks, in order (first failure wins):
1. `chainId` equals the configured chain, else 400 `WrongChain`.
2. `to` equals the configured registry address (case-insensitive), else 400 `WrongTarget`.
3. `data` is hex, at least 4 bytes, at most 64 KiB, else 400 `BadRequest`.
4. Selector is in the allowlist, else 400 `SelectorNotAllowed`.
5. Per-IP rate limit, else 429 `RateLimited` with `Retry-After`.
6. Simulate with `eth_call` from the relayer account. A revert returns 422 with `name` = the registry custom error name (decoded with the registry ABI, e.g. `BadNonce`, `Expired`, `NotAuthorized`), else `Reverted`. No tx is sent.
7. Send the tx, wait for one confirmation. Success: 200 `{ "txHash": hex }`. Receipt status 0: 502 `Reverted`. RPC unreachable: 503 `ChainUnavailable`. Relayer out of gas funds: 503 `RelayerUnfunded`.

Selector allowlist (4-byte selectors of): `createVault`, `addAsset`, `heartbeat`, `cancel`, `setAbsence`, `attest`, `dispute`, `submitShare`, `markClaimed`. Phase 7 stubs (queueChange, applyChange, revokeChange, drill, rekey, claimContingent) are added when they stop reverting `NotImplemented`. The relayer rejects any other selector, so it can never be used to call arbitrary contracts or functions.

Not the relayer's job: checking that `auth.kind` is EOA_SIG. A DIRECT call relayed would act as the relayer's own keyId, which the contract then rejects or attributes to the relayer; the relayer may refuse it as `BadRequest` if it decodes the first Auth word, but this is optional.

## POST /pin
Body: `{ "bundle": <heirloom.bundle.v1 JSON> }`. Response 200 `{ "cid": string }`.
- 400 `BadRequest` unless `bundle.v === "heirloom.bundle.v1"`. Maximum body 8 MiB (413 `TooLarge`).
- The relayer pins the exact JSON text it received. The `cid` is what the pinning backend returns; the client must verify it equals the CID it computes (or the bytes32 it commits on chain), because the relayer is not trusted.
- Same rate limit as /relay.

## GET /pin/:cid
Response 200: the bundle JSON, as pinned. 404 `NotFound` if unknown. Clients must verify the content hashes to `:cid`.

## GET /health
200 `{ "ok": true, "chainId": number, "registry": address, "relayerBalance": decimal-string wei }`. `ok` is false (still 200) when the RPC is unreachable or the balance is below the configured floor.

## Rate limiting
429 `RateLimited` with `Retry-After: <seconds>`. Suggested default: 30 requests/minute/IP on /relay and /pin. Rate limits apply before simulation to keep RPC cost bounded.

## Error names the client maps (copy.ts)
Registry names pass through unchanged. Relayer-only names: `WrongChain`, `WrongTarget`, `BadRequest`, `SelectorNotAllowed`, `RateLimited`, `TooLarge`, `NotFound`, `Reverted`, `ChainUnavailable`, `RelayerUnfunded`.

## Config (env)
`RPC_URL`, `CHAIN_ID`, `REGISTRY_ADDRESS`, `RELAYER_KEY`, `PINATA_JWT`, `MIN_BALANCE_WEI`, `RATE_LIMIT_PER_MIN`.

## Trust notes
- Signed payloads are replayable by any relayer, but only in nonce order and only until `deadline` (review 1c N4). Clients should use short deadlines (default 10 minutes).
- `createVault` signs `vaultId = vaultCount + 1`; if another vault is created first the call reverts `BadAuth` without burning the nonce (review 1c N6). The client re-reads `vaultCount` and re-signs when the user retries.
