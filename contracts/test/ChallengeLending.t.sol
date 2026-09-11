// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {ChallengeLending} from "../src/official/ChallengeLending.sol";
import {TokenvETH} from "../src/official/TokenvETH.sol";
import {TokenvUSD} from "../src/official/TokenvUSD.sol";

/// Behaviour tests for the FAITHFUL official contract. This test contract is the deployer/admin.
contract ChallengeLendingTest is Test {
    ChallengeLending lend;
    TokenvETH vETH;
    TokenvUSD vUSD;

    address user1 = address(0x1111);
    address user2 = address(0x2222);

    function setUp() public {
        vETH = new TokenvETH();
        vUSD = new TokenvUSD();
        lend = new ChallengeLending(address(vETH), address(vUSD));
        // lending contract mints / burnsFrom → needs ADMIN_ROLE on both tokens
        vETH.grantRole(vETH.ADMIN_ROLE(), address(lend));
        vUSD.grantRole(vUSD.ADMIN_ROLE(), address(lend));
    }

    function _debt(address u) internal view returns (uint256) {
        return lend.getUserPosition(u).debt;
    }

    function _hf(address u) internal view returns (uint256) {
        return lend.getUserPosition(u).hf;
    }

    // --- existing behaviour, ported to the official (no sticky-flag) semantics ---

    function testJoinAndLiquidation() public {
        lend.open();
        vm.prank(user1);
        lend.join();

        ChallengeLending.userPosition memory p = lend.getUserPosition(user1);
        assertEq(p.collateral, 500, "collateral");
        assertEq(p.debt, 700000, "debt");
        assertEq(p.hf, 111, "hf");

        lend.start();

        // just above the edge (hf 101) → no liquidation
        lend.updatevETHPrice(181300);
        lend.checkAllHF();
        assertEq(_debt(user1), 700000, "no liquidation at 181300");

        // drop further → hf <= 100 → liquidation reduces debt
        lend.updatevETHPrice(175000);
        lend.checkAllHF();
        assertLt(_debt(user1), 700000, "debt reduced by liquidation");
    }

    function testHappyPathRepayAndStop() public {
        lend.open();
        vm.prank(user2);
        lend.join();

        uint256 t0 = block.timestamp;
        lend.start();
        assertEq(lend.scenarioStartTime(), t0);

        // price drops → repay restores hf above 100 (burnFrom needs allowance)
        lend.updatevETHPrice(175000);
        vm.startPrank(user2);
        vUSD.approve(address(lend), 30000);
        lend.repay(30000);
        vm.stopPrank();

        assertEq(_debt(user2), 670000, "debt reduced");
        assertGt(_hf(user2), 100, "hf restored above liquidation");

        lend.checkAllHF();
        assertEq(_debt(user2), 670000, "no liquidation after repay");

        // advance time so the debt-time clock accrues, then stop
        vm.warp(block.timestamp + 1000);
        lend.stop();
        assertGt(lend.loanContinuityScore(user2), 0, "continuity score set");
        assertGt(lend.scenarioEndTime(), 0, "scenario stopped");
    }

    // --- new P1.4 tests: the four divergences from the old simplified copy ---

    /// join() mints start_vETH − start_Collateral = 500 spare vETH to the caller (deposit leg fundable).
    function testJoinMintsSpareVeth() public {
        lend.open();
        vm.prank(user1);
        lend.join();
        assertEq(vETH.balanceOf(user1), 500, "5.00 spare vETH minted to participant");
        assertEq(vUSD.balanceOf(user1), 700000, "7000.00 vUSD minted to participant");
    }

    /// repay() burns via burnFrom → reverts without a vUSD allowance to the lending contract.
    function testRepayBurnsFromAllowance() public {
        lend.open();
        vm.prank(user2);
        lend.join();
        lend.start();

        vm.prank(user2);
        vm.expectRevert(); // ERC20InsufficientAllowance
        lend.repay(10000);

        vm.startPrank(user2);
        vUSD.approve(address(lend), 10000);
        uint256 balBefore = vUSD.balanceOf(user2);
        lend.repay(10000);
        vm.stopPrank();
        assertEq(vUSD.balanceOf(user2), balBefore - 10000, "vUSD burned from wallet");
        assertEq(_debt(user2), 690000, "debt reduced by repay");
    }

    /// No sticky `liquidated` flag: checkAllHF() can liquidate the same user again on a further drop.
    function testRepeatLiquidation() public {
        lend.open();
        vm.prank(user1);
        lend.join();
        lend.start();

        lend.updatevETHPrice(175000);
        lend.checkAllHF();
        uint256 d1 = _debt(user1);
        assertLt(d1, 700000, "first liquidation reduced debt");

        lend.updatevETHPrice(150000);
        lend.checkAllHF();
        uint256 d2 = _debt(user1);
        assertLt(d2, d1, "second liquidation reduced debt again (no sticky flag)");
    }

    /// close() sets challengeOpen=false → onlyActive fails, so user actions revert.
    function testCloseDisablesActions() public {
        lend.open();
        vm.prank(user1);
        lend.join();
        lend.start();
        lend.close();

        vm.startPrank(user1);
        vUSD.approve(address(lend), 10000);
        vm.expectRevert(bytes("Challenge is not open"));
        lend.repay(10000);
        vm.stopPrank();

        // and a new participant can no longer join
        vm.prank(user2);
        vm.expectRevert(bytes("Challenge is not open"));
        lend.join();
    }
}
