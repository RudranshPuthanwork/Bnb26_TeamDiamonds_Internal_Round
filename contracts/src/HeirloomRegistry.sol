// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Attestation, Reason, RuleParams, ReleaseRule} from "./libs/ReleaseRule.sol";

/// @title HeirloomRegistry
/// @notice Many-vault registry for conditional, guardian-gated inheritance. No owner, no proxy,
/// no pause, nothing payable. The only privileged party is each vault's owner.
contract HeirloomRegistry is EIP712 {
    uint256 public constant MAX_GUARDIANS = 12;
    uint256 public constant SHARE_LEN = 113; // D10: enc(32) || ct(65+16)

    enum KeyKind {
        EOA,
        P256
    }
    enum AuthKind {
        DIRECT,
        EOA_SIG,
        P256
    }
    enum Role {
        Any,
        Owner,
        Guardian
    }
    enum Action {
        CreateVault,
        AddAsset,
        Heartbeat,
        Cancel,
        SetAbsence,
        QueueChange,
        ApplyChange,
        RevokeChange,
        Attest,
        Dispute,
        SubmitShare,
        MarkClaimed,
        Drill,
        Rekey,
        ClaimContingent
    }
    enum Status {
        Sealed,
        Armed,
        Silent,
        Cooling,
        Disputed,
        Releasable,
        ContingentEligible,
        Claimed
    }

    /// @notice D2 authorisation envelope. For P256 the pubkey and WebAuthn data travel in `sig`.
    struct Auth {
        AuthKind kind;
        address signer;
        uint256 nonce;
        uint256 deadline;
        bytes sig;
    }

    struct AssetPolicy {
        uint8 reasonsMask;
        uint8 kAttest;
        bool requireEvidence;
        uint32 minInactivity;
        uint32 window;
        uint32 claimDeadline; // TIME_UNITs after the window opens
        bytes32 primaryBenef;
        bytes32 contingentBenef;
        bytes32 bundleCid;
        uint16 version;
        bytes32[] shareCommitments; // index-aligned with guardians
    }

    struct PendingChange {
        uint40 applyAfter;
        bytes32 payloadHash;
    }

    struct Vault {
        bytes32[2] owners;
        bytes32[] guardians;
        uint8 t;
        uint32 epoch;
        uint40 lastHeartbeat;
        uint40 absentUntil;
        uint40 disputedAt;
        uint32 disputeEpoch;
        uint32 policyDelay;
        mapping(uint32 => mapping(uint8 => Attestation)) att;
        mapping(uint8 => uint40) lastDrill;
        mapping(bytes32 => AssetPolicy) assets;
        mapping(bytes32 => bool) claimed;
        mapping(bytes32 => PendingChange) queued;
        mapping(bytes32 => mapping(bytes32 => mapping(uint8 => bytes))) shares;
    }

    bytes32 public constant ACTION_TYPEHASH =
        keccak256("Action(bytes32 vaultId,uint8 action,bytes32 paramsHash,uint256 nonce,uint256 deadline)");

    uint256 public immutable TIME_UNIT;
    uint256 public vaultCount;
    mapping(bytes32 keyId => uint256) public nonces;
    mapping(bytes32 vaultId => Vault) private _v;

    error NotImplemented();
    error BadAuth();
    error Expired();
    error BadNonce();
    error NotAuthorized();
    error NoVault();
    error BadBounds();
    error DuplicateGuardian();
    error AssetExists();
    error NoAsset();
    error BeneficiaryIsGuardian();
    error BadPolicy();
    error BadReason();
    error AttestationLocked();
    error AlreadyDisputed();
    error NotReleasable();
    error NotClaimant();
    error BadShare();
    error AlreadyClaimed();

    event VaultCreated(bytes32 indexed vaultId, bytes32 owner0, bytes32 owner1, uint8 guardians, uint8 t);
    event AssetAdded(bytes32 indexed vaultId, bytes32 indexed assetId, bytes32 primaryBenef, bytes32 bundleCid);
    event Heartbeat(bytes32 indexed vaultId, uint32 epoch);
    event Cancelled(bytes32 indexed vaultId, uint32 epoch);
    event AbsenceSet(bytes32 indexed vaultId, uint40 until);
    event ChangeQueued(bytes32 indexed vaultId, bytes32 indexed changeId, uint40 applyAfter);
    event ChangeApplied(bytes32 indexed vaultId, bytes32 indexed changeId);
    event ChangeRevoked(bytes32 indexed vaultId, bytes32 indexed changeId);
    event Attested(bytes32 indexed vaultId, uint8 indexed guardian, Reason reason, bytes32 evidenceHash);
    event Disputed(bytes32 indexed vaultId, uint8 indexed guardian, uint32 epoch);
    event DisputeOverridden(bytes32 indexed vaultId, uint40 resumeAt);
    event ShareSubmitted(bytes32 indexed vaultId, bytes32 indexed assetId, uint8 guardian);
    event Claimed(bytes32 indexed vaultId, bytes32 indexed assetId, bytes32 claimant);
    event DrillPassed(bytes32 indexed vaultId, uint8 indexed guardian, uint16 version);
    event Rekeyed(bytes32 indexed vaultId, bytes32 indexed assetId, uint16 version);

    /// @param timeUnit Seconds per TIME_UNIT (86400 prod, 60 demo, 1 anvil tests).
    constructor(uint256 timeUnit) EIP712("HeirloomRegistry", "1") {
        if (timeUnit == 0) revert BadBounds();
        TIME_UNIT = timeUnit;
    }

    // ───────────────────────────── identity & auth ─────────────────────────────

    /// @notice D1 key identifier.
    /// @param kind Key kind.
    /// @param a EOA: address as bytes32; P256: qx.
    /// @param b EOA: 0; P256: qy.
    /// @return The keyId.
    function keyId(KeyKind kind, bytes32 a, bytes32 b) public pure returns (bytes32) {
        return keccak256(abi.encode(kind, a, b));
    }

    /// @dev Verifies `auth`, burns its nonce, checks `role` against the vault. `idx` is the
    /// guardian index for Role.Guardian.
    function _authorize(bytes32 vaultId, Role role, Action action, bytes32 paramsHash, Auth calldata auth)
        internal
        returns (bytes32 id, uint8 idx)
    {
        if (auth.kind == AuthKind.DIRECT) {
            id = keyId(KeyKind.EOA, bytes32(uint256(uint160(msg.sender))), 0);
        } else if (auth.kind == AuthKind.EOA_SIG) {
            if (block.timestamp > auth.deadline) revert Expired();
            id = keyId(KeyKind.EOA, bytes32(uint256(uint160(auth.signer))), 0);
            if (auth.nonce != nonces[id]++) revert BadNonce();
            bytes32 digest = _hashTypedDataV4(
                keccak256(abi.encode(ACTION_TYPEHASH, vaultId, uint8(action), paramsHash, auth.nonce, auth.deadline))
            );
            (address rec, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, auth.sig);
            if (err != ECDSA.RecoverError.NoError || rec != auth.signer) revert BadAuth();
        } else {
            revert NotImplemented(); // Phase 6
        }

        if (role == Role.Owner) {
            Vault storage v = _vault(vaultId);
            if (id != v.owners[0] && id != v.owners[1]) revert NotAuthorized();
        } else if (role == Role.Guardian) {
            bytes32[] storage g = _vault(vaultId).guardians;
            uint256 n = g.length;
            uint256 i;
            for (; i < n; ++i) {
                if (g[i] == id) break;
            }
            if (i == n) revert NotAuthorized();
            idx = uint8(i);
        }
    }

    function _vault(bytes32 vaultId) private view returns (Vault storage v) {
        v = _v[vaultId];
        if (v.owners[0] == 0) revert NoVault();
    }

    function _asset(bytes32 vaultId, bytes32 assetId) private view returns (Vault storage v, AssetPolicy storage a) {
        v = _vault(vaultId);
        a = v.assets[assetId];
        if (a.primaryBenef == 0) revert NoAsset();
    }

    /// @dev D7: every owner action is a heartbeat.
    function _beat(bytes32 vaultId, Vault storage v) private {
        v.lastHeartbeat = uint40(block.timestamp / TIME_UNIT * TIME_UNIT);
        emit Heartbeat(vaultId, ++v.epoch);
    }

    // ───────────────────────────── owner actions ─────────────────────────────

    /// @notice Create a vault. The signer must be `owners[0]`. D3: 2 <= n <= 12, 1 <= t <= n.
    /// @param owners Primary and backup owner keyIds (backup may be zero).
    /// @param guardians Guardian keyIds.
    /// @param t Guardian reconstruction threshold.
    /// @param policyDelay Timelock for loosening changes, in TIME_UNITs.
    /// @param auth Authorisation; the digest's vaultId is `vaultCount + 1` at signing time.
    /// @return vaultId The new vault id.
    function createVault(
        bytes32[2] calldata owners,
        bytes32[] calldata guardians,
        uint8 t,
        uint32 policyDelay,
        Auth calldata auth
    ) external returns (bytes32 vaultId) {
        vaultId = bytes32(++vaultCount);
        (bytes32 id,) = _authorize(
            vaultId, Role.Any, Action.CreateVault, keccak256(abi.encode(owners, guardians, t, policyDelay)), auth
        );
        uint256 n = guardians.length;
        if (id != owners[0] || owners[0] == 0) revert NotAuthorized();
        if (n < 2 || n > MAX_GUARDIANS || t == 0 || t > n) revert BadBounds();
        for (uint256 i; i < n; ++i) {
            for (uint256 j; j < i; ++j) {
                if (guardians[i] == guardians[j]) revert DuplicateGuardian();
            }
        }
        Vault storage v = _v[vaultId];
        v.owners = owners;
        v.guardians = guardians;
        v.t = t;
        v.policyDelay = policyDelay;
        emit VaultCreated(vaultId, owners[0], owners[1], uint8(n), t);
        _beat(vaultId, v);
    }

    /// @notice Add an asset policy. Beneficiaries may not be guardians; D3: kAttest <= n-1.
    /// @param vaultId Vault.
    /// @param assetId Asset id.
    /// @param policy Release policy (durations in TIME_UNITs).
    /// @param auth Owner authorisation.
    function addAsset(bytes32 vaultId, bytes32 assetId, AssetPolicy calldata policy, Auth calldata auth) external {
        _authorize(vaultId, Role.Owner, Action.AddAsset, keccak256(abi.encode(assetId, policy)), auth);
        Vault storage v = _v[vaultId];
        if (v.assets[assetId].primaryBenef != 0) revert AssetExists();
        uint256 n = v.guardians.length;
        if (
            policy.primaryBenef == 0 || policy.reasonsMask == 0 || policy.reasonsMask > 0x0e || policy.kAttest == 0
                || policy.kAttest >= n || policy.minInactivity == 0 || policy.shareCommitments.length != n
                || policy.bundleCid == 0
        ) revert BadPolicy();
        for (uint256 i; i < n; ++i) {
            bytes32 g = v.guardians[i];
            if (g == policy.primaryBenef || g == policy.contingentBenef) revert BeneficiaryIsGuardian();
        }
        v.assets[assetId] = policy;
        emit AssetAdded(vaultId, assetId, policy.primaryBenef, policy.bundleCid);
        _beat(vaultId, v);
    }

    /// @notice Owner liveness signal: stamps today and bumps the epoch (voids attestations/disputes).
    /// @param vaultId Vault.
    /// @param auth Owner authorisation.
    function heartbeat(bytes32 vaultId, Auth calldata auth) external {
        _authorize(vaultId, Role.Owner, Action.Heartbeat, 0, auth);
        _beat(vaultId, _v[vaultId]);
    }

    /// @notice Explicit heartbeat with a loud event: "I am alive".
    /// @param vaultId Vault.
    /// @param auth Owner authorisation.
    function cancel(bytes32 vaultId, Auth calldata auth) external {
        _authorize(vaultId, Role.Owner, Action.Cancel, 0, auth);
        Vault storage v = _v[vaultId];
        _beat(vaultId, v);
        emit Cancelled(vaultId, v.epoch);
    }

    /// @notice Planned absence: silence cannot start before `until` (0 clears).
    /// @param vaultId Vault.
    /// @param until Unix timestamp.
    /// @param auth Owner authorisation.
    function setAbsence(bytes32 vaultId, uint40 until, Auth calldata auth) external {
        _authorize(vaultId, Role.Owner, Action.SetAbsence, keccak256(abi.encode(until)), auth);
        Vault storage v = _v[vaultId];
        v.absentUntil = until;
        emit AbsenceSet(vaultId, until);
        _beat(vaultId, v);
    }

    /// @notice Queue a loosening change (section 5.6). Phase 7.
    function queueChange(bytes32, bytes32, bytes calldata, Auth calldata) external pure {
        revert NotImplemented();
    }

    /// @notice Apply a queued change after `policyDelay`. Phase 7.
    function applyChange(bytes32, bytes32, Auth calldata) external pure {
        revert NotImplemented();
    }

    /// @notice Revoke a queued change. Phase 7.
    function revokeChange(bytes32, bytes32, Auth calldata) external pure {
        revert NotImplemented();
    }

    /// @notice Re-key an asset to a new bundle/version. Phase 7.
    function rekey(bytes32, bytes32, uint16, bytes32, bytes32[] calldata, Auth calldata) external pure {
        revert NotImplemented();
    }

    // ───────────────────────────── guardian actions ─────────────────────────────

    /// @notice File or upgrade an attestation (D5): re-attest only INCAPACITATED->DECEASED or to
    /// add an evidenceHash. `at` resets to now on every change. No withdrawal.
    /// @param vaultId Vault.
    /// @param reason DECEASED, INCAPACITATED or MISSING.
    /// @param evidenceHash Certificate hash, or 0.
    /// @param auth Guardian authorisation.
    function attest(bytes32 vaultId, Reason reason, bytes32 evidenceHash, Auth calldata auth) external {
        (, uint8 g) =
            _authorize(vaultId, Role.Guardian, Action.Attest, keccak256(abi.encode(reason, evidenceHash)), auth);
        if (reason == Reason.NONE) revert BadReason();
        Vault storage v = _v[vaultId];
        Attestation storage a = v.att[v.epoch][g];
        if (a.at != 0) {
            bool raise = a.reason == Reason.INCAPACITATED && reason == Reason.DECEASED;
            bool addEv = a.evidenceHash == 0 && evidenceHash != 0;
            if (!((raise || reason == a.reason) && (evidenceHash == a.evidenceHash || addEv) && (raise || addEv))) {
                revert AttestationLocked();
            }
        }
        v.att[v.epoch][g] = Attestation(reason, uint40(block.timestamp), evidenceHash);
        emit Attested(vaultId, g, reason, evidenceHash);
    }

    /// @notice ALIVE vote: freezes windows for this epoch; once per epoch. Overridable (D4).
    /// @param vaultId Vault.
    /// @param auth Guardian authorisation.
    function dispute(bytes32 vaultId, Auth calldata auth) external {
        (, uint8 g) = _authorize(vaultId, Role.Guardian, Action.Dispute, 0, auth);
        Vault storage v = _v[vaultId];
        if (v.disputedAt != 0 && v.disputeEpoch == v.epoch) revert AlreadyDisputed();
        v.disputedAt = uint40(block.timestamp);
        v.disputeEpoch = v.epoch;
        emit Disputed(vaultId, g, v.epoch);
    }

    /// @notice Submit this guardian's HPKE share for the current claimant (D8).
    /// @param vaultId Vault.
    /// @param assetId Asset.
    /// @param claimantKeyId Must equal currentClaimant.
    /// @param encShare 113-byte ciphertext.
    /// @param auth Guardian authorisation.
    function submitShare(
        bytes32 vaultId,
        bytes32 assetId,
        bytes32 claimantKeyId,
        bytes calldata encShare,
        Auth calldata auth
    ) external {
        (, uint8 g) = _authorize(
            vaultId, Role.Guardian, Action.SubmitShare, keccak256(abi.encode(assetId, claimantKeyId, encShare)), auth
        );
        if (!isReleasable(vaultId, assetId)) revert NotReleasable();
        if (claimantKeyId != currentClaimant(vaultId, assetId)) revert NotClaimant();
        if (encShare.length != SHARE_LEN) revert BadShare();
        _v[vaultId].shares[assetId][claimantKeyId][g] = encShare;
        emit ShareSubmitted(vaultId, assetId, g);
    }

    /// @notice Record a readiness drill. Phase 7.
    function drill(bytes32, uint16, Auth calldata) external pure {
        revert NotImplemented();
    }

    // ───────────────────────────── claimant actions ─────────────────────────────

    /// @notice Close an asset's lifecycle. Primary beneficiary only (contingent path: Phase 7).
    /// @param vaultId Vault.
    /// @param assetId Asset.
    /// @param auth Claimant authorisation.
    function markClaimed(bytes32 vaultId, bytes32 assetId, Auth calldata auth) external {
        (bytes32 id,) = _authorize(vaultId, Role.Any, Action.MarkClaimed, keccak256(abi.encode(assetId)), auth);
        Vault storage v = _v[vaultId];
        if (v.claimed[assetId]) revert AlreadyClaimed();
        if (!isReleasable(vaultId, assetId)) revert NotReleasable();
        if (id != currentClaimant(vaultId, assetId)) revert NotClaimant();
        v.claimed[assetId] = true;
        emit Claimed(vaultId, assetId, id);
    }

    /// @notice Contingent beneficiary claim after `claimDeadline`. Phase 7.
    function claimContingent(bytes32, bytes32, Auth calldata) external pure {
        revert NotImplemented();
    }

    // ───────────────────────────── views ─────────────────────────────

    struct Eval {
        bool disputeActive;
        uint256 tSilence;
        uint256 tQuorum;
        uint256 resumeAt;
        uint256 tOpen;
        bool ok;
    }

    function _eval(bytes32 vaultId, bytes32 assetId) private view returns (AssetPolicy storage a, Eval memory e) {
        Vault storage v;
        (v, a) = _asset(vaultId, assetId);
        uint256 n = v.guardians.length;
        Attestation[] memory atts = new Attestation[](n);
        for (uint8 i; i < n; ++i) {
            atts[i] = v.att[v.epoch][i];
        }
        e.disputeActive = v.disputedAt != 0 && v.disputeEpoch == v.epoch;
        (e.tSilence, e.tQuorum, e.resumeAt, e.tOpen, e.ok) = ReleaseRule.evaluate(
            RuleParams({
                lastHeartbeat: v.lastHeartbeat,
                minInactivity: a.minInactivity,
                absentUntil: v.absentUntil,
                reasonsMask: a.reasonsMask,
                kAttest: a.kAttest,
                requireEvidence: a.requireEvidence,
                window: a.window,
                disputedAt: v.disputedAt,
                disputeActive: e.disputeActive,
                kDispute: uint256(a.kAttest) + 1,
                timeUnit: TIME_UNIT,
                now_: block.timestamp
            }),
            atts
        );
    }

    /// @notice Whether the asset's shares may be released right now (section 5.2).
    /// @param vaultId Vault.
    /// @param assetId Asset.
    /// @return True iff quorum defined, window elapsed, and not disputed-without-override.
    function isReleasable(bytes32 vaultId, bytes32 assetId) public view returns (bool) {
        (, Eval memory e) = _eval(vaultId, assetId);
        return e.ok;
    }

    /// @notice Who may claim the asset. Primary only for now.
    /// @param vaultId Vault.
    /// @param assetId Asset.
    /// @return The claimant keyId.
    function currentClaimant(bytes32 vaultId, bytes32 assetId) public view returns (bytes32) {
        (, AssetPolicy storage a) = _asset(vaultId, assetId);
        return a.primaryBenef;
    }

    /// @notice Derived per-asset state (section 5.4). Armed = quorum reached, silence not yet;
    /// Silent = silence reached, quorum not; Cooling = both, window running.
    /// @param vaultId Vault.
    /// @param assetId Asset.
    /// @return The status.
    function status(bytes32 vaultId, bytes32 assetId) external view returns (Status) {
        (AssetPolicy storage a, Eval memory e) = _eval(vaultId, assetId);
        if (_v[vaultId].claimed[assetId]) return Status.Claimed;
        if (e.ok) {
            return block.timestamp >= e.tOpen + (uint256(a.window) + a.claimDeadline) * TIME_UNIT
                ? Status.ContingentEligible
                : Status.Releasable;
        }
        bool silent = block.timestamp >= e.tSilence;
        if (e.tQuorum == 0) return silent ? Status.Silent : Status.Sealed;
        if (!silent) return Status.Armed;
        return e.disputeActive && e.resumeAt == 0 ? Status.Disputed : Status.Cooling;
    }

    /// @notice Everything the Restriction Line needs. Zero = undefined.
    /// @param vaultId Vault.
    /// @param assetId Asset.
    /// @return tSilence max(lastHeartbeat + minInactivity, absentUntil).
    /// @return tQuorum Time the kAttest-th valid attestation landed.
    /// @return resumeAt Dispute override time.
    /// @return tOpen max(tSilence, tQuorum, resumeAt), 0 if no quorum.
    /// @return opensAt tOpen + window, 0 if no quorum.
    /// @return attestationsFiled Valid attestations in the current epoch.
    /// @return kAttest Required quorum.
    /// @return disputed Disputed and not overridden.
    /// @return claimDeadline Absolute time after which the contingent may claim, 0 if no quorum.
    function timeline(bytes32 vaultId, bytes32 assetId)
        external
        view
        returns (
            uint256 tSilence,
            uint256 tQuorum,
            uint256 resumeAt,
            uint256 tOpen,
            uint256 opensAt,
            uint8 attestationsFiled,
            uint8 kAttest,
            bool disputed,
            uint256 claimDeadline
        )
    {
        (AssetPolicy storage a, Eval memory e) = _eval(vaultId, assetId);
        (tSilence, tQuorum, resumeAt, tOpen) = (e.tSilence, e.tQuorum, e.resumeAt, e.tOpen);
        kAttest = a.kAttest;
        disputed = e.disputeActive && resumeAt == 0;
        Vault storage v = _v[vaultId];
        for (uint8 i; i < v.guardians.length; ++i) {
            Attestation storage x = v.att[v.epoch][i];
            if (x.at != 0 && (a.reasonsMask >> uint8(x.reason)) & 1 == 1) ++attestationsFiled;
        }
        if (tQuorum != 0) {
            opensAt = tOpen + uint256(a.window) * TIME_UNIT;
            claimDeadline = opensAt + uint256(a.claimDeadline) * TIME_UNIT;
        }
    }
}
