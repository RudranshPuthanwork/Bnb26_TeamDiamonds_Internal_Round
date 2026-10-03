# Purpose: Demonstration scenarios, competitive landscape comparison, live demo validation script, judge defense Q&A, and residual risks.
Depends on: specs/contract.md, specs/crypto.md, specs/client-ui.md, specs/services.md

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

## 12. Prior art and how we differ

| | Single signal? | Single platform trusted? | Guardians alone can decrypt? | Owner veto window | Per-asset conditions | Survives vendor shutdown |
|---|---|---|---|---|---|---|
| Apple Legacy Contact | Yes (death cert) | Apple | n/a | No | No | No |
| Bitwarden Emergency Access | Yes (wait timer) | Bitwarden | n/a | Yes | Per contact | No |
| Sarcophagus | Yes (missed re-wrap) | No (node network) | n/a | Re-wrap | Per file | Yes |
| Vault12 Inheritance | Beneficiary activates + guardians | Partly | Yes | – | Whole vault | Partly |
| **Heirloom** | **No (2–3 classes)** | **No** | **No (split-knowledge)** | **Yes, 1 tap** | **Yes, staged** | **Yes (walk-away kit)** |

---

## 15. Demo script (each scenario proves an invariant)

| # | Scenario | Proves |
|---|---|---|
| 1 | Owner dies → 3 guardians attest + co-attest certificate hash → medical records release first, letters later, seed phrase last → beneficiary decrypts | Staged conditional access, I2 |
| 2 | Owner is alive; beneficiary persuades 3 guardians to attest falsely → owner gets a Telegram alert → one tap → everything resets | I2, I3 |
| 3 | Attestations filed while heartbeats are fresh → `isReleasable == false` | No griefing |
| 4 | Show that 3 guardians' shares combined give garbage without `K_b` | I1 |
| 5 | One guardian offline + one submits a corrupted share → flagged, recovery still succeeds with the remaining 3 | Failure handling, attribution |
| 6 | Guardian disputes → clock frozen → 4 fresh attestations override → resumes | Intervention without permanent loss |
| 7 | Queue a beneficiary change from "stolen" owner device → guardians alerted → owner revokes | Asymmetric timelock |
| 8 | Kill relayer + watchtower + pinning → recover from the IPFS recovery page with a plain wallet | I4, I5 |

---

## 16. Judge Q&A (prepared answers)

**"Why does this need a blockchain?"**
Because otherwise our server decides when your secrets are released, and that makes us the single administrator the PS forbids. The chain is a neutral clock and rulebook nobody can edit, including us, plus a public audit log. It holds no secrets.

**"How do you know someone is actually dead?"**
No system *knows*. Apple trusts a document, and timers trust silence. We require independent signal classes to agree (owner silence **and** independent people) and then wait out a window the owner can veto. Documents are optional extra evidence, because digitised certificates have known fraud problems.

**"What if guardians and the beneficiary collude?"**
Through the protocol, the owner is alerted at the first attestation and can wipe it. Off-protocol collusion of beneficiary + *t* guardians is our honest residual risk. We raise the bar with the beneficiary ≠ guardian rule and guardian blindness, and Layer 3 (TACo) removes it entirely.

**"Owner is in a coma for two months?"**
Per-asset policy. Medical records can release on INCAPACITATED within days. The seed phrase requires DECEASED + co-attested evidence + 30 days. On waking, one tap cancels everything not yet released, and the app lists what to rotate.

**"My grandmother doesn't have MetaMask."**
She doesn't need it. She uses a passkey (fingerprint/Face ID), the contract verifies it natively with the P-256 precompile, encryption keys come from the same passkey via PRF, and our relayer pays gas without being able to forge anything.

**"What if your startup shuts down?"**
The Recovery Card points to an IPFS-hosted static app, the contract and IPFS. No Heirloom server is needed.

**"Can a single guardian hold the family hostage?"**
They can delay once per epoch. A larger quorum overrides them.

**"What about gas?"**
Every action is a single L2 transaction, so the cost is negligible, and the relayer covers it for users.

---

## 17. Residual risks and future work

- Off-protocol beneficiary + *t* guardians collusion, closed by Layer 3 (TACo condition-gated `K_b`).
- Post-quantum: AES-256 is fine. X25519/P-256 are not PQ-safe, so the path is hybrid HPKE with ML-KEM once browser support lands.
- Legal: produce an audit export format usable by executors. The legal treatment of digital assets in Indian succession is still evolving, so we position Heirloom as access infrastructure.
- Formal verification of the release rule (it is small enough for Certora/Halmos-style property checks).

---
