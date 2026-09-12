// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {PolicyCommit} from "./PolicyCommit.sol";

contract Receipts {
    using ECDSA for bytes32;

    struct Receipt {
        bytes32 commit;
        uint64 round;
        uint64 blockObserved;
        uint256 price;
        uint256 hfBp;
        uint8 action;
        uint256 amount;
        uint64 actionNonce;
    }

    PolicyCommit public immutable policyCommit;

    bytes32 public constant RECEIPT_TYPEHASH = keccak256(
        "Receipt(bytes32 commit,uint64 round,uint64 blockObserved,uint256 price,uint256 hfBp,uint8 action,uint256 amount,uint64 actionNonce)"
    );

    bytes32 public immutable DOMAIN_SEPARATOR;

    mapping(address => uint256) private _count;
    mapping(bytes32 => bool) private _used; // EIP-712 digest → posted, to reject replays

    event ReceiptPosted(
        address indexed participant,
        uint256 indexed index,
        bytes32 commit,
        uint64 round,
        uint8 action,
        uint256 amount,
        uint256 price,
        uint256 hfBp,
        bytes32 digest
    );

    constructor(address policyCommit_) {
        policyCommit = PolicyCommit(policyCommit_);
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("KeelReceipts")),
                keccak256(bytes("1")),
                uint256(11155111),
                address(this)
            )
        );
    }

    function _hashStruct(Receipt calldata r) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                RECEIPT_TYPEHASH,
                r.commit,
                r.round,
                r.blockObserved,
                r.price,
                r.hfBp,
                r.action,
                r.amount,
                r.actionNonce
            )
        );
    }

    function digestOf(Receipt calldata r) public view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, _hashStruct(r)));
    }

    function post(Receipt calldata r, bytes calldata sig) external {
        PolicyCommit.Commit memory c = policyCommit.commits(msg.sender);
        require(r.commit == c.hash, "commit mismatch");
        bytes32 digest = digestOf(r);
        address signer = digest.recover(sig);
        require(signer == c.signer, "bad signer");
        require(!_used[digest], "replay");
        _used[digest] = true;

        uint256 index = _count[msg.sender];
        _count[msg.sender] = index + 1;

        emit ReceiptPosted(
            msg.sender, index, r.commit, r.round, r.action, r.amount, r.price, r.hfBp, digest
        );
    }

    function count(address participant) external view returns (uint256) {
        return _count[participant];
    }
}
