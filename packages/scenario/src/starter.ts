// Baseline strategies for tune/replay comparison. Pure.
// Starter = fixed-threshold defender (no vol term, no jitter). Reuses controller solve()
// for the legs so the comparison isolates the *policy*, not the executor.
import { solve, type DecideInput, type Decision } from "../../controller/src/index.ts";
import type { Strategy } from "./engine.ts";

// Fixed threshold at armBp / restore to targetBp. e.g. 1.08/1.15 → 10800/11500.
export function makeStarter(armBp: number, targetBp: number): Strategy {
  const arm = BigInt(armBp);
  const target = BigInt(targetBp);
  return {
    name: `starter-${(armBp / 10000).toFixed(2)}/${(targetBp / 10000).toFixed(2)}`,
    decide(input: DecideInput): Decision {
      const base: Decision = {
        act: false,
        armBp: arm,
        targetBp: target,
        emergency: false,
        reason: "SAFE",
      };
      if (input.startedS === 0 || input.debt === 0n) return { ...base, reason: "IDLE" };
      const cooled =
        input.lastActionRound < 0 ||
        input.round - input.lastActionRound > input.policy.cooldown;
      const emergency = input.hfBp < arm; // fixed line doubles as emergency line
      if (!(input.hfBp <= arm && cooled)) return base;
      return {
        act: true,
        kind: "repay",
        amount: 0n,
        armBp: arm,
        targetBp: target,
        emergency,
        reason: "DEFENDED",
      };
    },
    plan(input: DecideInput) {
      const r = solve({
        C: input.collateral,
        D: input.debt,
        P: input.prices[input.round]!,
        targetBp: target,
        policy: input.policy,
        balances: input.balances,
        nowS: input.nowS,
        startedS: input.startedS,
        ignoreCaps: false, // naive keeper: bounded per-action, no emergency override
      });
      return { dep: r.dep, rep: r.rep };
    },
  };
}

export const DO_NOTHING: Strategy = {
  name: "do-nothing",
  decide(input: DecideInput): Decision {
    return {
      act: false,
      armBp: BigInt(input.policy.base_bp),
      targetBp: BigInt(input.policy.target_cap_bp),
      emergency: false,
      reason: "IDLE",
    };
  },
  plan() {
    return { dep: 0n, rep: 0n };
  },
};
