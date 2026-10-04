import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
  hexToBytes,
  http,
  bytesToHex,
  parseEventLogs,
  toHex,
  zeroHash,
  type Address,
  type PublicClient,
} from 'viem';
import { heirloomRegistryAbi as abi } from '@heirloom/abi';
import { Action, DIRECT_AUTH, eoaKeyId, fetchDomain, fetchNonce, signAction, type Auth, type Domain } from '@heirloom/auth';
import {
  beneficiaryReconstruct,
  drillCheck,
  guardianOpenShare,
  guardianReencrypt,
  keyIdOf,
  ReconstructError,
  sealAsset,
  type Bundle,
  type IdentityCard,
  type Rejected,
  type WireCard,
} from '@heirloom/crypto';
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
  Hex32,
  QueuedChange,
  RoleName,
  Timeline,
  Vault,
} from './types';
import { REASON_NAMES, Reason, Status } from './types';
import { defaultBundleStore, type BundleStore } from './bundleStore';
import { defaultKv, type Kv } from './localKv';
import { accountFor, accountIndexForRole } from '../dev/devSigner';
import { DevKeystore } from '../dev/keystore';
import { COPY } from '../copy';

export interface ChainConfig {
  rpcUrl: string;
  registry: Address;
  deployBlock: bigint;
  chainId: number;
  /** VITE_RELAYER_URL. Set: signed EOA_SIG calls go through the relayer. Unset: DIRECT. */
  relayerUrl?: string;
}

/** The relayer answered with an error or did not answer. `relayName` is the contract error name when known. */
export class RelayError extends Error {
  constructor(readonly relayName: string, detail: string) {
    super(`${relayName}: ${detail}`);
    this.name = 'RelayError';
  }
}

const SIGNATURE_TTL = 600n; // seconds; short, because a signed payload can be replayed by any relayer until then (review 1c N4)
const SECRET_FILE = 'heirloom-item.bin';

const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const cardFromWire = (c: WireCard): IdentityCard => ({ kind: c.kind, a: c.a, b: c.b, encPk: unb64(c.encPk) });
const pad4 = (n: number) => String(n).padStart(4, '0');
const pad2 = (n: number) => String(n).padStart(2, '0');

interface Meta {
  accession: string;
  title: string;
  contents: string;
}

interface ClaimCache {
  key: string;
  rejected: Rejected[];
  plaintext?: Uint8Array;
  received: number;
}

/** The real adapter. Runs unchanged in the browser and in Node (walk script). DIRECT auth only. */
export class ChainClient implements ChainApi {
  readonly pub: PublicClient;
  readonly keystore: DevKeystore;
  readonly bundles: BundleStore;
  readonly kv: Kv;
  private accountIndex = 0;
  private guardianNumber = 1;
  private failNext = false;
  /** True after a relayer outage (not a contract revert). The UI offers direct submission; the user decides. */
  relayerFailed = false;
  private direct = false;
  private domain?: Domain;
  private unit: number | null = null;
  private blockTimes = new Map<bigint, number>();
  private claims = new Map<string, ClaimCache>();

  constructor(
    readonly cfg: ChainConfig,
    deps: { bundles?: BundleStore; kv?: Kv; keystore?: DevKeystore } = {}
  ) {
    this.kv = deps.kv ?? defaultKv();
    this.bundles = deps.bundles ?? defaultBundleStore();
    this.keystore = deps.keystore ?? new DevKeystore(this.kv);
    this.pub = createPublicClient({ chain: this.chain, transport: http(cfg.rpcUrl) }) as PublicClient;
  }

  get chain() {
    return defineChain({
      id: this.cfg.chainId,
      name: this.cfg.chainId === 31337 ? 'Anvil' : `Chain ${this.cfg.chainId}`,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [this.cfg.rpcUrl] } },
    });
  }

  // ---------- acting account (dev signer, DIRECT auth) ----------

  setRole(role: RoleName) {
    this.accountIndex = accountIndexForRole(role, this.guardianNumber);
    this.role = role;
  }
  private role: RoleName = 'owner';

  setGuardianNumber(n: number) {
    this.guardianNumber = n;
    if (this.role === 'guardian') this.accountIndex = accountIndexForRole('guardian', n);
  }

  get actingAccount() {
    return this.accountIndex;
  }

  /** Act as an arbitrary anvil account (walk script). */
  useAccount(index: number) {
    this.accountIndex = index;
  }

  private myKeyId() {
    return this.keystore.keyId(this.accountIndex);
  }

  // ---------- plumbing ----------

  private async r<T>(functionName: string, args: unknown[] = []): Promise<T> {
    return (await this.pub.readContract({ address: this.cfg.registry, abi, functionName, args } as never)) as T;
  }

  /** The user's explicit choice after a relayer failure: the next write goes straight from the wallet. */
  chooseDirect() {
    this.direct = true;
    this.relayerFailed = false;
  }

  /**
   * The single submit path. `build` puts the Auth into the call's args. With a relayer the call is signed
   * (EOA_SIG) and posted; a relayer failure is thrown, never retried directly (see chooseDirect).
   */
  private async w(
    functionName: string,
    action: Action,
    vaultId: Hex32,
    params: Record<string, unknown>,
    build: (auth: Auth) => unknown[]
  ) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('The chain did not answer. Nothing was changed. Retry, or submit directly from a wallet.');
    }
    const account = accountFor(this.accountIndex);
    let hash: Hex32;
    if (this.cfg.relayerUrl && !this.direct) {
      hash = await this.relay(functionName, build(await this.sign(account, action, vaultId, params)));
    } else {
      this.direct = false;
      const { request } = await this.pub.simulateContract({
        address: this.cfg.registry,
        abi,
        functionName,
        args: build(DIRECT_AUTH),
        account,
      } as never);
      const wallet = createWalletClient({ account, chain: this.chain, transport: http(this.cfg.rpcUrl) });
      hash = (await wallet.writeContract(request as never)) as Hex32;
    }
    const receipt = await this.pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('The transaction reverted.');
    return { hash, receipt };
  }

  private async sign(account: ReturnType<typeof accountFor>, action: Action, vaultId: Hex32, params: Record<string, unknown>) {
    this.domain ??= await fetchDomain(this.pub, this.cfg.registry);
    const [nonce, block] = await Promise.all([
      fetchNonce(this.pub, this.cfg.registry, eoaKeyId(account.address)),
      this.pub.getBlock({ blockTag: 'latest' }), // chain time, not wall clock: anvil time can be warped
    ]);
    return signAction(account, this.domain, action, vaultId, params, nonce, block.timestamp + SIGNATURE_TTL);
  }

  private async relay(functionName: string, args: unknown[]): Promise<Hex32> {
    const data = encodeFunctionData({ abi, functionName, args } as never);
    let res: Response;
    try {
      res = await fetch(`${this.cfg.relayerUrl}/relay`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chainId: this.cfg.chainId, to: this.cfg.registry, data }),
      });
    } catch {
      this.relayerFailed = true;
      throw new RelayError('Unreachable', 'the relayer did not answer');
    }
    const body = (await res.json().catch(() => ({}))) as { txHash?: Hex32; error?: { name?: string; message?: string } };
    if (res.ok && body.txHash) {
      this.relayerFailed = false;
      return body.txHash;
    }
    const name = body.error?.name ?? 'Unreachable';
    this.relayerFailed = !(name in COPY.errors.reverts); // a contract revert would fail the same way directly
    throw new RelayError(name, body.error?.message ?? `HTTP ${res.status}`);
  }

  private async timeUnit() {
    if (this.unit === null) this.unit = Number(await this.r<bigint>('TIME_UNIT'));
    return this.unit;
  }

  private async toUnits(seconds: number) {
    return Math.max(1, Math.ceil(seconds / (await this.timeUnit())));
  }

  toggleFailNextWrite() {
    this.failNext = !this.failNext;
    return this.failNext;
  }
  isFailNextWrite() {
    return this.failNext;
  }

  // ---------- local metadata (names never go on chain) ----------

  private meta(assetId: Hex32): Meta | null {
    const s = this.kv.get(`heirloom.meta.${assetId}`);
    return s ? (JSON.parse(s) as Meta) : null;
  }

  async getOwnerKeys() {
    return [await this.keystore.keyId(0), await this.keystore.keyId(1)] as const;
  }

  rememberCards(cards: WireCard[]) {
    cards.forEach((c) => this.rememberCard(cardFromWire(c)));
  }

  /** Remember an identity card so the owner can seal to its holder (D1). */
  rememberCard(card: IdentityCard) {
    this.kv.set(
      `heirloom.card.${keyIdOf(card)}`,
      JSON.stringify({ kind: card.kind, a: card.a, b: card.b, encPk: bytesToHex(card.encPk) })
    );
  }

  private async cardOf(keyId: Hex32): Promise<IdentityCard> {
    const s = this.kv.get(`heirloom.card.${keyId}`);
    if (s) {
      const j = JSON.parse(s) as { kind: 0 | 1; a: Hex32; b: Hex32; encPk: `0x${string}` };
      return { ...j, encPk: hexToBytes(j.encPk) };
    }
    // Dev fallback: the anvil accounts' identities are known to the dev keystore.
    for (let i = 0; i <= 8; i++) {
      const c = await this.keystore.card(i);
      if (keyIdOf(c).toLowerCase() === keyId.toLowerCase()) return c;
    }
    throw new Error('An identity card is missing for one of the participants. Paste it in Create collection first.');
  }

  // ---------- chain info and reads ----------

  async getChainInfo(): Promise<ChainInfo> {
    const [block, unit] = await Promise.all([this.pub.getBlock({ blockTag: 'latest' }), this.timeUnit()]);
    return {
      chainId: this.cfg.chainId,
      timeUnit: unit,
      blockNumber: block.number,
      now: Number(block.timestamp),
    };
  }

  async getCurrentBlock() {
    return this.pub.getBlockNumber();
  }

  async getVault(vaultId: Hex32): Promise<Vault> {
    const [owners, guardians, t, policyDelay, epoch, lastHeartbeat, absentUntil, disputedAt, disputeEpoch, disputer] =
      await this.r<readonly [readonly [Hex32, Hex32], Hex32[], number, number, number, number, number, number, number, number]>(
        'getVault',
        [vaultId]
      );
    if (BigInt(owners[0]) === 0n) throw new Error('NoVault');
    return {
      vaultId,
      owners,
      guardians: [...guardians],
      t,
      policyDelay: policyDelay * (await this.timeUnit()),
      epoch,
      lastHeartbeat,
      absentUntil,
      disputedAt,
      disputeEpoch,
      disputer,
    };
  }

  private async toPolicy(raw: Record<string, unknown>): Promise<AssetPolicy> {
    const u = await this.timeUnit();
    return {
      reasonsMask: Number(raw.reasonsMask),
      kAttest: Number(raw.kAttest),
      requireEvidence: Boolean(raw.requireEvidence),
      minInactivity: Number(raw.minInactivity) * u,
      window: Number(raw.window) * u,
      claimDeadline: Number(raw.claimDeadline) * u,
      primaryBenef: raw.primaryBenef as Hex32,
      contingentBenef: raw.contingentBenef as Hex32,
      bundleCid: raw.bundleCid as Hex32,
      version: Number(raw.version),
      shareCommitments: [...(raw.shareCommitments as Hex32[])],
    };
  }

  async getAsset(vaultId: Hex32, assetId: Hex32) {
    const [policy, released, claimed] = await this.r<readonly [Record<string, unknown>, boolean, boolean]>('getAsset', [
      vaultId,
      assetId,
    ]);
    if (BigInt(policy.primaryBenef as Hex32) === 0n) throw new Error('NoAsset');
    return { policy: await this.toPolicy(policy), released, claimed };
  }

  async status(vaultId: Hex32, assetId: Hex32) {
    return (await this.r<number>('status', [vaultId, assetId])) as Status;
  }

  async timeline(vaultId: Hex32, assetId: Hex32): Promise<Timeline> {
    const t = await this.r<readonly [bigint, bigint, bigint, bigint, bigint, number, number, boolean, bigint]>('timeline', [
      vaultId,
      assetId,
    ]);
    return {
      tSilence: t[0],
      tQuorum: t[1],
      resumeAt: t[2],
      tOpen: t[3],
      opensAt: t[4],
      attestationsFiled: t[5],
      kAttest: t[6],
      disputed: t[7],
      claimDeadline: t[8],
    };
  }

  isReleasable(vaultId: Hex32, assetId: Hex32) {
    return this.r<boolean>('isReleasable', [vaultId, assetId]);
  }

  currentClaimant(vaultId: Hex32, assetId: Hex32) {
    return this.r<Hex32>('currentClaimant', [vaultId, assetId]);
  }

  private async eventLogs(name: string, args?: Record<string, unknown>) {
    const item = abi.find((x) => x.type === 'event' && x.name === name);
    return (await this.pub.getLogs({
      address: this.cfg.registry,
      event: item,
      args,
      fromBlock: this.cfg.deployBlock,
      toBlock: 'latest',
    } as never)) as unknown as { args: Record<string, unknown> }[];
  }

  async listAssets(vaultId: Hex32): Promise<AssetItem[]> {
    const vault = await this.getVault(vaultId);
    const logs = await this.eventLogs('AssetAdded', { vaultId });
    return Promise.all(
      logs.map(async (l, k) => {
        const assetId = l.args.assetId as Hex32;
        const [{ policy, released, claimed }, status, m] = await Promise.all([
          this.getAsset(vaultId, assetId),
          this.status(vaultId, assetId),
          Promise.resolve(this.meta(assetId)),
        ]);
        return {
          vaultId,
          assetId,
          accessionNumber: m?.accession ?? `HL-${pad4(Number(BigInt(vaultId)))}/${pad2(k + 1)}`,
          title: m?.title ?? `Item ${k + 1}`,
          contents: m?.contents ?? '',
          quorumOf: vault.guardians.length,
          policy,
          released,
          claimed,
          status,
        };
      })
    );
  }

  async getAttestations(vaultId: Hex32): Promise<Attestation[]> {
    const vault = await this.getVault(vaultId);
    return Promise.all(
      vault.guardians.map(async (_g, i) => {
        const [reason, at, evidenceHash] = await this.r<readonly [number, number, Hex32]>('getAttestation', [vaultId, i]);
        return { index: i + 1, reason: reason as Reason, at, evidenceHash };
      })
    );
  }

  private async blockTime(n: bigint) {
    let t = this.blockTimes.get(n);
    if (t === undefined) {
      t = Number((await this.pub.getBlock({ blockNumber: n })).timestamp);
      this.blockTimes.set(n, t);
    }
    return t;
  }

  async listAuditEvents(vaultId: Hex32): Promise<AuditEvent[]> {
    const logs = await this.pub.getLogs({
      address: this.cfg.registry,
      fromBlock: this.cfg.deployBlock,
      toBlock: 'latest',
    });
    const parsed = parseEventLogs({ abi, logs, strict: false }) as unknown as {
      eventName: string;
      args: Record<string, unknown>;
      blockNumber: bigint;
      logIndex: number;
      transactionHash: Hex32;
    }[];
    const mine = parsed.filter((e) => e.args && e.args.vaultId === vaultId);
    const rows = await Promise.all(
      mine.map(async (e): Promise<AuditEvent> => {
        const [timestamp, tx] = await Promise.all([
          this.blockTime(e.blockNumber),
          this.pub.getTransaction({ hash: e.transactionHash }),
        ]);
        const a = e.args;
        const g = typeof a.guardian === 'number' ? a.guardian + 1 : 0;
        const acc = a.assetId ? this.meta(a.assetId as Hex32)?.accession ?? '' : '';
        const data: AuditEvent['data'] = {};
        if (e.eventName === 'VaultCreated') Object.assign(data, { guardians: Number(a.guardians), t: Number(a.t) });
        if (e.eventName === 'Heartbeat' || e.eventName === 'Cancelled') data.epoch = Number(a.epoch);
        if (e.eventName === 'AbsenceSet') data.until = Number(a.until);
        if (e.eventName === 'Attested') Object.assign(data, { guardian: g, reason: REASON_NAMES[Number(a.reason) as Reason] });
        if (e.eventName === 'Disputed' || e.eventName === 'DrillPassed') data.guardian = g;
        if (e.eventName === 'ShareSubmitted') Object.assign(data, { guardian: g, accession: acc });
        if (e.eventName === 'AssetAdded' || e.eventName === 'Claimed') data.accession = acc;
        return {
          id: `${e.blockNumber}-${e.logIndex}`,
          txHash: e.transactionHash,
          eventName: e.eventName,
          timestamp,
          actor: keyIdOf({ kind: 0, a: `0x${tx.from.slice(2).padStart(64, '0')}` as Hex32, b: zeroHash }),
          data,
        };
      })
    );
    return rows.sort((x, y) => y.timestamp - x.timestamp || y.id.localeCompare(x.id));
  }

  async listQueuedChanges(): Promise<QueuedChange[]> {
    return []; // queueChange reverts NotImplemented until Phase 7, so nothing can be queued.
  }

  async getGuardiansReadiness(vaultId: Hex32): Promise<GuardianReadinessInfo> {
    const vault = await this.getVault(vaultId);
    const guardians = await Promise.all(
      vault.guardians.map(async (keyId, i) => {
        const [version, at] = await this.r<readonly [number, number]>('lastDrill', [vaultId, i]);
        return { index: i + 1, keyId, lastDrillVersion: version, lastDrillAt: at, ready: version >= 1 };
      })
    );
    const readyCount = guardians.filter((g) => g.ready).length;
    return { vaultId, t: vault.t, n: guardians.length, guardians, readyCount, slack: readyCount - vault.t };
  }

  // ---------- owner writes ----------

  async createVault(owners: readonly [Hex32, Hex32], guardians: Hex32[], t: number, policyDelay: number) {
    const units = await this.toUnits(policyDelay);
    // The digest binds vaultId = vaultCount + 1 (review 1c N6); a front-run vault makes this BadAuth, so retry re-signs.
    const next = toHex((await this.r<bigint>('vaultCount')) + 1n, { size: 32 });
    const { receipt } = await this.w('createVault', Action.CreateVault, next, { owners, guardians, t, policyDelay: units }, (a) => [
      owners,
      guardians,
      t,
      units,
      a,
    ]);
    const ev = parseEventLogs({ abi, logs: receipt.logs, eventName: 'VaultCreated' }) as unknown as {
      args: { vaultId: Hex32 };
    }[];
    return ev[0].args.vaultId;
  }

  async heartbeat(vaultId: Hex32) {
    return (await this.w('heartbeat', Action.Heartbeat, vaultId, {}, (a) => [vaultId, a])).hash;
  }

  async cancel(vaultId: Hex32) {
    return (await this.w('cancel', Action.Cancel, vaultId, {}, (a) => [vaultId, a])).hash;
  }

  async setAbsence(vaultId: Hex32, until: number) {
    return (await this.w('setAbsence', Action.SetAbsence, vaultId, { until }, (a) => [vaultId, until, a])).hash;
  }

  async revokeChange(vaultId: Hex32, changeId: Hex32) {
    return (await this.w('revokeChange', Action.RevokeChange, vaultId, {}, (a) => [vaultId, changeId, a])).hash;
  }

  async addAsset(
    vaultId: Hex32,
    item: Omit<AssetItem, 'vaultId' | 'status' | 'released' | 'claimed'>,
    secret?: Uint8Array
  ) {
    if (!secret || secret.length === 0) throw new Error('Enter the secret contents to seal.');
    const vault = await this.getVault(vaultId);
    const p = item.policy;
    const zero = BigInt(p.contingentBenef) === 0n;
    const [guardians, primary, contingent] = await Promise.all([
      Promise.all(vault.guardians.map((g) => this.cardOf(g))),
      this.cardOf(p.primaryBenef),
      zero ? Promise.resolve(null) : this.cardOf(p.contingentBenef),
    ]);
    const { bundle, commitments } = await sealAsset({
      vaultId,
      assetId: item.assetId,
      version: 1,
      plaintext: secret,
      guardians,
      t: vault.t,
      beneficiaries: contingent ? [primary, contingent] : [primary],
    });
    const bundleCid = await this.bundles.put(bundle);
    const policy = {
      reasonsMask: p.reasonsMask,
      kAttest: p.kAttest,
      requireEvidence: p.requireEvidence,
      minInactivity: await this.toUnits(p.minInactivity),
      window: await this.toUnits(p.window),
      claimDeadline: await this.toUnits(p.claimDeadline),
      primaryBenef: p.primaryBenef,
      contingentBenef: p.contingentBenef,
      bundleCid,
      version: 1,
      shareCommitments: commitments,
    };
    const { hash } = await this.w('addAsset', Action.AddAsset, vaultId, { assetId: item.assetId, policy }, (a) => [
      vaultId,
      item.assetId,
      policy,
      a,
    ]);
    const meta: Meta = { accession: item.accessionNumber, title: item.title, contents: item.contents };
    this.kv.set(`heirloom.meta.${item.assetId}`, JSON.stringify(meta));
    return hash;
  }

  // ---------- guardian ----------

  /** This account's 0-based guardian index in the vault. Other guardians' keys are never read here. */
  private async myGuardian(vaultId: Hex32): Promise<number> {
    const [found, index] = await this.r<readonly [boolean, number]>('guardianIndex', [vaultId, await this.myKeyId()]);
    if (!found) throw new Error('NotAuthorized');
    return index;
  }

  private async notice(vaultId: Hex32, item: AssetItem, me: number, now: number): Promise<GuardianNotice> {
    const [tl, vault, mine, claimant] = await Promise.all([
      this.timeline(vaultId, item.assetId),
      this.r<readonly [unknown, Hex32[], number, number, number, number, number, number, number, number]>('getVault', [vaultId]),
      this.r<readonly [number, number, Hex32]>('getAttestation', [vaultId, me]),
      this.currentClaimant(vaultId, item.assetId),
    ]);
    // Only counts leave this block: n, t and how many shares are in. No other guardian's key is kept.
    const n = vault[1].length;
    const t = vault[2];
    const epoch = vault[4];
    const shares = await Promise.all(
      Array.from({ length: n }, (_x, i) => this.r<`0x${string}`>('getShare', [vaultId, item.assetId, claimant, i]))
    );
    return {
      vaultId,
      assetId: item.assetId,
      accessionNumber: item.accessionNumber,
      title: item.title,
      status: item.status,
      filed: tl.attestationsFiled,
      kAttest: tl.kAttest,
      n,
      myReason: mine[0] as Reason,
      iDisputed: vault[9] === me && vault[7] !== 0 && vault[8] === epoch,
      releasable: item.status === Status.Releasable,
      sharesFiled: shares.filter((s) => s !== '0x').length,
      t,
      iSubmitted: shares[me] !== '0x',
      opensIn: item.status === Status.Cooling ? Math.max(0, Number(tl.opensAt) - now) : 0,
      frozen: item.status === Status.Disputed,
    };
  }

  async listGuardianNotices(vaultId: Hex32) {
    const [items, me, info] = await Promise.all([this.listAssets(vaultId), this.myGuardian(vaultId), this.getChainInfo()]);
    return Promise.all(items.map((i) => this.notice(vaultId, i, me, info.now)));
  }

  async getGuardianNotice(vaultId: Hex32, assetId: Hex32) {
    const item = (await this.listAssets(vaultId)).find((i) => i.assetId === assetId);
    if (!item) return null;
    return this.notice(vaultId, item, await this.myGuardian(vaultId), (await this.getChainInfo()).now);
  }

  async attest(vaultId: Hex32, reason: Reason, evidenceHash: Hex32 = zeroHash) {
    return (await this.w('attest', Action.Attest, vaultId, { reason, evidenceHash }, (a) => [vaultId, reason, evidenceHash, a])).hash;
  }

  async dispute(vaultId: Hex32) {
    return (await this.w('dispute', Action.Dispute, vaultId, {}, (a) => [vaultId, a])).hash;
  }

  async submitShare(vaultId: Hex32, assetId: Hex32) {
    const me = await this.myGuardian(vaultId);
    const { policy } = await this.getAsset(vaultId, assetId);
    const bundle = await this.bundles.get(policy.bundleCid);
    const { encSk } = await this.keystore.identity(this.accountIndex);
    const opened = await guardianOpenShare(bundle, me + 1, encSk);
    const claimant = await this.currentClaimant(vaultId, assetId);
    // D1/D10: encrypt to the claimant's key taken from the bundle's participants list.
    const card = bundle.participants.beneficiaries.map(cardFromWire).find((c) => keyIdOf(c).toLowerCase() === claimant.toLowerCase());
    if (!card) throw new Error('The claimant is not listed in the sealed bundle.');
    const enc = await guardianReencrypt(opened, card.encPk, { vaultId, assetId, version: policy.version, claimantKeyId: claimant });
    const encShare = bytesToHex(enc);
    const params = { assetId, claimantKeyId: claimant, encShare };
    return (await this.w('submitShare', Action.SubmitShare, vaultId, params, (a) => [vaultId, assetId, claimant, encShare, a])).hash;
  }

  /** On-chain drill() is a stub until Phase 7, so the drill runs locally and only a boolean leaves. */
  async drill(vaultId: Hex32, assetId: Hex32) {
    const me = await this.myGuardian(vaultId);
    const { policy } = await this.getAsset(vaultId, assetId);
    const bundle = await this.bundles.get(policy.bundleCid);
    const { encSk } = await this.keystore.identity(this.accountIndex);
    return drillCheck(bundle, me + 1, encSk, policy.shareCommitments[me], { vaultId, assetId, version: policy.version });
  }

  // ---------- beneficiary ----------

  async listClaims(vaultId: Hex32) {
    const mine = (await this.myKeyId()).toLowerCase();
    return (await this.listAssets(vaultId)).filter(
      (a) => a.policy.primaryBenef.toLowerCase() === mine || a.policy.contingentBenef.toLowerCase() === mine
    );
  }

  /** Verify every submitted share and, once t are valid, decrypt. The plaintext is cached in memory only. */
  private async collect(vaultId: Hex32, assetId: Hex32): Promise<ClaimCache & { t: number; n: number }> {
    const [vault, { policy }, claimant] = await Promise.all([
      this.getVault(vaultId),
      this.getAsset(vaultId, assetId),
      this.currentClaimant(vaultId, assetId),
    ]);
    const n = vault.guardians.length;
    const raw = await Promise.all(
      Array.from({ length: n }, (_x, i) => this.r<`0x${string}`>('getShare', [vaultId, assetId, claimant, i]))
    );
    const key = `${this.accountIndex}:${assetId}:${raw.join('')}`;
    const hit = this.claims.get(`${this.accountIndex}:${assetId}`);
    if (hit && hit.key === key && (hit.plaintext || hit.received < vault.t)) return { ...hit, t: vault.t, n };
    const submissions = raw
      .map((s, i) => ({ guardianIndex: i + 1, enc: s === '0x' ? null : hexToBytes(s) }))
      .filter((s): s is { guardianIndex: number; enc: Uint8Array } => s.enc !== null);
    let cache: ClaimCache = { key, rejected: [], received: 0 };
    if (submissions.length > 0) {
      const bundle: Bundle = await this.bundles.get(policy.bundleCid);
      const { encSk } = await this.keystore.identity(this.accountIndex);
      try {
        const out = await beneficiaryReconstruct({
          bundle,
          mySk: encSk,
          submissions,
          commitments: policy.shareCommitments,
          t: vault.t,
          expect: { vaultId, assetId, version: policy.version },
        });
        cache = { key, rejected: out.rejected, plaintext: out.plaintext, received: out.usedIndexes.length };
      } catch (e) {
        if (!(e instanceof ReconstructError)) throw e;
        cache = { key, rejected: e.rejected, received: submissions.length - e.rejected.length };
      }
    }
    this.claims.set(`${this.accountIndex}:${assetId}`, cache);
    return { ...cache, t: vault.t, n };
  }

  async getClaimProgress(vaultId: Hex32, assetId: Hex32): Promise<ClaimProgress | null> {
    const item = (await this.listAssets(vaultId)).find((a) => a.assetId === assetId);
    if (!item) return null;
    const base = { vaultId, assetId, accessionNumber: item.accessionNumber, title: item.title };
    if (item.claimed) return { ...base, step: 'claimed', received: 0, t: 0, rejected: [] };
    if (!item.released && item.status !== Status.Releasable) {
      return { ...base, step: 'waiting', received: 0, t: 0, rejected: [] };
    }
    const c = await this.collect(vaultId, assetId);
    return {
      ...base,
      step: c.plaintext ? 'ready' : 'collecting',
      received: c.plaintext ? c.t : c.received,
      t: c.t,
      rejected: c.rejected.map((r) => ({ guardianIndex: r.guardianIndex, reason: r.reason })),
    };
  }

  async reconstruct(vaultId: Hex32, assetId: Hex32) {
    const c = await this.collect(vaultId, assetId);
    if (!c.plaintext) throw new Error('NoShares');
    return { filename: SECRET_FILE, bytes: c.plaintext };
  }

  async markClaimed(vaultId: Hex32, assetId: Hex32) {
    return (await this.w('markClaimed', Action.MarkClaimed, vaultId, { assetId }, (a) => [vaultId, assetId, a])).hash;
  }
}
