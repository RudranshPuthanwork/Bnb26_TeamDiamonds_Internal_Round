// Heirloom crypto core (specs/crypto.md 4, decisions D1 D8 D9 D10 D12).
// Libraries: WebCrypto (AES-GCM, random), @hpke (RFC 9180), shamir-secret-sharing, @noble/hashes.
import { CipherSuite, Aes256Gcm, HkdfSha256 } from "@hpke/core";
import { DhkemX25519HkdfSha256 } from "@hpke/dhkem-x25519";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { combine, split } from "shamir-secret-sharing";

/** 0x-prefixed 32-byte hex. */
export type Hex32 = `0x${string}`;
/** Random source. Only reachable through src/testing.ts (D15), never the public index. */
export type Rng = (n: number) => Uint8Array;

/** D1 identity card: signing key (kind/a/b) plus X25519 encryption pubkey. kind: EOA=0, P256=1. */
export interface IdentityCard { kind: 0 | 1; a: Hex32; b: Hex32; encPk: Uint8Array }
export interface Identity { encSk: Uint8Array; encPk: Uint8Array }
export interface Ctx { vaultId: Hex32; assetId: Hex32; version: number }
/** Context for share re-encryption: adds the claimant's keyId (D10 info). */
export interface ClaimantCtx extends Ctx { claimantKeyId: Hex32 }

/** D12 bundle. Binary fields are base64url. Key order is fixed by construction. */
export interface Bundle {
  v: "heirloom.bundle.v1";
  vaultId: Hex32; assetId: Hex32; version: number;
  C: string; // iv(12) || AES-GCM ciphertext
  guardians: { i: number; keyId: Hex32; enc: string }[]; // HPKE(s_i||r_i), 113 bytes each
  beneficiaries: { keyId: Hex32; enc: string }[]; // HPKE(K_b)
  participants: { guardians: WireCard[]; beneficiaries: WireCard[] };
}
export interface WireCard { kind: 0 | 1; a: Hex32; b: Hex32; encPk: string }

export interface SealInput extends Ctx {
  plaintext: Uint8Array; guardians: IdentityCard[]; t: number;
  beneficiaries: IdentityCard[];
}
export type RekeyInput = Omit<SealInput, "guardians" | "beneficiaries"> & {
  newGuardians: IdentityCard[]; newBeneficiaries: IdentityCard[];
};
export interface Opened { share: Uint8Array; salt: Uint8Array; index: number }
export interface Submission { guardianIndex: number; enc: Uint8Array }
export interface Rejected { guardianIndex: number; reason: string }

export class ReconstructError extends Error {
  constructor(msg: string, public rejected: Rejected[] = []) { super(msg); }
}

const suite = new CipherSuite({ kem: new DhkemX25519HkdfSha256(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
const te = new TextEncoder();
const MAX_GUARDIANS = 12; // D3

// ---- byte helpers (no Buffer) ----
const cat = (...p: Uint8Array[]) => {
  const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let k = 0;
  for (const x of p) { o.set(x, k); k += x.length; }
  return o;
};
const toHex = (b: Uint8Array) => ("0x" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")) as Hex32;
const fromHex32 = (h: string) => {
  if (!/^0x[0-9a-fA-F]{64}$/.test(h)) throw new Error("expected 0x + 32-byte hex");
  return Uint8Array.from({ length: 32 }, (_, i) => parseInt(h.slice(2 + 2 * i, 4 + 2 * i), 16));
};
// Chunked: spreading a large buffer into fromCharCode overflows the stack (D15).
export const b64u = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
export const unb64u = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/")), o = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i);
  return o;
};
const sameCtx = (a: Ctx, b: Ctx) =>
  a.vaultId.toLowerCase() === b.vaultId.toLowerCase() && a.assetId.toLowerCase() === b.assetId.toLowerCase() && a.version === b.version;
const u16 = (n: number) => { if (!Number.isInteger(n) || n < 0 || n > 0xffff) throw new Error("version out of range"); return Uint8Array.of(n >> 8, n & 255); };
const u8 = (n: number) => { if (!Number.isInteger(n) || n < 1 || n > 255) throw new Error("index out of range"); return Uint8Array.of(n); };
const xor = (a: Uint8Array, b: Uint8Array) => a.map((x, i) => x ^ b[i]!);
/** Constant-time equality (length is not secret). */
const ctEq = (a: Uint8Array, b: Uint8Array) => {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) d |= a[i]! ^ b[i]!;
  return d === 0;
};
const zero = (...bs: Uint8Array[]) => bs.forEach((b) => b.fill(0));
const rand = (n: number, rng?: Rng) => (rng ? rng(n) : crypto.getRandomValues(new Uint8Array(n)));

// ---- D1 / D9 / D10 encodings ----
/** D1: keccak256(abi.encode(kind, a, b)). */
export const keyIdOf = (c: Pick<IdentityCard, "kind" | "a" | "b">): Hex32 => {
  const kind = new Uint8Array(32);
  kind[31] = c.kind;
  return toHex(keccak_256(cat(kind, fromHex32(c.a), fromHex32(c.b))));
};
const ctxBytes = (c: Ctx) => cat(fromHex32(c.vaultId), fromHex32(c.assetId), u16(c.version));
// D10 info = "heirloom/v1/" || purpose || vaultId || assetId || version || recipientKeyId (<= 124 B, HPKE limit 128)
const info = (purpose: string, c: Ctx, recipientKeyId: Hex32) =>
  cat(te.encode("heirloom/v1/" + purpose), ctxBytes(c), fromHex32(recipientKeyId));
/** D9 commitment. */
const commit = (share: Uint8Array, salt: Uint8Array, c: Ctx, i: number) => {
  if (share.length !== 33 || salt.length !== 32) throw new Error("share must be 33 bytes and salt 32 bytes");
  return toHex(keccak_256(cat(te.encode("heirloom/commit/v1"), share, salt, ctxBytes(c), u8(i))));
};

// ---- AES-256-GCM ----
const gcmKey = (k: Uint8Array, use: KeyUsage) => crypto.subtle.importKey("raw", new Uint8Array(k), "AES-GCM", false, [use]);
const aesSeal = async (dek: Uint8Array, pt: Uint8Array, aad: Uint8Array, rng?: Rng) => {
  const iv = rand(12, rng);
  const params = { name: "AES-GCM", iv: new Uint8Array(iv), additionalData: new Uint8Array(aad) };
  return cat(iv, new Uint8Array(await crypto.subtle.encrypt(params, await gcmKey(dek, "encrypt"), new Uint8Array(pt))));
};
const aesOpen = async (dek: Uint8Array, c: Uint8Array, aad: Uint8Array) => {
  const params = { name: "AES-GCM", iv: new Uint8Array(c.slice(0, 12)), additionalData: new Uint8Array(aad) };
  return new Uint8Array(await crypto.subtle.decrypt(params, await gcmKey(dek, "decrypt"), new Uint8Array(c.slice(12))));
};

// ---- HPKE base mode: output is enc(32) || ct ----
const hpkeSeal = async (encPk: Uint8Array, inf: Uint8Array, pt: Uint8Array, rng?: Rng) => {
  const recipientPublicKey = await suite.kem.deserializePublicKey(new Uint8Array(encPk));
  const { enc, ct } = await suite.seal({ recipientPublicKey, info: inf, ...(rng ? { ekm: rng(32) } : {}) }, pt);
  return cat(new Uint8Array(enc), new Uint8Array(ct));
};
const keyPair = (sk: Uint8Array) => suite.kem.deriveKeyPair(new Uint8Array(sk));
const hpkeOpen = async (sk: Uint8Array, inf: Uint8Array, blob: Uint8Array) =>
  new Uint8Array(await suite.open({ recipientKey: await keyPair(sk), enc: blob.slice(0, 32), info: inf }, blob.slice(32)));

const wire = (c: IdentityCard): WireCard => ({ kind: c.kind, a: c.a, b: c.b, encPk: b64u(c.encPk) });

/**
 * New X25519 identity. `encSk` is a 32-byte seed; the keypair is RFC 9180 DeriveKeyPair(seed),
 * so a WebAuthn-PRF-derived seed (Phase 6) drops in unchanged.
 */
export async function generateIdentityWith(rng?: Rng): Promise<Identity> {
  const encSk = rand(32, rng);
  const kp = await keyPair(encSk);
  return { encSk, encPk: new Uint8Array(await suite.kem.serializePublicKey(kp.publicKey)) };
}

/** Seal an asset (4.2). Returns the bundle and the on-chain commitments commit_1..commit_n. */
export async function sealAssetWith(a: SealInput, rng?: Rng): Promise<{ bundle: Bundle; commitments: Hex32[] }> {
  const { guardians, beneficiaries, t, plaintext } = a;
  const n = guardians.length;
  if (n < 2 || n > MAX_GUARDIANS || t < 2 || t > n) throw new Error("need 2 <= t <= n <= 12");
  if (!beneficiaries.length) throw new Error("need a beneficiary");
  const gIds = guardians.map(keyIdOf), bIds = beneficiaries.map(keyIdOf);
  if (new Set(gIds).size !== n || new Set(bIds).size !== bIds.length) throw new Error("duplicate participant");
  if (bIds.some((b) => gIds.includes(b))) throw new Error("a beneficiary cannot also be a guardian");
  const pks = [...guardians, ...beneficiaries].map((c) => toHex(c.encPk));
  if (new Set(pks).size !== pks.length) throw new Error("duplicate encPk");

  const dek = rand(32, rng), kb = rand(32, rng), kg = xor(dek, kb);
  const C = await aesSeal(dek, plaintext, ctxBytes(a), rng);
  const shares = await split(kg, n, t);
  const commitments: Hex32[] = [], gEnc: Bundle["guardians"] = [], bEnc: Bundle["beneficiaries"] = [];
  for (let k = 0; k < n; k++) {
    const i = k + 1, salt = rand(32, rng), s = shares[k]!;
    commitments.push(commit(s, salt, a, i));
    const enc = await hpkeSeal(guardians[k]!.encPk, info("guardian-share", a, gIds[k]!), cat(s, salt), rng);
    gEnc.push({ i, keyId: gIds[k]!, enc: b64u(enc) });
    zero(s, salt);
  }
  for (let k = 0; k < beneficiaries.length; k++) {
    const enc = await hpkeSeal(beneficiaries[k]!.encPk, info("beneficiary-kb", a, bIds[k]!), kb, rng);
    bEnc.push({ keyId: bIds[k]!, enc: b64u(enc) });
  }
  zero(dek, kb, kg);
  const bundle: Bundle = {
    v: "heirloom.bundle.v1", vaultId: a.vaultId, assetId: a.assetId, version: a.version,
    C: b64u(C), guardians: gEnc, beneficiaries: bEnc,
    participants: { guardians: guardians.map(wire), beneficiaries: beneficiaries.map(wire) },
  };
  return { bundle, commitments };
}

/** Guardian decrypts own `s_i || r_i` from the bundle. Throws if it is not theirs or was tampered. */
export async function guardianOpenShare(bundle: Bundle, myIndex: number, mySk: Uint8Array): Promise<Opened> {
  const g = bundle.guardians.find((x) => x.i === myIndex);
  if (!g) throw new Error("no such guardian index");
  const pt = await hpkeOpen(mySk, info("guardian-share", bundle, g.keyId), unb64u(g.enc));
  if (pt.length !== 65) throw new Error("bad share plaintext");
  return { share: pt.slice(0, 33), salt: pt.slice(33), index: myIndex };
}

/** 4.3 step 1: re-encrypt an opened share to the claimant. 113 bytes = enc(32) || ct(65+16). */
export function guardianReencrypt(opened: Opened, claimantEncPk: Uint8Array, ctx: ClaimantCtx): Promise<Uint8Array> {
  return hpkeSeal(claimantEncPk, info("claimant-share", ctx, ctx.claimantKeyId), cat(opened.share, opened.salt));
}

/** True iff the D9 commitment of (share, salt, ctx, i) equals `commitment` (constant-time compare). */
export function verifyShare(commitment: Hex32, share: Uint8Array, salt: Uint8Array, ctx: Ctx, i: number): boolean {
  try { return ctEq(fromHex32(commit(share, salt, ctx, i)), fromHex32(commitment)); } catch { return false; }
}

/**
 * Beneficiary side (4.3 step 2). Each submission is HPKE-opened and commitment-checked; bad ones land in
 * `rejected`. The first `t` valid distinct shares are combined. `expect` (required) pins the
 * vault/asset/version the caller believes it is opening. Throws ReconstructError (carrying `rejected`)
 * if fewer than t valid shares exist or the GCM tag fails.
 */
export async function beneficiaryReconstruct(a: {
  bundle: Bundle; mySk: Uint8Array; submissions: Submission[]; commitments: Hex32[]; t: number; expect: Ctx;
}): Promise<{ plaintext: Uint8Array; usedIndexes: number[]; rejected: Rejected[] }> {
  const { bundle, mySk, submissions, commitments, t, expect } = a;
  if (!expect || !sameCtx(expect, bundle)) throw new ReconstructError("bundle does not match expected vault/asset/version");
  if (!Number.isInteger(t) || t < 2 || t > commitments.length) throw new ReconstructError("t out of range");
  const myPk = new Uint8Array(await suite.kem.serializePublicKey((await keyPair(mySk)).publicKey));
  const card = bundle.participants.beneficiaries.find((c) => ctEq(unb64u(c.encPk), myPk));
  const mine = card && bundle.beneficiaries.find((b) => b.keyId.toLowerCase() === keyIdOf(card));
  if (!mine) throw new ReconstructError("not a beneficiary of this bundle");

  const rejected: Rejected[] = [], good: { i: number; share: Uint8Array }[] = [], seen = new Set<number>();
  for (const s of submissions) {
    const i = s.guardianIndex, rej = (reason: string) => void rejected.push({ guardianIndex: i, reason });
    if (!Number.isInteger(i) || i < 1 || i > commitments.length) { rej("bad-index"); continue; }
    if (seen.has(i)) { rej("duplicate"); continue; }
    let pt: Uint8Array;
    try { pt = await hpkeOpen(mySk, info("claimant-share", bundle, mine.keyId), s.enc); } catch { rej("bad-ciphertext"); continue; }
    if (pt.length !== 65) { rej("bad-share"); continue; }
    if (!verifyShare(commitments[i - 1]!, pt.slice(0, 33), pt.slice(33), bundle, i)) { rej("commitment-mismatch"); continue; }
    seen.add(i);
    good.push({ i, share: pt.slice(0, 33) });
  }
  const used = good.slice(0, t);
  if (used.length < t) throw new ReconstructError(`only ${used.length} valid shares, need ${t}`, rejected);
  let kg: Uint8Array | undefined;
  try {
    kg = await combine(used.map((u) => u.share));
    const kb = await hpkeOpen(mySk, info("beneficiary-kb", bundle, mine.keyId), unb64u(mine.enc));
    const dek = xor(kg, kb);
    const plaintext = await aesOpen(dek, unb64u(bundle.C), ctxBytes(bundle));
    zero(kb, dek);
    return { plaintext, usedIndexes: used.map((u) => u.i), rejected };
  } catch {
    throw new ReconstructError("decryption failed", rejected);
  } finally {
    if (kg) zero(kg);
    zero(...used.map((u) => u.share));
  }
}

/** Readiness drill (8): decrypt own share and recompute the commitment. Only a boolean leaves. */
export async function drillCheck(bundle: Bundle, myIndex: number, mySk: Uint8Array, commitment: Hex32, expect: Ctx): Promise<boolean> {
  try {
    if (!expect || !sameCtx(expect, bundle)) return false;
    const o = await guardianOpenShare(bundle, myIndex, mySk);
    const ok = verifyShare(commitment, o.share, o.salt, bundle, myIndex);
    zero(o.share, o.salt);
    return ok;
  } catch { return false; }
}

/** 4.6 full re-key: fresh DEK, halves, shares, IV; version+1. `version` is the OLD version. */
export function rekeyAssetWith(a: RekeyInput, rng?: Rng): Promise<{ bundle: Bundle; commitments: Hex32[] }> {
  const { newGuardians, newBeneficiaries, ...rest } = a;
  return sealAssetWith({ ...rest, version: a.version + 1, guardians: newGuardians, beneficiaries: newBeneficiaries }, rng);
}
