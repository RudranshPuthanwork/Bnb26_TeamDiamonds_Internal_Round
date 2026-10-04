import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Aes256Gcm, CipherSuite, HkdfSha256 } from "@hpke/core";
import { DhkemX25519HkdfSha256 } from "@hpke/dhkem-x25519";
import { sha256 } from "@noble/hashes/sha2.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { combine } from "shamir-secret-sharing";
import {
  beneficiaryReconstruct, drillCheck, generateIdentity, guardianOpenShare, guardianReencrypt, keyIdOf,
  ReconstructError, rekeyAsset, sealAsset, verifyShare,
  type Bundle, type Hex32, type IdentityCard, type Identity, type Submission,
} from "../src/index.js";
import * as pub from "../src/index.js";
import { b64u, unb64u } from "../src/core.js";
import * as seededApi from "../src/testing.js";
import type { Rng } from "../src/testing.js";

const VAULT = ("0x" + "11".repeat(32)) as Hex32;
const ASSET = ("0x" + "22".repeat(32)) as Hex32;
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) => Uint8Array.from(s.match(/../g) ?? [], (h) => parseInt(h, 16));
const num = (n: number) => ("0x" + n.toString(16).padStart(64, "0")) as Hex32;
const PT = new TextEncoder().encode("the safe combination is 12-34-56");

/** Deterministic rng: sha256(seed || counter) stream. Test-only. */
const seeded = (seed: string): Rng => {
  let ctr = 0, buf = new Uint8Array(0);
  return (n) => {
    while (buf.length < n) {
      const c = new TextEncoder().encode(`${seed}/${ctr++}`);
      const h = sha256(c);
      const m = new Uint8Array(buf.length + h.length);
      m.set(buf); m.set(h, buf.length); buf = m;
    }
    const out = buf.slice(0, n); buf = buf.slice(n); return out;
  };
};

type Party = Identity & { card: IdentityCard };
const party = async (k: number, rng?: Rng): Promise<Party> => {
  const id = await seededApi.generateIdentity(rng);
  return { ...id, card: { kind: 0, a: num(k), b: num(0), encPk: id.encPk } };
};
const parties = (from: number, n: number, rng?: Rng) => Promise.all(Array.from({ length: n }, (_, k) => party(from + k, rng)));

async function setup(n: number, t: number, o: { rng?: Rng; version?: number; assetId?: Hex32; vaultId?: Hex32 } = {}) {
  const gs = await parties(100, n, o.rng);
  const [ben] = await parties(900, 1, o.rng);
  const ctx = { vaultId: o.vaultId ?? VAULT, assetId: o.assetId ?? ASSET, version: o.version ?? 1 };
  const sealed = await seededApi.sealAsset({ ...ctx, plaintext: PT, guardians: gs.map((g) => g.card), t, beneficiaries: [ben!.card] }, o.rng);
  return { gs, ben: ben!, ctx, ...sealed };
}
/** Guardian-side: open and re-encrypt shares of `idx` (1-based) to the beneficiary. */
async function submit(bundle: Bundle, gs: Party[], ben: Party, idx: number[]): Promise<Submission[]> {
  const claimantKeyId = keyIdOf(ben.card);
  return Promise.all(idx.map(async (i) => {
    const o = await guardianOpenShare(bundle, i, gs[i - 1]!.encSk);
    return { guardianIndex: i, enc: await guardianReencrypt(o, ben.encPk, { ...bundle, claimantKeyId }) };
  }));
}
/** Independent D10 K_b opener (test only), to model "the old K_b leaked". */
const openKb = async (ben: Party, b: Bundle) => {
  const suite = new CipherSuite({ kem: new DhkemX25519HkdfSha256(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
  const raw = Uint8Array.from(atob(b.beneficiaries[0]!.enc.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const te = new TextEncoder();
  const info = new Uint8Array([...te.encode("heirloom/v1/beneficiary-kb"), ...unhex(b.vaultId.slice(2)), ...unhex(b.assetId.slice(2)), b.version >> 8, b.version & 255, ...unhex(keyIdOf(ben.card).slice(2))]);
  const recipientKey = await suite.kem.deriveKeyPair(ben.encSk);
  return new Uint8Array(await suite.open({ recipientKey, enc: raw.slice(0, 32), info }, raw.slice(32)));
};
const flip = (b64: string, byte = 5) => {
  const b = Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  b[byte] ^= 1;
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const open = (s: Awaited<ReturnType<typeof setup>>, subs: Submission[], t: number, bundle = s.bundle, commitments = s.commitments) =>
  beneficiaryReconstruct({ bundle, mySk: s.ben.encSk, submissions: subs, commitments, t, expect: bundle });

describe("1. round trip", () => {
  for (let t = 2; t <= 4; t++)
    for (let n = Math.max(3, t); n <= 7; n++)
      it(`t=${t} n=${n}, rotating t-subsets`, async () => {
        const s = await setup(n, t);
        for (const start of [0, n - t]) {
          const idx = Array.from({ length: t }, (_, k) => start + k + 1);
          const r = await open(s, await submit(s.bundle, s.gs, s.ben, idx), t);
          expect(r.plaintext).toEqual(PT);
          expect(r.usedIndexes).toEqual(idx);
          expect(r.rejected).toEqual([]);
        }
      });
});

describe("2. thresholds and split knowledge", () => {
  it("t-1 shares fail", async () => {
    const s = await setup(5, 3);
    await expect(open(s, await submit(s.bundle, s.gs, s.ben, [1, 2]), 3)).rejects.toBeInstanceOf(ReconstructError);
  });
  it("t guardians without K_b: K_g is not the DEK and GCM rejects", async () => {
    const s = await setup(5, 3);
    const shares = await Promise.all([1, 3, 5].map(async (i) => (await guardianOpenShare(s.bundle, i, s.gs[i - 1]!.encSk)).share));
    const kg = await combine(shares);
    const C = Uint8Array.from(atob(s.bundle.C.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", new Uint8Array(kg), "AES-GCM", false, ["decrypt"]);
    await expect(crypto.subtle.decrypt({ name: "AES-GCM", iv: C.slice(0, 12) }, key, C.slice(12))).rejects.toThrow();
  });
});

describe("3. bad and duplicate shares", () => {
  it("one corrupted among t+1 is flagged; reconstruction still succeeds", async () => {
    const s = await setup(5, 3);
    const subs = await submit(s.bundle, s.gs, s.ben, [1, 2, 3, 4]);
    subs[1]!.enc[40] ^= 1; // guardian 2
    const r = await open(s, subs, 3);
    expect(r.plaintext).toEqual(PT);
    expect(r.rejected).toEqual([{ guardianIndex: 2, reason: "bad-ciphertext" }]);
    expect(r.usedIndexes).toEqual([1, 3, 4]);
  });
  it("a share that decrypts but fails the commitment is flagged", async () => {
    const s = await setup(4, 3);
    const subs = await submit(s.bundle, s.gs, s.ben, [1, 2, 3, 4]);
    const bad = [...s.commitments]; bad[0] = num(7);
    const r = await open(s, subs, 3, s.bundle, bad);
    expect(r.rejected).toEqual([{ guardianIndex: 1, reason: "commitment-mismatch" }]);
    expect(r.plaintext).toEqual(PT);
  });
  it("duplicate indices are rejected and do not count toward t", async () => {
    const s = await setup(5, 3);
    const [a, b] = await submit(s.bundle, s.gs, s.ben, [1, 2]);
    await expect(open(s, [a!, b!, a!], 3)).rejects.toMatchObject({ rejected: [{ guardianIndex: 1, reason: "duplicate" }] });
  });
  it("a share replayed under another guardian index fails", async () => {
    const s = await setup(4, 3);
    const [a, b, c] = await submit(s.bundle, s.gs, s.ben, [1, 2, 3]);
    await expect(open(s, [a!, b!, { guardianIndex: 3, enc: a!.enc }, c!].slice(0, 3), 3)).rejects.toBeInstanceOf(ReconstructError);
  });
});

describe("4. cross-binding", () => {
  it("shares for asset A fail on asset B; for vault X fail on vault Y; for v on v+1", async () => {
    const A = await setup(4, 2, { rng: seeded("a") });
    for (const alt of [{ assetId: ("0x" + "33".repeat(32)) as Hex32 }, { vaultId: ("0x" + "44".repeat(32)) as Hex32 }, { version: 2 }]) {
      // Same participants, different context. Reuse A's guardians/beneficiary.
      const ctx = { ...A.ctx, ...alt };
      const B = await sealAsset({ ...ctx, plaintext: PT, guardians: A.gs.map((g) => g.card), t: 2, beneficiaries: [A.ben.card] });
      const subsA = await submit(A.bundle, A.gs, A.ben, [1, 2]);
      await expect(open(A, subsA, 2, B.bundle, B.commitments)).rejects.toMatchObject({ rejected: expect.arrayContaining([{ guardianIndex: 1, reason: "bad-ciphertext" }]) });
    }
  });
  it("relabelling a bundle's context breaks everything", async () => {
    const s = await setup(4, 2);
    const subs = await submit(s.bundle, s.gs, s.ben, [1, 2]);
    for (const patch of [{ vaultId: ("0x" + "55".repeat(32)) as Hex32 }, { assetId: ("0x" + "55".repeat(32)) as Hex32 }, { version: 2 }])
      await expect(open(s, subs, 2, { ...s.bundle, ...patch })).rejects.toBeInstanceOf(ReconstructError);
    await expect(guardianOpenShare({ ...s.bundle, version: 2 }, 1, s.gs[0]!.encSk)).rejects.toThrow();
  });
  it("expect pins vault/asset/version", async () => {
    const s = await setup(3, 2);
    await expect(beneficiaryReconstruct({ bundle: s.bundle, mySk: s.ben.encSk, submissions: [], commitments: s.commitments, t: 2, expect: { ...s.ctx, version: 2 } })).rejects.toBeInstanceOf(ReconstructError);
  });
  it("old-version bundle with new commitments fails", async () => {
    const old = await setup(4, 2);
    const next = await rekeyAsset({ ...old.ctx, plaintext: PT, t: 2, newGuardians: old.gs.map((g) => g.card), newBeneficiaries: [old.ben.card] });
    expect(next.bundle.version).toBe(2);
    const subs = await submit(old.bundle, old.gs, old.ben, [1, 2]);
    await expect(open(old, subs, 2, old.bundle, next.commitments)).rejects.toMatchObject({ rejected: [{ reason: "commitment-mismatch" }, { reason: "commitment-mismatch" }] });
  });
});

describe("5. tamper never yields wrong plaintext", () => {
  it("C bit flip", async () => {
    const s = await setup(4, 2);
    const subs = await submit(s.bundle, s.gs, s.ben, [1, 2]);
    await expect(open(s, subs, 2, { ...s.bundle, C: flip(s.bundle.C, 20) })).rejects.toThrow();
    await expect(open(s, subs, 2, { ...s.bundle, C: flip(s.bundle.C, 2) })).rejects.toThrow(); // IV
  });
  it("AAD fields", async () => {
    const s = await setup(4, 2);
    const subs = await submit(s.bundle, s.gs, s.ben, [1, 2]);
    for (const k of ["vaultId", "assetId"] as const) {
      const v = s.bundle[k]; const alt = (v.slice(0, -1) + (v.endsWith("0") ? "1" : "0")) as Hex32;
      await expect(open(s, subs, 2, { ...s.bundle, [k]: alt })).rejects.toThrow();
    }
    await expect(open(s, subs, 2, { ...s.bundle, version: s.bundle.version + 1 })).rejects.toThrow();
  });
  it("HPKE ciphertexts: K_b, guardian share, re-encrypted share", async () => {
    const s = await setup(4, 2);
    const subs = await submit(s.bundle, s.gs, s.ben, [1, 2]);
    const kb = { ...s.bundle, beneficiaries: [{ ...s.bundle.beneficiaries[0]!, enc: flip(s.bundle.beneficiaries[0]!.enc, 50) }] };
    await expect(open(s, subs, 2, kb)).rejects.toThrow();
    const kbEnc = { ...s.bundle, beneficiaries: [{ ...s.bundle.beneficiaries[0]!, enc: flip(s.bundle.beneficiaries[0]!.enc, 3) }] };
    await expect(open(s, subs, 2, kbEnc)).rejects.toThrow();
    const g = { ...s.bundle, guardians: s.bundle.guardians.map((x) => (x.i === 1 ? { ...x, enc: flip(x.enc, 60) } : x)) };
    await expect(guardianOpenShare(g, 1, s.gs[0]!.encSk)).rejects.toThrow();
    expect(await drillCheck(g, 1, s.gs[0]!.encSk, s.commitments[0]!, s.ctx)).toBe(false);
    subs[0]!.enc[10] ^= 1;
    await expect(open(s, subs, 2)).rejects.toMatchObject({ rejected: [{ guardianIndex: 1 }] });
  });
  it("commitments", async () => {
    const s = await setup(4, 2);
    const subs = await submit(s.bundle, s.gs, s.ben, [1, 2]);
    for (let k = 0; k < 2; k++) {
      const bad = [...s.commitments]; bad[k] = ("0x" + (BigInt(bad[k]!) ^ 1n).toString(16).padStart(64, "0")) as Hex32;
      await expect(open(s, subs, 2, s.bundle, bad)).rejects.toMatchObject({ rejected: [{ guardianIndex: k + 1, reason: "commitment-mismatch" }] });
    }
  });
  it("drillCheck is true for the right guardian and wrong for another key or commitment", async () => {
    const s = await setup(4, 2);
    expect(await drillCheck(s.bundle, 2, s.gs[1]!.encSk, s.commitments[1]!, s.ctx)).toBe(true);
    expect(await drillCheck(s.bundle, 2, s.gs[0]!.encSk, s.commitments[1]!, s.ctx)).toBe(false);
    expect(await drillCheck(s.bundle, 2, s.gs[1]!.encSk, s.commitments[0]!, s.ctx)).toBe(false);
  });
  it("setup rejects beneficiary == guardian", async () => {
    const [g1, g2] = await parties(1, 2);
    await expect(sealAsset({ ...{ vaultId: VAULT, assetId: ASSET, version: 1 }, plaintext: PT, guardians: [g1!.card, g2!.card], t: 2, beneficiaries: [g1!.card] })).rejects.toThrow(/beneficiary/);
  });
});

describe("6. sizes", () => {
  it("share ciphertext is exactly 113 bytes", async () => {
    const s = await setup(3, 2);
    const [sub] = await submit(s.bundle, s.gs, s.ben, [1]);
    expect(sub!.enc.length).toBe(113);
    expect(Uint8Array.from(atob(s.bundle.guardians[0]!.enc.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)).length).toBe(113);
  });
});

describe("8. rekey", () => {
  it("old guardian's old share cannot combine with new shares; old K_b cannot open new C", async () => {
    const old = await setup(4, 2);
    const [newG] = await parties(500, 1);
    const newGs = [newG!, ...old.gs.slice(1)];
    const next = await rekeyAsset({ ...old.ctx, plaintext: PT, t: 2, newGuardians: newGs.map((g) => g.card), newBeneficiaries: [old.ben.card] });
    expect(next.bundle.version).toBe(2);
    expect(next.bundle.C).not.toBe(old.bundle.C);
    // happy path on the new bundle
    expect((await open({ ...old, gs: newGs }, await submit(next.bundle, newGs, old.ben, [1, 2]), 2, next.bundle, next.commitments)).plaintext).toEqual(PT);

    const oldShare = (await guardianOpenShare(old.bundle, 1, old.gs[0]!.encSk)).share;
    const newShare2 = (await guardianOpenShare(next.bundle, 2, newGs[1]!.encSk)).share;
    const mixedKg = await combine([oldShare, newShare2]);
    const gcm = async (key: Uint8Array) => {
      const C = Uint8Array.from(atob(next.bundle.C.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: C.slice(0, 12), additionalData: new Uint8Array([...unhex(VAULT.slice(2)), ...unhex(ASSET.slice(2)), 0, 2]) }, await crypto.subtle.importKey("raw", new Uint8Array(key), "AES-GCM", false, ["decrypt"]), C.slice(12));
    };
    const newKg = await combine([(await guardianOpenShare(next.bundle, 1, newGs[0]!.encSk)).share, newShare2]);
    // true K_b of the old asset == dek ^ kg_old; recover via the protocol-less path: old kb opened with beneficiary sk
    const oldKb = await openKb(old.ben, old.bundle);
    await expect(gcm(mixedKg)).rejects.toThrow();
    await expect(gcm(oldKb)).rejects.toThrow();
    await expect(gcm(oldKb.map((x, i) => x ^ newKg[i]!))).rejects.toThrow();
  });
});

describe("7. fixed vectors", () => {
  const path = new URL("./vectors.json", import.meta.url);
  const make = async () => {
    const rng = seeded("heirloom-vector-1");
    const s = await setup(5, 3, { rng });
    const subs = await submit(s.bundle, s.gs, s.ben, [2, 4, 5]);
    return {
      ctx: s.ctx, t: 3, plaintext: hex(PT), commitments: s.commitments, bundle: s.bundle,
      guardianSks: s.gs.map((g) => hex(g.encSk)), beneficiarySk: hex(s.ben.encSk),
      submissions: subs.map((x) => ({ guardianIndex: x.guardianIndex, enc: hex(x.enc) })),
    };
  };
  if (process.env.GEN_VECTORS && !existsSync(path)) it("generate", async () => { writeFileSync(path, JSON.stringify(await make(), null, 2) + "\n"); });

  it("committed bundle still opens to the committed plaintext", async () => {
    const v = JSON.parse(readFileSync(path, "utf8"));
    const r = await beneficiaryReconstruct({
      bundle: v.bundle, mySk: unhex(v.beneficiarySk), commitments: v.commitments, t: v.t, expect: v.ctx,
      submissions: v.submissions.map((x: { guardianIndex: number; enc: string }) => ({ guardianIndex: x.guardianIndex, enc: unhex(x.enc) })),
    });
    expect(hex(r.plaintext)).toBe(v.plaintext);
    expect(r.usedIndexes).toEqual([2, 4, 5]);
    // D9 known-answer, built independently of the library's encoder
    const o = await guardianOpenShare(v.bundle, 3, unhex(v.guardianSks[2]));
    const manual = keccak_256(new Uint8Array([
      ...new TextEncoder().encode("heirloom/commit/v1"), ...o.share, ...o.salt,
      ...unhex(v.ctx.vaultId.slice(2)), ...unhex(v.ctx.assetId.slice(2)), 0, v.ctx.version, 3,
    ]));
    expect("0x" + hex(manual)).toBe(v.commitments[2]);
    expect(verifyShare(v.commitments[2], o.share, o.salt, v.ctx, 3)).toBe(true);
  });
  it("seeded rng reproduces everything except Shamir's own CSPRNG (C, K_b wraps, keys)", async () => {
    const v = JSON.parse(readFileSync(path, "utf8"));
    const again = await make();
    expect(again.bundle.C).toBe(v.bundle.C);
    expect(again.bundle.beneficiaries).toEqual(v.bundle.beneficiaries);
    expect(again.bundle.participants).toEqual(v.bundle.participants);
    expect(again.guardianSks).toEqual(v.guardianSks);
  });
});

describe("9. review 2b fixes (D15)", () => {
  it("B1: 10 MB seal/open round trip", async () => {
    const pt = new Uint8Array(10 * 1024 * 1024).map((_, i) => (i * 31) & 255);
    const gs = await parties(100, 3), [ben] = await parties(900, 1);
    const sealed = await sealAsset({ vaultId: VAULT, assetId: ASSET, version: 1, plaintext: pt, guardians: gs.map((g) => g.card), t: 2, beneficiaries: [ben!.card] });
    const s = { gs, ben: ben!, ctx: { vaultId: VAULT, assetId: ASSET, version: 1 }, ...sealed };
    const r = await open(s, await submit(s.bundle, gs, ben!, [1, 3]), 2);
    expect(Buffer.compare(r.plaintext, pt)).toBe(0);
  }, 60_000);
  it("B1: 50 MB b64u round trip", () => {
    const b = new Uint8Array(50 * 1024 * 1024).map((_, i) => (i * 7) & 255);
    expect(Buffer.compare(unb64u(b64u(b)), b)).toBe(0);
  }, 60_000);
  it("S1: public API has no rng parameter and ignores a smuggled one", async () => {
    expect([pub.generateIdentity.length, pub.sealAsset.length, pub.rekeyAsset.length]).toEqual([0, 1, 1]);
    const gen = pub.generateIdentity as (r?: Rng) => ReturnType<typeof pub.generateIdentity>;
    expect((await gen(seeded("x"))).encSk).not.toEqual((await gen(seeded("x"))).encSk);
    const gs = await parties(1, 2), [ben] = await parties(9, 1);
    const input = { vaultId: VAULT, assetId: ASSET, version: 1, plaintext: PT, guardians: gs.map((g) => g.card), t: 2, beneficiaries: [ben!.card] };
    const [a, b] = [await sealAsset({ ...input, rng: seeded("x") } as typeof input), await sealAsset({ ...input, rng: seeded("x") } as typeof input)];
    expect(a.bundle.C).not.toBe(b.bundle.C);
  });
  it("S2: invalid submission for index i then a valid one for i still succeeds", async () => {
    const s = await setup(4, 2);
    const [a, b] = await submit(s.bundle, s.gs, s.ben, [1, 2]);
    const bad = { guardianIndex: 1, enc: a!.enc.map((x, k) => (k === 40 ? x ^ 1 : x)) };
    const r = await open(s, [bad, a!, b!], 2);
    expect(r.plaintext).toEqual(PT);
    expect(r.usedIndexes).toEqual([1, 2]);
    expect(r.rejected).toEqual([{ guardianIndex: 1, reason: "bad-ciphertext" }]);
  });
  it("S3: t=1, t above n, and t below the real threshold give ReconstructError with rejected", async () => {
    const s = await setup(5, 3);
    const subs = await submit(s.bundle, s.gs, s.ben, [1, 2, 3, 4]);
    for (const t of [1, 6]) {
      await expect(open(s, subs, t)).rejects.toBeInstanceOf(ReconstructError);
      await expect(open(s, subs, t)).rejects.toMatchObject({ rejected: [] });
    }
    const bad = subs.map((x) => (x.guardianIndex === 4 ? { ...x, enc: x.enc.map((y, k) => (k === 40 ? y ^ 1 : y)) } : x));
    const err = await open(s, bad, 2).catch((e) => e);
    expect(err).toBeInstanceOf(ReconstructError);
    expect(err.rejected).toEqual([{ guardianIndex: 4, reason: "bad-ciphertext" }]);
  });
  it("S4: verifyShare rejects wrong-length share or salt (no byte shifting)", async () => {
    const s = await setup(3, 2);
    const o = await guardianOpenShare(s.bundle, 1, s.gs[0]!.encSk);
    expect(verifyShare(s.commitments[0]!, o.share, o.salt, s.ctx, 1)).toBe(true);
    expect(verifyShare(s.commitments[0]!, new Uint8Array([...o.share, o.salt[0]!]), o.salt.slice(1), s.ctx, 1)).toBe(false);
    expect(verifyShare(s.commitments[0]!, o.share.slice(0, 32), new Uint8Array(33), s.ctx, 1)).toBe(false);
  });
  it("S5: expect is required; hex case does not matter", async () => {
    const s = await setup(3, 2, { vaultId: ("0x" + "ab".repeat(32)) as Hex32, assetId: ("0x" + "cd".repeat(32)) as Hex32 });
    const subs = await submit(s.bundle, s.gs, s.ben, [1, 2]);
    const base = { bundle: s.bundle, mySk: s.ben.encSk, submissions: subs, commitments: s.commitments, t: 2 };
    // @ts-expect-error expect is required
    await expect(beneficiaryReconstruct(base)).rejects.toBeInstanceOf(ReconstructError);
    const up = (h: Hex32) => ("0x" + h.slice(2).toUpperCase()) as Hex32;
    const upperExpect = { ...s.ctx, vaultId: up(s.ctx.vaultId), assetId: up(s.ctx.assetId) };
    expect((await beneficiaryReconstruct({ ...base, expect: s.ctx })).plaintext).toEqual(PT);
    expect((await beneficiaryReconstruct({ ...base, expect: upperExpect })).plaintext).toEqual(PT);
    const upBundle = { ...s.bundle, vaultId: up(s.bundle.vaultId), assetId: up(s.bundle.assetId) };
    expect((await beneficiaryReconstruct({ ...base, bundle: upBundle, expect: s.ctx })).plaintext).toEqual(PT);
    expect(await drillCheck(s.bundle, 1, s.gs[0]!.encSk, s.commitments[0]!, upperExpect)).toBe(true);
    expect(await drillCheck(s.bundle, 1, s.gs[0]!.encSk, s.commitments[0]!, { ...s.ctx, version: 2 })).toBe(false);
  });
  it("S6: duplicate encPk is rejected across guardians and beneficiaries", async () => {
    const [g1, g2, g3] = await parties(1, 3), [ben] = await parties(9, 1);
    const base = { vaultId: VAULT, assetId: ASSET, version: 1, plaintext: PT, t: 2 };
    const twin = (p: Party, k: number): IdentityCard => ({ ...p.card, a: num(k) });
    await expect(sealAsset({ ...base, guardians: [g1!.card, twin(g1!, 50), g3!.card], beneficiaries: [ben!.card] })).rejects.toThrow(/encPk/);
    await expect(sealAsset({ ...base, guardians: [g1!.card, g2!.card, g3!.card], beneficiaries: [twin(g2!, 51)] })).rejects.toThrow(/encPk/);
    await expect(rekeyAsset({ ...base, newGuardians: [g1!.card, g2!.card], newBeneficiaries: [twin(g2!, 52)] })).rejects.toThrow(/encPk/);
  });
});
