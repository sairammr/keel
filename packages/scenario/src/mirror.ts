// ContractMirror — bit-exact integer mirror of contracts/src/ChallengeLending.sol.
// All amounts are contract units ×100 (2-decimal fixed point). No floats, no mocks:
// the HF and liquidation maths below reproduce the Solidity exactly.
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

const HF_MAX = 1_000_000n; // matches controller sentinel for D==0

export class ContractMirror {
  C: bigint; // collateral ×100 vETH (locked in contract)
  D: bigint; // debt ×100 vUSD
  P: bigint; // price ×100 vUSD per 1.00 vETH
  reserves: Reserves;

  scenarioStartTime = 0;
  scenarioStopTime = 0;
  cumulativeDebtTime = 0n; // Σ D·Δt (×100 vUSD · seconds)
  lastUpdateTime = 0;
  numOperations = 0;
  liquidated = false;
  now = 0;

  constructor(reserves: Reserves, price: bigint = P0) {
    this.C = INIT_COLLATERAL;
    this.D = INIT_DEBT;
    this.P = price;
    this.reserves = reserves;
  }

  /** hf100 = C·P·θ / (100·D), floor. D==0 → sentinel. Identical to contract _hf. */
  hf100(): bigint {
    if (this.D === 0n) return HF_MAX;
    return (this.C * this.P * THETA) / (100n * this.D);
  }

  /** Contract _accrue: only accrues once lastUpdateTime seeded (join sets it). */
  private accrue(): void {
    if (this.lastUpdateTime !== 0) {
      this.cumulativeDebtTime += this.D * BigInt(this.now - this.lastUpdateTime);
    }
    this.lastUpdateTime = this.now;
  }

  updatePrice(newPrice: bigint): void {
    this.P = newPrice; // no accrual, no liquidation (matches updatevETHPrice)
  }

  /** Contract join(): seed lastUpdateTime + scenarioStartTime at t. */
  start(t: number): void {
    this.now = t;
    this.lastUpdateTime = t;
    this.scenarioStartTime = t;
  }

  deposit(amount: bigint): void {
    if (amount <= 0n) return;
    if (this.reserves.vETH < amount) throw new Error("deposit: insufficient vETH reserve");
    this.accrue();
    this.reserves.vETH -= amount;
    this.C += amount;
    this.numOperations += 1;
  }

  repay(amount: bigint): void {
    if (amount <= 0n) return;
    if (amount > this.D) throw new Error("repay: amount > debt");
    if (this.reserves.vUSD < amount) throw new Error("repay: insufficient vUSD reserve");
    this.accrue();
    this.reserves.vUSD -= amount;
    this.D -= amount;
    this.numOperations += 1;
  }

  /** Contract withdrawCollateral(): reverts if resulting debt breaches MAX_LTV. */
  withdrawCollateral(amount: bigint): void {
    if (amount <= 0n) return;
    if (amount > this.C) throw new Error("withdraw: amount > collateral");
    this.accrue();
    const newC = this.C - amount;
    const value = (newC * this.P) / 100n;
    if (this.D > (value * MAX_LTV) / 100n) throw new Error("withdraw breaches LTV");
    this.C = newC;
    this.reserves.vETH += amount;
    this.numOperations += 1;
  }

  /** Contract checkAllHF()+_liquidate: seize to MAX_LTV + 5% penalty when hf100<=100. */
  checkAllHF(): void {
    if (this.liquidated) return;
    const hf = this.hf100();
    if (hf <= 100n && this.D > 0n) this.liquidate();
  }

  private liquidate(): void {
    const value = (this.C * this.P) / 100n; // vUSD ×100
    const targetDebt = (value * MAX_LTV) / 100n;
    const repaid = this.D > targetDebt ? this.D - targetDebt : 0n;
    const seizeCollateral = this.P === 0n ? 0n : (repaid * 100n) / this.P;
    const penalty = (seizeCollateral * LIQUI_PENALTY) / 100n;
    let totalSeize = seizeCollateral + penalty;
    if (totalSeize > this.C) totalSeize = this.C;
    this.C -= totalSeize;
    this.D -= repaid;
    this.numOperations += 1;
    this.liquidated = true;
  }

  /** Contract stop(): final accrual, returns loanContinuityScore in bp. */
  stop(t: number): number {
    this.now = t;
    this.accrue();
    this.scenarioStopTime = t;
    const duration = t - this.scenarioStartTime;
    const maxDebtTime = INIT_DEBT * BigInt(duration);
    return maxDebtTime === 0n ? 0 : Number((this.cumulativeDebtTime * 10000n) / maxDebtTime);
  }

  get duration(): number {
    return this.scenarioStopTime - this.scenarioStartTime;
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
