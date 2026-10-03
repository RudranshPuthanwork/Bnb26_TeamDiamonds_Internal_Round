// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HeirloomRegistry as R} from "../src/HeirloomRegistry.sol";
import {Reason} from "../src/libs/ReleaseRule.sol";

contract HeirloomRegistryTest is Test {
    R r;
    address owner = address(0xA11CE);
    address[5] g;
    bytes32 vid;
    bytes32 constant ASSET = keccak256("seed");

    function _k(address a) internal view returns (bytes32) {
        return r.keyId(R.KeyKind.EOA, bytes32(uint256(uint160(a))), 0);
    }

    function _d() internal pure returns (R.Auth memory) {
        return R.Auth(R.AuthKind.DIRECT, address(0), 0, 0, "");
    }

    function test_smoke() public {
        r = new R(1);
        vm.warp(1_000_000);
        bytes32[] memory gk = new bytes32[](5);
        bytes32[] memory sc = new bytes32[](5);
        for (uint256 i; i < 5; ++i) {
            g[i] = address(uint160(0x100 + i));
            gk[i] = _k(g[i]);
            sc[i] = bytes32(i + 1);
        }
        bytes32 ok = _k(owner);
        vm.prank(owner);
        vid = r.createVault([ok, bytes32(0)], gk, 3, 7, _d());
        bytes32 ben = _k(address(0xBEEF));
        R.AssetPolicy memory p = R.AssetPolicy(0x0c, 3, false, 30, 7, 10, ben, 0, bytes32(uint256(1)), 1, sc);
        vm.prank(owner);
        r.addAsset(vid, ASSET, p, _d());
        assertEq(uint8(r.status(vid, ASSET)), uint8(R.Status.Sealed));

        for (uint256 i; i < 3; ++i) {
            vm.prank(g[i]);
            r.attest(vid, Reason.DECEASED, 0, _d());
        }
        assertEq(uint8(r.status(vid, ASSET)), uint8(R.Status.Armed));
        assertFalse(r.isReleasable(vid, ASSET));

        vm.warp(block.timestamp + 30 + 7);
        assertTrue(r.isReleasable(vid, ASSET));

        vm.prank(owner);
        r.heartbeat(vid, _d());
        assertFalse(r.isReleasable(vid, ASSET));
    }
}
