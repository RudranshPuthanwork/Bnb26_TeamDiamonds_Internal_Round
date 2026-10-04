I found one blocker. It breaks functionality; it doesn't leak anything. Its PoC test fails as expected; the other 34 tests pass (npx vitest run in packages/crypto).



B1 · blocker · src/index.ts:62 (b64u)

String.fromCharCode(...b) passes the whole buffer as function arguments. Anything over about 128 KiB throws RangeError: Maximum call stack size exceeded. I measured 64 KiB working and 128 KiB failing in Node 20. Because sealAsset base64-encodes C, no asset larger than about 128 KiB can be sealed. It fails closed, so nothing leaks, but most documents can't be sealed. PoC: test/review-poc.test.ts "B1".



Should-fix

\- S1 · :10, :74, :94, :106, :120. rng is an optional field on the public SealInput, rekeyAsset and generateIdentity. A production caller can pass it, and a seeded rng that gets reused produces the same DEK and the same IV. That is AES-GCM nonce reuse, plus repeated HPKE ephemeral keys. rekeyAsset passes rng through via ...rest, so it inherits the problem. Move test injection to a separate test-only entry point.

\- S2 · :199–200. seen.add(i) runs before the share is validated. If an invalid submission for index i comes first, a later valid one for i is rejected as "duplicate", so the result depends on submission order. The contract's write-once slot (D14) stops this on-chain, but not when a caller merges on-chain and off-chain sources. Mark an index as seen only after its commitment check passes.

\- S3 · :187, :207–209. t comes from the caller and isn't validated:

&#x20; - With t=1, combine throws a plain Error at :209 (outside the try), so the caller gets neither a ReconstructError nor the rejected list.

&#x20; - If t is lower than the real threshold, the combined key is garbage, the result is a generic "decryption failed", and the other valid shares are never tried.

&#x20; - Fix: require 2 ≤ t ≤ commitments.length and put combine inside the try.

\- S4 · :88–89, :174. commit doesn't check the share and salt lengths (33 and 32 bytes). Through the exported verifyShare, bytes can be moved between share and salt without changing the hash: (s‖r\[0], r\[1:]) hashes the same as (s, r). beneficiaryReconstruct is safe because it slices at fixed offsets; the exported function isn't. Assert the lengths inside commit.

\- S5 · :185, :188. expect is optional, so by default reconstruction trusts the vault, asset and version the bundle declares about itself. Splicing across assets or versions still fails, because the commitments and the HPKE info both bind the context. Still, the rollback guard depends on the caller fetching the commitments for the right version. Make expect required. Also compare lowercased hex, since today a mismatch in hex letter case (checksummed vs lowercase) wrongly rejects a valid bundle.

\- S6 · :133. The "a beneficiary cannot be a guardian" rule (§4.4) compares keyIds only. Two cards with different keyIds but the same encPk both pass, and that one X25519 key can then decrypt both a share and K\_b. Also reject duplicate encPk values across all participants.



Notes

\- N1 · Shamir (v0.0.4 in node\_modules).

&#x20; - Each share's x-coordinate is a random byte (shuffled, 1–255) appended as the last byte. It has nothing to do with the guardian index i.

&#x20; - D9 commits the full 33 bytes including x, so a share relabelled to another index fails the commitment check.

&#x20; - split rejects threshold < 2 and never uses x = 0.

&#x20; - combine rejects duplicate x values but accepts x = 0: a lone x = 0 share interpolates straight to its own y value, i.e. an attacker-chosen secret. The commitment check is the only thing stopping a forged share. Keep it mandatory.

&#x20; - The library uses its own CSPRNG, so the injected rng never reaches split.

\- N2 · HPKE.

&#x20; - The suite matches D10.

&#x20; - The info strings are a fixed 124 bytes, since all three purpose names are 14 bytes. There's no field ambiguity, and recipient, vault, asset and version are all bound.

&#x20; - enc is 32 bytes and the 113-byte length is asserted in the existing tests.

&#x20; - The library rejects low-order and all-zero X25519 keys: I tried sealing to the all-zero point and to u=1, and both threw EncapError.

&#x20; - Claimant shares don't bind the guardian index i in the HPKE info, but the commitment covers it.

\- N3 · IVs. A fresh 96-bit IV comes from crypto.getRandomValues for every encryption, stored as the first 12 bytes of C. Each DEK encrypts exactly once per version, so an IV can't repeat under one key unless S1 happens.

\- N4 · Plaintext length. C is the plaintext length plus 28 bytes and is stored publicly on IPFS. That leaks what kind of asset it is (a 12-word seed phrase versus a PDF). Either pad to size buckets or write down the leak as a known limit in crypto.md. I recommend writing it down at minimum.

\- N5 · Rekey and §4.6. The code matches the doc: fresh DEK, K\_b, shares, salts and IV, and version + 1. However, the plaintext is the same, and guardian X25519 keys never change. So any retained guardian can re-derive their old share from any cached copy of the old bundle; they don't need to have "kept" it. A removed beneficiary plus t old-version guardians, colluding off-protocol, can still open the old C, which is the current plaintext. Unpinning the old CID is the only defence. The doc should say this explicitly.

\- N6 · :211–214. kb and dek are only zeroed on success. Opened buffers in the loop and valid shares beyond the first t are never zeroed. This is best-effort in JS anyway.

\- N7 · Error messages. The rejected reasons (bad-ciphertext, bad-share, commitment-mismatch) are only visible to the key holder, who can already decrypt. GCM failure gives one generic "decryption failed". I found no remote oracle. Comparing the public commitment in constant time is harmless.

