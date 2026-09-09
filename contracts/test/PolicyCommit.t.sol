// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PolicyCommit} from "../src/PolicyCommit.sol";

contract PolicyCommitTest is Test {
    PolicyCommit pc;
    address alice = address(0xA11CE);

    event Revealed(address indexed participant, bytes32 policyHash, bytes32 salt, bytes policy);

    function setUp() public {
        pc = new PolicyCommit();
    }

    function _policy() internal pure returns (bytes memory) {
        // abi.encode layout: uint16 version, 13x uint32 params, bytes32 codehash
        return abi.encode(
            uint16(1),
            uint32(100), // base
            uint32(200), // kvol
            uint32(300), // volcap
            uint32(400), // jitter
            uint32(500), // tmax
            uint32(600), // emerg
            uint32(700), // buffer
            uint32(800), // target_cap
            uint32(900), // halflife
            uint32(1000), // cooldown
            uint32(1100), // max_repay
            uint32(1200), // max_deposit
            uint32(1300), // t_est
            bytes32(uint256(0xC0DE))
        );
    }

    function testCommitThenRevealEmits() public {
        bytes memory policy = _policy();
        bytes32 salt = keccak256("salt");
        bytes32 policyHash = keccak256(policy);
        bytes32 hash = keccak256(abi.encodePacked(policyHash, salt));

        vm.prank(alice);
        pc.commit(hash, alice);

        vm.expectEmit(true, false, false, true);
        emit Revealed(alice, policyHash, salt, policy);
        vm.prank(alice);
        pc.reveal(policy, salt);
    }

    function testSecondCommitReverts() public {
        vm.startPrank(alice);
        pc.commit(keccak256("a"), alice);
        vm.expectRevert(bytes("already committed"));
        pc.commit(keccak256("b"), alice);
        vm.stopPrank();
    }

    function testRevealWrongSaltReverts() public {
        bytes memory policy = _policy();
        bytes32 salt = keccak256("salt");
        bytes32 hash = keccak256(abi.encodePacked(keccak256(policy), salt));

        vm.prank(alice);
        pc.commit(hash, alice);

        vm.expectRevert(bytes("reveal mismatch"));
        vm.prank(alice);
        pc.reveal(policy, keccak256("wrong"));
    }
}
