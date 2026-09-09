// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {PolicyCommit} from "../src/PolicyCommit.sol";
import {Receipts} from "../src/Receipts.sol";

contract ReceiptsTest is Test {
    PolicyCommit pc;
    Receipts receipts;

    uint256 signerKey = 0xA11CE0000000000000000000000000000000000000000000000000000000B0B;
    address signerAddr;
    address participant = address(0xBEEF);
    bytes32 commitHash = keccak256("policy-commit");

    function setUp() public {
        pc = new PolicyCommit();
        receipts = new Receipts(address(pc));
        signerAddr = vm.addr(signerKey);

        vm.prank(participant);
        pc.commit(commitHash, signerAddr);
    }

    function _receipt() internal view returns (Receipts.Receipt memory) {
        return Receipts.Receipt({
            commit: commitHash,
            round: 3,
            blockObserved: 123456,
            price: 200000,
            hfBp: 11100,
            action: 1,
            amount: 500,
            actionNonce: 7
        });
    }

    function _sign(uint256 key, Receipts.Receipt memory r) internal view returns (bytes memory) {
        bytes32 digest = receipts.digestOf(r);
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(rr, s, v);
    }

    function testPostValidSig() public {
        Receipts.Receipt memory r = _receipt();
        bytes memory sig = _sign(signerKey, r);

        vm.prank(participant);
        receipts.post(r, sig);
        assertEq(receipts.count(participant), 1);

        vm.prank(participant);
        receipts.post(r, sig);
        assertEq(receipts.count(participant), 2);
    }

    function testPostWrongSignerReverts() public {
        Receipts.Receipt memory r = _receipt();
        bytes memory sig = _sign(0xDEAD, r); // different key

        vm.prank(participant);
        vm.expectRevert(bytes("bad signer"));
        receipts.post(r, sig);
    }

    function testPostWrongCommitReverts() public {
        Receipts.Receipt memory r = _receipt();
        r.commit = keccak256("other");
        bytes memory sig = _sign(signerKey, r);

        vm.prank(participant);
        vm.expectRevert(bytes("commit mismatch"));
        receipts.post(r, sig);
    }

    /// Fixed test vector: prints the EIP-712 digest so it can be cross-checked with viem.
    function testDigestVector() public view {
        Receipts.Receipt memory r = Receipts.Receipt({
            commit: bytes32(uint256(0x1111111111111111111111111111111111111111111111111111111111111111)),
            round: 1,
            blockObserved: 1000,
            price: 200000,
            hfBp: 11143,
            action: 2,
            amount: 250,
            actionNonce: 0
        });
        bytes32 digest = receipts.digestOf(r);
        console2.log("DOMAIN_SEPARATOR:");
        console2.logBytes32(receipts.DOMAIN_SEPARATOR());
        console2.log("RECEIPT_TYPEHASH:");
        console2.logBytes32(receipts.RECEIPT_TYPEHASH());
        console2.log("FIXED RECEIPT DIGEST:");
        console2.logBytes32(digest);
        // stable across runs (verifyingContract is deterministic in this test setup)
        assertTrue(digest != bytes32(0));
    }
}
