// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum Reason {
    NONE,
    INCAPACITATED,
    DECEASED,
    MISSING
}

/// @notice A guardian attestation. `at == 0` means "none filed".
struct Attestation {
    Reason reason;
    uint40 at;
    bytes32 evidenceHash;
}

/// @notice Inputs for one asset's release evaluation. Durations are in TIME_UNITs.
struct RuleParams {
    uint256 lastHeartbeat;
    uint256 minInactivity;
    uint256 absentUntil;
    uint256 reasonsMask;
    uint256 kAttest;
    bool requireEvidence;
    uint256 window;
    uint256 disputedAt;
    bool disputeActive;
    uint256 disputer; // guardian index of the disputer, excluded from the override count
    bool latched; // D14: a share was already submitted; release cannot be undone
    uint256 kDispute;
    uint256 timeUnit;
    uint256 now_;
}

/// @title ReleaseRule
/// @notice The release rule of contract.md §5.2 with D4–D7, as one pure function.
library ReleaseRule {
    uint256 internal constant MAX_GUARDIANS = 12;

    /// @notice Evaluate the rule. A zero `tQuorum` means "not defined"; a zero `resumeAt` means
    /// "no dispute override".
    /// @param p Rule inputs.
    /// @param atts Current-epoch attestations, one slot per guardian (length <= MAX_GUARDIANS).
    function evaluate(RuleParams memory p, Attestation[] memory atts)
        internal
        pure
        returns (uint256 tSilence, uint256 tQuorum, uint256 resumeAt, uint256 tOpen, bool releasable)
    {
        tSilence = p.lastHeartbeat + p.minInactivity * p.timeUnit;
        if (p.absentUntil > tSilence) tSilence = p.absentUntil;

        Attestation[] memory v = _validSorted(atts, p.reasonsMask, type(uint256).max);
        uint256 n = v.length;

        // D6: earliest T with >= kAttest valid attestations (and, if required, a shared non-zero hash).
        bool paired = !p.requireEvidence;
        for (uint256 i; i < n; ++i) {
            for (uint256 j; j < i && !paired; ++j) {
                if (v[i].evidenceHash != 0 && v[i].evidenceHash == v[j].evidenceHash) paired = true;
            }
            if (i + 1 >= p.kAttest && paired) {
                tQuorum = v[i].at;
                break;
            }
        }

        // D4/D14: override = kDispute-th valid non-disputer attestation strictly after disputedAt.
        if (p.disputeActive) {
            Attestation[] memory w = _validSorted(atts, p.reasonsMask, p.disputer);
            uint256 c;
            for (uint256 i; i < w.length; ++i) {
                if (w[i].at > p.disputedAt && ++c == p.kDispute) {
                    resumeAt = w[i].at;
                    break;
                }
            }
        }

        if (tQuorum == 0) return (tSilence, 0, resumeAt, 0, p.latched);
        tOpen = tSilence > tQuorum ? tSilence : tQuorum;
        if (resumeAt > tOpen) tOpen = resumeAt;
        releasable = p.latched || (p.now_ >= tOpen + p.window * p.timeUnit && !(p.disputeActive && resumeAt == 0));
    }

    /// @dev Valid (reason in mask, filed) attestations, skipping guardian `skip`, ascending by `at`. Insertion sort, n <= 12.
    function _validSorted(Attestation[] memory atts, uint256 mask, uint256 skip)
        private
        pure
        returns (Attestation[] memory v) {
        v = new Attestation[](atts.length);
        uint256 n;
        for (uint256 i; i < atts.length; ++i) {
            Attestation memory a = atts[i];
            if (i == skip || a.at == 0 || a.reason == Reason.NONE || (mask >> uint8(a.reason)) & 1 == 0) continue;
            uint256 j = n++;
            for (; j > 0 && v[j - 1].at > a.at; --j) {
                v[j] = v[j - 1];
            }
            v[j] = a;
        }
        assembly {
            mstore(v, n)
        }
    }
}
