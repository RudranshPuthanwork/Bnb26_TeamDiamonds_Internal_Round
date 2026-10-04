# Heirloom interfaces (frozen at tag interfaces-v1)

Changes after this point need a change note in specs/decisions-log.md and a new tag.
Do not import @heirloom/crypto/testing outside tests.

## 1. HeirloomRegistry (Solidity interface)

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

library HeirloomRegistry {
    type AuthKind is uint8;
    type KeyKind is uint8;
    type Status is uint8;

    struct AssetPolicy {
        uint8 reasonsMask;
        uint8 kAttest;
        bool requireEvidence;
        uint32 minInactivity;
        uint32 window;
        uint32 claimDeadline;
        bytes32 primaryBenef;
        bytes32 contingentBenef;
        bytes32 bundleCid;
        uint16 version;
        bytes32[] shareCommitments;
    }

    struct Auth {
        AuthKind kind;
        address signer;
        uint256 nonce;
        uint256 deadline;
        bytes sig;
    }
}

interface IHeirloomRegistry {
    type Reason is uint8;

    error AlreadyClaimed();
    error AlreadyDisputed();
    error AssetExists();
    error AttestationLocked();
    error BadAuth();
    error BadBounds();
    error BadNonce();
    error BadPolicy();
    error BadReason();
    error BadShare();
    error BeneficiaryIsGuardian();
    error DuplicateGuardian();
    error Expired();
    error InvalidShortString();
    error NoAsset();
    error NoShares();
    error NoVault();
    error NotAuthorized();
    error NotClaimant();
    error NotImplemented();
    error NotReleasable();
    error ShareExists();
    error StringTooLong(string str);

    event AbsenceSet(bytes32 indexed vaultId, uint40 until);
    event AssetAdded(bytes32 indexed vaultId, bytes32 indexed assetId, bytes32 primaryBenef, bytes32 bundleCid);
    event Attested(bytes32 indexed vaultId, uint8 indexed guardian, Reason reason, bytes32 evidenceHash);
    event Cancelled(bytes32 indexed vaultId, uint32 epoch);
    event ChangeApplied(bytes32 indexed vaultId, bytes32 indexed changeId);
    event ChangeQueued(bytes32 indexed vaultId, bytes32 indexed changeId, uint40 applyAfter);
    event ChangeRevoked(bytes32 indexed vaultId, bytes32 indexed changeId);
    event Claimed(bytes32 indexed vaultId, bytes32 indexed assetId, bytes32 claimant);
    event DisputeOverridden(bytes32 indexed vaultId, uint40 resumeAt);
    event Disputed(bytes32 indexed vaultId, uint8 indexed guardian, uint32 epoch);
    event DrillPassed(bytes32 indexed vaultId, uint8 indexed guardian, uint16 version);
    event EIP712DomainChanged();
    event Heartbeat(bytes32 indexed vaultId, uint32 epoch);
    event Rekeyed(bytes32 indexed vaultId, bytes32 indexed assetId, uint16 version);
    event ShareSubmitted(bytes32 indexed vaultId, bytes32 indexed assetId, uint8 guardian);
    event VaultCreated(bytes32 indexed vaultId, bytes32 owner0, bytes32 owner1, uint8 guardians, uint8 t);

    function ACTION_TYPEHASH() external view returns (bytes32);
    function MAX_GUARDIANS() external view returns (uint256);
    function SHARE_LEN() external view returns (uint256);
    function TIME_UNIT() external view returns (uint256);
    function addAsset(
        bytes32 vaultId,
        bytes32 assetId,
        HeirloomRegistry.AssetPolicy memory policy,
        HeirloomRegistry.Auth memory auth
    ) external;
    function applyChange(bytes32, bytes32, HeirloomRegistry.Auth memory) external pure;
    function attest(bytes32 vaultId, Reason reason, bytes32 evidenceHash, HeirloomRegistry.Auth memory auth) external;
    function cancel(bytes32 vaultId, HeirloomRegistry.Auth memory auth) external;
    function claimContingent(bytes32, bytes32, HeirloomRegistry.Auth memory) external pure;
    function createVault(
        bytes32[2] memory owners,
        bytes32[] memory guardians,
        uint8 t,
        uint32 policyDelay,
        HeirloomRegistry.Auth memory auth
    ) external returns (bytes32 vaultId);
    function currentClaimant(bytes32 vaultId, bytes32 assetId) external view returns (bytes32);
    function dispute(bytes32 vaultId, HeirloomRegistry.Auth memory auth) external;
    function drill(bytes32, uint16, HeirloomRegistry.Auth memory) external pure;
    function eip712Domain()
        external
        view
        returns (
            bytes1 fields,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            bytes32 salt,
            uint256[] memory extensions
        );
    function heartbeat(bytes32 vaultId, HeirloomRegistry.Auth memory auth) external;
    function isReleasable(bytes32 vaultId, bytes32 assetId) external view returns (bool);
    function keyId(HeirloomRegistry.KeyKind kind, bytes32 a, bytes32 b) external pure returns (bytes32);
    function markClaimed(bytes32 vaultId, bytes32 assetId, HeirloomRegistry.Auth memory auth) external;
    function nonces(bytes32 keyId) external view returns (uint256);
    function queueChange(bytes32, bytes32, bytes memory, HeirloomRegistry.Auth memory) external pure;
    function rekey(bytes32, bytes32, uint16, bytes32, bytes32[] memory, HeirloomRegistry.Auth memory) external pure;
    function revokeChange(bytes32, bytes32, HeirloomRegistry.Auth memory) external pure;
    function setAbsence(bytes32 vaultId, uint40 until, HeirloomRegistry.Auth memory auth) external;
    function status(bytes32 vaultId, bytes32 assetId) external view returns (HeirloomRegistry.Status);
    function submitShare(
        bytes32 vaultId,
        bytes32 assetId,
        bytes32 claimantKeyId,
        bytes memory encShare,
        HeirloomRegistry.Auth memory auth
    ) external;
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
        );
    function vaultCount() external view returns (uint256);
}
```

## 2. @heirloom/crypto (public API types)
