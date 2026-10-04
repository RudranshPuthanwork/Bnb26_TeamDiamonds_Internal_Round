/**
 * Heirloom TypeScript types matching specs/interfaces.md
 */

export type Hex = `0x${string}`;
export type Hex32 = `0x${string}`;

/** On-chain order of Status values */
export const Status = {
  Sealed: 0,
  Armed: 1,
  Silent: 2,
  Cooling: 3,
  Disputed: 4,
  Releasable: 5,
  ContingentEligible: 6,
  Claimed: 7,
} as const;

export type Status = (typeof Status)[keyof typeof Status];

export type StatusName =
  | 'Sealed'
  | 'Armed'
  | 'Silent'
  | 'Cooling'
  | 'Disputed'
  | 'Releasable'
  | 'ContingentEligible'
  | 'Claimed';

export const STATUS_NAMES: Record<Status, StatusName> = {
  [Status.Sealed]: 'Sealed',
  [Status.Armed]: 'Armed',
  [Status.Silent]: 'Silent',
  [Status.Cooling]: 'Cooling',
  [Status.Disputed]: 'Disputed',
  [Status.Releasable]: 'Releasable',
  [Status.ContingentEligible]: 'ContingentEligible',
  [Status.Claimed]: 'Claimed',
};

/** On-chain order of Reason values */
export const Reason = {
  NONE: 0,
  INCAPACITATED: 1,
  DECEASED: 2,
  MISSING: 3,
} as const;

export type Reason = (typeof Reason)[keyof typeof Reason];

export const REASON_NAMES: Record<Reason, string> = { 0: 'NONE', 1: 'INCAPACITATED', 2: 'DECEASED', 3: 'MISSING' };

export const KeyKind = {
  EOA: 0,
  P256: 1,
} as const;

export type KeyKind = (typeof KeyKind)[keyof typeof KeyKind];

export const AuthKind = {
  DIRECT: 0,
  EOA_SIG: 1,
  P256: 2,
} as const;

export type AuthKind = (typeof AuthKind)[keyof typeof AuthKind];

export const Role = {
  Any: 0,
  Owner: 1,
  Guardian: 2,
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const Action = {
  CreateVault: 0,
  AddAsset: 1,
  Heartbeat: 2,
  Cancel: 3,
  SetAbsence: 4,
  QueueChange: 5,
  ApplyChange: 6,
  RevokeChange: 7,
  Attest: 8,
  Dispute: 9,
  SubmitShare: 10,
  MarkClaimed: 11,
  Drill: 12,
  Rekey: 13,
  ClaimContingent: 14,
} as const;

export type Action = (typeof Action)[keyof typeof Action];

export interface AssetPolicy {
  reasonsMask: number;
  kAttest: number;
  requireEvidence: boolean;
  minInactivity: number;
  window: number;
  claimDeadline: number;
  primaryBenef: Hex32;
  contingentBenef: Hex32;
  bundleCid: Hex32;
  version: number;
  shareCommitments: Hex32[];
}

export interface Vault {
  vaultId: Hex32;
  owners: readonly [Hex32, Hex32];
  guardians: Hex32[];
  t: number;
  policyDelay: number;
  epoch: number;
  lastHeartbeat: number;
  absentUntil: number;
  disputedAt: number;
  disputeEpoch: number;
  disputer: number;
}

export interface Timeline {
  tSilence: bigint;
  tQuorum: bigint;
  resumeAt: bigint;
  tOpen: bigint;
  opensAt: bigint;
  attestationsFiled: number;
  kAttest: number;
  disputed: boolean;
  claimDeadline: bigint;
}

export interface AssetItem {
  vaultId: Hex32;
  assetId: Hex32;
  accessionNumber: string;
  title: string;
  contents: string;
  quorumOf: number;
  policy: AssetPolicy;
  released: boolean;
  claimed: boolean;
  status: Status;
}

export interface WireCard {
  kind: 0 | 1;
  a: Hex32;
  b: Hex32;
  encPk: string;
}

export interface AuditEvent {
  id: string;
  txHash: Hex32;
  /** Contract event name, e.g. Attested. Used for filtering. */
  eventName: string;
  /** Block timestamp, seconds. */
  timestamp: number;
  /** Key hash of the signer when known; null when unknown. */
  actor: Hex32 | null;
  /** Event arguments rendered as strings or numbers, described in plain words by copy.ts. */
  data: Record<string, string | number>;
}

export interface QueuedChange {
  changeId: Hex32;
  kind: string;
  description: string;
  applyAfter: number;
  queuedAt: number;
}

export interface GuardianStatus {
  index: number;
  keyId: Hex32;
  lastDrillVersion: number;
  lastDrillAt: number;
  ready: boolean;
}

export interface GuardianReadinessInfo {
  vaultId: Hex32;
  t: number;
  n: number;
  guardians: GuardianStatus[];
  readyCount: number;
  slack: number;
}

export type RoleName = 'owner' | 'guardian' | 'beneficiary';

export interface Attestation {
  index: number;
  reason: Reason;
  at: number;
  evidenceHash: Hex32;
}

/** What a guardian may see about an item: counts only, never other guardians. */
export interface GuardianNotice {
  vaultId: Hex32;
  assetId: Hex32;
  accessionNumber: string;
  title: string;
  status: Status;
  filed: number;
  kAttest: number;
  n: number;
  /** This guardian's own attestation, NONE if not filed. */
  myReason: Reason;
  iDisputed: boolean;
  releasable: boolean;
  sharesFiled: number;
  t: number;
  iSubmitted: boolean;
  /** Seconds until the window ends; 0 when not cooling. */
  opensIn: number;
  /** True when a dispute freezes the release. */
  frozen: boolean;
}

export type ClaimStep = 'waiting' | 'collecting' | 'decrypting' | 'ready' | 'claimed';

export interface ClaimProgress {
  vaultId: Hex32;
  assetId: Hex32;
  accessionNumber: string;
  title: string;
  step: ClaimStep;
  received: number;
  t: number;
  rejected: { guardianIndex: number; reason: string }[];
}

export interface ChainInfo {
  chainId: number;
  /** Seconds per TIME_UNIT. */
  timeUnit: number;
  blockNumber: bigint;
  /** Latest block timestamp, seconds. */
  now: number;
}

/** All durations crossing this interface are in seconds; adapters convert to TIME_UNIT. */
export interface ChainApi {
  setRole(role: RoleName): void;
  /** The signing account's own key and its backup owner key. */
  getOwnerKeys(): Promise<readonly [Hex32, Hex32]>;
  /** Remember pasted identity cards so the owner can seal to their holders (D1). */
  rememberCards(cards: WireCard[]): void;
  getChainInfo(): Promise<ChainInfo>;
  getVault(vaultId: Hex32): Promise<Vault>;
  getAsset(
    vaultId: Hex32,
    assetId: Hex32
  ): Promise<{ policy: AssetPolicy; released: boolean; claimed: boolean }>;
  status(vaultId: Hex32, assetId: Hex32): Promise<Status>;
  timeline(vaultId: Hex32, assetId: Hex32): Promise<Timeline>;
  isReleasable(vaultId: Hex32, assetId: Hex32): Promise<boolean>;
  currentClaimant(vaultId: Hex32, assetId: Hex32): Promise<Hex32>;
  listAssets(vaultId: Hex32): Promise<AssetItem[]>;
  getCurrentBlock(): Promise<bigint>;
  /** Owner view: one row per guardian index. */
  getAttestations(vaultId: Hex32): Promise<Attestation[]>;
  listAuditEvents(vaultId: Hex32): Promise<AuditEvent[]>;

  // Owner writes
  heartbeat(vaultId: Hex32): Promise<Hex32>;
  cancel(vaultId: Hex32): Promise<Hex32>;
  /** `secret` is sealed client-side; the mock ignores it. */
  addAsset(
    vaultId: Hex32,
    item: Omit<AssetItem, 'vaultId' | 'status' | 'released' | 'claimed'>,
    secret?: Uint8Array
  ): Promise<Hex32>;
  createVault(
    owners: readonly [Hex32, Hex32],
    guardians: Hex32[],
    t: number,
    policyDelay: number
  ): Promise<Hex32>;
  setAbsence(vaultId: Hex32, until: number): Promise<Hex32>;
  revokeChange(vaultId: Hex32, changeId: Hex32): Promise<Hex32>;
  listQueuedChanges(vaultId: Hex32): Promise<QueuedChange[]>;
  getGuardiansReadiness(vaultId: Hex32): Promise<GuardianReadinessInfo>;

  // Guardian
  listGuardianNotices(vaultId: Hex32): Promise<GuardianNotice[]>;
  getGuardianNotice(vaultId: Hex32, assetId: Hex32): Promise<GuardianNotice | null>;
  attest(vaultId: Hex32, reason: Reason, evidenceHash?: Hex32): Promise<Hex32>;
  dispute(vaultId: Hex32): Promise<Hex32>;
  submitShare(vaultId: Hex32, assetId: Hex32): Promise<Hex32>;
  /** Local readiness check; on-chain drill() is a stub until Phase 7. */
  drill(vaultId: Hex32, assetId: Hex32): Promise<boolean>;

  // Beneficiary
  listClaims(vaultId: Hex32): Promise<AssetItem[]>;
  getClaimProgress(vaultId: Hex32, assetId: Hex32): Promise<ClaimProgress | null>;
  reconstruct(vaultId: Hex32, assetId: Hex32): Promise<{ filename: string; bytes: Uint8Array }>;
  markClaimed(vaultId: Hex32, assetId: Hex32): Promise<Hex32>;

  toggleFailNextWrite(): boolean;
  isFailNextWrite(): boolean;
}
