// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.sol";
import {HeirloomRegistry as R} from "../src/HeirloomRegistry.sol";
import {Reason} from "../src/libs/ReleaseRule.sol";

contract ViewsTest is Base {
    bytes32 constant NOPE = bytes32(uint256(0xdead));

    function setUp() public {
        _init(1);
        _stdAsset(ASSET);
    }

    function test_getVault() public view {
        (bytes32[2] memory o, bytes32[] memory gs, uint8 t, uint32 pd, uint32 ep, uint40 hb, uint40 ab,,,) =
            r.getVault(vid);
        assertEq(o[0], _k(owner));
        assertEq(o[1], 0);
        assertEq(gs.length, 5);
        assertEq(gs[2], _k(g[2]));
        assertEq(t, 3);
        assertEq(pd, 7);
        assertEq(ep, 2); // createVault + addAsset
        assertEq(hb, T0);
        assertEq(ab, 0);
    }

    function test_getVault_dispute() public {
        _att(0, Reason.DECEASED, 0);
        vm.warp(T0 + 1);
        _disp(1);
        (,,,,,,, uint40 da, uint32 de, uint8 dr) = r.getVault(vid);
        assertEq(da, T0 + 1);
        assertEq(de, 2);
        assertEq(dr, 1);
    }

    function test_getVault_missing() public view {
        (bytes32[2] memory o, bytes32[] memory gs, uint8 t,, uint32 ep,,,,,) = r.getVault(NOPE);
        assertEq(o[0], 0);
        assertEq(gs.length, 0);
        assertEq(t, 0);
        assertEq(ep, 0);
    }

    function test_getAsset_and_latch() public {
        (R.AssetPolicy memory p, bool rel, bool cl) = r.getAsset(vid, ASSET);
        assertEq(p.kAttest, 3);
        assertEq(p.window, 2);
        assertEq(p.primaryBenef, _k(benef));
        assertEq(p.shareCommitments.length, 5);
        assertEq(p.shareCommitments[4], bytes32(uint256(5)));
        assertFalse(rel);
        assertFalse(cl);
        _release(ASSET);
        _submit(0);
        (, rel, cl) = r.getAsset(vid, ASSET);
        assertTrue(rel);
        assertFalse(cl);
        vm.prank(benef);
        r.markClaimed(vid, ASSET, _d());
        (, rel, cl) = r.getAsset(vid, ASSET);
        assertTrue(rel);
        assertTrue(cl);
    }

    function test_getAsset_missing() public view {
        (R.AssetPolicy memory p, bool rel, bool cl) = r.getAsset(vid, NOPE);
        assertEq(p.primaryBenef, 0);
        assertEq(p.shareCommitments.length, 0);
        assertFalse(rel);
        assertFalse(cl);
        (p, rel, cl) = r.getAsset(NOPE, ASSET);
        assertEq(p.primaryBenef, 0);
    }

    function test_getAttestation() public {
        vm.warp(T0 + 4);
        _att(2, Reason.INCAPACITATED, A1);
        (Reason re, uint40 at, bytes32 ev) = r.getAttestation(vid, 2);
        assertEq(uint8(re), uint8(Reason.INCAPACITATED));
        assertEq(at, T0 + 4);
        assertEq(ev, A1);
        (re, at, ev) = r.getAttestation(vid, 1);
        assertEq(uint8(re), 0);
        assertEq(at, 0);
        assertEq(ev, 0);
        // epoch bump voids it
        _hb();
        (re, at, ev) = r.getAttestation(vid, 2);
        assertEq(at, 0);
        // out of range / missing vault
        (, at,) = r.getAttestation(vid, 200);
        assertEq(at, 0);
        (, at,) = r.getAttestation(NOPE, 0);
        assertEq(at, 0);
    }

    function test_getShare() public {
        _release(ASSET);
        _submit(1);
        assertEq(r.getShare(vid, ASSET, _k(benef), 1).length, 113);
        assertEq(r.getShare(vid, ASSET, _k(benef), 0).length, 0);
        assertEq(r.getShare(vid, ASSET, _k(stranger), 1).length, 0);
        assertEq(r.getShare(vid, NOPE, _k(benef), 1).length, 0);
        assertEq(r.getShare(NOPE, ASSET, _k(benef), 1).length, 0);
    }

    function test_lastDrill_readyGuardians_empty() public view {
        (uint16 v, uint40 at) = r.lastDrill(vid, 0);
        assertEq(v, 0);
        assertEq(at, 0);
        (v, at) = r.lastDrill(NOPE, 3);
        assertEq(at, 0);
        assertEq(r.readyGuardians(vid, 1), 0);
        assertEq(r.readyGuardians(vid, 0), 0);
        assertEq(r.readyGuardians(NOPE, 1), 0);
    }

    function test_getPendingChange_empty() public view {
        (uint8 kind, bytes memory data, uint40 aa, bool ex) = r.getPendingChange(vid, bytes32(uint256(1)));
        assertEq(kind, 0);
        assertEq(data.length, 0);
        assertEq(aa, 0);
        assertFalse(ex);
        (,,, ex) = r.getPendingChange(NOPE, bytes32(uint256(1)));
        assertFalse(ex);
    }

    function test_guardianIndex() public view {
        for (uint8 i; i < 5; ++i) {
            (bool f, uint8 ix) = r.guardianIndex(vid, _k(g[i]));
            assertTrue(f);
            assertEq(ix, i);
        }
        (bool f2, uint8 ix2) = r.guardianIndex(vid, _k(stranger));
        assertFalse(f2);
        assertEq(ix2, 0);
        (f2,) = r.guardianIndex(vid, _k(owner));
        assertFalse(f2);
        (f2,) = r.guardianIndex(NOPE, _k(g[0]));
        assertFalse(f2);
    }
}
