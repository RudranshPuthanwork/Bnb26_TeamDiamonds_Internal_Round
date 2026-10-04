# Decisions the architecture leaves open

D1 Identity. On chain, a participant is `keyId = keccak256(abi.encode(kind, a, b))`. EOA: kind=EOA, a=address as bytes32, b=0. P-256: kind=P256, a=qx, b=qy. Off chain, an "identity card" (base64url JSON: kind, signing pubkey, X25519 encPk) is how a participant hands the owner their keys. The encPk's authenticity comes from the owner-chosen bundle CID (committed on chain), so guardian clients encrypt to the claimant's encPk taken from the bundle's participants list.
D2 Auth. Every state-changing function takes `Auth {kind: DIRECT|EOA_SIG|P256, signer, nonce, deadline, sig}`. DIRECT uses msg.sender. EOA_SIG checks an EIP-712 digest over {chainId, contract, vaultId, action, paramsHash, nonce, deadline}. P256 reverts `NotImplemented` until Phase 6, but the enum slot exists so the ABI never changes. Nonces are per keyId. Use OZ ECDSA (no raw ecrecover).
D3 Bounds. n ≤ 12 guardians. t ≤ n. kAttest ≤ n−1 so that kDispute = kAttest+1 ≤ n is always reachable.
D4 Dispute. Scoped to the epoch it was filed in (`disputeEpoch == epoch`). Override: count attestations in the current epoch with `at > disputedAt` and reason in the asset's mask; when that count reaches kDispute, `resumeAt` is the timestamp of the kDispute-th such attestation (computed lazily, not stored).
D5 Attestation changes. A guardian may re-attest in the same epoch only to raise INCAPACITATED→DECEASED or to add an evidenceHash. `at` resets to now on every change. No withdrawal.
D6 Evidence. With requireEvidence, `t_quorum` is the earliest time T at which ≥ kAttest valid attestations exist AND ≥ 2 of them share one non-zero evidenceHash.
D7 Time. All durations are stored as multiples of TIME_UNIT (uint32). `lastHeartbeat` = floor(now / TIME_UNIT) × TIME_UNIT. Do the arithmetic in uint256. Every owner action is a heartbeat and bumps the epoch, including addAsset.
D8 Shares. Stored per (assetId, claimantKeyId, guardianIndex). `submitShare` requires isReleasable and claimantKeyId == currentClaimant. A later cancel does not delete submitted shares (a release cannot be undone); the UI shows the rotate checklist.
D9 Commitment (client-only encoding). keccak256( "heirloom/commit/v1" ‖ s_i(33B, Shamir share incl. x byte) ‖ r_i(32B) ‖ vaultId(32B BE) ‖ assetId(32B) ‖ version(2B BE) ‖ i(1B) ).
D10 HPKE. DHKEM(X25519,HKDF-SHA256) / HKDF-SHA256 / AES-256-GCM, base mode. info = "heirloom/v1/" ‖ purpose ‖ vaultId ‖ assetId ‖ version ‖ recipientKeyId, with purpose ∈ {guardian-share, claimant-share, beneficiary-kb}. Share ciphertext = enc(32) ‖ ct(65+16) = 113 bytes. Assert that in tests.
D11 Phase 1 scope. Build all storage fields and the full release formula now. Implement `dispute()` and `setAbsence()` fully in Phase 1 (the review in 1c covers dispute override and the formula depends on both). These are `revert NotImplemented()` stubs until Phase 7: queueChange/applyChange/revokeChange, contingent claim path, drill, rekey. The ABI is therefore stable from Phase 3.
D12 Bundle. JSON `heirloom.bundle.v1`, base64url fields, fixed key order; contains C, per-guardian HPKE shares, per-beneficiary HPKE K_b, and a `participants` list of identity cards.
D13 Chain. Base Sepolia (84532). TIME_UNIT set in the constructor (86400 prod, 60 demo, 1 for anvil tests). Deploy address in `deployments/base-sepolia.json`.
R1 Open risk (decide at the Phase 6 spike). A passkey is bound to its rpId. The static recovery page on an IPFS gateway has a different origin, so a passkey created on the app's domain probably cannot sign or produce PRF output there. Fallback to evaluate: the beneficiary also holds an offline recovery key (EOA + X25519 secret, printed on the Recovery Card), with K_b encrypted to both.

D14 Amendments from review 1c (override D3/D4/D5/D8 where they conflict)
- kAttest ≤ n−1 stays. kDispute = min(kAttest+1, n−1). The disputer's index is stored with disputedAt and excluded from the override count.
- Re-affirm: if disputeEpoch == epoch and a guardian's existing attestation has at ≤ disputedAt, that guardian may re-file once (same or higher reason); at = now. Otherwise D5 stands.
- Latch: the first successful submitShare for an asset sets released[asset] = true. isReleasable and status return Releasable from then until claimed. Later disputes, cancels, heartbeats or attestation upgrades do not un-release it. A cancel still voids assets that have not latched.
- submitShare: write-once per (asset, claimant, guardian) slot; reverts after claimed.
- addAsset: reject reasonsMask with bit 0 set or above 0x0e; reject window == 0; reject claimDeadline == 0 when a contingent beneficiary is set.
- createVault: reject any zero keyId (owners, guardians, beneficiaries).
- Constructor: 1 ≤ TIME_UNIT ≤ 30 days.
- setAbsence: at most 365 units; setAbsence(0) clears it.
- markClaimed requires at least one submitted share for that claimant.
