# Purpose: Cryptographic core specifications: key hierarchy, asset sealing, threshold sharing, share integrity, and guardian lifecycle.
Depends on: None

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

## 4. Cryptographic core

### 4.1 Participant keys (no seed phrases)

Every participant (owner, guardians, beneficiaries) has **one passkey** and gets two keys from it:

- **Signing key:** the passkey's native **P-256** key. The contract verifies WebAuthn assertions directly using the P-256 precompile (RIP-7212 on L2s, EIP-7951 on L1) through OpenZeppelin's `WebAuthn`/`P256` libraries, which fall back to a Solidity verifier on chains without the precompile.
- **Encryption key:** an **X25519** keypair derived from the passkey's **WebAuthn PRF** output with `HKDF-SHA256(prf, "heirloom-x25519-v1")`. Nothing is stored in browser storage. The key exists only after a biometric unlock.
- **Fallback** for authenticators without PRF: a device-generated X25519 key, exported once as a printable "Guardian Kit" QR.

Owners register **two passkeys** (primary + backup). Synced passkeys (iCloud Keychain / Google Password Manager) mean losing a phone does not lose a key.

### 4.2 Sealing an asset (owner device)

```
DEK          ← random 256-bit
C            ← AES-256-GCM(DEK, asset, AAD = vaultId‖assetId‖version)
K_b          ← random 256-bit                        # beneficiary half
K_g          ← DEK ⊕ K_b                             # guardian half
s_1..s_n     ← Shamir.split(K_g, n, t)               # GF(2^8), audited lib
r_i          ← random 256-bit salt per share
commit_i     ← keccak256(s_i ‖ r_i ‖ vaultId ‖ assetId ‖ version ‖ i)

bundle = {
  C,
  HPKE(pk_guardian_i, s_i ‖ r_i)      for i = 1..n,
  HPKE(pk_beneficiary_j, K_b)         for each eligible beneficiary (primary, contingent)
}
CID ← IPFS.add(bundle)
contract.addAsset(policy, CID, [commit_1..commit_n])
```

HPKE = RFC 9180 base mode (X25519, HKDF-SHA256, AES-256-GCM).

### 4.3 Release and reconstruction

1. When `isReleasable(asset)` is true, each guardian client decrypts its own `s_i ‖ r_i` and re-encrypts it to the current claimant's public key. It then calls `submitShare(asset, i, HPKE(pk_B, s_i ‖ r_i))`. The contract rejects this unless the asset is releasable, so the release itself becomes an auditable event.
2. The beneficiary client collects ≥ *t* shares and checks each one against `commit_i`. It combines them into `K_g`, decrypts `K_b` from the bundle, computes `DEK = K_g ⊕ K_b`, and opens `C`. The GCM tag verifies the whole chain end to end.
3. The beneficiary calls `markClaimed(asset)`.

### 4.4 Who can decrypt? (this is the I1 proof)

| Party / coalition | Has | Can decrypt? |
|---|---|---|
| Heirloom (servers, relayer, pinning) | Ciphertext only | ❌ |
| Any single guardian | 1 share | ❌ |
| Any *t* guardians colluding | `K_g` | ❌ missing `K_b` |
| Beneficiary alone | `K_b` | ❌ missing `K_g` |
| Beneficiary + *t* guardians, **through the protocol** | Both halves | ✅ only after silence + quorum + window, with the owner alerted at the first attestation |
| Beneficiary + *t* guardians, **off-protocol collusion** | Both halves | ⚠️ Residual risk, stated honestly. Mitigations in §10. |

**Rule enforced at setup:** a beneficiary of an asset **cannot also be a guardian of that asset**. If they could, the collusion bar would drop to *t − 1* other people. Vault12, for comparison, has the owner pick the beneficiary *from* the guardian group.

### 4.5 Share integrity: commitments, not Feldman VSS

The audited Shamir library we use does not verify reconstruction itself and leaves integrity checking to the caller. Our answer is per-share **hash commitments** written on-chain at setup:

- A garbage share from a faulty or malicious guardian is detected **before** combining. The beneficiary simply uses a different share.
- Because each submission is passkey-signed and each commitment is on-chain, the cheat is **attributable** to a specific guardian.

**Why not Feldman/Pedersen VSS?** VSS protects shareholders against a *dishonest dealer*. Here the dealer is the owner splitting their own secret, who has no reason to cheat. What we actually need is *share authenticity at reconstruction*, and hash commitments give exactly that, with far less complexity, in the same GF(2^8) field.

### 4.6 Re-keying (removing or replacing a guardian)

Re-splitting the *same* `K_g` is **not enough**. The removed guardian's old share still combines with other old shares. So any guardian or beneficiary change triggers a full **re-key**: new DEK, new halves, new shares, new ciphertext, `version++`, and the old CID is unpinned.

We are explicit about the limit: data that was already handed out cannot be cryptographically revoked. That is exactly why the split-knowledge design matters. A removed guardian who kept old shares *still* needs the beneficiary's old `K_b`. It is also why we use IPFS (unpinnable) rather than Arweave (permanent) for ciphertext.

### 4.7 Known limits

- **N4, plaintext length leaks.** `C` is the plaintext length plus 28 bytes (12 IV + 16 tag) and is stored publicly on IPFS. Its size reveals the plaintext length class (a 12-word seed phrase versus a PDF). We do not pad. Accepted for v1.
- **N5, re-key does not stop collusion over old data.** A re-key keeps the plaintext and guardian X25519 keys, so a retained guardian can re-derive their old share from any cached copy of the old bundle. A removed beneficiary plus *t* old-version guardians who kept the old bundle, colluding off-protocol, can still open the old `C`, which holds the current plaintext. Unpinning the old CID is the only defence.

---

## 8. Failure handling matrix (Guardians, Shares & Drills)

| Failure | Detection | Response |
|---|---|---|
| Guardian unresponsive at release | `submitShare` count < n | *t*-of-*n*. Default n=5, t=3 gives 2 spare. |
| Guardian silently lost their key over years | **Readiness drill** (see below) | Owner alerted when `slack = readyGuardians − t < 1`. Owner re-keys with a replacement. |
| Guardian submits a bad share | Commitment mismatch on the beneficiary client | Discard it, use another share, and attribute it to that guardian in the audit view. |
| Guardian dies before owner | Drill overdue | Same as above: replace and re-key while the owner is alive. |

**Readiness drill:** inspired by the practice of running two test recoveries a year with half the guardians each time. Twice a year, half of the guardians' clients prompt them to decrypt their stored share, recompute the commitment, and sign `drill(version)`. Nothing secret leaves the device. This turns "are my guardians still able to help?" into a **measured number** on the owner's dashboard instead of a hope.
