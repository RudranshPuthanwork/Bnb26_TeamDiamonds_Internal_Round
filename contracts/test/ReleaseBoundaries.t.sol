// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.sol";
import {HeirloomRegistry as R} from "../src/HeirloomRegistry.sol";
import {Reason} from "../src/libs/ReleaseRule.sol";

/// @dev Table-driven threshold tests: every boundary is probed at T-1, T, T+1 (TIME_UNIT = 1, so 1 unit = 1 s).
contract ReleaseBoundariesTest is Base {
    function setUp() public {
        _init(1);
    }

    /// @dev releasable exactly from `t` on.
    function _edge(bytes32 id, uint256 t) internal {
        assertFalse(_relAt(id, t - 1), "T-1 must not release");
        assertTrue(_relAt(id, t), "T must release");
        assertTrue(_relAt(id, t + 1), "T+1 must release");
    }

    function _never(bytes32 id, uint256 from) internal {
        uint256[4] memory dt = [uint256(0), 1, 1000, 10_000_000];
        for (uint256 i; i < 4; ++i) {
            assertFalse(_relAt(id, from + dt[i]), "must never release");
        }
    }

    function _attMany(uint256 from, uint256 n, Reason re, bytes32 ev) internal {
        for (uint256 i = from; i < from + n; ++i) {
            _att(i, re, ev);
        }
    }

    // ───────── silence threshold ─────────

    function test_silenceBound_table() public {
        uint32[4] memory minIn = [uint32(3), 3, 30, 5];
        uint32[4] memory win = [uint32(0), 2, 7, 1];
        for (uint256 i; i < 4; ++i) {
            vid = _newVault();
            _at(T0 + i * 1000);
            _add(ASSET, _pol(0x06, 3, false, minIn[i], win[i], 1000));
            _hb();
            uint256 h = _now();
            _at(h + 1);
            _attMany(0, 3, Reason.DECEASED, 0); // quorum at h+1, long before silence
            uint256 s = h + minIn[i];
            assertEq(uint8(_stAt(ASSET, s - 1)), uint8(R.Status.Armed));
            assertEq(uint8(_stAt(ASSET, s)), win[i] == 0 ? uint8(R.Status.Releasable) : uint8(R.Status.Cooling));
            _edge(ASSET, s + win[i]);
        }
    }

    function test_silenceBound_timeUnit60_floorsHeartbeat() public {
        _init(60);
        _add(ASSET, _pol(0x06, 3, false, 3, 2, 0));
        _at(T0 + 30);
        _hb();
        uint256 floor = ((T0 + 30) / 60) * 60;
        assertTrue(floor < T0 + 30, "test needs a non-aligned timestamp");
        _attMany(0, 3, Reason.DECEASED, 0);
        _edge(ASSET, floor + (3 + 2) * 60);
    }

    // ───────── quorum threshold ─────────

    function test_quorumBound_table() public {
        uint8[4] memory ks = [uint8(1), 2, 3, 4];
        uint32[2] memory ws = [uint32(0), 3];
        for (uint256 i; i < 4; ++i) {
            for (uint256 j; j < 2; ++j) {
                vid = _newVault();
                _at(T0 + (i * 2 + j) * 10_000);
                _add(ASSET, _pol(0x06, ks[i], false, 3, ws[j], 0));
                _hb();
                uint256 h = _now();
                _at(h + 1);
                _attMany(0, ks[i] - 1, Reason.DECEASED, 0); // quorum one short
                assertEq(uint8(_stAt(ASSET, h + 5000)), uint8(R.Status.Silent));
                _never(ASSET, h + 100);
                uint256 q = h + 50; // silence (h+3) long over
                _at(q);
                _att(ks[i] - 1, Reason.DECEASED, 0);
                assertEq(_tl(ASSET).tQuorum, q);
                _edge(ASSET, q + ws[j]);
            }
        }
    }

    function test_quorum_isKthSmallest_notLastFiled() public {
        // 5 guardians, k=2: the 2nd attestation by time opens the quorum even if more arrive later
        _add(ASSET, _pol(0x06, 2, false, 3, 4, 0));
        _hb();
        uint256 h = _now();
        _at(h + 10);
        _att(3, Reason.DECEASED, 0);
        _at(h + 20);
        _att(0, Reason.DECEASED, 0);
        _at(h + 30);
        _att(1, Reason.DECEASED, 0);
        assertEq(_tl(ASSET).tQuorum, h + 20);
        _edge(ASSET, h + 20 + 4);
    }

    // ───────── evidence (D6) ─────────

    function test_evidence_noPair_neverReleases() public {
        _add(ASSET, _pol(0x06, 3, true, 3, 0, 0));
        _hb();
        uint256 h = _now();
        _at(h + 10);
        _att(0, Reason.DECEASED, A1);
        _att(1, Reason.DECEASED, A2);
        _att(2, Reason.DECEASED, A3);
        assertEq(_tl(ASSET).tQuorum, 0);
        _never(ASSET, h + 10);
    }

    function test_evidence_zeroHashesDoNotPair() public {
        _add(ASSET, _pol(0x06, 3, true, 3, 0, 0));
        _hb();
        _at(_now() + 10);
        _attMany(0, 4, Reason.DECEASED, 0);
        assertEq(_tl(ASSET).tQuorum, 0);
    }

    function test_evidence_quorumAtFirstPairedPrefix() public {
        // k=3: g0 A1 @t1, g1 A2 @t2, g2 A3 @t3 (no pair), g3 A1 @t4 -> earliest T with >=3 AND a pair is t4
        _add(ASSET, _pol(0x06, 3, true, 3, 2, 0));
        _hb();
        uint256 h = _now();
        _at(h + 10);
        _att(0, Reason.DECEASED, A1);
        _at(h + 11);
        _att(1, Reason.DECEASED, A2);
        _at(h + 12);
        _att(2, Reason.DECEASED, A3);
        assertEq(_tl(ASSET).tQuorum, 0);
        _at(h + 20);
        _att(3, Reason.DECEASED, A1);
        assertEq(_tl(ASSET).tQuorum, h + 20);
        _edge(ASSET, h + 20 + 2);
    }

    function test_evidence_pairBeforeCountReached() public {
        // k=3: pair exists at t2, but the third attestation (no evidence) at t3 is what completes the quorum
        _add(ASSET, _pol(0x06, 3, true, 3, 2, 0));
        _hb();
        uint256 h = _now();
        _at(h + 10);
        _att(0, Reason.DECEASED, A1);
        _at(h + 11);
        _att(1, Reason.DECEASED, A1);
        assertEq(_tl(ASSET).tQuorum, 0);
        _at(h + 15);
        _att(2, Reason.DECEASED, 0);
        assertEq(_tl(ASSET).tQuorum, h + 15);
        _edge(ASSET, h + 15 + 2);
    }

    function test_evidence_countReachedBeforePair() public {
        // k=2: g0 A1 @t1, g1 A2 @t2 -> count ok, no pair; g2 A1 @t3 completes pair {g0,g2}
        _add(ASSET, _pol(0x06, 2, true, 3, 0, 0));
        _hb();
        uint256 h = _now();
        _at(h + 10);
        _att(0, Reason.DECEASED, A1);
        _at(h + 11);
        _att(1, Reason.DECEASED, A2);
        assertEq(_tl(ASSET).tQuorum, 0);
        _at(h + 12);
        _att(2, Reason.DECEASED, A1);
        assertEq(_tl(ASSET).tQuorum, h + 12);
        _edge(ASSET, h + 12);
    }

    function test_evidence_notRequired_ignoresHashes() public {
        _add(ASSET, _pol(0x06, 3, false, 3, 0, 0));
        _hb();
        uint256 h = _now();
        _at(h + 10);
        _att(0, Reason.DECEASED, A1);
        _att(1, Reason.DECEASED, A2);
        _att(2, Reason.DECEASED, A3);
        assertEq(_tl(ASSET).tQuorum, h + 10);
        _edge(ASSET, h + 10);
    }

    function test_evidence_addedByReattest_resetsAt() public {
        _add(ASSET, _pol(0x06, 3, true, 3, 0, 0));
        _hb();
        uint256 h = _now();
        _at(h + 10);
        _attMany(0, 3, Reason.DECEASED, 0);
        assertEq(_tl(ASSET).tQuorum, 0);
        _at(h + 20);
        _att(0, Reason.DECEASED, A1);
        _at(h + 21);
        _att(1, Reason.DECEASED, A1); // pair; all three still valid, kth smallest at = 21 (g2 @10, g0 @20, g1 @21)
        assertEq(_tl(ASSET).tQuorum, h + 21);
        _edge(ASSET, h + 21);
    }

    // ───────── planned absence ─────────

    function test_absence_table() public {
        // until offsets relative to heartbeat h; minInactivity = 3
        uint256[3] memory off = [uint256(100), 2, 3];
        uint256[3] memory silence = [uint256(100), 3, 3];
        for (uint256 i; i < 3; ++i) {
            vid = _newVault();
            _at(T0 + i * 10_000);
            _add(ASSET, _pol(0x06, 3, false, 3, 2, 0));
            uint256 h = _now();
            vm.prank(owner);
            r.setAbsence(vid, uint40(h + off[i]), _d());
            _at(h + 1);
            _attMany(0, 3, Reason.DECEASED, 0);
            assertEq(_tl(ASSET).tSilence, h + silence[i]);
            assertEq(uint8(_stAt(ASSET, h + silence[i] - 1)), uint8(R.Status.Armed));
            assertEq(uint8(_stAt(ASSET, h + silence[i])), uint8(R.Status.Cooling));
            _edge(ASSET, h + silence[i] + 2);
        }
    }

    function test_absence_quorumStillAccumulatesDuring() public {
        _add(ASSET, _pol(0x06, 3, false, 3, 2, 0));
        uint256 h = _now();
        vm.prank(owner);
        r.setAbsence(vid, uint40(h + 100), _d());
        _at(h + 5);
        _attMany(0, 3, Reason.DECEASED, 0);
        assertEq(_tl(ASSET).tQuorum, h + 5);
        assertFalse(_relAt(ASSET, h + 99));
    }

    function test_absence_quorumAfterAbsenceDominates() public {
        _add(ASSET, _pol(0x06, 3, false, 3, 2, 0));
        uint256 h = _now();
        vm.prank(owner);
        r.setAbsence(vid, uint40(h + 100), _d());
        _at(h + 200);
        _attMany(0, 3, Reason.DECEASED, 0);
        _edge(ASSET, h + 200 + 2);
    }

    // ───────── dispute (D4) ─────────

    function _armedAndSilent() internal returns (uint256 h) {
        _add(ASSET, _pol(0x06, 3, false, 3, 2, 0));
        _hb();
        h = _now();
        _at(h + 1);
        _attMany(0, 3, Reason.INCAPACITATED, 0);
        _at(h + 10); // silent, quorum reached, window (2) long elapsed -> would be releasable
        assertTrue(_rel(ASSET));
    }

    function test_dispute_freezesRelease() public {
        uint256 h = _armedAndSilent();
        _disp(4);
        assertFalse(_rel(ASSET));
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Disputed));
        assertTrue(_tl(ASSET).disputed);
        _never(ASSET, h + 10);
    }

    function test_dispute_threeFreshAttestationsAreNotEnough() public {
        uint256 h = _armedAndSilent();
        _disp(4);
        _at(h + 11);
        _attMany(0, 3, Reason.DECEASED, 0); // raises: 3 fresh < kDispute (4)
        assertFalse(_rel(ASSET));
        assertTrue(_tl(ASSET).disputed);
        _never(ASSET, h + 11);
    }

    function test_dispute_override_resumeAtIsKDisputeThSmallest() public {
        _armedAndSilent();
        _disp(4);
        uint256 d = _now();
        _at(d + 1);
        _att(0, Reason.DECEASED, 0);
        _at(d + 2);
        _att(1, Reason.DECEASED, 0);
        _at(d + 3);
        _att(2, Reason.DECEASED, 0);
        _at(d + 4);
        _att(3, Reason.DECEASED, 0); // 4th fresh -> override
        _at(d + 5);
        _att(4, Reason.DECEASED, 0);
        R.Status s = _st(ASSET);
        assertTrue(s == R.Status.Cooling);
        TL memory t = _tl(ASSET);
        assertEq(t.resumeAt, d + 4);
        assertFalse(t.disputed);
        assertEq(t.tOpen, d + 4);
        _edge(ASSET, d + 4 + 2);
    }

    function test_dispute_attestationAtDisputeSecondDoesNotCount() public {
        _armedAndSilent();
        _disp(4);
        uint256 d = _now();
        // two raises in the same second as the dispute (at == disputedAt) must not count
        _att(0, Reason.DECEASED, 0);
        _att(1, Reason.DECEASED, 0);
        _at(d + 1);
        _att(2, Reason.DECEASED, 0);
        _att(3, Reason.DECEASED, 0);
        _att(4, Reason.DECEASED, 0);
        // strictly-after count is 3 (g2,g3,g4); counting >= would give 5 and override
        assertTrue(_tl(ASSET).disputed);
        assertFalse(_rel(ASSET));
    }

    function test_dispute_clearedByOwnerHeartbeat_newEpochReleasesNormally() public {
        _armedAndSilent();
        _disp(4);
        _hb();
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Sealed));
        uint256 h = _now();
        _at(h + 1);
        _attMany(0, 3, Reason.DECEASED, 0);
        assertFalse(_tl(ASSET).disputed); // dispute is scoped to the epoch it was filed in
        _edge(ASSET, h + 3 + 2);
    }

    function test_dispute_beforeQuorum_stillFreezesLater() public {
        _add(ASSET, _pol(0x06, 3, false, 3, 2, 0));
        _hb();
        uint256 h = _now();
        _disp(4);
        _at(h + 1);
        _attMany(0, 3, Reason.DECEASED, 0); // at > disputedAt only if time advanced
        _at(h + 100);
        assertFalse(_rel(ASSET));
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Disputed));
    }

    // ───────── reason upgrade / masks ─────────

    function test_reasonUpgrade_deceasedOnlyMask() public {
        _add(ASSET, _pol(0x04, 3, false, 3, 2, 0)); // DECEASED only
        _hb();
        uint256 h = _now();
        _at(h + 1);
        _attMany(0, 3, Reason.INCAPACITATED, 0);
        assertEq(_tl(ASSET).tQuorum, 0);
        assertEq(_tl(ASSET).filed, 0);
        _at(h + 10);
        _att(0, Reason.DECEASED, 0);
        _att(1, Reason.DECEASED, 0);
        assertEq(_tl(ASSET).tQuorum, 0);
        _at(h + 20);
        _att(2, Reason.DECEASED, 0); // third upgrade completes the quorum
        assertEq(_tl(ASSET).tQuorum, h + 20);
        _edge(ASSET, h + 20 + 2);
    }

    function test_mask_missingOnly() public {
        _add(ASSET, _pol(0x08, 2, false, 3, 0, 0));
        _hb();
        uint256 h = _now();
        _at(h + 10);
        _att(0, Reason.DECEASED, 0);
        _att(1, Reason.INCAPACITATED, 0);
        assertEq(_tl(ASSET).tQuorum, 0);
        _att(2, Reason.MISSING, 0);
        assertEq(_tl(ASSET).tQuorum, 0);
        _att(3, Reason.MISSING, 0);
        assertEq(_tl(ASSET).tQuorum, h + 10);
        assertEq(_tl(ASSET).filed, 2);
    }

    // ───────── §5.3 staged policies on one vault ─────────

    function _threePolicies() internal returns (bytes32 med, bytes32 ltr, bytes32 cry) {
        med = keccak256("medical");
        ltr = keccak256("letters");
        cry = keccak256("crypto");
        _add(med, _pol(0x06, 3, false, 3, 2, 0));
        _add(ltr, _pol(0x0c, 2, false, 30, 7, 0));
        _add(cry, _pol(0x04, 3, true, 45, 30, 0));
    }

    function test_staged_deceasedWithSharedEvidence() public {
        (bytes32 med, bytes32 ltr, bytes32 cry) = _threePolicies();
        _hb();
        uint256 h = _now();
        _at(h + 1);
        _attMany(0, 3, Reason.DECEASED, A1);

        uint256[8] memory t = [h + 4, h + 5, h + 36, h + 37, h + 74, h + 75, h + 76, h + 1000];
        bool[8] memory eM = [false, true, true, true, true, true, true, true];
        bool[8] memory eL = [false, false, false, true, true, true, true, true];
        bool[8] memory eC = [false, false, false, false, false, true, true, true];
        for (uint256 i; i < 8; ++i) {
            assertEq(_relAt(med, t[i]), eM[i], "medical");
            assertEq(_relAt(ltr, t[i]), eL[i], "letters");
            assertEq(_relAt(cry, t[i]), eC[i], "crypto");
        }
    }

    function test_staged_cryptoNeedsEvidence_othersDont() public {
        (bytes32 med, bytes32 ltr, bytes32 cry) = _threePolicies();
        _hb();
        uint256 h = _now();
        _at(h + 1);
        _attMany(0, 3, Reason.DECEASED, 0);
        _at(h + 100_000);
        assertTrue(_rel(med));
        assertTrue(_rel(ltr));
        assertFalse(_rel(cry));
    }

    function test_staged_missingOnlyReleasesLetters() public {
        (bytes32 med, bytes32 ltr, bytes32 cry) = _threePolicies();
        _hb();
        uint256 h = _now();
        _at(h + 1);
        _attMany(0, 3, Reason.MISSING, 0);
        _at(h + 100_000);
        assertFalse(_rel(med));
        assertTrue(_rel(ltr));
        assertFalse(_rel(cry));
    }

    function test_staged_incapacitatedReleasesMedicalOnly() public {
        (bytes32 med, bytes32 ltr, bytes32 cry) = _threePolicies();
        _hb();
        uint256 h = _now();
        _at(h + 1);
        _attMany(0, 3, Reason.INCAPACITATED, 0);
        _at(h + 100_000);
        assertTrue(_rel(med));
        assertFalse(_rel(ltr));
        assertFalse(_rel(cry));
    }
}
