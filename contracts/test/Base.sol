// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HeirloomRegistry as R} from "../src/HeirloomRegistry.sol";
import {Reason} from "../src/libs/ReleaseRule.sol";

/// @dev Shared fixtures. Tests run with TIME_UNIT = 1 unless `_init` says otherwise.
abstract contract Base is Test {
    uint256 constant T0 = 1_000_000;
    uint256 constant OWNER_PK = 0xA11CE;
    bytes32 constant A1 = keccak256("evidence-1");
    bytes32 constant A2 = keccak256("evidence-2");
    bytes32 constant A3 = keccak256("evidence-3");
    bytes32 constant ASSET = keccak256("asset");

    R r;
    uint256 unit;
    address owner;
    address benef = address(0xBEEF);
    address contBenef = address(0xC0FFEE);
    address stranger = address(0x5712A);
    address[5] g;
    uint256[5] gPk;
    bytes32 vid;

    function _init(uint256 u) internal {
        unit = u;
        r = new R(u);
        vm.warp(T0);
        owner = vm.addr(OWNER_PK);
        for (uint256 i; i < 5; ++i) {
            gPk[i] = 0x1000 + i;
            g[i] = vm.addr(gPk[i]);
        }
        vid = _newVault();
    }

    function _k(address a) internal pure returns (bytes32) {
        return keccak256(abi.encode(R.KeyKind.EOA, bytes32(uint256(uint160(a))), bytes32(0)));
    }

    function _d() internal pure returns (R.Auth memory) {
        return R.Auth(R.AuthKind.DIRECT, address(0), 0, 0, "");
    }

    function _gk(uint256 n) internal view returns (bytes32[] memory gk) {
        gk = new bytes32[](n);
        for (uint256 i; i < n; ++i) {
            gk[i] = _k(i < 5 ? g[i] : address(uint160(0x7000 + i)));
        }
    }

    function _newVault() internal returns (bytes32 id) {
        bytes32[] memory gk = _gk(5);
        bytes32 ok = _k(owner);
        vm.prank(owner);
        id = r.createVault([ok, bytes32(0)], gk, 3, 7, _d());
    }

    function _pol(uint8 mask, uint8 k, bool ev, uint32 minIn, uint32 win, uint32 cdl)
        internal
        view
        returns (R.AssetPolicy memory p)
    {
        bytes32[] memory sc = new bytes32[](5);
        for (uint256 i; i < 5; ++i) {
            sc[i] = bytes32(i + 1);
        }
        p = R.AssetPolicy(mask, k, ev, minIn, win, cdl, _k(benef), _k(contBenef), bytes32(uint256(1)), 1, sc);
    }

    function _add(bytes32 id, R.AssetPolicy memory p) internal {
        vm.prank(owner);
        r.addAsset(vid, id, p, _d());
    }

    function _hb() internal {
        vm.prank(owner);
        r.heartbeat(vid, _d());
    }

    function _att(uint256 i, Reason re, bytes32 ev) internal {
        vm.prank(g[i]);
        r.attest(vid, re, ev, _d());
    }

    function _disp(uint256 i) internal {
        vm.prank(g[i]);
        r.dispute(vid, _d());
    }

    struct TL {
        uint256 tSilence;
        uint256 tQuorum;
        uint256 resumeAt;
        uint256 tOpen;
        uint256 opensAt;
        uint8 filed;
        uint8 k;
        bool disputed;
        uint256 claimDeadline;
    }

    function _tl(bytes32 id) internal view returns (TL memory t) {
        // a static struct ABI-encodes exactly like its fields in sequence
        (bool ok, bytes memory ret) = address(r).staticcall(abi.encodeCall(R.timeline, (vid, id)));
        require(ok, "timeline reverted");
        t = abi.decode(ret, (TL));
    }

    function _now() internal view returns (uint256) {
        return vm.getBlockTimestamp();
    }

    function _at(uint256 t) internal {
        vm.warp(t);
    }

    function _rel(bytes32 id) internal view returns (bool) {
        return r.isReleasable(vid, id);
    }

    function _st(bytes32 id) internal view returns (R.Status) {
        return r.status(vid, id);
    }

    /// @dev Probe the view at absolute time `t` (state unchanged).
    function _relAt(bytes32 id, uint256 t) internal returns (bool) {
        vm.warp(t);
        return r.isReleasable(vid, id);
    }

    function _stAt(bytes32 id, uint256 t) internal returns (R.Status) {
        vm.warp(t);
        return r.status(vid, id);
    }

    /// @dev Default asset: mask {INCAP,DECEASED}, k=3, min 3, window 2, claim deadline 5 (all units).
    function _stdAsset(bytes32 id) internal {
        _add(id, _pol(0x06, 3, false, 3, 2, 5));
    }

    /// @dev Drives the std asset (already added) to Releasable. Returns heartbeat time H.
    function _release(bytes32 id) internal returns (uint256 h) {
        _hb();
        h = _now();
        _at(h + 1);
        for (uint256 i; i < 3; ++i) {
            _att(i, Reason.DECEASED, 0);
        }
        _at(h + 5); // silence h+3, quorum h+1, window 2
        assertTrue(_rel(id));
    }

    function _share() internal pure returns (bytes memory) {
        return new bytes(113);
    }

    // ── EIP-712 helpers (independent re-derivation of the digest) ──

    function _domain(uint256 chainId, address verifying) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("HeirloomRegistry"),
                keccak256("1"),
                chainId,
                verifying
            )
        );
    }

    function _digest(
        uint256 chainId,
        address verifying,
        bytes32 vaultId,
        R.Action action,
        bytes32 paramsHash,
        uint256 nonce,
        uint256 deadline
    ) internal pure returns (bytes32) {
        bytes32 sh = keccak256(
            abi.encode(
                keccak256("Action(bytes32 vaultId,uint8 action,bytes32 paramsHash,uint256 nonce,uint256 deadline)"),
                vaultId,
                uint8(action),
                paramsHash,
                nonce,
                deadline
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", _domain(chainId, verifying), sh));
    }

    function _sig(
        uint256 pk,
        uint256 chainId,
        address verifying,
        bytes32 vaultId,
        R.Action action,
        bytes32 paramsHash,
        uint256 nonce,
        uint256 deadline
    ) internal pure returns (R.Auth memory a) {
        (uint8 v, bytes32 rr, bytes32 s) =
            vm.sign(pk, _digest(chainId, verifying, vaultId, action, paramsHash, nonce, deadline));
        a = R.Auth(R.AuthKind.EOA_SIG, vm.addr(pk), nonce, deadline, abi.encodePacked(rr, s, v));
    }
}
