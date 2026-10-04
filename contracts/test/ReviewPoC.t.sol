// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.sol";
import {HeirloomRegistry as R} from "../src/HeirloomRegistry.sol";
import {Reason} from "../src/libs/ReleaseRule.sol";

contract ReviewPoC is Base {
    function setUp() public {
        _init(1);
    }

    // B1a: kAttest = n-1 (allowed by D3); the disputer abstains -> kDispute = n unreachable.
    function test_B1a_disputerAbstainsBlocksForever() public {
        _add(ASSET, _pol(0x06, 4, false, 3, 2, 5));
        _at(_now() + 1);
        _disp(4);
        _at(_now() + 1);
        for (uint256 i; i < 4; ++i) _att(i, Reason.DECEASED, 0);
        _at(_now() + 10_000);
        assertTrue(_rel(ASSET), "one guardian blocked release forever");
    }

    // B1b: D5 locks pre-dispute attesters, so they can never be "fresh" for the D4 override.
    function test_B1b_lockedAttestersCannotOverride() public {
        _add(ASSET, _pol(0x06, 3, false, 3, 2, 5));
        _at(_now() + 1);
        for (uint256 i; i < 3; ++i) _att(i, Reason.DECEASED, A1);
        _at(_now() + 1);
        _disp(3);
        _at(_now() + 1);
        vm.expectRevert(R.AttestationLocked.selector);
        _att(0, Reason.DECEASED, A1);
        _att(3, Reason.DECEASED, A1);
        _att(4, Reason.DECEASED, A1);
        _at(_now() + 10_000);
        assertTrue(_rel(ASSET), "2 fresh of kDispute=4 possible");
    }

    // B2: a dispute filed after the window elapsed un-releases the asset (not in §5.4).
    function test_B2_disputeAfterWindowUnreleases() public {
        _stdAsset(ASSET);
        _release(ASSET);
        _disp(4);
        assertTrue(_rel(ASSET), "Releasable -> Disputed");
    }
}
