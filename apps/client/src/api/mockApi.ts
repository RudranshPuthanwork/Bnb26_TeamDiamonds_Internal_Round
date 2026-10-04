import type {
  AssetItem,
  AssetPolicy,
  ChainApi,
  Hex32,
  Timeline,
  Vault,
} from './types';
import { Status } from './types';

export const MOCK_VAULT_ID: Hex32 =
  '0x7f4a819b13c02d1847a9884e62c1d04423b0981d77a0641dfb194017c62bb184';

export const MOCK_CURRENT_BLOCK = 14203118n;

export const MOCK_VAULT: Vault = {
  vaultId: MOCK_VAULT_ID,
  owners: [
    '0x3d7b8849c719e3401fa990089e5a59dbca484102146973e8cb14c4c8108a7122',
    '0x9c417f300184c7eb3901a5e42718cb498e103f19472304918734018fba817412',
  ],
  guardians: [
    '0x110294817ca93847201948571029485710293847102938471029384710293847',
    '0x220294817ca93847201948571029485710293847102938471029384710293847',
    '0x330294817ca93847201948571029485710293847102938471029384710293847',
    '0x440294817ca93847201948571029485710293847102938471029384710293847',
    '0x550294817ca93847201948571029485710293847102938471029384710293847',
  ],
  t: 3,
  policyDelay: 604800, // 7 days in seconds
  epoch: 4,
  lastHeartbeat: 1729382400, // 19 Oct
  absentUntil: 0,
  disputedAt: 0,
  disputeEpoch: 0,
  disputer: 0,
};

const BASE_POLICY: AssetPolicy = {
  reasonsMask: 6, // INCAPACITATED | DECEASED
  kAttest: 3,
  requireEvidence: false,
  minInactivity: 2592000, // 30 days
  window: 604800, // 7 days
  claimDeadline: 1209600, // 14 days
  primaryBenef:
    '0xaa01928374650192837465019283746501928374650192837465019283746501',
  contingentBenef:
    '0xbb01928374650192837465019283746501928374650192837465019283746501',
  bundleCid:
    '0x1220a4b7f8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5',
  version: 1,
  shareCommitments: [
    '0xc101928374650192837465019283746501928374650192837465019283746501',
    '0xc201928374650192837465019283746501928374650192837465019283746501',
    '0xc301928374650192837465019283746501928374650192837465019283746501',
    '0xc401928374650192837465019283746501928374650192837465019283746501',
    '0xc501928374650192837465019283746501928374650192837465019283746501',
  ],
};

export const MOCK_ASSETS: AssetItem[] = [
  {
    vaultId: MOCK_VAULT_ID,
    assetId: '0x0100000000000000000000000000000000000000000000000000000000000001',
    accessionNumber: 'HL-0007/01',
    title: 'Medical directive and records',
    contents: '3 files, 4.1 MB',
    quorumOf: 3,
    policy: { ...BASE_POLICY, kAttest: 2, window: 14 * 86400 },
    released: false,
    claimed: false,
    status: Status.Sealed,
  },
  {
    vaultId: MOCK_VAULT_ID,
    assetId: '0x0200000000000000000000000000000000000000000000000000000000000002',
    accessionNumber: 'HL-0007/02',
    title: 'Letters to Mira and Anil',
    contents: '14 files, 38 MB',
    quorumOf: 3,
    policy: { ...BASE_POLICY, kAttest: 2, window: 30 * 86400 },
    released: false,
    claimed: false,
    status: Status.Armed,
  },
  {
    vaultId: MOCK_VAULT_ID,
    assetId: '0x0300000000000000000000000000000000000000000000000000000000000003',
    accessionNumber: 'HL-0007/03',
    title: 'Wallet seed phrase',
    contents: '1 file, 312 B',
    quorumOf: 5,
    policy: { ...BASE_POLICY, kAttest: 3, window: 30 * 86400 },
    released: false,
    claimed: false,
    status: Status.Silent,
  },
  {
    vaultId: MOCK_VAULT_ID,
    assetId: '0x0400000000000000000000000000000000000000000000000000000000000004',
    accessionNumber: 'HL-0007/04',
    title: 'Bank and locker access list',
    contents: '1 file, 18 KB',
    quorumOf: 5,
    policy: { ...BASE_POLICY, kAttest: 3, window: 7 * 86400 },
    released: false,
    claimed: false,
    status: Status.Cooling,
  },
  {
    vaultId: MOCK_VAULT_ID,
    assetId: '0x0500000000000000000000000000000000000000000000000000000000000005',
    accessionNumber: 'HL-0007/05',
    title: 'Tax filings 2019–2025',
    contents: '7 files, 22 MB',
    quorumOf: 4,
    policy: { ...BASE_POLICY, kAttest: 2, window: 21 * 86400 },
    released: false,
    claimed: false,
    status: Status.Disputed,
  },
  {
    vaultId: MOCK_VAULT_ID,
    assetId: '0x0600000000000000000000000000000000000000000000000000000000000006',
    accessionNumber: 'HL-0007/06',
    title: 'Insurance policy scans',
    contents: '9 files, 11 MB',
    quorumOf: 3,
    policy: { ...BASE_POLICY, kAttest: 2, window: 10 * 86400 },
    released: true,
    claimed: false,
    status: Status.Releasable,
  },
  {
    vaultId: MOCK_VAULT_ID,
    assetId: '0x0700000000000000000000000000000000000000000000000000000000000007',
    accessionNumber: 'HL-0007/07',
    title: 'Property deeds, flat',
    contents: '5 files, 27 MB',
    quorumOf: 5,
    policy: { ...BASE_POLICY, kAttest: 3, window: 14 * 86400 },
    released: true,
    claimed: false,
    status: Status.ContingentEligible,
  },
  {
    vaultId: MOCK_VAULT_ID,
    assetId: '0x0800000000000000000000000000000000000000000000000000000000000008',
    accessionNumber: 'HL-0007/08',
    title: 'Domain and hosting logins',
    contents: '1 file, 2.2 KB',
    quorumOf: 5,
    policy: { ...BASE_POLICY, kAttest: 3, window: 5 * 86400 },
    released: true,
    claimed: true,
    status: Status.Claimed,
  },
];

export class MockChainApi implements ChainApi {
  async getVault(vaultId: Hex32): Promise<Vault> {
    if (vaultId !== MOCK_VAULT_ID) {
      return { ...MOCK_VAULT, vaultId };
    }
    return MOCK_VAULT;
  }

  async getAsset(
    vaultId: Hex32,
    assetId: Hex32
  ): Promise<{ policy: AssetPolicy; released: boolean; claimed: boolean }> {
    const asset = MOCK_ASSETS.find(
      (a) => a.vaultId === vaultId && a.assetId === assetId
    ) ?? MOCK_ASSETS[0];
    return {
      policy: asset.policy,
      released: asset.released,
      claimed: asset.claimed,
    };
  }

  async status(vaultId: Hex32, assetId: Hex32): Promise<Status> {
    const asset = MOCK_ASSETS.find(
      (a) => a.vaultId === vaultId && a.assetId === assetId
    );
    return asset ? asset.status : Status.Sealed;
  }

  async timeline(vaultId: Hex32, assetId: Hex32): Promise<Timeline> {
    const asset = MOCK_ASSETS.find(
      (a) => a.vaultId === vaultId && a.assetId === assetId
    ) ?? MOCK_ASSETS[0];

    const isCooling = asset.status === Status.Cooling;
    const isDisputed = asset.status === Status.Disputed;

    return {
      tSilence: 1729382400n + BigInt(asset.policy.minInactivity),
      tQuorum: 1729500000n,
      resumeAt: isDisputed ? 1730000000n : 0n,
      tOpen: 1729600000n,
      opensAt: isCooling ? 1729600000n + 100800n : 1729600000n,
      attestationsFiled: asset.status === Status.Armed ? 2 : asset.policy.kAttest,
      kAttest: asset.policy.kAttest,
      disputed: isDisputed,
      claimDeadline: 1731500000n,
    };
  }

  async isReleasable(vaultId: Hex32, assetId: Hex32): Promise<boolean> {
    const s = await this.status(vaultId, assetId);
    return s === Status.Releasable || s === Status.ContingentEligible;
  }

  async currentClaimant(vaultId: Hex32, assetId: Hex32): Promise<Hex32> {
    const asset = MOCK_ASSETS.find(
      (a) => a.vaultId === vaultId && a.assetId === assetId
    ) ?? MOCK_ASSETS[0];

    if (asset.status === Status.ContingentEligible) {
      return asset.policy.contingentBenef;
    }
    return asset.policy.primaryBenef;
  }

  async listAssets(vaultId: Hex32): Promise<AssetItem[]> {
    return MOCK_ASSETS.filter((a) => a.vaultId === vaultId);
  }

  async getCurrentBlock(): Promise<bigint> {
    return MOCK_CURRENT_BLOCK;
  }
}

export const mockApi = new MockChainApi();
