// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {TheyaMarket} from "../src/FlashMarket.sol";

contract Deploy is Script {
    function run() external returns (TheyaMarket market) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address creator = vm.envAddress("CREATOR_ADDRESS");
        address resolver = vm.envAddress("RESOLVER_ADDRESS");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT_ADDRESS");

        vm.startBroadcast(deployerKey);
        market = new TheyaMarket(creator, resolver, feeRecipient);
        vm.stopBroadcast();
    }
}
