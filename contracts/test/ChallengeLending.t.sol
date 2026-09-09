// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ChallengeLending} from "../src/ChallengeLending.sol";
import {TokenvETH} from "../src/TokenvETH.sol";
import {TokenvUSD} from "../src/TokenvUSD.sol";

contract ChallengeLendingTest is Test {
    ChallengeLending lend;
    TokenvETH vETH;
    TokenvUSD vUSD;

    address user1 = address(0x1111);
    address user2 = address(0x2222);

    function setUp() public {
        lend = new ChallengeLending(); // this test contract is admin
        vETH = lend.vETH();
        vUSD = lend.vUSD();
    }

    function _pos(address u)
        internal
        view
        returns (uint256 c, uint256 d, uint256 hf, uint256 ops, uint256 lut, uint256 cdt)
    {
        return lend.getUserPosition(u);
    }

    function testJoinAndLiquidation() public {
        lend.open();
        vm.prank(user1);
        lend.join();

        (uint256 c, uint256 d, uint256 hf,,,) = _pos(user1);
        assertEq(c, 500, "collateral");
        assertEq(d, 700000, "debt");
        assertEq(hf, 111, "hf");

        lend.close();
        lend.start();

        // spec's 181300 is just above the liquidation edge -> hf 101, no liquidation
        lend.updatevETHPrice(181300);
        lend.checkAllHF();
        assertFalse(lend.liquidated(user1), "should not liquidate at 181300");

        // drop further -> hf <= 100 -> liquidation
        lend.updatevETHPrice(175000);
        lend.checkAllHF();
        assertTrue(lend.liquidated(user1), "should liquidate");

        (, uint256 dAfter,,,,) = _pos(user1);
        assertLt(dAfter, 700000, "debt reduced by liquidation");
    }

    function testHappyPathRepayAndStop() public {
        lend.open();
        vm.prank(user2);
        lend.join();
        lend.close();

        uint256 t0 = block.timestamp;
        lend.start();
        assertEq(lend.scenarioStartTime(), t0);

        // exercise deposit + withdraw with real token transfers (price still 200000)
        vm.startPrank(user2);
        lend.withdrawCollateral(20); // user2 receives 20 vETH
        assertEq(vETH.balanceOf(user2), 20);
        vETH.approve(address(lend), 20);
        lend.deposit(20);
        vm.stopPrank();
        (uint256 c,,,,,) = _pos(user2);
        assertEq(c, 500, "collateral restored after deposit");

        // price drops -> underwater -> repay restores hf above 100
        lend.updatevETHPrice(175000);
        vm.startPrank(user2);
        vUSD.approve(address(lend), 30000);
        lend.repay(30000);
        vm.stopPrank();

        (, uint256 d, uint256 hf,,,) = _pos(user2);
        assertEq(d, 670000, "debt reduced");
        assertGt(hf, 100, "hf restored above liquidation");

        lend.checkAllHF();
        assertFalse(lend.liquidated(user2), "no liquidation after repay");

        // advance time so the debt-time clock accrues, then stop
        vm.warp(block.timestamp + 1000);
        lend.stop();
        assertGt(lend.loanContinuityScore(user2), 0, "continuity score set");
        assertFalse(lend.challengeOpen(), "challenge closed after stop");
    }
}
