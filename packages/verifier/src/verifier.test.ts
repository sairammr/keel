import { test, expect } from "bun:test";
import { commitmentOf, INIT_COLLATERAL, INIT_DEBT, type Policy } from "keel-controller";
import { DEFAULT_POLICY } from "../../controller/src/fixture.ts";
import { audit } from "./audit.ts";
import type { ReconstructedRun, ReconRound } from "./reconstruct.ts";

const CODEHASH = "0x7ed604edb03747f3c1a66bb765f9bbe7638d261ad293d77b42b5b658516acc88" as const;
const SALT = ("0x" + "5a".repeat(32)) as `0x${string}`;
const WRONG_SALT = ("0x" + "5b".repeat(32)) as `0x${string}`;
const RECEIPTS_ADDR = "0x0000000000000000000000000000000000000001" as const;

function runWith(hash: `0x${string}`, rounds: ReconRound[] = []): ReconstructedRun {
  const { signer } = commitmentOf(DEFAULT_POLICY, SALT, CODEHASH);
  return {
    participant: "0x9673afB923d556979E4dfe6854d8C6e2D9994Eb4",
    commit: { hash, signer, blockNumber: 1n },
    prices: rounds.map((r) => r.price),
    rounds,
    receipts: [],
    liquidated: false,
  };
}

test("commitment matches with the true salt", async () => {
  const { commit } = commitmentOf(DEFAULT_POLICY, SALT, CODEHASH);
  const rep = await audit(runWith(commit), {
    receiptsAddr: RECEIPTS_ADDR, policy: DEFAULT_POLICY, salt: SALT, controllerCodeHash: CODEHASH,
  });
  expect(rep.commitmentOk).toBe(true);
});

test("a wrong salt is caught as COMMITMENT MISMATCH", async () => {
  const { commit } = commitmentOf(DEFAULT_POLICY, SALT, CODEHASH);
  const rep = await audit(runWith(commit), {
    receiptsAddr: RECEIPTS_ADDR, policy: DEFAULT_POLICY, salt: WRONG_SALT, controllerCodeHash: CODEHASH,
  });
  expect(rep.commitmentOk).toBe(false);
  expect(rep.verdict).toBe("COMMITMENT MISMATCH");
});

// Decision replay: jitter_bp=0, kvol_bp=0, flat prices ⇒ arm = base_bp deterministically.
const FLAT: Policy = { ...DEFAULT_POLICY, jitter_bp: 0, kvol_bp: 0 };
const P = 190000n;
const mkRound = (round: number, hfBpPre: bigint, acted: boolean): ReconRound => ({
  round, price: P, cPre: INIT_COLLATERAL, dPre: INIT_DEBT, hfBpPre, acted,
});

test("acting exactly when HF crosses the trigger is ALL ROUNDS CONSISTENT", async () => {
  const { commit } = commitmentOf(FLAT, SALT, CODEHASH);
  const run = runWith(commit, [
    mkRound(0, 10800n, false), // above base 10700 → no act
    mkRound(1, 10600n, true), // below → act
    mkRound(2, 10800n, false), // recovered → no act
  ]);
  const rep = await audit(run, { receiptsAddr: RECEIPTS_ADDR, policy: FLAT, salt: SALT, controllerCodeHash: CODEHASH });
  expect(rep.roundsConsistent).toBe(true);
  expect(rep.verdict).toBe("ALL ROUNDS CONSISTENT");
});

test("a missed action below the trigger is ROUND INCONSISTENT", async () => {
  const { commit } = commitmentOf(FLAT, SALT, CODEHASH);
  const run = runWith(commit, [mkRound(0, 10600n, false)]); // below trigger but did NOT act
  const rep = await audit(run, { receiptsAddr: RECEIPTS_ADDR, policy: FLAT, salt: SALT, controllerCodeHash: CODEHASH });
  expect(rep.roundsConsistent).toBe(false);
  expect(rep.verdict).toBe("ROUND INCONSISTENT");
});
