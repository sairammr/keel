// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PolicyCommit {
    struct Commit {
        bytes32 hash;
        address signer;
        uint64 blockNumber;
        uint64 timestamp;
    }

    mapping(address => Commit) private _commits;

    event Committed(address indexed participant, bytes32 hash, address signer, uint64 blockNumber);
    event Revealed(address indexed participant, bytes32 policyHash, bytes32 salt, bytes policy);

    function commit(bytes32 hash, address signer) external {
        require(_commits[msg.sender].hash == bytes32(0), "already committed");
        _commits[msg.sender] = Commit({
            hash: hash,
            signer: signer,
            blockNumber: uint64(block.number),
            timestamp: uint64(block.timestamp)
        });
        emit Committed(msg.sender, hash, signer, uint64(block.number));
    }

    function reveal(bytes calldata policy, bytes32 salt) external {
        bytes32 policyHash = keccak256(policy);
        require(
            keccak256(abi.encodePacked(policyHash, salt)) == _commits[msg.sender].hash,
            "reveal mismatch"
        );
        emit Revealed(msg.sender, policyHash, salt, policy);
    }

    function commits(address participant) external view returns (Commit memory) {
        return _commits[participant];
    }
}
