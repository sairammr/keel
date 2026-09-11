import { parseAbi } from "viem";

// Official ChallengeLending events (topic0-verified on Sepolia, see PLAN Phase 0).
export const LENDING_ABI = parseAbi([
  "event PriceUpdate(uint256 oldPrice, uint256 newPrice)",
  "event ChallengeStarted(uint256 startTime)",
  "event Join(address indexed user)",
  "event Deposit(address indexed user, uint256 amount)",
  "event Repay(address indexed user, uint256 amount)",
  "event WithdrawCollateral(address indexed user, uint256 amount)",
  "event Borrow(address indexed user, uint256 amount)",
  "event Liquidated(address indexed user, uint256 debtRepaid, uint256 collateralSeized)",
  "function scenarioStartTime() view returns (uint256)",
]);

export const POLICYCOMMIT_ABI = parseAbi([
  "event Committed(address indexed participant, bytes32 hash, address signer, uint64 blockNumber)",
  "event Revealed(address indexed participant, bytes32 policyHash, bytes32 salt, bytes policy)",
  "function commits(address) view returns (bytes32 hash, address signer, uint64 blockNumber, uint64 timestamp)",
]);

export const RECEIPTS_ABI = parseAbi([
  "event ReceiptPosted(address indexed participant, uint256 indexed index, bytes32 commit, uint64 round, uint8 action, uint256 amount, uint256 price, uint256 hfBp, bytes32 digest)",
  "function post((bytes32 commit,uint64 round,uint64 blockObserved,uint256 price,uint256 hfBp,uint8 action,uint256 amount,uint64 actionNonce) r, bytes sig)",
]);
