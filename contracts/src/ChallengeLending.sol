// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TokenvETH} from "./TokenvETH.sol";
import {TokenvUSD} from "./TokenvUSD.sol";

/// @notice Faithful local copy of the ETHGlobal challenge lending contract.
/// Deploys its own vETH/vUSD tokens (2 decimals) and drives a liquidation scenario.
contract ChallengeLending {
    struct Position {
        uint256 collateral;
        uint256 debt;
        uint256 hf;
        uint256 numOperations;
        uint256 lastUpdateTime;
        uint256 cumulativeDebtTime;
    }

    // Params
    uint256 public constant MAX_LTV = 75;
    uint256 public constant LIQUI_THRESHOLD = 78;
    uint256 public constant LIQUI_PENALTY = 5;

    // join grants
    uint256 public constant JOIN_COLLATERAL = 500; // 5.00 vETH
    uint256 public constant JOIN_DEBT = 700000; // 7000.00 vUSD

    uint256 private constant HF_MAX = type(uint256).max;

    address public immutable admin;
    TokenvETH public immutable vETH;
    TokenvUSD public immutable vUSD;

    uint256 private _price = 200000; // vUSD units per 1.00 vETH x100
    bool public challengeOpen;
    bool public joinOpen;
    uint256 public scenarioStartTime;
    uint256 public scenarioStopTime;

    mapping(address => Position) private positions;
    mapping(address => bool) public joined;
    mapping(address => bool) public liquidated;
    mapping(address => uint256) public loanContinuityScore; // bp
    address[] public participants;

    event Join(address indexed participant, uint256 collateral, uint256 debt);
    event Deposit(address indexed participant, uint256 amount, uint256 hf);
    event Repay(address indexed participant, uint256 amount, uint256 hf);
    event WithdrawCollateral(address indexed participant, uint256 amount, uint256 hf);
    event Liquidated(address indexed participant, uint256 seized, uint256 repaid, uint256 hf);
    event PriceUpdate(uint256 newPrice);
    event ChallengeStarted(uint256 startTime);

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin");
        _;
    }

    modifier onlyActive() {
        require(challengeOpen && scenarioStartTime > 0, "not active");
        _;
    }

    constructor() {
        admin = msg.sender;
        vETH = new TokenvETH(address(this));
        vUSD = new TokenvUSD(address(this));
    }

    // ---- price ----
    function vETHPrice() public view returns (uint256) {
        return _price;
    }

    function updatevETHPrice(uint256 newPrice) external onlyAdmin {
        _price = newPrice;
        emit PriceUpdate(newPrice);
    }

    // ---- lifecycle ----
    function open() external onlyAdmin {
        challengeOpen = true;
        joinOpen = true;
    }

    function close() external onlyAdmin {
        joinOpen = false;
    }

    function start() external onlyAdmin {
        require(challengeOpen, "not open");
        scenarioStartTime = block.timestamp;
        emit ChallengeStarted(block.timestamp);
    }

    function stop() external onlyAdmin {
        require(scenarioStartTime > 0, "not started");
        scenarioStopTime = block.timestamp;
        uint256 duration = block.timestamp - scenarioStartTime;
        for (uint256 i = 0; i < participants.length; i++) {
            address user = participants[i];
            Position storage p = positions[user];
            _accrue(p);
            uint256 maxDebtTime = JOIN_DEBT * duration;
            loanContinuityScore[user] =
                maxDebtTime == 0 ? 0 : (p.cumulativeDebtTime * 10000) / maxDebtTime;
        }
        challengeOpen = false;
    }

    function join() external {
        require(challengeOpen && joinOpen, "join closed");
        require(!joined[msg.sender], "already joined");
        joined[msg.sender] = true;
        participants.push(msg.sender);

        // borrowed funds go to the user; collateral is locked in the contract
        vUSD.mint(msg.sender, JOIN_DEBT);
        vETH.mint(address(this), JOIN_COLLATERAL);

        Position storage p = positions[msg.sender];
        p.collateral = JOIN_COLLATERAL;
        p.debt = JOIN_DEBT;
        p.lastUpdateTime = block.timestamp;
        p.hf = _hf(p.collateral, p.debt);

        emit Join(msg.sender, JOIN_COLLATERAL, JOIN_DEBT);
    }

    // ---- user ops ----
    function deposit(uint256 amount) external onlyActive {
        require(joined[msg.sender], "not participant");
        Position storage p = positions[msg.sender];
        _accrue(p);
        require(vETH.transferFrom(msg.sender, address(this), amount), "transfer fail");
        p.collateral += amount;
        p.numOperations += 1;
        p.hf = _hf(p.collateral, p.debt);
        emit Deposit(msg.sender, amount, p.hf);
    }

    function repay(uint256 amount) external onlyActive {
        require(joined[msg.sender], "not participant");
        Position storage p = positions[msg.sender];
        require(amount <= p.debt, "amount > debt");
        _accrue(p);
        require(vUSD.transferFrom(msg.sender, address(this), amount), "transfer fail");
        p.debt -= amount;
        p.numOperations += 1;
        p.hf = _hf(p.collateral, p.debt);
        emit Repay(msg.sender, amount, p.hf);
    }

    function withdrawCollateral(uint256 amount) external onlyActive {
        require(joined[msg.sender], "not participant");
        Position storage p = positions[msg.sender];
        require(amount <= p.collateral, "amount > collateral");
        _accrue(p);
        p.collateral -= amount;
        // resulting position must stay within MAX_LTV (never breach LIQUI_THRESHOLD)
        uint256 value = (p.collateral * _price) / 100; // vUSD 2-dec value
        require(p.debt <= (value * MAX_LTV) / 100, "withdraw breaches LTV");
        p.numOperations += 1;
        p.hf = _hf(p.collateral, p.debt);
        require(vETH.transfer(msg.sender, amount), "transfer fail");
        emit WithdrawCollateral(msg.sender, amount, p.hf);
    }

    // ---- liquidation ----
    function checkAllHF() external onlyAdmin {
        for (uint256 i = 0; i < participants.length; i++) {
            address user = participants[i];
            if (liquidated[user]) continue;
            Position storage p = positions[user];
            uint256 hf = _hf(p.collateral, p.debt);
            if (hf <= 100 && p.debt > 0) {
                _liquidate(user, p);
            } else {
                p.hf = hf;
            }
        }
    }

    function _liquidate(address user, Position storage p) internal {
        // restore debt to MAX_LTV given current collateral value, seize collateral + penalty
        uint256 value = (p.collateral * _price) / 100; // vUSD 2-dec
        uint256 targetDebt = (value * MAX_LTV) / 100;
        uint256 repaid = p.debt > targetDebt ? p.debt - targetDebt : 0;

        uint256 seizeCollateral = (repaid * 100) / _price; // vUSD -> vETH
        uint256 penalty = (seizeCollateral * LIQUI_PENALTY) / 100;
        uint256 totalSeize = seizeCollateral + penalty;
        if (totalSeize > p.collateral) totalSeize = p.collateral;

        p.collateral -= totalSeize;
        p.debt -= repaid;
        p.numOperations += 1;
        p.hf = _hf(p.collateral, p.debt);
        liquidated[user] = true;

        emit Liquidated(user, totalSeize, repaid, p.hf);
    }

    // ---- views / helpers ----
    function _hf(uint256 collateral, uint256 debt) internal view returns (uint256) {
        if (debt == 0) return HF_MAX;
        return (collateral * _price * LIQUI_THRESHOLD) / (100 * debt);
    }

    function _accrue(Position storage p) internal {
        if (p.lastUpdateTime != 0) {
            p.cumulativeDebtTime += p.debt * (block.timestamp - p.lastUpdateTime);
        }
        p.lastUpdateTime = block.timestamp;
    }

    function getUserPosition(address user)
        external
        view
        returns (
            uint256 collateral,
            uint256 debt,
            uint256 hf,
            uint256 numOperations,
            uint256 lastUpdateTime,
            uint256 cumulativeDebtTime
        )
    {
        Position storage p = positions[user];
        return (p.collateral, p.debt, p.hf, p.numOperations, p.lastUpdateTime, p.cumulativeDebtTime);
    }

    function participantCount() external view returns (uint256) {
        return participants.length;
    }
}
