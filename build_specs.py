import os

source_path = r'd:/Heirloom/docs/Heirloom_Architecture.md'
with open(source_path, 'r', encoding='utf-8') as f:
    orig_lines = f.readlines()

def get_slice(start, end):
    # 1-indexed, inclusive
    return ''.join(orig_lines[start-1:end])

invariants_block = """## 1. Design invariants

Every component below exists to enforce one of these five invariants. Each item in the demo proves one of them.

| # | Invariant | Enforced by |
|---|---|---|
| **I1** | No single party can decrypt: not Heirloom, not one guardian, not *t* guardians, not the beneficiary. | Split-knowledge key (§4) |
| **I2** | No single signal can start a release. Release needs owner silence **and** a guardian quorum **and** an elapsed window. | Release rule (§5.2) |
| **I3** | While the owner is alive, the owner always wins. One tap cancels everything not yet released. | Epoch reset (§5.5) |
| **I4** | Correctness never depends on our servers or a bot. State is computed lazily from timestamps and signatures. | Keeper-free contract (§6) |
| **I5** | Heirs can recover even if Heirloom shuts down. | Walk-away recovery kit (§7.5) |
"""

# 1. contract.md
# §1 invariants, §5 (all), §6 (all), §8 rows about contract/relayer, §10 threat model
contract_content = """# Purpose: Smart contract specification (`HeirloomRegistry`), release policies, state machine, on-chain failure handling, and threat model.
Depends on: specs/crypto.md

""" + invariants_block + "\n---\n\n" + get_slice(169, 250) + "\n" + get_slice(252, 324) + "\n" + """## 8. Failure handling matrix (Contract & Relayer)

| Failure | Detection | Response |
|---|---|---|
| Beneficiary dead or absent | `claimDeadline` passes | Contingent beneficiary becomes claimant. |
| One guardian blocks via dispute | Dispute open | Overridable by `kAttest + 1` fresh attestations, so permanent loss is impossible from one actor. |
| Relayer down or censoring | Tx not mined | Direct submission from any wallet. |

---

""" + get_slice(381, 396)

# 2. crypto.md
# §4 (all), §1 invariants table, §8 rows about guardians/shares/drills
crypto_content = """# Purpose: Cryptographic core specifications: key hierarchy, asset sealing, threshold sharing, share integrity, and guardian lifecycle.
Depends on: None

""" + invariants_block + "\n---\n\n" + get_slice(99, 167) + "\n" + """## 8. Failure handling matrix (Guardians, Shares & Drills)

| Failure | Detection | Response |
|---|---|---|
| Guardian unresponsive at release | `submitShare` count < n | *t*-of-*n*. Default n=5, t=3 gives 2 spare. |
| Guardian silently lost their key over years | **Readiness drill** (see below) | Owner alerted when `slack = readyGuardians − t < 1`. Owner re-keys with a replacement. |
| Guardian submits a bad share | Commitment mismatch on the beneficiary client | Discard it, use another share, and attribute it to that guardian in the audit view. |
| Guardian dies before owner | Drill overdue | Same as above: replace and re-key while the owner is alive. |

**Readiness drill:** inspired by the practice of running two test recoveries a year with half the guardians each time. Twice a year, half of the guardians' clients prompt them to decrypt their stored share, recompute the commitment, and sign `drill(version)`. Nothing secret leaves the device. This turns "are my guardians still able to help?" into a **measured number** on the owner's dashboard instead of a hope.
"""

# 3. client-ui.md
# §5.4 state machine, §5.5, §5.6, §7.1, §9, §14 build plan
client_ui_content = """# Purpose: Client user interface specification, asset state machine, emergency intervention mechanisms, audit trail, and engineering build plan.
Depends on: specs/contract.md, specs/crypto.md

""" + invariants_block + "\n---\n\n" + get_slice(216, 235) + "\n" + get_slice(237, 244) + "\n" + get_slice(246, 249) + "\n" + get_slice(328, 330) + "\n---\n\n" + get_slice(370, 379) + "\n" + get_slice(442, 464)

# 4. services.md
# §7.2 to §7.5, §8 rows about relayer/watchtower/pinning/company gone, §13 tech stack
services_content = """# Purpose: Off-chain infrastructure services: stateless relayer, event-driven watchtower, decentralized IPFS storage, and walk-away recovery kit.
Depends on: specs/contract.md, specs/crypto.md

""" + invariants_block + "\n---\n\n" + get_slice(332, 348) + "\n" + """## 8. Failure handling matrix (Relayer, Watchtower, Pinning & Company Gone)

| Failure | Detection | Response |
|---|---|---|
| Relayer down or censoring | Tx not mined | Direct submission from any wallet. |
| Watchtower down | – | Guardian clients poll the chain. Windows are sized to absorb missed notifications. |
| Pinning service down | CID unreachable | Owner and guardian local copies re-pin. |
| Heirloom company gone | – | Walk-away kit (§7.5). |

---

""" + get_slice(428, 440)

# 5. demo.md
# §12, §15, §16, §17
demo_content = """# Purpose: Demonstration scenarios, competitive landscape comparison, live demo validation script, judge defense Q&A, and residual risks.
Depends on: specs/contract.md, specs/crypto.md, specs/client-ui.md, specs/services.md

""" + invariants_block + "\n---\n\n" + get_slice(416, 426) + "\n" + get_slice(466, 479) + "\n" + get_slice(481, 507) + "\n" + get_slice(509, 516)

os.makedirs(r'd:/Heirloom/specs', exist_ok=True)
files = {
    'contract.md': contract_content,
    'crypto.md': crypto_content,
    'client-ui.md': client_ui_content,
    'services.md': services_content,
    'demo.md': demo_content,
}

for name, content in files.items():
    p = os.path.join(r'd:/Heirloom/specs', name)
    clean_content = content.strip() + '\n'
    with open(p, 'w', encoding='utf-8') as out:
        out.write(clean_content)
    print(f'Wrote {name} ({len(clean_content.splitlines())} lines)')
