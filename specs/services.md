# Purpose: Off-chain infrastructure services: stateless relayer, event-driven watchtower, decentralized IPFS storage, and walk-away recovery kit.
Depends on: specs/contract.md, specs/crypto.md

## 1. Design invariants

Every component below exists to enforce one of these five invariants. Each item in the demo proves one of them.

| # | Invariant | Enforced by |
|---|---|---|
| **I1** | No single party can decrypt: not Heirloom, not one guardian, not *t* guardians, not the beneficiary. | Split-knowledge key (§4) |
| **I2** | No single signal can start a release. Release needs owner silence **and** a guardian quorum **and** an elapsed window. | Release rule (§5.2) |
| **I3** | While the owner is alive, the owner always wins. One tap cancels everything not yet released. | Epoch reset (§5.5) |
| **I4** | Correctness never depends on our servers or a bot. State is computed lazily from timestamps and signatures. | Keeper-free contract (§6) |
| **I5** | Heirs can recover even if Heirloom shuts down. | Walk-away recovery kit (§7.5) |

---

### 7.2 Relayer (Node, stateless)

Accepts signed payloads and pays gas, so non-crypto relatives never need ETH. It has no database. It can censor but not forge, and direct submission is always possible.

### 7.3 Watchtower (Node)

Subscribes to contract events and sends **pre-lapse reminders** ("heartbeat due in 5 days"), **attestation and dispute alerts** to the owner and all guardians, **release notices**, and **drill-overdue / low-slack** warnings. Channels: email (Resend), Telegram bot, Web Push. Contacts are stored encrypted, and the watchtower is self-hostable. Safety does not depend on it (I4). It exists for *speed of warning*.

### 7.4 Storage

Bundles live on IPFS (Pinata for the demo). Owner and guardian clients keep a local copy in IndexedDB and can re-pin. Since bundles are ciphertext, letting guardians pin them costs nothing in privacy.

### 7.5 Walk-away recovery kit (I5)

At setup each beneficiary gets a printable **Recovery Card** (PDF + QR) with: chain ID, contract address, vault ID, and the **IPFS CID of a static recovery app**. With the card, their passkey, and any wallet, they can complete recovery even if Heirloom's domain, relayer, watchtower and pinning are all gone. Because the CID is content-addressed, the code they run is provably the code that was audited.

---

## 8. Failure handling matrix (Relayer, Watchtower, Pinning & Company Gone)

| Failure | Detection | Response |
|---|---|---|
| Relayer down or censoring | Tx not mined | Direct submission from any wallet. |
| Watchtower down | – | Guardian clients poll the chain. Windows are sized to absorb missed notifications. |
| Pinning service down | CID unreachable | Owner and guardian local copies re-pin. |
| Heirloom company gone | – | Walk-away kit (§7.5). |

---

## 13. Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Chain | **Base Sepolia** | Cheap L2 with the P-256 precompile. Any EIP-7951/RIP-7212 chain works. |
| Contracts | Solidity, **Foundry**, OpenZeppelin 5.x (`WebAuthn`, `P256`, `EIP712`) | Fuzz/invariant tests, `vm.warp` for time. |
| Client | React + Vite, **viem/wagmi** | Team already knows React. |
| Passkeys | `ox` / `webauthn-p256` (wevm), WebAuthn PRF | P-256 signing + PRF-derived encryption keys. |
| Crypto | WebCrypto AES-GCM, **hpke-js** (RFC 9180), `@noble/hashes`, **`shamir-secret-sharing`** (Privy; audited by Cure53 and Zellic) | Audited primitives only. No home-made crypto. |
| Storage | IPFS via Pinata, IndexedDB local copies | |
| Services | Node + Express relayer, Node watchtower (viem `watchContractEvent`), Resend, Telegram Bot API, Web Push | |

---
