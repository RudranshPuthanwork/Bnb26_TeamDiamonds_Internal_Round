// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Slow, literal oracle for specs/contract.md section 5.2 and decisions D4-D6. Deliberately written
/// without looking at the contract implementation: every definition is "find the earliest time T such that ...".
struct OAtt {
    bool filed;
    uint8 reason; // 1 INCAPACITATED, 2 DECEASED, 3 MISSING
    uint256 at;
    bytes32 ev;
}

struct OState {
    // policy (durations in TIME_UNITs)
    uint8 mask;
    uint256 kAttest;
    uint256 guardians; // n
    bool requireEvidence;
    uint256 minInactivity;
    uint256 window;
    uint256 unit;
    // vault, current epoch only
    uint256 lastHeartbeat;
    uint256 absentUntil;
    bool disputed;
    uint256 disputedAt;
    uint8 disputer; // D14: index of the guardian who filed the dispute
    bool latched; // D14: a share was submitted; release is permanent
    OAtt[5] att;
}

library ReleaseOracle {
    function valid(OState memory s, uint256 i) internal pure returns (bool) {
        OAtt memory a = s.att[i];
        return a.filed && a.reason >= 1 && a.reason <= 3 && ((s.mask >> a.reason) & 1) == 1;
    }

    /// t_silence = max(lastHeartbeat + minInactivity, absentUntil)
    function tSilence(OState memory s) internal pure returns (uint256) {
        uint256 x = s.lastHeartbeat + s.minInactivity * s.unit;
        return x > s.absentUntil ? x : s.absentUntil;
    }

    /// D6: earliest T at which >= kAttest valid attestations exist (and, if required, >= 2 of them share one
    /// non-zero evidenceHash). 0 = undefined.
    function tQuorum(OState memory s) internal pure returns (uint256 best) {
        for (uint256 c; c < 5; ++c) {
            if (!valid(s, c)) continue;
            uint256 t = s.att[c].at; // candidate T: quorum can only first become true when an attestation lands
            if (_holdsAt(s, t, 0) && (best == 0 || t < best)) best = t;
        }
    }

    /// D14: kDispute = min(kAttest + 1, n - 1).
    function kDispute(OState memory s) internal pure returns (uint256) {
        return s.kAttest + 1 < s.guardians - 1 ? s.kAttest + 1 : s.guardians - 1;
    }

    /// D4/D14: earliest T at which >= kDispute valid attestations with at > disputedAt, not by the disputer, exist.
    /// 0 = none / no dispute.
    function resumeAt(OState memory s) internal pure returns (uint256 best) {
        if (!s.disputed) return 0;
        for (uint256 c; c < 5; ++c) {
            if (c == s.disputer || !valid(s, c) || s.att[c].at <= s.disputedAt) continue;
            uint256 t = s.att[c].at;
            uint256 n;
            for (uint256 i; i < 5; ++i) {
                if (i != s.disputer && valid(s, i) && s.att[i].at > s.disputedAt && s.att[i].at <= t) ++n;
            }
            if (n >= kDispute(s) && (best == 0 || t < best)) best = t;
        }
    }

    /// t_open = max(t_silence, t_quorum, resumeAt); 0 when t_quorum is undefined.
    function tOpen(OState memory s) internal pure returns (uint256) {
        uint256 q = tQuorum(s);
        if (q == 0) return 0;
        uint256 o = tSilence(s);
        if (q > o) o = q;
        uint256 r = resumeAt(s);
        return r > o ? r : o;
    }

    /// isReleasable <=> t_quorum defined AND now >= t_open + window AND NOT disputed(e) (unless overridden)
    function releasable(OState memory s, uint256 now_) internal pure returns (bool) {
        if (s.latched) return true;
        if (tQuorum(s) == 0) return false;
        if (now_ < tOpen(s) + s.window * s.unit) return false;
        if (s.disputed && resumeAt(s) == 0) return false;
        return true;
    }

    /// D5 + D14: may guardian `i` file (reason, ev) now? A first filing always; later only a raise INCAPACITATED ->
    /// DECEASED or adding an evidence hash; plus one re-affirm (same or higher reason, evidence kept) for an
    /// attestation filed at or before the dispute of the current epoch.
    function attestAllowed(OState memory s, uint256 i, uint8 reason, bytes32 ev) internal pure returns (bool) {
        OAtt memory a = s.att[i];
        if (!a.filed) return true;
        bool raise = a.reason == 1 && reason == 2;
        bool addEv = a.ev == 0 && ev != 0;
        bool reasonOk = raise || reason == a.reason;
        bool evOk = ev == a.ev || addEv;
        bool reaffirm = s.disputed && a.at <= s.disputedAt;
        return reasonOk && evOk && (raise || addEv || reaffirm);
    }

    function _holdsAt(OState memory s, uint256 t, uint256) private pure returns (bool) {
        uint256 n;
        for (uint256 i; i < 5; ++i) {
            if (valid(s, i) && s.att[i].at <= t) ++n;
        }
        if (n < s.kAttest) return false;
        if (!s.requireEvidence) return true;
        for (uint256 i; i < 5; ++i) {
            for (uint256 j = i + 1; j < 5; ++j) {
                if (
                    valid(s, i) && valid(s, j) && s.att[i].at <= t && s.att[j].at <= t && s.att[i].ev != 0
                        && s.att[i].ev == s.att[j].ev
                ) return true;
            }
        }
        return false;
    }
}
