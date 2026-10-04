// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.sol";
import {HeirloomRegistry as R} from "../src/HeirloomRegistry.sol";
import {Reason} from "../src/libs/ReleaseRule.sol";

/// @dev Demo scenarios (specs/demo.md numbering): #1 staged release, #2 false attestation + cancel,
/// #3 attests under fresh heartbeats, #6 dispute then override.
contract ScenariosTest is Base {
    function setUp() public {
        _init(1);
    }

    function _attAll(uint256 n, Reason re, bytes32 ev) internal {
        for (uint256 i; i < n; ++i) {
            _att(i, re, ev);
        }
    }

    // ── #1 staged release: three policies, three release times, shares + claim per stage ──
    function test_scenario1_stagedRelease() public {
        bytes32 med = keccak256("medical");
        bytes32 letters = keccak256("letters");
        bytes32 crypto = keccak256("crypto");
        _add(med, _pol(0x06, 3, false, 3, 2, 100));
        _add(letters, _pol(0x0c, 2, false, 30, 7, 100));
        _add(crypto, _pol(0x04, 3, true, 45, 30, 100));
        _hb();
        uint256 h = _now();
        _at(h + 1);
        _attAll(3, Reason.DECEASED, A1);

        // stage 1: only medical (h+5)
        _at(h + 5);
        assertEq(uint8(_st(med)), uint8(R.Status.Releasable));
        assertEq(uint8(_st(letters)), uint8(R.Status.Armed));
        assertEq(uint8(_st(crypto)), uint8(R.Status.Armed));
        bytes32 c = _k(benef);
        vm.prank(g[0]);
        r.submitShare(vid, med, c, _share(), _d());
        vm.expectRevert(R.NotReleasable.selector);
        vm.prank(g[0]);
        r.submitShare(vid, letters, c, _share(), _d());
        vm.prank(benef);
        r.markClaimed(vid, med, _d());
        assertEq(uint8(_st(med)), uint8(R.Status.Claimed));

        // stage 2: letters (h+37)
        _at(h + 37);
        assertEq(uint8(_st(letters)), uint8(R.Status.Releasable));
        assertEq(uint8(_st(crypto)), uint8(R.Status.Armed));
        vm.prank(g[1]);
        r.submitShare(vid, letters, c, _share(), _d());
        vm.expectRevert(R.NotReleasable.selector);
        vm.prank(benef);
        r.markClaimed(vid, crypto, _d());

        // stage 3: crypto (h+75)
        _at(h + 75);
        assertEq(uint8(_st(crypto)), uint8(R.Status.Releasable));
        vm.prank(g[2]);
        r.submitShare(vid, crypto, c, _share(), _d());
        vm.prank(benef);
        r.markClaimed(vid, crypto, _d());
    }

    // ── #2 guardians file false DECEASED while the owner is alive; one tap cancels everything ──
    function test_scenario2_falseAttestation_ownerCancels() public {
        _stdAsset(ASSET);
        _hb();
        uint256 h = _now();
        _at(h + 1);
        _attAll(3, Reason.DECEASED, 0); // quorum reached while the owner is alive
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Armed));
        assertEq(_tl(ASSET).filed, 3);
        assertFalse(_rel(ASSET));

        vm.prank(owner);
        r.cancel(vid, _d()); // one tap
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Sealed));
        assertEq(_tl(ASSET).filed, 0);

        // the original silence/window deadlines pass: nothing releases, the old attestations are void
        _at(h + 1000);
        assertFalse(_rel(ASSET));
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Silent));
        // fewer than quorum cannot re-arm
        _attAll(2, Reason.DECEASED, 0);
        assertFalse(_rel(ASSET));
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Silent));
    }

    function test_scenario2_cancelWhileCooling_voidsWindow() public {
        _stdAsset(ASSET);
        uint256 h = _release(ASSET); // releasable
        _at(h + 3); // back inside the window: silent + quorum, window (until h+5) still running
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Cooling));
        vm.prank(owner);
        r.cancel(vid, _d());
        _at(h + 500);
        assertFalse(_rel(ASSET));
    }

    // ── #3 attestations under fresh heartbeats never satisfy silence ──
    function test_scenario3_freshHeartbeats_attestationsNeverRelease() public {
        _stdAsset(ASSET); // minInactivity 3, window 2
        for (uint256 day; day < 60; ++day) {
            _hb();
            uint256 h = _now();
            _attAll(5, Reason.DECEASED, 0); // the whole guardian set attests
            assertFalse(_rel(ASSET));
            assertEq(uint8(_st(ASSET)), uint8(R.Status.Armed));
            _at(h + 2); // owner is always back before minInactivity (3) lapses
            assertFalse(_rel(ASSET));
            assertEq(uint8(_st(ASSET)), uint8(R.Status.Armed));
        }
        // the next heartbeat wipes every attestation
        _hb();
        assertEq(_tl(ASSET).filed, 0);
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Sealed));
    }

    function test_scenario3_armedThenLapseFires_noDoubleWait() public {
        _stdAsset(ASSET);
        _hb();
        uint256 h = _now();
        _at(h + 1);
        _attAll(3, Reason.DECEASED, 0);
        assertFalse(_relAt(ASSET, h + 4)); // silence reached at h+3, window not elapsed
        assertTrue(_relAt(ASSET, h + 5)); // window starts at the lapse, not at the attestation + window + lapse
    }

    // ── #6 dispute, then override by kDispute fresh attestations ──
    function test_scenario6_disputeThenOverride() public {
        _stdAsset(ASSET);
        _hb();
        uint256 h = _now();
        _at(h + 1);
        _attAll(3, Reason.INCAPACITATED, 0);
        _at(h + 4);
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Cooling));

        _disp(4); // ALIVE vote at h+4 (inside window)
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Disputed));
        _at(h + 500); // the original window long over: still frozen
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Disputed));
        assertFalse(_rel(ASSET));

        // kDispute = kAttest + 1 = 4 fresh attestations
        _at(h + 600);
        _att(0, Reason.DECEASED, 0);
        _att(1, Reason.DECEASED, 0);
        _att(2, Reason.DECEASED, 0);
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Disputed)); // 3 is not enough
        _att(3, Reason.DECEASED, 0);
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Cooling)); // override: window restarts at h+600
        assertEq(_tl(ASSET).resumeAt, h + 600);
        assertFalse(_relAt(ASSET, h + 601));
        assertTrue(_relAt(ASSET, h + 602));
    }

    function test_scenario6_disputeThenOwnerReturns() public {
        _stdAsset(ASSET);
        _hb();
        uint256 h = _now();
        _at(h + 1);
        _attAll(3, Reason.DECEASED, 0);
        _at(h + 4);
        _disp(4);
        vm.prank(owner);
        r.cancel(vid, _d()); // owner alive: epoch++ voids dispute and attestations
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Sealed));
        assertFalse(_tl(ASSET).disputed);
    }

    function test_scenario6_oneGuardianCannotBlockForever() public {
        _stdAsset(ASSET);
        _hb();
        uint256 h = _now();
        _at(h + 1);
        _attAll(3, Reason.INCAPACITATED, 0);
        _at(h + 4);
        _disp(4);
        vm.expectRevert(R.AlreadyDisputed.selector); // the blocker cannot re-dispute to push disputedAt forward
        _disp(4);
        _at(h + 10);
        _att(0, Reason.DECEASED, 0);
        _att(1, Reason.DECEASED, 0);
        _att(2, Reason.DECEASED, 0);
        vm.expectRevert(R.AlreadyDisputed.selector); // nor can an ally
        _disp(3);
        _att(3, Reason.DECEASED, 0); // 4th fresh attestation: the remaining guardians override
        assertFalse(_tl(ASSET).disputed);
        assertTrue(_relAt(ASSET, h + 12));
    }
}
