// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Vm} from "forge-std/Vm.sol";
import {Base} from "./Base.sol";
import {HeirloomRegistry as R} from "../src/HeirloomRegistry.sol";
import {Reason} from "../src/libs/ReleaseRule.sol";

/// @dev Drives random owner / guardian / claimant behaviour and keeps an independent ghost model.
contract Handler is Base {
    uint256 constant NA = 3;
    bytes32[NA] public ids;
    uint8[NA] mask = [0x06, 0x0c, 0x04];
    uint8[NA] kAtt = [3, 2, 3];
    bool[NA] needEv = [false, false, true];
    uint32[NA] minIn = [uint32(3), 6, 10];
    uint32[NA] win = [uint32(2), 3, 4];

    // ghost model (current epoch)
    uint256 public gLastHb;
    uint256 public gAbsent;

    struct GAtt {
        bool filed;
        uint8 reason;
        uint256 at;
        bytes32 ev;
    }
    GAtt[5] public gAtt;
    bool[NA] public gClaimed;
    uint32 public lastEpoch;

    // violation flags (checked by the invariant test)
    bool public epochBad;
    bool public i3Bad;
    bool public shareBad;
    bool public claimBad;
    uint256 public shareOk;
    uint256 public claimOk;
    uint256 public releasedSeen;

    constructor() {
        vm.recordLogs();
        _init(1);
        for (uint256 i; i < NA; ++i) {
            ids[i] = keccak256(abi.encode("asset", i));
            _add(ids[i], _pol(mask[i], kAtt[i], needEv[i], minIn[i], win[i], 5));
        }
        _hb();
        gLastHb = _now();
        _syncEpoch();
    }

    function reg() external view returns (R) {
        return r;
    }

    function vaultId() external view returns (bytes32) {
        return vid;
    }

    // ── helpers ──

    /// @dev Reads Heartbeat events: each must be exactly previous + 1.
    function _syncEpoch() internal {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 sig = keccak256("Heartbeat(bytes32,uint32)");
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] != sig || logs[i].emitter != address(r)) continue;
            uint32 e = abi.decode(logs[i].data, (uint32));
            if (lastEpoch != 0 && e != lastEpoch + 1) epochBad = true;
            lastEpoch = e;
        }
    }

    function _ownerAction() internal {
        gLastHb = _now();
        for (uint256 i; i < 5; ++i) {
            delete gAtt[i];
        }
        _syncEpoch();
        // I3: every asset that has not been claimed is Sealed right after an owner action
        for (uint256 a; a < NA; ++a) {
            if (!gClaimed[a] && r.status(vid, ids[a]) != R.Status.Sealed) i3Bad = true;
        }
    }

    function validCount(uint256 a) public view returns (uint256 n) {
        for (uint256 i; i < 5; ++i) {
            if (gAtt[i].filed && (mask[a] >> gAtt[i].reason) & 1 == 1) ++n;
        }
    }

    /// @dev Independent necessary conditions for release: lapse AND quorum AND window elapsed.
    function mustHold(uint256 a, uint256 t) public view returns (bool) {
        uint256 n = validCount(a);
        if (n < kAtt[a]) return false;
        uint256[] memory ats = new uint256[](n);
        bytes32[] memory evs = new bytes32[](n);
        uint256 m;
        for (uint256 i; i < 5; ++i) {
            if (gAtt[i].filed && (mask[a] >> gAtt[i].reason) & 1 == 1) {
                uint256 j = m++;
                for (; j > 0 && ats[j - 1] > gAtt[i].at; --j) {
                    ats[j] = ats[j - 1];
                    evs[j] = evs[j - 1];
                }
                ats[j] = gAtt[i].at;
                evs[j] = gAtt[i].ev;
            }
        }
        if (needEv[a]) {
            bool pair;
            for (uint256 i; i < n; ++i) {
                for (uint256 j = i + 1; j < n; ++j) {
                    if (evs[i] != 0 && evs[i] == evs[j]) pair = true;
                }
            }
            if (!pair) return false;
        }
        uint256 lapse = gLastHb + minIn[a];
        if (gAbsent > lapse) lapse = gAbsent;
        uint256 q = ats[kAtt[a] - 1];
        return t >= lapse && t >= lapse + win[a] && t >= q + win[a];
    }

    function claimedGhost(uint256 a) external view returns (bool) {
        return gClaimed[a];
    }

    // ── handler actions ──

    function warp(uint256 s) external {
        _at(_now() + s % 40);
    }

    function heartbeat() external {
        _hb();
        _ownerAction();
    }

    function cancel() external {
        vm.prank(owner);
        r.cancel(vid, _d());
        _ownerAction();
    }

    function setAbsence(uint256 s) external {
        vm.prank(owner);
        r.setAbsence(vid, s % 3 == 0 ? 0 : uint40(_now() + (s >> 8) % 60), _d());
        _ownerAction();
        gAbsent = s % 3 == 0 ? 0 : _now() + (s >> 8) % 60;
    }

    function attest(uint256 gi, uint256 re, uint256 evSel) external {
        gi %= 5;
        Reason reason = Reason(1 + re % 3);
        bytes32 ev = evSel % 3 == 0 ? bytes32(0) : (evSel % 3 == 1 ? A1 : A2);
        vm.prank(g[gi]);
        try r.attest(vid, reason, ev, _d()) {
            gAtt[gi] = GAtt(true, uint8(reason), _now(), ev);
        } catch {}
    }

    function dispute(uint256 gi) external {
        vm.prank(g[gi % 5]);
        try r.dispute(vid, _d()) {} catch {}
    }

    function submitShare(uint256 gi, uint256 a, bool wrongClaimant) external {
        a %= NA;
        bool ok = r.isReleasable(vid, ids[a]);
        bytes32 claimant = wrongClaimant ? _k(contBenef) : _k(benef);
        vm.prank(g[gi % 5]);
        try r.submitShare(vid, ids[a], claimant, _share(), _d()) {
            ++shareOk;
            if (!ok || wrongClaimant) shareBad = true;
        } catch {}
    }

    function markClaimed(uint256 who, uint256 a) external {
        a %= NA;
        address[5] memory actors = [owner, g[0], benef, contBenef, stranger];
        address actor = actors[who % 5];
        bool ok = r.isReleasable(vid, ids[a]);
        vm.prank(actor);
        try r.markClaimed(vid, ids[a], _d()) {
            ++claimOk;
            gClaimed[a] = true;
            if (!ok || actor != benef) claimBad = true;
        } catch {}
    }
}

contract InvariantsTest is StdInvariant, Base {
    Handler h;

    function setUp() public {
        h = new Handler();
        r = h.reg();
        vid = h.vaultId();
        targetContract(address(h));
        bytes4[] memory sel = new bytes4[](8);
        sel[0] = Handler.warp.selector;
        sel[1] = Handler.heartbeat.selector;
        sel[2] = Handler.cancel.selector;
        sel[3] = Handler.setAbsence.selector;
        sel[4] = Handler.attest.selector;
        sel[5] = Handler.dispute.selector;
        sel[6] = Handler.submitShare.selector;
        sel[7] = Handler.markClaimed.selector;
        targetSelector(FuzzSelector({addr: address(h), selectors: sel}));
    }

    /// I2: a release implies lapse AND quorum AND elapsed window, checked against an independent ghost model.
    function invariant_I2_releaseNeedsLapseQuorumWindow() public view {
        for (uint256 a; a < 3; ++a) {
            if (r.isReleasable(vid, h.ids(a))) {
                assertTrue(h.mustHold(a, vm.getBlockTimestamp()), "released without lapse+quorum+window");
            }
        }
    }

    /// I3: right after every owner action every unclaimed asset was Sealed.
    function invariant_I3_ownerActionSealsEverything() public view {
        assertFalse(h.i3Bad());
    }

    /// I4: views depend only on state and timestamp, never on the sender.
    function invariant_I4_viewsAreSenderIndependent() public {
        address[4] memory senders = [address(0xA), address(0xB), owner, benef];
        for (uint256 a; a < 3; ++a) {
            bytes32 id = h.ids(a);
            bool rel0 = r.isReleasable(vid, id);
            R.Status st0 = r.status(vid, id);
            for (uint256 s; s < 4; ++s) {
                vm.prank(senders[s], senders[(s + 1) % 4]);
                assertEq(r.isReleasable(vid, id), rel0);
                vm.prank(senders[s], senders[(s + 1) % 4]);
                assertEq(uint8(r.status(vid, id)), uint8(st0));
            }
            assertEq(
                rel0,
                st0 == R.Status.Releasable || st0 == R.Status.ContingentEligible || (st0 == R.Status.Claimed && rel0)
            );
        }
    }

    function invariant_epochOnlyIncreasesByOne() public view {
        assertFalse(h.epochBad());
    }

    /// One attestation slot per guardian per epoch: the on-chain count equals the ghost model's distinct guardians.
    function invariant_atMostOneAttestationPerGuardian() public {
        for (uint256 a; a < 3; ++a) {
            TL memory t = _tl(h.ids(a));
            assertLe(t.filed, 5);
            assertEq(t.filed, h.validCount(a));
        }
    }

    function invariant_submitShareOnlyWhenReleasable() public view {
        assertFalse(h.shareBad());
    }

    function invariant_markClaimedOnlyByCurrentClaimant() public view {
        assertFalse(h.claimBad());
    }

    function invariant_claimedIsSticky() public view {
        for (uint256 a; a < 3; ++a) {
            assertEq(r.status(vid, h.ids(a)) == R.Status.Claimed, h.claimedGhost(a));
        }
    }
}
