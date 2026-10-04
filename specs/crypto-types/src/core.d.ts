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
