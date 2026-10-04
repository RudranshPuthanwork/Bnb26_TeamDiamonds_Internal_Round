// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.sol";
import {HeirloomRegistry as R} from "../src/HeirloomRegistry.sol";
import {Reason} from "../src/libs/ReleaseRule.sol";
import {OState, ReleaseOracle} from "./ReleaseOracle.sol";

/// @dev Fuzzed histories: contract (via TIME_UNIT 1 or 60) vs. the literal oracle.
contract DifferentialTest is Base {
    using ReleaseOracle for OState;

    OState o;

    function _resetEpoch() internal {
        for (uint256 i; i < 5; ++i) {
            delete o.att[i];
        }
        o.disputed = false;
        o.disputedAt = 0;
    }

    function _ownerAction() internal {
        o.lastHeartbeat = (_now() / unit) * unit;
        _resetEpoch();
    }

    function _compare(string memory ctx) internal {
        uint256 base = _now();
        uint256[5] memory dts = [uint256(0), 1, unit, 7 * unit, 40 * unit];
        for (uint256 i; i < 5; ++i) {
            uint256 t = base + dts[i];
            vm.warp(t);
            assertEq(r.isReleasable(vid, ASSET), o.releasable(t), string.concat(ctx, ": isReleasable"));
        }
        vm.warp(base);
        TL memory tl = _tl(ASSET);
        assertEq(tl.tOpen, o.tOpen(), string.concat(ctx, ": tOpen"));
        assertEq(tl.tQuorum, o.tQuorum(), string.concat(ctx, ": tQuorum"));
        assertEq(tl.tSilence, o.tSilence(), string.concat(ctx, ": tSilence"));
        assertEq(tl.resumeAt, o.resumeAt(), string.concat(ctx, ": resumeAt"));
    }

    /// forge-config: default.fuzz.runs = 1000
    function testFuzz_contractMatchesOracle(uint256 seed) public {
        _init((seed & 1) == 0 ? 1 : 60);
        uint8 mask = uint8(2 * (1 + (seed >> 8) % 7));
        uint8 k = uint8(1 + (seed >> 16) % 4);
        bool ev = ((seed >> 24) & 1) == 1;
        uint32 minIn = uint32(1 + (seed >> 32) % 20);
        uint32 win = uint32((seed >> 40) % 10);
        _add(ASSET, _pol(mask, k, ev, minIn, win, 0));

        o.mask = mask;
        o.kAttest = k;
        o.requireEvidence = ev;
        o.minInactivity = minIn;
        o.window = win;
        o.unit = unit;
        _ownerAction();
        _compare("init");

        bytes32[4] memory evs = [bytes32(0), A1, A1, A2];
        for (uint256 step; step < 40; ++step) {
            uint256 x = uint256(keccak256(abi.encode(seed, step)));
            uint256 op = x % 100;
            string memory ctx = string.concat("step ", vm.toString(step), " op ", vm.toString(op));
            if (op < 25) {
                _at(_now() + ((x >> 8) % 25) * unit + (x >> 16) % unit);
            } else if (op < 35) {
                _hb();
                _ownerAction();
            } else if (op < 40) {
                vm.prank(owner);
                r.cancel(vid, _d());
                _ownerAction();
            } else if (op < 43) {
                uint256 until = (x >> 8) % 2 == 0 ? 0 : _now() + ((x >> 16) % 40) * unit;
                vm.prank(owner);
                r.setAbsence(vid, uint40(until), _d());
                _ownerAction();
                o.absentUntil = until;
            } else if (op < 80) {
                uint256 gi = (x >> 8) % 5;
                Reason re = Reason(1 + (x >> 16) % 3);
                bytes32 e = evs[(x >> 24) % 4];
                vm.prank(g[gi]);
                try r.attest(vid, re, e, _d()) {
                    o.att[gi].filed = true;
                    o.att[gi].reason = uint8(re);
                    o.att[gi].at = _now();
                    o.att[gi].ev = e;
                } catch {}
            } else if (op < 90) {
                vm.prank(g[(x >> 8) % 5]);
                try r.dispute(vid, _d()) {
                    o.disputed = true;
                    o.disputedAt = _now();
                } catch {}
            } else {
                _at(_now() + 1);
            }
            _compare(ctx);
        }
    }
}
