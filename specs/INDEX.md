# Purpose: Master traceability index mapping architecture sections §0–§18 to specification files and line counts.
Depends on: specs/contract.md, specs/crypto.md, specs/client-ui.md, specs/services.md, specs/demo.md

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

## Architecture Section to Specification Mapping

| Section Number | Section Title | Target File(s) | Line Count (Source) |
|---|---|---|---|
| §0 | The pitch (60 seconds) | *(unplaced)* | 13 |
| §1 | Design invariants | `specs/contract.md`, `specs/crypto.md`, `specs/client-ui.md`, `specs/services.md`, `specs/demo.md` *(duplicated)* | 14 |
| §2 | Requirement traceability | *(unplaced)* | 14 |
| §3 | System overview | *(unplaced)* | 51 |
| §4 | Cryptographic core (all: 4.1–4.6) | `specs/crypto.md` | 70 |
| §5.1 | Signal classes | `specs/contract.md` | 10 |
| §5.2 | The release rule (computed lazily, no keeper) | `specs/contract.md` | 23 |
| §5.3 | Conditional access: example policies (one case, staged release) | `specs/contract.md` | 12 |
| §5.4 | State machine (per asset, derived, not stored) | `specs/contract.md`, `specs/client-ui.md` *(duplicated)* | 21 |
| §5.5 | Emergency intervention | `specs/contract.md`, `specs/client-ui.md` *(duplicated)* | 9 |
| §5.6 | Asymmetric policy timelock | `specs/contract.md`, `specs/client-ui.md` *(duplicated)* | 6 |
| §6 | Smart contract: `HeirloomRegistry` (all: 6.1–6.5) | `specs/contract.md` | 74 |
| §7.1 | Heirloom Client (React + Vite PWA) | `specs/client-ui.md` | 4 |
| §7.2 | Relayer (Node, stateless) | `specs/services.md` | 4 |
| §7.3 | Watchtower (Node) | `specs/services.md` | 4 |
| §7.4 | Storage | `specs/services.md` | 4 |
| §7.5 | Walk-away recovery kit (I5) | `specs/services.md` | 6 |
| §8 | Failure handling matrix | `specs/contract.md` (contract/relayer rows), `specs/crypto.md` (guardians/shares/drills rows), `specs/services.md` (relayer/watchtower/pinning/company rows) *(duplicated / split)* | 20 |
| §9 | Auditability and privacy | `specs/client-ui.md` | 11 |
| §10 | Threat model | `specs/contract.md` | 17 |
| §11 | Considered and rejected (and why) | *(unplaced)* | 18 |
| §12 | Prior art and how we differ | `specs/demo.md` | 12 |
| §13 | Tech stack | `specs/services.md` | 14 |
| §14 | Build plan | `specs/client-ui.md` | 24 |
| §15 | Demo script (each scenario proves an invariant) | `specs/demo.md` | 15 |
| §16 | Judge Q&A (prepared answers) | `specs/demo.md` | 28 |
| §17 | Residual risks and future work | `specs/demo.md` | 9 |
| §18 | References | *(unplaced)* | 16 |

---

## Unplaced Sections

The following sections from `Heirloom_Architecture.md` were not assigned to any specific spec file according to the partitioning instructions:

- **§0. The pitch (60 seconds)** (lines 7–19, 13 lines)
- **§2. Requirement traceability** (lines 34–47, 14 lines)
- **§3. System overview** (lines 48–98, 51 lines)
- **§11. Considered and rejected (and why)** (lines 398–415, 18 lines)
- **§18. References** (lines 518–533, 16 lines)

---

## Target Specification Files Summary

| File | Purpose | Line Count |
|---|---|---|
| `specs/contract.md` | Smart contract specification (`HeirloomRegistry`), release policies, state machine, on-chain failure handling, and threat model | 200 |
| `specs/crypto.md` | Cryptographic core specifications: key hierarchy, asset sealing, threshold sharing, share integrity, and guardian lifecycle | 97 |
| `specs/client-ui.md` | Client UI/PWA specification, asset state machine, emergency intervention mechanisms, audit trail, and engineering build plan | 92 |
| `specs/services.md` | Off-chain infrastructure services: stateless relayer, event-driven watchtower, decentralized IPFS storage, and walk-away recovery kit | 59 |
| `specs/demo.md` | Demonstration scenarios, competitive landscape comparison, live demo validation script, judge defense Q&A, and residual risks | 80 |
| `specs/INDEX.md` | Master section-to-file traceability matrix, duplication index, and unplaced sections log | 66 |


Sections §0, §2, §3, §11, §18 are in specs/overview.md.
