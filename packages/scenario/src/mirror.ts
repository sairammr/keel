// ContractMirror — bit-exact integer mirror of the OFFICIAL ChallengeLending
// (contracts/src/official/ChallengeLending.sol, proven byte-for-byte to the deployed 0x8857…1ba1).
// All amounts are contract units ×100 (2-decimal fixed point). No floats, no mocks: the HF,
// debt-time, liquidation, minCollateral and borrow maths reproduce the Solidity exactly.
// Cross-checked against a real Anvil deployment in mirror.anvil.test.ts.
import {
  MAX_LTV,
  THETA,
  LIQUI_PENALTY,
  INIT_COLLATERAL,
  INIT_DEBT,
  P0,
  hf100Of,
} from "../../controller/src/index.ts";

export interface Reserves {
  vETH: bigint; // wallet vETH ×100 available to the controller
  vUSD: bigint; // wallet vUSD ×100 available to the controller
}

const HF_MAX = 1_000_000n; // matches controller sentinel for D==0 (contract uses type(uint256).max)

export class ContractMirror {
  C: bigint; // collateral ×100 vETH (locked in contract)
  D: bigint; // debt ×100 vUSD
  P: bigint; // price ×100 vUSD per 1.00 vETH
  reserves: Reserves;

  scenarioStartTime = 0;
  scenarioEndTime = 0; // 0 = not stopped (mirrors the contract field name)
  cumulativeDebtTime = 0n; // Σ D·Δt (×100 vUSD · seconds), bounded to [start, end]
  lastUpdateTime = 0;
  numOperations = 0;
  liquidationCount = 0; // no sticky flag: checkAllHF can liquidate the same user repeatedly
  everLiquidated = false;
  now = 0;

  constructor(reserves: Reserves, price: bigint = P0) {
    this.C = INIT_COLLATERAL;
    this.D = INIT_DEBT;
    this.P = price;
    this.reserves = reserves;
  }

  /** Back-compat alias for scoring: did this position get liquidated at any point? */
  get liquidated(): boolean {
    return this.everLiquidated;
  }

  /** scenarioStopTime kept as an alias for callers reading the old field name. */
  get scenarioStopTime(): number {
    return this.scenarioEndTime;
  }

  /** hf100 = C·P·θ / (100·D), floor. D==0 → sentinel. Identical to contract calcHF. */
  hf100(): bigint {
    if (this.D === 0n) return HF_MAX;
    return (this.C * this.P * THETA) / (100n * this.D);
  }

  /** minCollateral(totalDebt) = ceil(totalDebt·10000 / (P·MAX_LTV)). Identical to contract. */
  minCollateral(totalDebt: bigint): bigint {
    const denom = this.P * MAX_LTV;
    return (totalDebt * 10000n + denom - 1n) / denom;
  }

  /**
   * Contract _updateDebtTime: accrue debt·elapsed, bounded to [scenarioStartTime, scenarioEndTime].
   * Only called on debt changes (borrow/repay/liquidate/stop) — NOT deposit/withdraw. Updates
   * lastUpdateTime to `now` so a following deposit/withdraw folds its interval into the next debt op.
   */
  private updateDebtTime(): void {
    if (this.lastUpdateTime !== 0 && this.scenarioStartTime > 0) {
      const from = this.lastUpdateTime < this.scenarioStartTime ? this.scenarioStartTime : this.lastUpdateTime;
      const to = this.scenarioEndTime > 0 && this.now > this.scenarioEndTime ? this.scenarioEndTime : this.now;
      if (to > from) this.cumulativeDebtTime += this.D * BigInt(to - from);
    }
    this.lastUpdateTime = this.now;
  }

  updatePrice(newPrice: bigint): void {
    this.P = newPrice; // no accrual, no liquidation (matches updatevETHPrice)
  }

  /** Contract join()+start(): seed lastUpdateTime + scenarioStartTime at t. */
  start(t: number): void {
    this.now = t;
    this.lastUpdateTime = t;
    this.scenarioStartTime = t;
  }

  /** Contract deposit(): collateral only, NO debt-time accrual. */
  deposit(amount: bigint): void {
    if (amount <= 0n) return;
    if (this.reserves.vETH < amount) throw new Error("deposit: insufficient vETH reserve");
    this.reserves.vETH -= amount;
    this.C += amount;
    this.numOperations += 1;
  }

  /** Contract borrow(): require C >= minCollateral(D+amount); mint vUSD to wallet; accrue then D+=. */
  borrow(amount: bigint): void {
    if (amount <= 0n) return;
    if (this.C < this.minCollateral(this.D + amount)) throw new Error("borrow: insufficient collateral");
    this.updateDebtTime();
    this.D += amount;
    this.reserves.vUSD += amount;
    this.numOperations += 1;
  }

  /** Contract repay(): burnFrom wallet vUSD; accrue then D-=. */
  repay(amount: bigint): void {
    if (amount <= 0n) return;
    if (amount > this.D) throw new Error("repay: amount > debt");
    if (this.reserves.vUSD < amount) throw new Error("repay: insufficient vUSD reserve");
    this.updateDebtTime();
    this.reserves.vUSD -= amount;
    this.D -= amount;
    this.numOperations += 1;
  }

  /** Contract withdrawCollateral(): require C-amount >= minCollateral(D); NO debt-time accrual. */
  withdrawCollateral(amount: bigint): void {
    if (amount <= 0n) return;
    if (amount > this.C) throw new Error("withdraw: amount > collateral");
    if (this.C - amount < this.minCollateral(this.D)) throw new Error("withdraw: collateral below minimum");
    this.C -= amount;
    this.reserves.vETH += amount;
    this.numOperations += 1;
  }

  /** Contract checkAllHF(): liquidate whenever hf100 <= 100 — repeatable, no sticky flag. */
  checkAllHF(): void {
    if (this.hf100() <= 100n) this.liquidate();
  }

  /** Contract liquidateUser(): partial to MAX_LTV + 5% penalty, ceil seize, full-close fallback. */
  private liquidate(): void {
    const collateralValue = (this.C * this.P) / 100n; // vUSD ×100
    const D = this.D;
    const targetDebt = (collateralValue * MAX_LTV) / 100n;
    if (targetDebt >= D) return; // defensive guard — position already safe, no state change

    let debtToRepay = D - targetDebt;
    const seizeValueVUSD = (debtToRepay * (100n + LIQUI_PENALTY)) / 100n;
    let collateralToSeize = this.P === 0n ? 0n : (seizeValueVUSD * 100n + this.P - 1n) / this.P; // ceil

    if (collateralToSeize > this.C) {
      collateralToSeize = this.C;
      debtToRepay = D; // full closure
    }

    this.updateDebtTime();
    this.D -= debtToRepay;
    this.C -= collateralToSeize;
    this.numOperations += 1;
    this.liquidationCount += 1;
    this.everLiquidated = true;
  }

  /** Contract stop(): final bounded accrual, score in bp capped at 10000. */
  stop(t: number): number {
    this.now = t;
    this.scenarioEndTime = t;
    this.updateDebtTime(); // flush pending debt·time up to scenarioEndTime
    const duration = t - this.scenarioStartTime;
    const maxDebtTime = INIT_DEBT * BigInt(duration);
    if (maxDebtTime === 0n) return 0;
    const score = Number((this.cumulativeDebtTime * 10000n) / maxDebtTime);
    return score > 10000 ? 10000 : score;
  }

  get duration(): number {
    return this.scenarioEndTime - this.scenarioStartTime;
  }
}

// Proof hook used by tests: mirror hf100 must equal controller hf100Of for same inputs.
export function assertHfMatches(C: bigint, D: bigint, P: bigint): void {
  const m = new ContractMirror({ vETH: 0n, vUSD: 0n }, P);
  m.C = C;
  m.D = D;
  if (m.hf100() !== hf100Of(C, D, P)) {
    throw new Error(`hf100 mismatch C=${C} D=${D} P=${P}`);
  }
}
