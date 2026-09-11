// P1.4 cross-check: replay random action sequences against a REAL deployment of the faithful
// official ChallengeLending on a throwaway Anvil, and assert the ContractMirror agrees on
// (C, D, hf, cumulativeDebtTime, liquidationCount) after EVERY step — same ops, same reverts.
//
// Skips (does not fail) if `anvil` is absent; §9 requires anvil present in CI.
import { afterAll, beforeAll, expect, test } from "bun:test";
import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  parseEventLogs,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ContractMirror } from "./mirror.ts";
import { P0 } from "../../controller/src/index.ts";

const ANVIL = Bun.which("anvil");
// randomize the port so a leftover anvil from an aborted run can't be silently connected to
// (a fixed port let a stale node answer with wrong state → slow, spurious failures).
const PORT = 8600 + Math.floor(Math.random() * 300);
const RPC = `http://127.0.0.1:${PORT}`;
const KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex; // anvil acct 0
const SEQUENCES = Number(process.env.KEEL_ANVIL_SEQ ?? 200);
const ART = new URL("../../../contracts/out/", import.meta.url).pathname;

const load = (name: string) => {
  const j = require(`${ART}${name}.sol/${name}.json`);
  return { abi: j.abi, bytecode: j.bytecode.object as Hex };
};
const CL = load("ChallengeLending");
const VETH = load("TokenvETH");
const VUSD = load("TokenvUSD");

const account = privateKeyToAccount(KEY);
let proc: ReturnType<typeof Bun.spawn> | undefined;
let pub: PublicClient;
let wallet: WalletClient;

// deterministic RNG (mulberry32)
const mk = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  return pub.request({ method: method as never, params: params as never }) as Promise<T>;
}

async function deploy(art: { abi: unknown[]; bytecode: Hex }, args: unknown[] = []): Promise<Address> {
  const hash = await wallet.deployContract({ abi: art.abi as never, bytecode: art.bytecode, args, account, chain: null });
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  return getAddress(rcpt.contractAddress!);
}

async function send(to: Address, abi: unknown[], fn: string, args: unknown[]): Promise<void> {
  const hash = await wallet.writeContract({ address: to, abi: abi as never, functionName: fn as never, args: args as never, account, chain: null });
  await pub.waitForTransactionReceipt({ hash });
}

// simulate → true if it would REVERT
async function reverts(to: Address, abi: unknown[], fn: string, args: unknown[]): Promise<boolean> {
  try {
    await pub.simulateContract({ address: to, abi: abi as never, functionName: fn as never, args: args as never, account });
    return false;
  } catch {
    return true;
  }
}

beforeAll(async () => {
  if (!ANVIL) return;
  proc = Bun.spawn([ANVIL, "--port", String(PORT), "--silent"], { stdout: "ignore", stderr: "ignore" });
  // low pollingInterval: anvil auto-mines instantly; the 4s default would dominate runtime.
  pub = createPublicClient({ transport: http(RPC), pollingInterval: 5 });
  wallet = createWalletClient({ transport: http(RPC), pollingInterval: 5 });
  // wait until responsive, then assert it's OUR fresh anvil (block 0), not a stale leftover
  for (let i = 0; i < 100; i++) {
    try {
      await pub.getChainId();
      const block = await pub.getBlockNumber();
      if (block !== 0n) throw new Error(`port ${PORT} answered at block ${block}, not a fresh anvil`);
      return;
    } catch (e) {
      if (String(e).includes("not a fresh anvil")) throw e;
      await Bun.sleep(50);
    }
  }
  throw new Error("anvil did not start");
});

afterAll(() => {
  proc?.kill();
});

test.skipIf(!ANVIL)(
  `mirror matches faithful contract over ${SEQUENCES} random sequences on Anvil`,
  async () => {
    // tokens deployed once; deployer (admin) holds ADMIN_ROLE from their constructors.
    const vETH = await deploy(VETH);
    const vUSD = await deploy(VUSD);
    const adminRole = (await pub.readContract({ address: vETH, abi: VETH.abi as never, functionName: "ADMIN_ROLE" })) as Hex;

    for (let s = 0; s < SEQUENCES; s++) {
      const rng = mk(1000 + s);
      const ri = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

      // fresh lending instance ⇒ isolated single-user state matching the mirror
      const lend = await deploy(CL, [vETH, vUSD]);
      await send(vETH, VETH.abi, "grantRole", [adminRole, lend]);
      await send(vUSD, VUSD.abi, "grantRole", [adminRole, lend]);
      await send(lend, CL.abi, "open", []);
      await send(vETH, VETH.abi, "approve", [lend, (1n << 255n)]);
      await send(vUSD, VUSD.abi, "approve", [lend, (1n << 255n)]);
      await send(lend, CL.abi, "join", []);
      await send(lend, CL.abi, "start", []);

      const startTs = Number((await pub.readContract({ address: lend, abi: CL.abi as never, functionName: "scenarioStartTime" })) as bigint);
      // reserves set high (both on-chain wallet and mirror) so only position-based reverts differ
      const m = new ContractMirror({ vETH: 10n ** 9n, vUSD: 10n ** 12n }, P0);
      m.start(startTs);
      let liqSeen = 0;

      const readPos = async () => {
        const p = (await pub.readContract({ address: lend, abi: CL.abi as never, functionName: "getUserPosition", args: [account.address] })) as {
          collateral: bigint; debt: bigint; hf: bigint; cumulativeDebtTime: bigint;
        };
        return p;
      };

      const nOps = ri(3, 10);
      // stored on-chain hf is only fresh after a calcHF-invoking op (deposit/repay/borrow/
      // withdraw/checkAllHF/liquidate) with no updatePrice since; join left it fresh at P0.
      let hfFresh = true;
      for (let op = 0; op < nOps; op++) {
        const nextTs = m.now + ri(1, 300);
        const roll = rng();

        // choose an op; funding-safe amounts so only position constraints can revert
        let kind: string;
        let amount = 0n;
        if (roll < 0.28) { kind = "updatePrice"; amount = BigInt(ri(120_000, 260_000)); }
        else if (roll < 0.48) { kind = "deposit"; amount = BigInt(ri(1, 200)); }
        else if (roll < 0.68) { kind = "repay"; amount = BigInt(ri(1, m.D > 1n ? Number(m.D > 5000n ? 5000n : m.D) : 1)); }
        else if (roll < 0.80) { kind = "borrow"; amount = BigInt(ri(1, 2000)); }
        else if (roll < 0.90) { kind = "withdrawCollateral"; amount = BigInt(ri(1, 50)); }
        else { kind = "checkAllHF"; }

        // apply to the MIRROR (validates before mutating; throws on revert-equivalent)
        const prevNow = m.now;
        let mirrorThrew = false;
        const applyMirror = () => {
          m.now = nextTs;
          switch (kind) {
            case "updatePrice": m.updatePrice(amount); break;
            case "deposit": m.deposit(amount); break;
            case "repay": m.repay(amount); break;
            case "borrow": m.borrow(amount); break;
            case "withdrawCollateral": m.withdrawCollateral(amount); break;
            case "checkAllHF": m.checkAllHF(); break;
          }
        };

        if (kind === "updatePrice" || kind === "checkAllHF") {
          // never revert on-chain
          await rpc("evm_setNextBlockTimestamp", [`0x${nextTs.toString(16)}`]);
          applyMirror();
          const fn = kind === "updatePrice" ? "updatevETHPrice" : "checkAllHF";
          const hash = await wallet.writeContract({ address: lend, abi: CL.abi as never, functionName: fn as never, args: kind === "updatePrice" ? [amount] : [], account, chain: null });
          const rcpt = await pub.waitForTransactionReceipt({ hash });
          if (kind === "checkAllHF") {
            liqSeen += parseEventLogs({ abi: CL.abi as never, logs: rcpt.logs, eventName: "Liquidated" as never }).length;
          }
          hfFresh = kind === "checkAllHF"; // updatePrice leaves hf stale; checkAllHF recomputes it
        } else {
          const willRevert = await reverts(lend, CL.abi, kind, [amount]);
          try { applyMirror(); } catch { mirrorThrew = true; m.now = prevNow; } // no block mined → don't advance clock
          expect(mirrorThrew).toBe(willRevert); // same accept/reject decision
          if (!willRevert) {
            await rpc("evm_setNextBlockTimestamp", [`0x${nextTs.toString(16)}`]);
            await send(lend, CL.abi, kind, [amount]);
            hfFresh = true; // deposit/repay/borrow/withdraw all call calcHF
          }
          // a reverted op mines no block and calls no calcHF → hfFresh unchanged
        }

        // compare position state
        const p = await readPos();
        expect(p.collateral).toBe(m.C);
        expect(p.debt).toBe(m.D);
        expect(p.cumulativeDebtTime).toBe(m.cumulativeDebtTime);
        expect(liqSeen).toBe(m.liquidationCount);
        // compare stored hf only when it is fresh (contract recomputes on calcHF-invoking ops only)
        if (hfFresh && m.D > 0n) expect(p.hf).toBe(m.hf100());
      }
    }
  },
  600_000,
);
