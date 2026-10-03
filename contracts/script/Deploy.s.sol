// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {HeirloomRegistry} from "../src/HeirloomRegistry.sol";

contract Deploy is Script {
    function run() external returns (HeirloomRegistry r) {
        vm.startBroadcast();
        r = new HeirloomRegistry(vm.envUint("TIME_UNIT"));
        vm.stopBroadcast();
    }
}
