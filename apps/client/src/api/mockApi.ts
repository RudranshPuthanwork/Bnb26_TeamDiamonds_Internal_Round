import type {
  AssetItem,
  AssetPolicy,
  Attestation,
  AuditEvent,
  ChainApi,
  ChainInfo,
  ClaimProgress,
  GuardianNotice,
  GuardianReadinessInfo,
  GuardianStatus,
  Hex32,
  QueuedChange,
  RoleName,
  Timeline,
  Vault,
} from './types';
import { REASON_NAMES, Reason, Status } from './types';


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
  lastHeartbeat: Math.floor(Date.now() / 1000) - 12 * 86400,
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

const nowSec = () => Math.floor(Date.now() / 1000);
const DAY = 86400;
const ME_GUARDIAN = 1; // the mock guardian is index 1
const FILE_BYTES = new TextEncoder().encode(
  'Sample plaintext, 312 bytes in the real flow. Reconstructed by the mock adapter.'
);

type Mark = Record<number, { reason: Reason; at: number }>;

export class MockChainApi implements ChainApi {
  private vault: Vault = { ...MOCK_VAULT };
  private assets: AssetItem[] = MOCK_ASSETS.map((a) => ({ ...a }));
  private marks = new Map<Hex32, Mark>();
  private disputer = new Map<Hex32, number>();
  private shares = new Map<Hex32, Set<number>>();
  private rejected = new Map<Hex32, { guardianIndex: number; reason: string }[]>();
  private failNext = false;
  private seq = 0;
  private queuedChanges: QueuedChange[] = [
    {
      changeId: '0x1010101010101010101010101010101010101010101010101010101010101010',
      kind: 'Threshold',
      description: 'Lower guardian threshold t from 3 to 2',
      applyAfter: nowSec() + 4 * DAY,
      queuedAt: nowSec() - 3 * DAY,
    },
    {
      changeId: '0x2020202020202020202020202020202020202020202020202020202020202020',
      kind: 'Beneficiary',
      description: 'Replace contingent beneficiary for HL-0007/07',
      applyAfter: nowSec() + 6 * DAY,
      queuedAt: nowSec() - DAY,
    },
  ];
  private auditEvents: AuditEvent[] = [];

  constructor() {
    const t0 = nowSec();
    const g = this.vault.guardians;
    const id = (n: number) => this.assets[n].assetId;
    this.event('VaultCreated', null, { guardians: 5, t: 3 }, t0 - 40 * DAY);
    this.event('AssetAdded', this.vault.owners[0], { accession: 'HL-0007/01' }, t0 - 39 * DAY);
    this.event('Heartbeat', this.vault.owners[0], { epoch: 3 }, t0 - 20 * DAY);
    // seeded marks mirror the seeded statuses
    this.mark(id(1), 2, Reason.INCAPACITATED, t0 - 2 * DAY);
    this.mark(id(1), 3, Reason.DECEASED, t0 - 1 * DAY);
    [1, 2, 3].forEach((i, k) => this.mark(id(3), i, Reason.DECEASED, t0 - (3 - k) * DAY));
    [1, 2, 4].forEach((i, k) => this.mark(id(4), i, Reason.INCAPACITATED, t0 - (6 - k) * DAY));
    this.disputer.set(id(4), 4);
    this.vault.disputer = 4;
    this.vault.disputedAt = t0 - 5 * DAY;
    this.vault.disputeEpoch = this.vault.epoch;
    [1, 2, 3].forEach((i, k) => this.mark(id(5), i, Reason.DECEASED, t0 - (12 - k) * DAY));
    this.shares.set(id(5), new Set([2, 3]));
    this.rejected.set(id(5), [{ guardianIndex: 3, reason: 'Share did not match its commitment' }]);
    this.event('Attested', g[1], { guardian: 2, reason: 'INCAPACITATED' }, t0 - 2 * DAY);
    this.event('Attested', g[2], { guardian: 3, reason: 'DECEASED' }, t0 - 1 * DAY);
    this.event('Disputed', g[3], { guardian: 4 }, t0 - 5 * DAY);
    this.event('ShareSubmitted', g[1], { guardian: 2, accession: 'HL-0007/06' }, t0 - 3600 * 5);
    this.event('ShareSubmitted', g[2], { guardian: 3, accession: 'HL-0007/06' }, t0 - 3600 * 3);
    this.event('Claimed', null, { accession: 'HL-0007/08' }, t0 - 9 * DAY);
  }

  private mark(assetId: Hex32, index: number, reason: Reason, at: number) {
    const m = this.marks.get(assetId) ?? {};
    m[index] = { reason, at };
    this.marks.set(assetId, m);
  }

  private event(
    eventName: string,
    actor: Hex32 | null,
    data: AuditEvent['data'],
    timestamp = nowSec(),
    txHash?: Hex32
  ) {
    this.auditEvents.unshift({
      id: `evt-${++this.seq}`,
      txHash: txHash ?? this.fakeTx(),
      eventName,
      timestamp,
      actor,
      data,
    });
    this.auditEvents.sort((a, b) => b.timestamp - a.timestamp);
  }

  private fakeTx(): Hex32 {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return ('0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')) as Hex32;
  }

  /** Mock writes wait 600 ms, then mutate in-memory state and append an audit event. */
  private async write(
    eventName: string,
    actor: Hex32 | null,
    data: AuditEvent['data'],
    mutate: () => void
  ): Promise<Hex32> {
    await new Promise((resolve) => setTimeout(resolve, 600));
    if (this.failNext) {
      this.failNext = false;
      throw new Error('The chain did not answer. Nothing was changed. Retry, or submit directly from a wallet.');
    }
    mutate();
    const txHash = this.fakeTx();
    this.event(eventName, actor, data, nowSec(), txHash);
    return txHash;
  }

  private find(assetId: Hex32) {
    const a = this.assets.find((x) => x.assetId === assetId);
    if (!a) throw new Error('Item not found in this collection register.');
    return a;
  }

  private filed(assetId: Hex32) {
    return Object.keys(this.marks.get(assetId) ?? {}).length;
  }

  private bumpStatus(a: AssetItem) {
    if (a.released || a.claimed) return;
    if (this.disputer.has(a.assetId)) a.status = Status.Disputed;
    else if (this.filed(a.assetId) >= a.policy.kAttest) a.status = Status.Cooling;
    else if (this.filed(a.assetId) > 0) a.status = Status.Armed;
    else a.status = Status.Sealed;
  }

  setRole(_role: RoleName) {
    // The mock acts as guardian 1 and the primary beneficiary regardless of role.
  }

  toggleFailNextWrite(): boolean {
    this.failNext = !this.failNext;
    return this.failNext;
  }

  isFailNextWrite(): boolean {
    return this.failNext;
  }

  async getChainInfo(): Promise<ChainInfo> {
    return { chainId: 84532, timeUnit: DAY, blockNumber: MOCK_CURRENT_BLOCK, now: nowSec() };
  }

  async getVault(vaultId: Hex32): Promise<Vault> {
    return { ...this.vault, vaultId: vaultId ?? this.vault.vaultId };
  }

  async getAsset(_v: Hex32, assetId: Hex32) {
    const a = this.find(assetId);
    return { policy: a.policy, released: a.released, claimed: a.claimed };
  }

  async status(_v: Hex32, assetId: Hex32): Promise<Status> {
    return this.find(assetId).status;
  }

  async timeline(_v: Hex32, assetId: Hex32): Promise<Timeline> {
    const a = this.find(assetId);
    const t = nowSec();
    const marks = Object.values(this.marks.get(assetId) ?? {});
    const tQuorum = marks.length >= a.policy.kAttest ? Math.max(...marks.map((m) => m.at)) : 0;
    const cooling = a.status === Status.Cooling;
    return {
      tSilence: BigInt(this.vault.lastHeartbeat + a.policy.minInactivity),
      tQuorum: BigInt(tQuorum),
      resumeAt: 0n,
      tOpen: tQuorum ? BigInt(tQuorum + a.policy.window) : 0n,
      opensAt: cooling ? BigInt(t + 28 * 3600) : tQuorum ? BigInt(tQuorum + a.policy.window) : 0n,
      attestationsFiled: this.filed(assetId),
      kAttest: a.policy.kAttest,
      disputed: this.disputer.has(assetId),
      claimDeadline: BigInt(t + a.policy.claimDeadline),
    };
  }

  async isReleasable(_v: Hex32, assetId: Hex32): Promise<boolean> {
    const s = this.find(assetId).status;
    return s === Status.Releasable || s === Status.ContingentEligible;
  }

  async currentClaimant(_v: Hex32, assetId: Hex32): Promise<Hex32> {
    const a = this.find(assetId);
    return a.status === Status.ContingentEligible ? a.policy.contingentBenef : a.policy.primaryBenef;
  }

  async listAssets(vaultId: Hex32): Promise<AssetItem[]> {
    return this.assets.filter((a) => a.vaultId === vaultId || vaultId === this.vault.vaultId).map((a) => ({ ...a }));
  }

  async getCurrentBlock(): Promise<bigint> {
    return MOCK_CURRENT_BLOCK;
  }

  async getAttestations(_v?: Hex32, _a?: Hex32): Promise<Attestation[]> {
    const out: Attestation[] = [];
    // Owner view: one row per guardian index, aggregated over the first asset with marks.
    const merged: Mark = {};
    for (const m of this.marks.values()) Object.assign(merged, m);
    for (let i = 1; i <= this.vault.guardians.length; i++) {
      const m = merged[i];
      out.push({
        index: i,
        reason: m?.reason ?? Reason.NONE,
        at: m?.at ?? 0,
        evidenceHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      });
    }
    return out;
  }

  async listAuditEvents(_v?: Hex32, _a?: Hex32): Promise<AuditEvent[]> {
    return [...this.auditEvents];
  }

  // --- Owner writes ---

  async heartbeat(_v?: Hex32, _a?: Hex32): Promise<Hex32> {
    return this.write('Heartbeat', this.vault.owners[0], { epoch: this.vault.epoch + 1 }, () => {
      this.vault.epoch += 1;
      this.vault.lastHeartbeat = nowSec();
    });
  }

  async cancel(_v?: Hex32, _a?: Hex32): Promise<Hex32> {
    return this.write('Cancelled', this.vault.owners[0], { epoch: this.vault.epoch + 1 }, () => {
      this.vault.epoch += 1;
      this.vault.lastHeartbeat = nowSec();
      this.vault.disputedAt = 0;
      for (const a of this.assets) {
        if (a.released || a.claimed) continue;
        this.marks.delete(a.assetId);
        this.disputer.delete(a.assetId);
        a.status = Status.Sealed;
      }
    });
  }

  async addAsset(
    vaultId: Hex32,
    item: Omit<AssetItem, 'vaultId' | 'status' | 'released' | 'claimed'>
  ): Promise<Hex32> {
    return this.write('AssetAdded', this.vault.owners[0], { accession: item.accessionNumber }, () => {
      this.vault.epoch += 1;
      this.vault.lastHeartbeat = nowSec();
      this.assets.push({ ...item, vaultId, status: Status.Sealed, released: false, claimed: false });
    });
  }

  async createVault(
    owners: readonly [Hex32, Hex32],
    guardians: Hex32[],
    t: number,
    policyDelay: number
  ): Promise<Hex32> {
    const newVaultId = this.fakeTx();
    await this.write('VaultCreated', owners[0], { guardians: guardians.length, t }, () => {
      this.vault = {
        vaultId: newVaultId,
        owners,
        guardians: [...guardians],
        t,
        policyDelay,
        epoch: 1,
        lastHeartbeat: nowSec(),
        absentUntil: 0,
        disputedAt: 0,
        disputeEpoch: 0,
        disputer: 0,
      };
      this.assets = [];
    });
    return newVaultId;
  }

  async setAbsence(_v: Hex32, until: number): Promise<Hex32> {
    return this.write('AbsenceSet', this.vault.owners[0], { until }, () => {
      this.vault.absentUntil = until;
    });
  }

  async revokeChange(_v: Hex32, changeId: Hex32): Promise<Hex32> {
    return this.write('ChangeRevoked', this.vault.owners[0], { changeId }, () => {
      this.queuedChanges = this.queuedChanges.filter((c) => c.changeId !== changeId);
    });
  }

  async listQueuedChanges(_v?: Hex32, _a?: Hex32): Promise<QueuedChange[]> {
    return [...this.queuedChanges];
  }

  async getGuardiansReadiness(_v?: Hex32, _a?: Hex32): Promise<GuardianReadinessInfo> {
    const guardians: GuardianStatus[] = this.vault.guardians.map((keyId, idx) => ({
      index: idx + 1,
      keyId,
      lastDrillVersion: 1,
      lastDrillAt: nowSec() - (idx + 3) * DAY,
      ready: idx !== 4,
    }));
    const readyCount = guardians.filter((g) => g.ready).length;
    return {
      vaultId: this.vault.vaultId,
      t: this.vault.t,
      n: guardians.length,
      guardians,
      readyCount,
      slack: readyCount - this.vault.t,
    };
  }

  // --- Guardian ---

  private notice(a: AssetItem): GuardianNotice {
    const mine = this.marks.get(a.assetId)?.[ME_GUARDIAN];
    const sent = this.shares.get(a.assetId) ?? new Set<number>();
    return {
      vaultId: a.vaultId,
      assetId: a.assetId,
      accessionNumber: a.accessionNumber,
      title: a.title,
      status: a.status,
      filed: this.filed(a.assetId),
      kAttest: a.policy.kAttest,
      n: this.vault.guardians.length,
      myReason: mine?.reason ?? Reason.NONE,
      iDisputed: this.disputer.get(a.assetId) === ME_GUARDIAN,
      releasable: a.status === Status.Releasable,
      sharesFiled: sent.size,
      t: this.vault.t,
      iSubmitted: sent.has(ME_GUARDIAN),
      opensIn: a.status === Status.Cooling ? 28 * 3600 : 0,
      frozen: a.status === Status.Disputed,
    };
  }

  async listGuardianNotices(_v?: Hex32, _a?: Hex32): Promise<GuardianNotice[]> {
    return this.assets.map((a) => this.notice(a));
  }

  async getGuardianNotice(_v: Hex32, assetId: Hex32): Promise<GuardianNotice | null> {
    const a = this.assets.find((x) => x.assetId === assetId);
    return a ? this.notice(a) : null;
  }

  async attest(_v: Hex32, reason: Reason, _evidenceHash?: Hex32): Promise<Hex32> {
    return this.write('Attested', this.vault.guardians[ME_GUARDIAN - 1], { guardian: ME_GUARDIAN, reason: REASON_NAMES[reason] }, () => {
      for (const a of this.assets) {
        if (a.released || a.claimed) continue;
        this.mark(a.assetId, ME_GUARDIAN, reason, nowSec());
        this.bumpStatus(a);
      }
    });
  }

  async dispute(): Promise<Hex32> {
    return this.write('Disputed', this.vault.guardians[ME_GUARDIAN - 1], { guardian: ME_GUARDIAN }, () => {
      for (const a of this.assets) {
        if (a.released || a.claimed) continue;
        this.disputer.set(a.assetId, ME_GUARDIAN);
        this.bumpStatus(a);
      }
    });
  }

  async submitShare(_v: Hex32, assetId: Hex32): Promise<Hex32> {
    const a = this.find(assetId);
    return this.write('ShareSubmitted', this.vault.guardians[ME_GUARDIAN - 1], { guardian: ME_GUARDIAN, accession: a.accessionNumber }, () => {
      const set = this.shares.get(assetId) ?? new Set<number>();
      set.add(ME_GUARDIAN);
      this.shares.set(assetId, set);
    });
  }

  async drill(_v: Hex32, assetId: Hex32): Promise<boolean> {
    const a = this.find(assetId);
    await this.write('DrillPassed', this.vault.guardians[ME_GUARDIAN - 1], { guardian: ME_GUARDIAN, accession: a.accessionNumber }, () => {});
    return true;
  }

  // --- Beneficiary ---

  async listClaims(_v?: Hex32, _a?: Hex32): Promise<AssetItem[]> {
    return this.assets.map((a) => ({ ...a }));
  }

  async getClaimProgress(_v: Hex32, assetId: Hex32): Promise<ClaimProgress | null> {
    const a = this.assets.find((x) => x.assetId === assetId);
    if (!a) return null;
    const received = (this.shares.get(assetId)?.size ?? 0) - (this.rejected.get(assetId)?.length ?? 0);
    const t = this.vault.t;
    const step = a.claimed
      ? 'claimed'
      : !a.released && a.status !== Status.Releasable
        ? 'waiting'
        : received >= t
          ? 'ready'
          : 'collecting';
    return {
      vaultId: a.vaultId,
      assetId,
      accessionNumber: a.accessionNumber,
      title: a.title,
      step,
      received: Math.max(0, received),
      t,
      rejected: this.rejected.get(assetId) ?? [],
    };
  }

  async reconstruct(_v?: Hex32, _a?: Hex32): Promise<{ filename: string; bytes: Uint8Array }> {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { filename: 'heirloom-item.txt', bytes: FILE_BYTES };
  }

  async markClaimed(_v: Hex32, assetId: Hex32): Promise<Hex32> {
    const a = this.find(assetId);
    return this.write('Claimed', a.policy.primaryBenef, { accession: a.accessionNumber }, () => {
      a.claimed = true;
      a.status = Status.Claimed;
    });
  }
}

export const mockApi = new MockChainApi();
