import type { DecideInput, Decision } from "./types";
import { volTermBp } from "./vol";
import { jitterBpOf } from "./jitter";
import { solve } from "./solver";

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function decide(input: DecideInput): Decision {
  const { policy, salt, prices, round, collateral: C, debt: D, hfBp } = input;

  const volTerm = volTermBp(prices, round, policy);
  const jitter = jitterBpOf(salt, round, policy.jitter_bp);

  const armBpN = clamp(policy.base_bp + volTerm + jitter, policy.base_bp, policy.tmax_bp);
  const targetBpN = clamp(
    armBpN + policy.buffer_bp + volTerm,
    armBpN + policy.buffer_bp,
    policy.target_cap_bp,
  );
  const armBp = BigInt(armBpN);
  const targetBp = BigInt(targetBpN);

  // not started / no debt → idle
  if (input.startedS === 0 || D === 0n) {
    return { act: false, armBp, targetBp, emergency: false, reason: "IDLE" };
  }

  const emergency = hfBp < BigInt(policy.emerg_bp);
  const cooled =
    input.lastActionRound < 0 || round - input.lastActionRound > policy.cooldown;
  const actNow = emergency || (hfBp <= armBp && cooled);

  if (!actNow) {
    return { act: false, armBp, targetBp, emergency: false, reason: "SAFE" };
  }

  // emergency: target = max(arm+buffer, emerg+buffer); ignore cooldown/caps except balances
  const solveTarget = emergency
    ? BigInt(Math.max(armBpN + policy.buffer_bp, policy.emerg_bp + policy.buffer_bp))
    : targetBp;

  const r = solve({
    C,
    D,
    P: prices[round]!,
    targetBp: solveTarget,
    policy,
    balances: input.balances,
    nowS: input.nowS,
    startedS: input.startedS,
    ignoreCaps: emergency,
  });

  const amount = r.kind === "deposit" ? r.dep : r.rep;

  return {
    act: true,
    kind: r.kind,
    amount,
    armBp,
    targetBp,
    emergency,
    reason: emergency ? "EMERGENCY" : "DEFENDED",
  };
}
