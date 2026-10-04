# Heirloom interfaces (frozen at tag interfaces-v1)

Changes after this point need a change note in specs/decisions-log.md and a new tag.
Do not import @heirloom/crypto/testing outside tests.

## 1. HeirloomRegistry (Solidity interface)
```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

library HeirloomRegistry {
    type AuthKind is uint8;
    type KeyKind is uint8;
    type Status is uint8;

    struct AssetPolicy {
        uint8 reasonsMask;
        uint8 kAttest;
        bool requireEvidence;
        uint32 minInactivity;
        uint32 window;
        uint32 claimDeadline;
        bytes32 primaryBenef;
        bytes32 contingentBenef;
        bytes32 bundleCid;
        uint16 version;
        bytes32[] shareCommitments;
    }

    struct Auth {
        AuthKind kind;
        address signer;
        uint256 nonce;
        uint256 deadline;
        bytes sig;
    }
}

interface IHeirloomRegistry {
    type Reason is uint8;

    error AlreadyClaimed();
    error AlreadyDisputed();
    error AssetExists();
    error AttestationLocked();
    error BadAuth();
    error BadBounds();
    error BadNonce();
    error BadPolicy();
    error BadReason();
    error BadShare();
    error BeneficiaryIsGuardian();
    error DuplicateGuardian();
    error Expired();
    error InvalidShortString();
    error NoAsset();
    error NoShares();
    error NoVault();
    error NotAuthorized();
    error NotClaimant();
    error NotImplemented();
    error NotReleasable();
    error ShareExists();
    error StringTooLong(string str);

    event AbsenceSet(bytes32 indexed vaultId, uint40 until);
    event AssetAdded(bytes32 indexed vaultId, bytes32 indexed assetId, bytes32 primaryBenef, bytes32 bundleCid);
    event Attested(bytes32 indexed vaultId, uint8 indexed guardian, Reason reason, bytes32 evidenceHash);
    event Cancelled(bytes32 indexed vaultId, uint32 epoch);
    event ChangeApplied(bytes32 indexed vaultId, bytes32 indexed changeId);
    event ChangeQueued(bytes32 indexed vaultId, bytes32 indexed changeId, uint40 applyAfter);
    event ChangeRevoked(bytes32 indexed vaultId, bytes32 indexed changeId);
    event Claimed(bytes32 indexed vaultId, bytes32 indexed assetId, bytes32 claimant);
    event DisputeOverridden(bytes32 indexed vaultId, uint40 resumeAt);
    event Disputed(bytes32 indexed vaultId, uint8 indexed guardian, uint32 epoch);
    event DrillPassed(bytes32 indexed vaultId, uint8 indexed guardian, uint16 version);
    event EIP712DomainChanged();
    event Heartbeat(bytes32 indexed vaultId, uint32 epoch);
    event Rekeyed(bytes32 indexed vaultId, bytes32 indexed assetId, uint16 version);
    event ShareSubmitted(bytes32 indexed vaultId, bytes32 indexed assetId, uint8 guardian);
    event VaultCreated(bytes32 indexed vaultId, bytes32 owner0, bytes32 owner1, uint8 guardians, uint8 t);

    function ACTION_TYPEHASH() external view returns (bytes32);
    function MAX_GUARDIANS() external view returns (uint256);
    function SHARE_LEN() external view returns (uint256);
    function TIME_UNIT() external view returns (uint256);
    function addAsset(
        bytes32 vaultId,
        bytes32 assetId,
        HeirloomRegistry.AssetPolicy memory policy,
        HeirloomRegistry.Auth memory auth
    ) external;
    function applyChange(bytes32 vaultId, bytes32 changeId, HeirloomRegistry.Auth memory auth) external;
    function attest(bytes32 vaultId, Reason reason, bytes32 evidenceHash, HeirloomRegistry.Auth memory auth) external;
    function cancel(bytes32 vaultId, HeirloomRegistry.Auth memory auth) external;
    function claimContingent(bytes32 vaultId, bytes32 assetId, HeirloomRegistry.Auth memory auth) external;
    function createVault(
        bytes32[2] memory owners,
        bytes32[] memory guardians,
        uint8 t,
        uint32 policyDelay,
        HeirloomRegistry.Auth memory auth
    ) external returns (bytes32 vaultId);
    function currentClaimant(bytes32 vaultId, bytes32 assetId) external view returns (bytes32);
    function dispute(bytes32 vaultId, HeirloomRegistry.Auth memory auth) external;
    function drill(bytes32 vaultId, uint16 version, HeirloomRegistry.Auth memory auth) external;
    function eip712Domain()
        external
        view
        returns (
            bytes1 fields,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            bytes32 salt,
            uint256[] memory extensions
        );
    function getAsset(bytes32 vaultId, bytes32 assetId)
        external
        view
        returns (HeirloomRegistry.AssetPolicy memory policy, bool released, bool claimed);
    function getAttestation(bytes32 vaultId, uint8 guardianIndex)
        external
        view
        returns (Reason reason, uint40 at, bytes32 evidenceHash);
    function getPendingChange(bytes32 vaultId, bytes32 changeId)
        external
        view
        returns (uint8 kind, bytes memory data, uint40 applyAfter, bool exists);
    function getShare(bytes32 vaultId, bytes32 assetId, bytes32 claimantKeyId, uint8 guardianIndex)
        external
        view
        returns (bytes memory);
    function getVault(bytes32 vaultId)
        external
        view
        returns (
            bytes32[2] memory owners,
            bytes32[] memory guardians,
            uint8 t,
            uint32 policyDelay,
            uint32 epoch,
            uint40 lastHeartbeat,
            uint40 absentUntil,
            uint40 disputedAt,
            uint32 disputeEpoch,
            uint8 disputer
        );
    function guardianIndex(bytes32 vaultId, bytes32 keyId_) external view returns (bool found, uint8 index);
    function heartbeat(bytes32 vaultId, HeirloomRegistry.Auth memory auth) external;
    function isReleasable(bytes32 vaultId, bytes32 assetId) external view returns (bool);
    function keyId(HeirloomRegistry.KeyKind kind, bytes32 a, bytes32 b) external pure returns (bytes32);
    function lastDrill(bytes32 vaultId, uint8 guardianIndex) external view returns (uint16 version, uint40 at);
    function markClaimed(bytes32 vaultId, bytes32 assetId, HeirloomRegistry.Auth memory auth) external;
    function nonces(bytes32 keyId) external view returns (uint256);
    function queueChange(
        bytes32 vaultId,
        bytes32 changeId,
        uint8 kind,
        bytes memory data,
        HeirloomRegistry.Auth memory auth
    ) external;
    function readyGuardians(bytes32 vaultId, uint16 version) external view returns (uint8 ready);
    function rekey(
        bytes32 vaultId,
        bytes32 assetId,
        uint16 version,
        bytes32 newBundleCid,
        bytes32[] memory newCommitments,
        HeirloomRegistry.Auth memory auth
    ) external;
    function revokeChange(bytes32 vaultId, bytes32 changeId, HeirloomRegistry.Auth memory auth) external;
    function setAbsence(bytes32 vaultId, uint40 until, HeirloomRegistry.Auth memory auth) external;
    function status(bytes32 vaultId, bytes32 assetId) external view returns (HeirloomRegistry.Status);
    function submitShare(
        bytes32 vaultId,
        bytes32 assetId,
        bytes32 claimantKeyId,
        bytes memory encShare,
        HeirloomRegistry.Auth memory auth
    ) external;
    function timeline(bytes32 vaultId, bytes32 assetId)
        external
        view
        returns (
            uint256 tSilence,
            uint256 tQuorum,
            uint256 resumeAt,
            uint256 tOpen,
            uint256 opensAt,
            uint8 attestationsFiled,
            uint8 kAttest,
            bool disputed,
            uint256 claimDeadline
        );
    function vaultCount() external view returns (uint256);
}
```

## 2. Enums (member order is the on-chain value)
```solidity
enum KeyKind {
        EOA,
        P256
    }
enum AuthKind {
        DIRECT,
        EOA_SIG,
        P256
    }
enum Role {
        Any,
        Owner,
        Guardian
    }
enum Action {
        CreateVault,
        AddAsset,
        Heartbeat,
        Cancel,
        SetAbsence,
        QueueChange,
        ApplyChange,
        RevokeChange,
        Attest,
        Dispute,
        SubmitShare,
        MarkClaimed,
        Drill,
        Rekey,
        ClaimContingent
    }
enum Status {
        Sealed,
        Armed,
        Silent,
        Cooling,
        Disputed,
        Releasable,
        ContingentEligible,
        Claimed
    }
```

## 2b. Reason (member order is the on-chain value)
```solidity
enum Reason {
    NONE,
    INCAPACITATED,
    DECEASED,
    MISSING
}
```

## 3. @heirloom/crypto (public API types)

Import ONLY from '@heirloom/crypto' (index.d.ts). core.d.ts is listed for its types; Rng, b64u and the *With functions are internal and must never be imported by apps or services.

### core.d.ts
```ts
/** 0x-prefixed 32-byte hex. */
export type Hex32 = `0x${string}`;
/** Random source. Only reachable through src/testing.ts (D15), never the public index. */
export type Rng = (n: number) => Uint8Array;
/** D1 identity card: signing key (kind/a/b) plus X25519 encryption pubkey. kind: EOA=0, P256=1. */
export interface IdentityCard {
    kind: 0 | 1;
    a: Hex32;
    b: Hex32;
    encPk: Uint8Array;
}
export interface Identity {
    encSk: Uint8Array;
    encPk: Uint8Array;
}
export interface Ctx {
    vaultId: Hex32;
    assetId: Hex32;
    version: number;
}
/** Context for share re-encryption: adds the claimant's keyId (D10 info). */
export interface ClaimantCtx extends Ctx {
    claimantKeyId: Hex32;
}
/** D12 bundle. Binary fields are base64url. Key order is fixed by construction. */
export interface Bundle {
    v: "heirloom.bundle.v1";
    vaultId: Hex32;
    assetId: Hex32;
    version: number;
    C: string;
    guardians: {
        i: number;
        keyId: Hex32;
        enc: string;
    }[];
    beneficiaries: {
        keyId: Hex32;
        enc: string;
    }[];
    participants: {
        guardians: WireCard[];
        beneficiaries: WireCard[];
    };
}
export interface WireCard {
    kind: 0 | 1;
    a: Hex32;
    b: Hex32;
    encPk: string;
}
export interface SealInput extends Ctx {
    plaintext: Uint8Array;
    guardians: IdentityCard[];
    t: number;
    beneficiaries: IdentityCard[];
}
export type RekeyInput = Omit<SealInput, "guardians" | "beneficiaries"> & {
    newGuardians: IdentityCard[];
    newBeneficiaries: IdentityCard[];
};
export interface Opened {
    share: Uint8Array;
    salt: Uint8Array;
    index: number;
}
export interface Submission {
    guardianIndex: number;
    enc: Uint8Array;
}
export interface Rejected {
    guardianIndex: number;
    reason: string;
}
export declare class ReconstructError extends Error {
    rejected: Rejected[];
    constructor(msg: string, rejected?: Rejected[]);
}
export declare const b64u: (b: Uint8Array) => string;
export declare const unb64u: (s: string) => Uint8Array<ArrayBuffer>;
/** D1: keccak256(abi.encode(kind, a, b)). */
export declare const keyIdOf: (c: Pick<IdentityCard, "kind" | "a" | "b">) => Hex32;
/**
 * New X25519 identity. `encSk` is a 32-byte seed; the keypair is RFC 9180 DeriveKeyPair(seed),
 * so a WebAuthn-PRF-derived seed (Phase 6) drops in unchanged.
 */
export declare function generateIdentityWith(rng?: Rng): Promise<Identity>;
/** Seal an asset (4.2). Returns the bundle and the on-chain commitments commit_1..commit_n. */
export declare function sealAssetWith(a: SealInput, rng?: Rng): Promise<{
    bundle: Bundle;
    commitments: Hex32[];
}>;
/** Guardian decrypts own `s_i || r_i` from the bundle. Throws if it is not theirs or was tampered. */
export declare function guardianOpenShare(bundle: Bundle, myIndex: number, mySk: Uint8Array): Promise<Opened>;
/** 4.3 step 1: re-encrypt an opened share to the claimant. 113 bytes = enc(32) || ct(65+16). */
export declare function guardianReencrypt(opened: Opened, claimantEncPk: Uint8Array, ctx: ClaimantCtx): Promise<Uint8Array>;
/** True iff the D9 commitment of (share, salt, ctx, i) equals `commitment` (constant-time compare). */
export declare function verifyShare(commitment: Hex32, share: Uint8Array, salt: Uint8Array, ctx: Ctx, i: number): boolean;
/**
 * Beneficiary side (4.3 step 2). Each submission is HPKE-opened and commitment-checked; bad ones land in
 * `rejected`. The first `t` valid distinct shares are combined. `expect` (required) pins the
 * vault/asset/version the caller believes it is opening. Throws ReconstructError (carrying `rejected`)
 * if fewer than t valid shares exist or the GCM tag fails.
 */
export declare function beneficiaryReconstruct(a: {
    bundle: Bundle;
    mySk: Uint8Array;
    submissions: Submission[];
    commitments: Hex32[];
    t: number;
    expect: Ctx;
}): Promise<{
    plaintext: Uint8Array;
    usedIndexes: number[];
    rejected: Rejected[];
}>;
/** Readiness drill (8): decrypt own share and recompute the commitment. Only a boolean leaves. */
export declare function drillCheck(bundle: Bundle, myIndex: number, mySk: Uint8Array, commitment: Hex32, expect: Ctx): Promise<boolean>;
/** 4.6 full re-key: fresh DEK, halves, shares, IV; version+1. `version` is the OLD version. */
export declare function rekeyAssetWith(a: RekeyInput, rng?: Rng): Promise<{
    bundle: Bundle;
    commitments: Hex32[];
}>;

```

### index.d.ts
```ts
import { type RekeyInput, type SealInput } from "./core.js";
export { beneficiaryReconstruct, drillCheck, guardianOpenShare, guardianReencrypt, keyIdOf, ReconstructError, verifyShare, } from "./core.js";
export type { Bundle, ClaimantCtx, Ctx, Hex32, Identity, IdentityCard, Opened, RekeyInput, Rejected, SealInput, Submission, WireCard, } from "./core.js";
export declare const generateIdentity: () => Promise<import("./core.js").Identity>;
export declare const sealAsset: (a: SealInput) => Promise<{
    bundle: import("./core.js").Bundle;
    commitments: import("./core.js").Hex32[];
}>;
export declare const rekeyAsset: (a: RekeyInput) => Promise<{
    bundle: import("./core.js").Bundle;
    commitments: import("./core.js").Hex32[];
}>;

```
