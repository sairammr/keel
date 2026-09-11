// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Script, console2} from "forge-std/Script.sol";
import {PolicyCommit} from "../src/PolicyCommit.sol";
import {Receipts} from "../src/Receipts.sol";
import {ChallengeLending} from "../src/official/ChallengeLending.sol";
import {TokenvETH} from "../src/official/TokenvETH.sol";
import {TokenvUSD} from "../src/official/TokenvUSD.sol";

/// Deploys the KEEL core (PolicyCommit + Receipts) plus a FAITHFUL copy of the official
/// ChallengeLending and its two tokens, wired exactly as the organisers' deploy script does:
/// tokens first, then lending, then grant ADMIN_ROLE on both tokens to the lending contract
/// (so it can mint on join/borrow and burnFrom on repay), then open() the challenge.
///   forge script script/Deploy.s.sol --rpc-url <url> --broadcast
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        PolicyCommit policyCommit = new PolicyCommit();
        Receipts receipts = new Receipts(address(policyCommit));

        TokenvETH vETH = new TokenvETH();
        TokenvUSD vUSD = new TokenvUSD();
        ChallengeLending lending = new ChallengeLending(address(vETH), address(vUSD));

        // The lending contract mints (join/borrow) and burnsFrom (repay); it needs ADMIN_ROLE.
        vETH.grantRole(vETH.ADMIN_ROLE(), address(lending));
        vUSD.grantRole(vUSD.ADMIN_ROLE(), address(lending));

        lending.open();

        vm.stopBroadcast();

        console2.log("PolicyCommit     :", address(policyCommit));
        console2.log("Receipts         :", address(receipts));
        console2.log("ChallengeLending :", address(lending));
        console2.log("vETH             :", address(vETH));
        console2.log("vUSD             :", address(vUSD));
    }
}
