// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.sol";
import {HeirloomRegistry as R} from "../src/HeirloomRegistry.sol";

/// @dev Phase 7 flips these: every stub must revert NotImplemented for every caller.
contract StubsTest is Base {
    function setUp() public {
        _init(1);
        _stdAsset(ASSET);
    }

    function _all() internal view returns (bytes[6] memory c) {
        bytes32 cid = bytes32(uint256(1));
        c[0] = abi.encodeCall(R.queueChange, (vid, cid, uint8(1), hex"01", _d()));
        c[1] = abi.encodeCall(R.applyChange, (vid, cid, _d()));
        c[2] = abi.encodeCall(R.revokeChange, (vid, cid, _d()));
        c[3] = abi.encodeCall(R.drill, (vid, uint16(1), _d()));
        c[4] = abi.encodeCall(R.rekey, (vid, ASSET, uint16(2), cid, new bytes32[](5), _d()));
        c[5] = abi.encodeCall(R.claimContingent, (vid, ASSET, _d()));
    }

    function test_stubs_revertNotImplemented_forEveryCaller() public {
        bytes[6] memory c = _all();
        address[4] memory who = [owner, g[0], benef, stranger];
        for (uint256 i; i < 6; ++i) {
            for (uint256 j; j < 4; ++j) {
                vm.prank(who[j]);
                (bool ok, bytes memory ret) = address(r).call(c[i]);
                assertFalse(ok);
                assertEq(bytes4(ret), R.NotImplemented.selector, "stub");
            }
        }
    }
}
