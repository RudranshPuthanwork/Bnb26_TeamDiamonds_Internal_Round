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
