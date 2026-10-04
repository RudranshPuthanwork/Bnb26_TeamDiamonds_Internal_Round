import type {
  AssetItem,
  AssetPolicy,
  AuditEvent,
  ChainApi,
  GuardianReadinessInfo,
  GuardianStatus,
  Hex32,
  QueuedChange,
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
  private vault: Vault = { ...MOCK_VAULT };
  private assets: AssetItem[] = [...MOCK_ASSETS];
  private queuedChanges: QueuedChange[] = [
    {
      changeId: '0x1010101010101010101010101010101010101010101010101010101010101010',
      kind: 'Threshold',
      description: 'Lower guardian threshold t from 3 to 2',
      applyAfter: Math.floor(Date.now() / 1000) + 345600, // 4 days remaining
      queuedAt: Math.floor(Date.now() / 1000) - 259200,
    },
    {
      changeId: '0x2020202020202020202020202020202020202020202020202020202020202020',
      kind: 'Beneficiary',
      description: 'Replace contingent beneficiary for HL-0007/07',
      applyAfter: Math.floor(Date.now() / 1000) + 518400, // 6 days remaining
      queuedAt: Math.floor(Date.now() / 1000) - 86400,
    },
  ];
  private auditEvents: AuditEvent[] = [
    {
      id: 'evt-1',
      txHash: '0x8f2a11b092c4e7d81a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f',
      eventName: 'VaultCreated',
      timestamp: 1727827200, // 02 Oct 2026
      details: 'Vault initialized with 5 guardians, threshold 3',
    },
    {
      id: 'evt-2',
      txHash: '0x9a3b22c103d5f8e92b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f50',
      eventName: 'Heartbeat',
      timestamp: 1729382400, // 19 Oct 2026
      details: 'Owner signature received for epoch 4',
    },
  ];
  private failNext: boolean = false;

  private generateFakeTx(): Hex32 {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return ('0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')) as Hex32;
  }

  private async simulateLatency(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  private async executeWrite<T>(action: string, mutate: () => T, details: string): Promise<{ txHash: Hex32; result: T }> {
    await this.simulateLatency();
    if (this.failNext) {
      this.failNext = false;
      throw new Error('The chain did not answer. Nothing was changed. Retry, or submit directly from a wallet.');
    }

    const result = mutate();
    const txHash = this.generateFakeTx();
    this.auditEvents.unshift({
      id: `evt-${Date.now()}`,
      txHash,
      eventName: action,
      timestamp: Math.floor(Date.now() / 1000),
      details,
    });
    return { txHash, result };
  }

  toggleFailNextWrite(): boolean {
    this.failNext = !this.failNext;
    return this.failNext;
  }

  isFailNextWrite(): boolean {
    return this.failNext;
  }

  async getVault(vaultId: Hex32): Promise<Vault> {
    if (vaultId !== this.vault.vaultId) {
      return { ...this.vault, vaultId };
    }
    return { ...this.vault };
  }

  async getAsset(
    vaultId: Hex32,
    assetId: Hex32
  ): Promise<{ policy: AssetPolicy; released: boolean; claimed: boolean }> {
    const asset =
      this.assets.find((a) => a.vaultId === vaultId && a.assetId === assetId) ??
      this.assets[0];
    return {
      policy: asset.policy,
      released: asset.released,
      claimed: asset.claimed,
    };
  }

  async status(vaultId: Hex32, assetId: Hex32): Promise<Status> {
    const asset = this.assets.find(
      (a) => a.vaultId === vaultId && a.assetId === assetId
    );
    return asset ? asset.status : Status.Sealed;
  }

  async timeline(vaultId: Hex32, assetId: Hex32): Promise<Timeline> {
    const asset =
      this.assets.find((a) => a.vaultId === vaultId && a.assetId === assetId) ??
      this.assets[0];

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
    const asset =
      this.assets.find((a) => a.vaultId === vaultId && a.assetId === assetId) ??
      this.assets[0];

    if (asset.status === Status.ContingentEligible) {
      return asset.policy.contingentBenef;
    }
    return asset.policy.primaryBenef;
  }

  async listAssets(vaultId: Hex32): Promise<AssetItem[]> {
    return [...this.assets.filter((a) => a.vaultId === vaultId)];
  }

  async getCurrentBlock(): Promise<bigint> {
    return MOCK_CURRENT_BLOCK;
  }

  // --- Write methods ---

  async heartbeat(_vaultId: Hex32): Promise<Hex32> {
    const { txHash } = await this.executeWrite(
      'Heartbeat',
      () => {
        this.vault.epoch += 1;
        this.vault.lastHeartbeat = Math.floor(Date.now() / 1000);
      },
      `Heartbeat recorded. Epoch advanced to ${this.vault.epoch + 1}`
    );
    return txHash;
  }

  async cancel(_vaultId: Hex32): Promise<Hex32> {
    const { txHash } = await this.executeWrite(
      'Cancelled',
      () => {
        this.vault.epoch += 1;
        this.vault.lastHeartbeat = Math.floor(Date.now() / 1000);
        // Reset everything not released to Sealed
        this.assets = this.assets.map((a) => {
          if (!a.released && a.status !== Status.Claimed) {
            return { ...a, status: Status.Sealed };
          }
          return a;
        });
      },
      `Owner cancel executed. Unreleased assets reset to Sealed. Epoch is now ${this.vault.epoch + 1}`
    );
    return txHash;
  }

  async addAsset(
    vaultId: Hex32,
    item: Omit<AssetItem, 'vaultId' | 'status' | 'released' | 'claimed'>
  ): Promise<Hex32> {
    const { txHash } = await this.executeWrite(
      'AssetAdded',
      () => {
        this.vault.epoch += 1;
        this.vault.lastHeartbeat = Math.floor(Date.now() / 1000);
        const newItem: AssetItem = {
          ...item,
          vaultId,
          status: Status.Sealed,
          released: false,
          claimed: false,
        };
        this.assets.push(newItem);
        return newItem;
      },
      `Asset ${item.accessionNumber} added to collection.`
    );
    return txHash;
  }

  async createVault(
    owners: readonly [Hex32, Hex32],
    guardians: Hex32[],
    t: number,
    policyDelay: number
  ): Promise<Hex32> {
    const newVaultId = this.generateFakeTx();
    const { txHash } = await this.executeWrite(
      'VaultCreated',
      () => {
        this.vault = {
          vaultId: newVaultId,
          owners,
          guardians: [...guardians],
          t,
          policyDelay,
          epoch: 1,
          lastHeartbeat: Math.floor(Date.now() / 1000),
          absentUntil: 0,
          disputedAt: 0,
          disputeEpoch: 0,
          disputer: 0,
        };
        this.assets = [];
        return newVaultId;
      },
      `New vault created with ${guardians.length} custodians, threshold ${t}`
    );
    return txHash;
  }

  async setAbsence(_vaultId: Hex32, until: number): Promise<Hex32> {
    const { txHash } = await this.executeWrite(
      'AbsenceSet',
      () => {
        this.vault.absentUntil = until;
      },
      `Planned absence set until timestamp ${until}`
    );
    return txHash;
  }

  async revokeChange(_vaultId: Hex32, changeId: Hex32): Promise<Hex32> {
    const { txHash } = await this.executeWrite(
      'ChangeRevoked',
      () => {
        this.queuedChanges = this.queuedChanges.filter((c) => c.changeId !== changeId);
      },
      `Queued policy change ${changeId.slice(0, 10)}… revoked.`
    );
    return txHash;
  }

  async listQueuedChanges(_vaultId: Hex32): Promise<QueuedChange[]> {
    return [...this.queuedChanges];
  }

  async getGuardiansReadiness(_vaultId: Hex32): Promise<GuardianReadinessInfo> {
    const guardianStatuses: GuardianStatus[] = this.vault.guardians.map((keyId, idx) => ({
      index: idx + 1,

      keyId,
      lastDrillVersion: 1,
      lastDrillAt: 1729267200 - idx * 86400, // Irregular dates around mid Oct
      ready: idx !== 4, // 4 out of 5 ready
    }));

    const readyCount = guardianStatuses.filter((g) => g.ready).length;
    const slack = readyCount - this.vault.t;

    return {
      vaultId: this.vault.vaultId,
      t: this.vault.t,
      n: this.vault.guardians.length,
      guardians: guardianStatuses,
      readyCount,
      slack,
    };
  }

  async listAuditEvents(): Promise<AuditEvent[]> {
    return [...this.auditEvents];
  }
}

export const mockApi = new MockChainApi();

