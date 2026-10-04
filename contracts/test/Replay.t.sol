// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.sol";
import {HeirloomRegistry as R} from "../src/HeirloomRegistry.sol";
import {Reason} from "../src/libs/ReleaseRule.sol";

contract ReplayTest is Base {
    function setUp() public {
        _init(1);
        _stdAsset(ASSET);
    }

    function _hbSig(uint256 pk, bytes32 v, uint256 nonce, uint256 deadline) internal view returns (R.Auth memory) {
        return _sig(pk, block.chainid, address(r), v, R.Action.Heartbeat, 0, nonce, deadline);
    }

    function _dl() internal view returns (uint256) {
        return _now() + 1000;
    }

    function test_validSignature_relayerSubmits() public {
        vm.prank(stranger); // msg.sender is irrelevant for EOA_SIG
        r.heartbeat(vid, _hbSig(OWNER_PK, vid, 0, _dl()));
        assertEq(r.nonces(_k(owner)), 1);
    }

    function test_reusedNonce() public {
        R.Auth memory a = _hbSig(OWNER_PK, vid, 0, _dl());
        r.heartbeat(vid, a);
        vm.expectRevert(R.BadNonce.selector);
        r.heartbeat(vid, a);
    }

    function test_nonceMustBeSequential() public {
        vm.expectRevert(R.BadNonce.selector);
        r.heartbeat(vid, _hbSig(OWNER_PK, vid, 1, _dl()));
        r.heartbeat(vid, _hbSig(OWNER_PK, vid, 0, _dl()));
        r.heartbeat(vid, _hbSig(OWNER_PK, vid, 1, _dl()));
    }

    function test_nonceIsPerKey_sharedAcrossVaults() public {
        bytes32 vb = _newVault();
        r.heartbeat(vid, _hbSig(OWNER_PK, vid, 0, _dl()));
        vm.expectRevert(R.BadNonce.selector); // nonce 0 is spent for this key everywhere
        r.heartbeat(vb, _hbSig(OWNER_PK, vb, 0, _dl()));
        r.heartbeat(vb, _hbSig(OWNER_PK, vb, 1, _dl()));
        assertEq(r.nonces(_k(g[0])), 0); // other keys untouched
    }

    function test_failedCall_doesNotBurnNonce() public {
        vm.expectRevert(R.BadAuth.selector);
        r.heartbeat(vid, _sig(OWNER_PK, block.chainid + 1, address(r), vid, R.Action.Heartbeat, 0, 0, _dl()));
        assertEq(r.nonces(_k(owner)), 0);
    }

    function test_wrongChainId() public {
        vm.expectRevert(R.BadAuth.selector);
        r.heartbeat(vid, _sig(OWNER_PK, block.chainid + 1, address(r), vid, R.Action.Heartbeat, 0, 0, _dl()));
    }

    function test_wrongContract() public {
        vm.expectRevert(R.BadAuth.selector);
        r.heartbeat(vid, _sig(OWNER_PK, block.chainid, address(0xdead), vid, R.Action.Heartbeat, 0, 0, _dl()));
        // a signature made for another deployment of the registry
        R other = new R(1);
        vm.expectRevert(R.BadAuth.selector);
        r.heartbeat(vid, _sig(OWNER_PK, block.chainid, address(other), vid, R.Action.Heartbeat, 0, 0, _dl()));
    }

    function test_tamperedParams() public {
        R.Auth memory a = _sig(
            OWNER_PK, block.chainid, address(r), vid, R.Action.SetAbsence, keccak256(abi.encode(uint40(100))), 0, _dl()
        );
        vm.expectRevert(R.BadAuth.selector);
        r.setAbsence(vid, 200, a);
        r.setAbsence(vid, 100, a); // untampered works
    }

    function test_tamperedParams_attestReason() public {
        R.Auth memory a = _sig(
            gPk[0],
            block.chainid,
            address(r),
            vid,
            R.Action.Attest,
            keccak256(abi.encode(Reason.INCAPACITATED, bytes32(0))),
            0,
            _dl()
        );
        vm.expectRevert(R.BadAuth.selector);
        r.attest(vid, Reason.DECEASED, 0, a);
        vm.expectRevert(R.BadAuth.selector);
        r.attest(vid, Reason.INCAPACITATED, A1, a);
        r.attest(vid, Reason.INCAPACITATED, 0, a);
    }

    function test_expiredDeadline() public {
        uint256 t = _now();
        vm.expectRevert(R.Expired.selector);
        r.heartbeat(vid, _hbSig(OWNER_PK, vid, 0, t - 1));
        // deadline == now is still valid
        r.heartbeat(vid, _hbSig(OWNER_PK, vid, 0, t));
        _at(t + 10);
        vm.expectRevert(R.Expired.selector);
        r.heartbeat(vid, _hbSig(OWNER_PK, vid, 1, t + 9));
    }

    function test_signatureForVaultA_onVaultB() public {
        bytes32 vb = _newVault(); // same owner, same guardians
        R.Auth memory a = _hbSig(OWNER_PK, vid, 0, _dl());
        vm.expectRevert(R.BadAuth.selector);
        r.heartbeat(vb, a);
    }

    function test_nonParticipantSigner() public {
        vm.expectRevert(R.NotAuthorized.selector);
        r.heartbeat(vid, _hbSig(0x57A, vid, 0, _dl())); // valid signature, but not an owner of this vault
        // a guardian's valid signature does not confer owner rights
        vm.expectRevert(R.NotAuthorized.selector);
        r.heartbeat(vid, _hbSig(gPk[0], vid, 0, _dl()));
    }

    function test_signerFieldSpoof() public {
        R.Auth memory a = _hbSig(0x57A, vid, 0, _dl());
        a.signer = owner; // claim to be the owner, signature is from a stranger
        vm.expectRevert(R.BadAuth.selector);
        r.heartbeat(vid, a);
    }

    function test_wrongAction() public {
        R.Auth memory a = _hbSig(OWNER_PK, vid, 0, _dl()); // signed as Heartbeat
        vm.expectRevert(R.BadAuth.selector);
        r.cancel(vid, a);
    }

    function test_malformedSignature() public {
        R.Auth memory a = _hbSig(OWNER_PK, vid, 0, _dl());
        a.sig = hex"1234";
        vm.expectRevert(R.BadAuth.selector);
        r.heartbeat(vid, a);
        a.sig = new bytes(65);
        vm.expectRevert(R.BadAuth.selector);
        r.heartbeat(vid, a);
    }

    function test_createVault_signed_andVaultIdBound() public {
        bytes32[] memory gk = _gk(5);
        bytes32 ok = _k(owner);
        bytes32[2] memory owners = [ok, bytes32(0)];
        bytes32 ph = keccak256(abi.encode(owners, gk, uint8(3), uint32(7)));
        bytes32 next = bytes32(r.vaultCount() + 1);
        // signed for a vault id that is not the next one -> rejected (no re-targeting)
        R.Auth memory wrong =
            _sig(OWNER_PK, block.chainid, address(r), bytes32(uint256(next) + 1), R.Action.CreateVault, ph, 0, _dl());
        vm.expectRevert(R.BadAuth.selector);
        r.createVault(owners, gk, 3, 7, wrong);
        R.Auth memory good = _sig(OWNER_PK, block.chainid, address(r), next, R.Action.CreateVault, ph, 0, _dl());
        assertEq(r.createVault(owners, gk, 3, 7, good), next);
    }

    function test_guardianSigned_attest_andNonceIndependence() public {
        R.Auth memory a = _sig(
            gPk[1],
            block.chainid,
            address(r),
            vid,
            R.Action.Attest,
            keccak256(abi.encode(Reason.DECEASED, bytes32(0))),
            0,
            _dl()
        );
        r.attest(vid, Reason.DECEASED, 0, a);
        assertEq(r.nonces(_k(g[1])), 1);
        assertEq(r.nonces(_k(owner)), 0);
    }
}
