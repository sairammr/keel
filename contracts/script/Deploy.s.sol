// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {PolicyCommit} from "../src/PolicyCommit.sol";
import {Receipts} from "../src/Receipts.sol";
import {ChallengeLending} from "../src/ChallengeLending.sol";

/// Deploys the KEEL core (PolicyCommit + Receipts) and a ChallengeLending copy
/// (which itself deploys the vETH/vUSD tokens). Reads admin key from env PRIVATE_KEY.
///   forge script script/Deploy.s.sol --rpc-url <url> --broadcast
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        PolicyCommit policyCommit = new PolicyCommit();
        Receipts receipts = new Receipts(address(policyCommit));
        ChallengeLending lending = new ChallengeLending();

        vm.stopBroadcast();

        console2.log("PolicyCommit     :", address(policyCommit));
        console2.log("Receipts         :", address(receipts));
        console2.log("ChallengeLending :", address(lending));
        console2.log("vETH             :", address(lending.vETH()));
        console2.log("vUSD             :", address(lending.vUSD()));
    }
}
