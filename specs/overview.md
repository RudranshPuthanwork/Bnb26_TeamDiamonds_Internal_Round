# Purpose: Pitch, requirement traceability, system overview, rejected options and references, copied verbatim.
Depends on: none

## 0. The pitch (60 seconds)

Every existing digital-inheritance product makes one of two bets. **Platform products** (Apple Legacy Contact, Google Inactive Account Manager, Bitwarden Emergency Access) ask you to trust the company, and they release your data on a **single signal**: a death certificate submitted to that company, or a timer running out. **Crypto products** (Sarcophagus, Vault12) remove the company, but they still rely on one signal (a missed check-in) or let a group of guardians decrypt on their own.

Heirloom is built on one idea: **a release needs two things that no single person controls.**

1. **Cryptographically**, the decryption key is split between the *guardians* and the *beneficiary*. Neither side can decrypt alone. That includes us.
2. **Procedurally**, a release needs *machine-observed silence* from the owner **and** a *human quorum* of guardians, held for a *cooling window* that the owner can cancel with one passkey tap.

An admin-less smart contract acts as referee and notary. It holds **no secrets**. It only decides *when* guardians are allowed to hand over their pieces, and it records everything. If Heirloom the company disappears tomorrow, heirs can still recover using a static recovery page and the chain.

---


## 2. Requirement traceability

| PS key feature | How Heirloom satisfies it | Section |
|---|---|---|
| **Secure Access Control** — no access before conditions are met | Asset key = `K_g ⊕ K_b`. Guardian shares of `K_g` are released only when the contract reports `isReleasable(asset) == true`. `K_b` alone is useless. | §4, §5.2 |
| **Unavailability Detection** — no single signal | Two independent signal classes are both required: passive (heartbeat lapse) and human (k-of-n guardian attestations). Optional third class: documentary evidence, which must be co-attested by 2 guardians. | §5.1 |
| **Recovery Authorization** — sufficient independent evidence | Per-asset `kAttest` quorum with allowed reason codes, optional evidence requirement, and a mandatory window. | §5.2–5.3 |
| **Emergency Intervention** — cancel during active recovery | Owner cancel (any owner action bumps the epoch and wipes attestations). Guardian **dispute** vote freezes the clock. Planned-absence mode. Asymmetric timelock on policy loosening. | §5.5–5.6 |
| **Conditional Access** — different conditions per asset or beneficiary | Each asset has its own policy: reasons, quorum, inactivity, window, evidence, primary and contingent beneficiary. One recovery case unlocks assets in **stages**. | §5.3 |
| **Failure Handling** — continue if a party is unresponsive | *t*-of-*n* with slack, guardian **readiness drills**, contingent beneficiary, dispute override, relayer and watchtower fallbacks, guardians co-pin storage. | §8 |
| **Auditability** — verifiable history | Every transition is an on-chain event signed by the acting party. An audit timeline UI and an exportable report reference tx hashes. Bad shares are attributable to the guardian who sent them. | §9 |

---


## 3. System overview

```
                         ┌────────────────────────────────────────────┐
                         │      HeirloomRegistry (Base, admin-less)    │
                         │  policies · heartbeats · attestations ·     │
                         │  disputes · released shares (encrypted) ·   │
                         │  share commitments · events = audit log     │
                         └───────▲───────────────▲──────────────▲──────┘
        signed actions (passkey) │               │              │ events
                                 │               │              │
┌────────────────┐     ┌─────────┴──────┐        │      ┌───────┴────────┐
│ Heirloom Client│────►│  Relayer       │        │      │  Watchtower    │
│ (React PWA)    │     │  pays gas only │        │      │  notifications │
│ Owner/Guardian/│     │  can't forge   │        │      │  email/Telegram│
│ Beneficiary    │     └────────────────┘        │      │  /web-push     │
│ ALL crypto     │──────── direct tx fallback ───┘      └────────────────┘
│ runs here      │
└───────┬────────┘
        │ encrypted bundles only
┌───────▼────────┐
│ IPFS (pinned by│   ciphertext of assets, HPKE-encrypted shares,
│ us + owner +   │   HPKE-encrypted K_b — never plaintext
│ guardians)     │
└────────────────┘
```

**Trust level of each component**

| Component | If it is malicious | If it is offline |
|---|---|---|
| Contract | Can't be. Immutable, no admin key, no upgrade proxy. | Inherits L2 liveness. |
| Relayer (ours) | Can **censor**, cannot forge. Every payload is passkey-signed with a nonce. | Users submit directly from any wallet. |
| Watchtower (ours) | Can stay silent. Safety does not depend on it, only how fast people are warned. | Guardian clients also watch the chain. Windows are long enough to absorb this. |
| IPFS pinning (ours) | Sees ciphertext only. | Owner and guardian clients keep and re-pin bundles. |
| Client app | The trusted computing base. Shipped as an IPFS-hosted static build, so its integrity can be checked by CID. | n/a |

**On-chain vs off-chain**

| On-chain (public, permanent) | Off-chain (encrypted) |
|---|---|
| Key *hashes* of participants, thresholds, windows, reason masks | Asset contents, names, contact details |
| Heartbeat timestamp (day-granular) and epoch | Plaintext shares (never exist outside a participant's device) |
| Attestations: reason code + evidence *hash* | Evidence documents (encrypted to guardians only) |
| Share commitments `H(s_i ‖ r_i ‖ …)` | |
| Released shares, already HPKE-encrypted to the beneficiary | |

> **Why a blockchain at all?** Without it, *our server* would be the administrator that decides when a release happens, which is exactly what the problem statement forbids. The chain gives us a neutral clock, rules nobody can quietly change (including us), a tamper-evident log, and survival beyond the company. It does **not** store secrets. Everything on a public chain is public, so the chain is the referee, not the vault.

---


## 11. Considered and rejected (and why)

| Option | Why we didn't use it |
|---|---|
| **Inactivity timer only** (Sarcophagus-style, Bitwarden-style) | A single signal, which the PS explicitly calls out. Hospitalisation or a lost phone triggers premature disclosure. |
| **Guardians alone reconstruct** (Vault12-style) | *t* guardians can decrypt without anyone else. This violates I1. |
| **Death-certificate upload to us** (Apple-style) | Makes us the single administrator, and documents can be forged. |
| **Store secrets "in" the contract** | Contract storage is public. Contracts can't keep secrets. |
| **Feldman / Pedersen VSS** | Solves the dishonest-dealer problem, which we don't have (§4.5). |
| **drand timelock encryption (tlock)** | Encrypts to a *fixed future date*. Death is not scheduled, and our window starts dynamically. |
| **Arweave for ciphertext** | Permanent storage conflicts with re-keying. Old versions should be unpinnable. |
| **Initiation bonds / staking** | Unnecessary. Recovery can't start while the owner is active (§5.2), so there's nothing to grief. |
| **Separate "executor" veto role** | Redundant with the guardian dispute vote. |
| **Upgradeable proxy** | An upgrade key is an admin who could rewrite the rules. |
| **TACo / threshold network as the main gate** | Strong, but testnet access needs an allow-listed ritual ID, which is a hackathon risk. Kept as **optional Layer 3**: encrypt `K_b` under a TACo condition `isReleasable(asset) == true`. That makes even beneficiary + *t* guardians collusion fail without the network. |

---


## 18. References

- Vault12 Digital Inheritance — https://vault12.com/blog/crypto-inheritance-vault12/
- Sarcophagus (decentralised dead-man's switch) — https://dapps.alchemy.com/dapps/sarcophagus
- Bitwarden Emergency Access — https://bitwarden.com/help/request-and-grant-emergency-access/
- Apple Legacy Contact — https://support.apple.com/en-gb/102631
- Threshold Access Control (TACo) key concepts — https://docs.threshold.network/applications/threshold-access-control/key-concepts
- TACo testnet quickstart (ritual ID / allow-list) — https://docs.threshold.network/app-development/threshold-access-control-tac/quickstart-testnet
- EIP-7951 (P-256 precompile, supersedes RIP-7212) — https://eips.ethereum.org/EIPS/eip-7951
- OpenZeppelin WebAuthn smart accounts — https://docs.openzeppelin.com/contracts/5.x/learn/webauthn-smart-accounts
- WebAuthn PRF extension overview (2026) — https://www.corbado.com/blog/passkeys-prf-webauthn
- Privy `shamir-secret-sharing` (audited) — https://npmjs.com/package/shamir-secret-sharing
- Social recovery pattern, recovery windows — https://ethsystems.org/patterns/pattern-social-recovery/
- Vitalik Buterin on choosing guardians — https://vitalik.eth.limo/general/2021/01/11/recovery.html
- RBD (Amendment) Act 2023 / CRS digitisation — https://laex.in/prelims-fact-sheet/centralised-civil-registration-system-crs-portal/
- RGI stricter verification of digitised records (July 2026) — https://superkalam.com/current-affairs/18-07-2026/govt-orders-strict-scrutiny-of-digitised-birth-death-records-pg12-ea3da73f-0c48-441c-91c1-f4be5d6b3034

