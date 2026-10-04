// TEST ONLY (D15): deterministic-rng entry point, "@heirloom/crypto/testing". Never import from apps or services.
export { generateIdentityWith as generateIdentity, rekeyAssetWith as rekeyAsset, sealAssetWith as sealAsset } from "./core.js";
export type { Rng } from "./core.js";
