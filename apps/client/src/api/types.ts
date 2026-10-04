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
  eventName: string;
  timestamp: number;
  details: string;
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

export interface ChainApi {
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
  // Write methods per specification
  heartbeat(vaultId: Hex32): Promise<Hex32>;
  cancel(vaultId: Hex32): Promise<Hex32>;
  addAsset(
    vaultId: Hex32,
    item: Omit<AssetItem, 'vaultId' | 'status' | 'released' | 'claimed'>
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
  listAuditEvents(): Promise<AuditEvent[]>;
  toggleFailNextWrite(): boolean;
  isFailNextWrite(): boolean;
}

