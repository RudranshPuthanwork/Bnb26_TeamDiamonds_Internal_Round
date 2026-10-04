// Review PoCs (blockers only). Each test fails until the finding is fixed.
import { describe, expect, it } from "vitest";
import { generateIdentity, sealAsset, type Hex32, type IdentityCard } from "../src/index.js";

const h = (n: number) => ("0x" + n.toString(16).padStart(64, "0")) as Hex32;
const card = async (n: number): Promise<IdentityCard> =>
  ({ kind: 0, a: h(n), b: h(0), encPk: (await generateIdentity()).encPk });

describe("review PoC", () => {
  // B1: b64u spreads the whole buffer into String.fromCharCode -> RangeError above ~128 KiB.
  it("B1: seals a 256 KiB asset", async () => {
    const guardians = await Promise.all([1, 2, 3].map(card));
    const beneficiaries = [await card(9)];
    const plaintext = new Uint8Array(256 * 1024);
    await expect(
      sealAsset({ vaultId: h(1), assetId: h(2), version: 1, plaintext, guardians, t: 2, beneficiaries }),
    ).resolves.toBeDefined();
  });
});
