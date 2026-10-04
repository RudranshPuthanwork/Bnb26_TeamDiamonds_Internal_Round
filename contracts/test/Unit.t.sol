// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.sol";
import {HeirloomRegistry as R} from "../src/HeirloomRegistry.sol";
import {Reason} from "../src/libs/ReleaseRule.sol";

contract UnitTest is Base {
    event VaultCreated(bytes32 indexed vaultId, bytes32 owner0, bytes32 owner1, uint8 guardians, uint8 t);
    event AssetAdded(bytes32 indexed vaultId, bytes32 indexed assetId, bytes32 primaryBenef, bytes32 bundleCid);
    event Heartbeat(bytes32 indexed vaultId, uint32 epoch);
    event Cancelled(bytes32 indexed vaultId, uint32 epoch);
    event AbsenceSet(bytes32 indexed vaultId, uint40 until);
    event Attested(bytes32 indexed vaultId, uint8 indexed guardian, Reason reason, bytes32 evidenceHash);
    event Disputed(bytes32 indexed vaultId, uint8 indexed guardian, uint32 epoch);
    event ShareSubmitted(bytes32 indexed vaultId, bytes32 indexed assetId, uint8 guardian);
    event Claimed(bytes32 indexed vaultId, bytes32 indexed assetId, bytes32 claimant);

    function setUp() public {
        _init(1);
    }

    // ───────── constructor / keyId ─────────

    function test_constructor_zeroUnitReverts() public {
        vm.expectRevert(R.BadBounds.selector);
        new R(0);
    }

    function test_constructor_storesUnit() public view {
        assertEq(r.TIME_UNIT(), 1);
        assertEq(r.MAX_GUARDIANS(), 12);
    }

    function test_keyId_matchesD1() public view {
        assertEq(
            r.keyId(R.KeyKind.EOA, bytes32(uint256(1)), 0),
            keccak256(abi.encode(R.KeyKind.EOA, bytes32(uint256(1)), bytes32(0)))
        );
        assertTrue(r.keyId(R.KeyKind.EOA, bytes32(uint256(1)), 0) != r.keyId(R.KeyKind.P256, bytes32(uint256(1)), 0));
    }

    // ───────── createVault ─────────

    function test_createVault_ok() public {
        bytes32[] memory gk = _gk(5);
        bytes32 ok = _k(owner);
        vm.expectEmit(true, false, false, true);
        emit VaultCreated(bytes32(uint256(2)), ok, bytes32(0), 5, 3);
        vm.prank(owner);
        bytes32 id = r.createVault([ok, bytes32(0)], gk, 3, 7, _d());
        assertEq(id, bytes32(uint256(2)));
        assertEq(r.vaultCount(), 2);
    }

    function test_createVault_maxGuardians() public {
        bytes32[] memory gk = _gk(12);
        bytes32 ok = _k(owner);
        vm.prank(owner);
        r.createVault([ok, bytes32(0)], gk, 12, 0, _d());
    }

    function test_createVault_reverts() public {
        bytes32 ok = _k(owner);
        bytes32[] memory gk = _gk(5);

        vm.expectRevert(R.BadBounds.selector); // n > 12
        vm.prank(owner);
        r.createVault([ok, bytes32(0)], _gk(13), 3, 0, _d());

        vm.expectRevert(R.BadBounds.selector); // n < 2
        vm.prank(owner);
        r.createVault([ok, bytes32(0)], _gk(1), 1, 0, _d());

        vm.expectRevert(R.BadBounds.selector); // t = 0
        vm.prank(owner);
        r.createVault([ok, bytes32(0)], gk, 0, 0, _d());

        vm.expectRevert(R.BadBounds.selector); // t > n
        vm.prank(owner);
        r.createVault([ok, bytes32(0)], gk, 6, 0, _d());

        bytes32[] memory dup = _gk(5);
        dup[4] = dup[0];
        vm.expectRevert(R.DuplicateGuardian.selector);
        vm.prank(owner);
        r.createVault([ok, bytes32(0)], dup, 3, 0, _d());

        vm.expectRevert(R.NotAuthorized.selector); // signer is not owners[0]
        vm.prank(stranger);
        r.createVault([ok, bytes32(0)], gk, 3, 0, _d());

        vm.expectRevert(R.NotAuthorized.selector); // zero owner
        vm.prank(address(0));
        r.createVault([bytes32(0), bytes32(0)], gk, 3, 0, _d());
    }

    // ───────── addAsset ─────────

    function test_addAsset_ok_bumpsEpochAndStamps() public {
        vm.expectEmit(true, true, false, true);
        emit AssetAdded(vid, ASSET, _k(benef), bytes32(uint256(1)));
        _stdAsset(ASSET);
        assertEq(_k(benef), r.currentClaimant(vid, ASSET));
        (,,,,,, uint8 k,,) = r.timeline(vid, ASSET);
        assertEq(k, 3);
    }

    function test_addAsset_reverts() public {
        // primary beneficiary is a guardian
        R.AssetPolicy memory p = _pol(0x06, 3, false, 3, 2, 5);
        p.primaryBenef = _k(g[2]);
        vm.expectRevert(R.BeneficiaryIsGuardian.selector);
        vm.prank(owner);
        r.addAsset(vid, ASSET, p, _d());

        // contingent beneficiary is a guardian
        p = _pol(0x06, 3, false, 3, 2, 5);
        p.contingentBenef = _k(g[4]);
        vm.expectRevert(R.BeneficiaryIsGuardian.selector);
        vm.prank(owner);
        r.addAsset(vid, ASSET, p, _d());

        // D3: kAttest <= n-1
        p = _pol(0x06, 5, false, 3, 2, 5);
        vm.expectRevert(R.BadPolicy.selector);
        vm.prank(owner);
        r.addAsset(vid, ASSET, p, _d());
        p = _pol(0x06, 4, false, 3, 2, 5); // n-1 is fine
        _add(ASSET, p);

        bytes32 id2 = keccak256("2");
        R.AssetPolicy[7] memory bad;
        bad[0] = _pol(0x06, 0, false, 3, 2, 5); // k = 0
        bad[1] = _pol(0x00, 3, false, 3, 2, 5); // mask empty
        bad[2] = _pol(0x10, 3, false, 3, 2, 5); // mask out of range
        bad[3] = _pol(0x06, 3, false, 0, 2, 5); // minInactivity 0
        bad[4] = _pol(0x06, 3, false, 3, 2, 5);
        bad[4].primaryBenef = 0;
        bad[5] = _pol(0x06, 3, false, 3, 2, 5);
        bad[5].bundleCid = 0;
        bad[6] = _pol(0x06, 3, false, 3, 2, 5);
        bad[6].shareCommitments = new bytes32[](4);
        for (uint256 i; i < 7; ++i) {
            vm.expectRevert(R.BadPolicy.selector);
            vm.prank(owner);
            r.addAsset(vid, id2, bad[i], _d());
        }

        vm.expectRevert(R.AssetExists.selector);
        vm.prank(owner);
        r.addAsset(vid, ASSET, _pol(0x06, 3, false, 3, 2, 5), _d());
    }

    function test_addAsset_noVault() public {
        vm.expectRevert(R.NoVault.selector);
        vm.prank(owner);
        r.addAsset(bytes32(uint256(99)), ASSET, _pol(0x06, 3, false, 3, 2, 5), _d());
    }

    // ───────── heartbeat / cancel / setAbsence ─────────

    function test_heartbeat_bumpsEpochAndVoidsAttestations() public {
        _stdAsset(ASSET);
        _att(0, Reason.DECEASED, 0);
        (,,,,, uint8 filed,,,) = r.timeline(vid, ASSET);
        assertEq(filed, 1);
        vm.expectEmit(true, false, false, false);
        emit Heartbeat(vid, 0);
        _hb();
        (,,,,, filed,,,) = r.timeline(vid, ASSET);
        assertEq(filed, 0);
    }

    function test_heartbeat_floorsToTimeUnit() public {
        _init(60);
        _stdAsset(ASSET);
        _at(T0 + 61);
        _hb();
        (uint256 tSilence,,,,,,,,) = r.timeline(vid, ASSET);
        assertEq(tSilence, ((T0 + 61) / 60) * 60 + 3 * 60);
    }

    function test_cancel_emitsAndResets() public {
        _stdAsset(ASSET);
        vm.expectEmit(true, false, false, false);
        emit Cancelled(vid, 0);
        vm.prank(owner);
        r.cancel(vid, _d());
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Sealed));
    }

    function test_setAbsence_setsAndClears() public {
        _stdAsset(ASSET);
        vm.expectEmit(true, false, false, true);
        emit AbsenceSet(vid, uint40(T0 + 500));
        vm.prank(owner);
        r.setAbsence(vid, uint40(T0 + 500), _d());
        (uint256 tSilence,,,,,,,,) = r.timeline(vid, ASSET);
        assertEq(tSilence, T0 + 500);
        vm.prank(owner);
        r.setAbsence(vid, 0, _d());
        (tSilence,,,,,,,,) = r.timeline(vid, ASSET);
        assertEq(tSilence, T0 + 3);
    }

    function test_ownerFns_noVault() public {
        bytes32 nv = bytes32(uint256(77));
        vm.startPrank(owner);
        vm.expectRevert(R.NoVault.selector);
        r.heartbeat(nv, _d());
        vm.expectRevert(R.NoVault.selector);
        r.cancel(nv, _d());
        vm.expectRevert(R.NoVault.selector);
        r.setAbsence(nv, 1, _d());
        vm.stopPrank();
    }

    function test_p256Auth_reverts() public {
        R.Auth memory a = R.Auth(R.AuthKind.P256, address(0), 0, 0, "");
        vm.expectRevert(R.NotImplemented.selector);
        vm.prank(owner);
        r.heartbeat(vid, a);
    }

    // ───────── attest ─────────

    function test_attest_ok() public {
        _stdAsset(ASSET);
        vm.expectEmit(true, true, false, true);
        emit Attested(vid, 2, Reason.DECEASED, A1);
        _att(2, Reason.DECEASED, A1);
        (,,,,, uint8 filed,,,) = r.timeline(vid, ASSET);
        assertEq(filed, 1);
    }

    function test_attest_reverts() public {
        vm.expectRevert(R.BadReason.selector);
        vm.prank(g[0]);
        r.attest(vid, Reason.NONE, 0, _d());

        vm.expectRevert(R.NotAuthorized.selector);
        vm.prank(stranger);
        r.attest(vid, Reason.DECEASED, 0, _d());

        vm.expectRevert(R.NoVault.selector);
        vm.prank(g[0]);
        r.attest(bytes32(uint256(77)), Reason.DECEASED, 0, _d());
    }

    function test_attest_d5_lockedChanges() public {
        _stdAsset(ASSET);
        _att(0, Reason.DECEASED, 0);
        _att(1, Reason.INCAPACITATED, 0);
        _att(2, Reason.MISSING, 0);
        _att(3, Reason.DECEASED, A1);

        // identical re-attest is not a change
        vm.expectRevert(R.AttestationLocked.selector);
        _att(0, Reason.DECEASED, 0);
        // downgrade
        vm.expectRevert(R.AttestationLocked.selector);
        _att(0, Reason.INCAPACITATED, 0);
        // lateral
        vm.expectRevert(R.AttestationLocked.selector);
        _att(1, Reason.MISSING, 0);
        // MISSING cannot be raised
        vm.expectRevert(R.AttestationLocked.selector);
        _att(2, Reason.DECEASED, 0);
        // evidence cannot be changed or removed
        vm.expectRevert(R.AttestationLocked.selector);
        _att(3, Reason.DECEASED, A2);
        vm.expectRevert(R.AttestationLocked.selector);
        _att(3, Reason.DECEASED, 0);
    }

    function test_attest_d5_allowedChanges_resetAt() public {
        _stdAsset(ASSET);
        _att(0, Reason.INCAPACITATED, 0);
        _att(1, Reason.INCAPACITATED, 0);
        _att(2, Reason.INCAPACITATED, 0);
        (, uint256 q0,,,,,,,) = r.timeline(vid, ASSET);
        assertEq(q0, T0);

        _at(T0 + 10);
        _att(0, Reason.DECEASED, 0); // raise
        _att(1, Reason.INCAPACITATED, A1); // add evidence, same reason
        _att(2, Reason.DECEASED, A2); // raise + add evidence together
        // `at` reset to now for all three: kth smallest is now T0+10
        (, uint256 q1,,,,,,,) = r.timeline(vid, ASSET);
        assertEq(q1, T0 + 10);
    }

    // ───────── dispute ─────────

    function test_dispute_ok_onceThenNewEpoch() public {
        _stdAsset(ASSET);
        vm.expectEmit(true, true, false, false);
        emit Disputed(vid, 1, 0);
        _disp(1);
        vm.expectRevert(R.AlreadyDisputed.selector);
        _disp(2);
        vm.expectRevert(R.AlreadyDisputed.selector);
        _disp(1);
        _hb(); // new epoch: disputes are scoped to the epoch they were filed in (D4)
        _disp(2);
    }

    function test_dispute_reverts() public {
        vm.expectRevert(R.NotAuthorized.selector);
        vm.prank(stranger);
        r.dispute(vid, _d());
        vm.expectRevert(R.NoVault.selector);
        vm.prank(g[0]);
        r.dispute(bytes32(uint256(77)), _d());
    }

    // ───────── submitShare ─────────

    function test_submitShare_ok() public {
        _stdAsset(ASSET);
        _release(ASSET);
        bytes32 c = _k(benef);
        bytes memory s = _share();
        vm.expectEmit(true, true, false, true);
        emit ShareSubmitted(vid, ASSET, 3);
        vm.prank(g[3]);
        r.submitShare(vid, ASSET, c, s, _d());
        // overwrite by the same guardian is allowed
        vm.prank(g[3]);
        r.submitShare(vid, ASSET, c, s, _d());
    }

    function test_submitShare_reverts() public {
        _stdAsset(ASSET);
        bytes32 c = _k(benef);
        bytes memory s = _share();
        vm.expectRevert(R.NotReleasable.selector);
        vm.prank(g[0]);
        r.submitShare(vid, ASSET, c, s, _d());

        _release(ASSET);
        vm.expectRevert(R.NotClaimant.selector);
        vm.prank(g[0]);
        r.submitShare(vid, ASSET, _k(contBenef), s, _d());

        vm.expectRevert(R.BadShare.selector);
        vm.prank(g[0]);
        r.submitShare(vid, ASSET, c, new bytes(112), _d());
        vm.expectRevert(R.BadShare.selector);
        vm.prank(g[0]);
        r.submitShare(vid, ASSET, c, new bytes(114), _d());

        vm.expectRevert(R.NotAuthorized.selector);
        vm.prank(benef);
        r.submitShare(vid, ASSET, c, s, _d());

        vm.expectRevert(R.NoAsset.selector);
        vm.prank(g[0]);
        r.submitShare(vid, keccak256("nope"), c, s, _d());
    }

    // ───────── markClaimed ─────────

    function test_markClaimed_ok() public {
        _stdAsset(ASSET);
        _release(ASSET);
        vm.expectEmit(true, true, false, true);
        emit Claimed(vid, ASSET, _k(benef));
        vm.prank(benef);
        r.markClaimed(vid, ASSET, _d());
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Claimed));
        vm.expectRevert(R.AlreadyClaimed.selector);
        vm.prank(benef);
        r.markClaimed(vid, ASSET, _d());
    }

    function test_markClaimed_reverts() public {
        _stdAsset(ASSET);
        vm.expectRevert(R.NotReleasable.selector);
        vm.prank(benef);
        r.markClaimed(vid, ASSET, _d());

        _release(ASSET);
        vm.expectRevert(R.NotClaimant.selector);
        vm.prank(contBenef);
        r.markClaimed(vid, ASSET, _d());
        vm.expectRevert(R.NoAsset.selector);
        vm.prank(benef);
        r.markClaimed(vid, keccak256("nope"), _d());
    }

    function test_claimed_isSticky_afterCancel() public {
        _stdAsset(ASSET);
        _release(ASSET);
        vm.prank(benef);
        r.markClaimed(vid, ASSET, _d());
        _hb();
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Claimed)); // released secret cannot be un-released
    }

    // ───────── views ─────────

    function test_views_noVaultNoAsset() public {
        vm.expectRevert(R.NoVault.selector);
        r.isReleasable(bytes32(uint256(77)), ASSET);
        vm.expectRevert(R.NoAsset.selector);
        r.isReleasable(vid, ASSET);
        vm.expectRevert(R.NoAsset.selector);
        r.currentClaimant(vid, ASSET);
        vm.expectRevert(R.NoAsset.selector);
        r.status(vid, ASSET);
        vm.expectRevert(R.NoAsset.selector);
        r.timeline(vid, ASSET);
    }

    function test_timeline_values() public {
        _stdAsset(ASSET);
        _hb();
        uint256 h = _now();
        TL memory t = _tl(ASSET);
        assertEq(t.tSilence, h + 3);
        assertEq(t.tQuorum + t.resumeAt + t.tOpen + t.opensAt + t.filed + t.claimDeadline, 0);
        assertEq(t.k, 3);
        assertFalse(t.disputed);

        _at(h + 1);
        for (uint256 i; i < 3; ++i) {
            _att(i, Reason.DECEASED, 0);
        }
        t = _tl(ASSET);
        assertEq(t.tQuorum, h + 1);
        assertEq(t.tOpen, h + 3);
        assertEq(t.opensAt, h + 5);
        assertEq(t.filed, 3);
        assertEq(t.claimDeadline, h + 10);
    }

    function test_status_contingentEligible() public {
        _stdAsset(ASSET);
        uint256 h = _release(ASSET);
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Releasable));
        assertEq(uint8(_stAt(ASSET, h + 9)), uint8(R.Status.Releasable)); // opensAt h+5, deadline h+10
        assertEq(uint8(_stAt(ASSET, h + 10)), uint8(R.Status.ContingentEligible));
        // primary is still the only claimant for now
        assertEq(r.currentClaimant(vid, ASSET), _k(benef));
    }

    function test_status_allNonTerminalStates() public {
        _stdAsset(ASSET);
        _hb();
        uint256 h = _now();
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Sealed));
        _at(h + 3);
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Silent));
        _at(h + 1);
        for (uint256 i; i < 3; ++i) {
            _att(i, Reason.DECEASED, 0);
        }
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Armed));
        _at(h + 3);
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Cooling));
        _disp(3);
        assertEq(uint8(_st(ASSET)), uint8(R.Status.Disputed));
    }

    // ───────── access matrix ─────────

    function _call(address who, bytes memory data) internal returns (bool ok, bytes4 sel) {
        vm.prank(who);
        bytes memory ret;
        (ok, ret) = address(r).call(data);
        if (!ok && ret.length >= 4) {
            assembly {
                sel := mload(add(ret, 0x20))
            }
        }
    }

    function test_accessMatrix() public {
        address[4] memory who = [owner, g[3], benef, stranger];
        // 0 = owner, 1 = guardian, 2 = beneficiary, 3 = stranger
        bytes32 nid = keccak256("matrix-asset");
        R.AssetPolicy memory p = _pol(0x06, 3, false, 3, 2, 5);
        bytes[7] memory data = [
            abi.encodeCall(R.heartbeat, (vid, _d())),
            abi.encodeCall(R.cancel, (vid, _d())),
            abi.encodeCall(R.setAbsence, (vid, uint40(0), _d())),
            abi.encodeCall(R.addAsset, (vid, nid, p, _d())),
            abi.encodeCall(R.attest, (vid, Reason.DECEASED, bytes32(0), _d())),
            abi.encodeCall(R.dispute, (vid, _d())),
            abi.encodeCall(R.submitShare, (vid, ASSET, _k(benef), _share(), _d()))
        ];
        // allowed caller index per function
        uint8[7] memory allowed = [0, 0, 0, 0, 1, 1, 1];
        _stdAsset(ASSET);
        _release(ASSET);
        for (uint256 f; f < 7; ++f) {
            for (uint256 c; c < 4; ++c) {
                uint256 snap = vm.snapshotState();
                (bool ok, bytes4 sel) = _call(who[c], data[f]);
                if (c == allowed[f]) {
                    assertTrue(ok, "authorised caller rejected");
                } else {
                    assertFalse(ok);
                    assertEq(sel, R.NotAuthorized.selector, "wrong rejection");
                }
                vm.revertToState(snap);
            }
        }
        // markClaimed: Role.Any, so the claimant check rejects everyone but the primary beneficiary
        bytes memory mc = abi.encodeCall(R.markClaimed, (vid, ASSET, _d()));
        for (uint256 c; c < 4; ++c) {
            uint256 snap = vm.snapshotState();
            (bool ok, bytes4 sel) = _call(who[c], mc);
            if (c == 2) {
                assertTrue(ok);
            } else {
                assertFalse(ok);
                assertEq(sel, R.NotClaimant.selector);
            }
            vm.revertToState(snap);
        }
    }
}
