// Public API (D15): no rng parameter anywhere. Test injection lives in ./testing.ts.
import { generateIdentityWith, rekeyAssetWith, sealAssetWith, type RekeyInput, type SealInput } from "./core.js";

export {
  beneficiaryReconstruct, drillCheck, guardianOpenShare, guardianReencrypt, keyIdOf, ReconstructError, verifyShare,
} from "./core.js";
export type {
  Bundle, ClaimantCtx, Ctx, Hex32, Identity, IdentityCard, Opened, RekeyInput, Rejected, SealInput, Submission, WireCard,
} from "./core.js";

export const generateIdentity = () => generateIdentityWith();
export const sealAsset = (a: SealInput) => sealAssetWith(a);
export const rekeyAsset = (a: RekeyInput) => rekeyAssetWith(a);
