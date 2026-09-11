// KEEL end-to-end integration test against a local Anvil chain (chain-id 11155111).
// NO MOCKS: real deployed contracts, real signed txs, real controller code.
// Deploy -> join -> commit -> start -> price crash -> controller decides ->
// on-chain action + EIP-712 receipt -> checkAllHF (survive) -> reveal.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  getContract,
  decodeEventLog,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  commitmentOf,
  encodePolicyBytes,
  policyHashOf,
  decide,
  hfBpOf,
  hf100Of,
  signReceipt,
  recoverReceiptSigner,
  receiptDigest,
  type Receipt,
  type DecideInput,
} from "../../packages/controller/src/index.ts";
import { DEFAULT_POLICY } from "../../packages/controller/src/fixture.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

// ---- anvil default funded accounts ----
const ADMIN_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const PARTICIPANT_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const anvil = defineChain({
  id: 11155111,
  name: "anvil-sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

// ---- assertion helper ----
let failed = false;
function check(label: string, cond: boolean, detail = ""): void {
  const line = `${cond ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`;
  console.log(line);
  if (!cond) {
    failed = true;
    throw new Error("assertion failed: " + label + (detail ? " (" + detail + ")" : ""));
  }
}

function loadArtifact(sol: string, name: string): { abi: Abi; bytecode: Hex } {
  const p = join(ROOT, "contracts", "out", `${sol}.sol`, `${name}.json`);
  const j = JSON.parse(readFileSync(p, "utf8"));
  return { abi: j.abi as Abi, bytecode: j.bytecode.object as Hex };
}

const publicClient = createPublicClient({ chain: anvil, transport: http(RPC) });
const admin = createWalletClient({ account: privateKeyToAccount(ADMIN_KEY), chain: anvil, transport: http(RPC) });
const part = createWalletClient({ account: privateKeyToAccount(PARTICIPANT_KEY), chain: anvil, transport: http(RPC) });
const adminAddr = admin.account.address;
const partAddr = part.account.address;

async function deploy(sol: string, name: string, args: unknown[] = []): Promise<Address> {
  const { abi, bytecode } = loadArtifact(sol, name);
  const hash = await admin.deployContract({ abi, bytecode, args } as any);
  const rcpt = await publicClient.waitForTransactionReceipt({ hash });
  if (!rcpt.contractAddress) throw new Error(`deploy ${name} produced no address`);
  return rcpt.contractAddress;
}

async function send(wallet: typeof admin, contract: Address, abi: Abi, fn: string, args: unknown[] = []) {
  const { request } = await publicClient.simulateContract({
    account: wallet.account,
    address: contract,
    abi,
    functionName: fn,
    args,
  });
  const hash = await wallet.writeContract(request);
  return publicClient.waitForTransactionReceipt({ hash });
}

async function main() {
  console.log(`\n=== KEEL E2E on ${RPC} (chainId ${anvil.id}) ===`);
  console.log(`admin=${adminAddr}  participant=${partAddr}\n`);

  const codehash = JSON.parse(readFileSync(join(ROOT, "workflow", "config.local.json"), "utf8"))
    .controllerCodeHash as Hex;

  // ---- STEP 1: deploy tokens, then the faithful lending (grant it ADMIN_ROLE), then KEEL core ----
  const tokenAbi = loadArtifact("TokenvETH", "TokenvETH").abi;
  const vETH = await deploy("TokenvETH", "TokenvETH");
  const vUSD = await deploy("TokenvUSD", "TokenvUSD");
  const lendingAddr = await deploy("ChallengeLending", "ChallengeLending", [vETH, vUSD]);
  const policyCommitAddr = await deploy("PolicyCommit", "PolicyCommit");
  const receiptsAddr = await deploy("Receipts", "Receipts", [policyCommitAddr]);

  const lendingAbi = loadArtifact("ChallengeLending", "ChallengeLending").abi;
  const policyAbi = loadArtifact("PolicyCommit", "PolicyCommit").abi;
  const receiptsAbi = loadArtifact("Receipts", "Receipts").abi;

  // the lending contract mints (join/borrow) and burnsFrom (repay) → grant it ADMIN_ROLE on both tokens
  const ADMIN_ROLE = (await publicClient.readContract({ address: vETH, abi: tokenAbi, functionName: "ADMIN_ROLE" })) as Hex;
  await send(admin, vETH, tokenAbi, "grantRole", [ADMIN_ROLE, lendingAddr]);
  await send(admin, vUSD, tokenAbi, "grantRole", [ADMIN_ROLE, lendingAddr]);

  const lending = getContract({ address: lendingAddr, abi: lendingAbi, client: publicClient });
  const receipts = getContract({ address: receiptsAddr, abi: receiptsAbi, client: publicClient });
  const policy = getContract({ address: policyCommitAddr, abi: policyAbi, client: publicClient });

  check("STEP 1 deploy: 3 contracts + tokens", true,
    `lending=${lendingAddr} policyCommit=${policyCommitAddr} receipts=${receiptsAddr} vETH=${vETH} vUSD=${vUSD}`);

  // ---- STEP 2: open + join, verify initial position ----
  await send(admin, lendingAddr, lendingAbi, "open");
  await send(part, lendingAddr, lendingAbi, "join");
  {
    const pos = (await lending.read.getUserPosition([partAddr])) as { collateral: bigint; debt: bigint; hf: bigint };
    check("STEP 2 join: collateral==500", pos.collateral === 500n, `C=${pos.collateral}`);
    check("STEP 2 join: debt==700000", pos.debt === 700000n, `D=${pos.debt}`);
    check("STEP 2 join: hf==111", pos.hf === 111n, `hf=${pos.hf}`);
  }

  // ---- STEP 3: commit with the REAL controller ----
  const salt = ("0x" + "42".repeat(32)) as Hex; // 32 fixed bytes
  const saltBytes = new Uint8Array(32).fill(0x42);
  const { commit, signer, policyHash, receiptKey } = commitmentOf(DEFAULT_POLICY, salt, codehash);
  await send(part, policyCommitAddr, policyAbi, "commit", [commit, signer]);
  const commitBlock = await publicClient.getBlockNumber();
  {
    const c = (await policy.read.commits([partAddr])) as { hash: Hex; signer: Address; blockNumber: bigint };
    check("STEP 3 commit: hash matches", c.hash === commit, `${c.hash}`);
    check("STEP 3 commit: signer matches", c.signer.toLowerCase() === signer.toLowerCase(), `${c.signer}`);
    check("STEP 3 commit: blockNumber>0", c.blockNumber > 0n, `block=${c.blockNumber}`);
  }

  // ---- STEP 4: start, verify commit block < start block ----
  // NB: the official close() sets challengeOpen=false, which disables ALL user actions
  // (onlyActive), so the real scenario lifecycle is open→join→start→act (no close before the run).
  const startRcpt = await send(admin, lendingAddr, lendingAbi, "start");
  const startBlock = startRcpt.blockNumber;
  const startedS = Number((await lending.read.scenarioStartTime()) as bigint);
  check("STEP 4 ordering: commitBlock < startBlock", commitBlock < startBlock,
    `commit=${commitBlock} start=${startBlock}`);

  // approvals once (participant lets the lending contract pull vUSD/vETH)
  const MAXU = (1n << 256n) - 1n;
  await send(part, vUSD, tokenAbi, "approve", [lendingAddr, MAXU]);
  await send(part, vETH, tokenAbi, "approve", [lendingAddr, MAXU]);

  // ---- STEP 5: drive a price crash, controller defends each round ----
  // Deep enough that the *undefended* position would liquidate (hf100<=100 at P<=179487),
  // proving the controller's repays are what keep it alive.
  const priceSteps = [200000n, 192000n, 184000n, 178000n, 172000n, 168000n];
  let lastActionRound = -1;
  let actionNonce = 0n;
  let actionsTaken = 0;
  let lastReceipt: Receipt | null = null;
  let lastSig: Hex | null = null;

  for (let round = 0; round < priceSteps.length; round++) {
    const P = priceSteps[round]!;
    if (round > 0) await send(admin, lendingAddr, lendingAbi, "updatevETHPrice", [P]);

    const pos = (await lending.read.getUserPosition([partAddr])) as { collateral: bigint; debt: bigint };
    const C = pos.collateral;
    const D = pos.debt;
    const hfBp = hfBpOf(C, D, P);
    const undef = hf100Of(500n, 700000n, P); // what an undefended position would score
    const blk = await publicClient.getBlock();

    const balVETH = (await publicClient.readContract({ address: vETH, abi: tokenAbi, functionName: "balanceOf", args: [partAddr] })) as bigint;
    const balVUSD = (await publicClient.readContract({ address: vUSD, abi: tokenAbi, functionName: "balanceOf", args: [partAddr] })) as bigint;

    const input: DecideInput = {
      policy: DEFAULT_POLICY,
      salt: saltBytes,
      prices: priceSteps.slice(0, round + 1),
      round,
      collateral: C,
      debt: D,
      hfBp,
      lastActionRound,
      nowS: Number(blk.timestamp),
      startedS,
      balances: { vETH: balVETH, vUSD: balVUSD },
    };
    const d = decide(input);

    console.log(
      `  round ${round}: P=${P} C=${C} D=${D} hfBp=${hfBp} (undefended hf100=${undef}) -> ${d.reason}` +
        (d.act ? ` ${d.kind} ${d.amount}` : ""),
    );

    if (d.act) {
      // join() mints 5.00 spare vETH to the participant (deposit is fundable); the solver may
      // pick repay (from the 7000 vUSD) or deposit. Handle both.
      const kind = d.kind!;
      const amount = d.amount!;
      const rep = kind === "repay" ? amount : 0n;
      const dep = kind === "deposit" ? amount : 0n;
      if (amount <= 0n) throw new Error(`decide said act but amount=${amount}`);

      const actRcpt =
        rep > 0n
          ? await send(part, lendingAddr, lendingAbi, "repay", [rep])
          : await send(part, lendingAddr, lendingAbi, "deposit", [dep]);

      const receipt: Receipt = {
        commit,
        round: BigInt(round),
        blockObserved: actRcpt.blockNumber,
        price: P,
        hfBp,
        action: rep > 0n ? 1 : 2,
        amount: rep > 0n ? rep : dep,
        actionNonce,
      };
      const sig = await signReceipt(receipt, receiptKey, receiptsAddr);

      const before = (await receipts.read.count([partAddr])) as bigint;
      await send(part, receiptsAddr, receiptsAbi, "post", [receipt, sig]);
      const after = (await receipts.read.count([partAddr])) as bigint;
      check(`STEP 5.${round} receipt count incremented`, after === before + 1n, `${before}->${after}`);

      const onChainDigest = (await receipts.read.digestOf([receipt])) as Hex;
      const offChainDigest = receiptDigest(receipt, receiptsAddr);
      check(`STEP 5.${round} digest on-chain==off-chain`, onChainDigest === offChainDigest, onChainDigest);

      lastActionRound = round;
      actionNonce += 1n;
      actionsTaken += 1;
      lastReceipt = receipt;
      lastSig = sig;
    }

    // survival proof: after defending at this (already lower) price, admin runs the liquidation
    // sweep. The official contract has NO sticky flag — a liquidation is visible as a debt drop,
    // so surviving means debt is unchanged by checkAllHF (and hf stays above the line).
    const debtBefore = (await lending.read.getUserPosition([partAddr]) as { debt: bigint }).debt;
    await send(admin, lendingAddr, lendingAbi, "checkAllHF");
    const posAfter = (await lending.read.getUserPosition([partAddr])) as { debt: bigint; hf: bigint };
    check(`STEP 5.${round} NOT liquidated (survives)`, posAfter.debt === debtBefore && posAfter.hf > 100n,
      `debt ${debtBefore}->${posAfter.debt} hf=${posAfter.hf}`);
  }

  check("STEP 5 controller acted at least once", actionsTaken > 0, `actions=${actionsTaken}`);

  // ---- STEP 6: reveal (correct salt succeeds, wrong salt reverts) ----
  const policyBytes = encodePolicyBytes(DEFAULT_POLICY, codehash);
  check("STEP 6 policyBytes hash == committed policyHash", policyHashOf(policyBytes) === policyHash, policyHash);
  const revealRcpt = await send(part, policyCommitAddr, policyAbi, "reveal", [policyBytes, salt]);
  const revealedLog = revealRcpt.logs
    .map((l) => {
      try { return decodeEventLog({ abi: policyAbi, data: l.data, topics: l.topics }); }
      catch { return null; }
    })
    .find((e) => e && e.eventName === "Revealed");
  check("STEP 6 reveal emits Revealed", !!revealedLog, revealedLog ? "Revealed" : "no event");

  let wrongReverted = false;
  const badSalt = ("0x" + "99".repeat(32)) as Hex;
  try {
    await send(part, policyCommitAddr, policyAbi, "reveal", [policyBytes, badSalt]);
  } catch {
    wrongReverted = true;
  }
  check("STEP 6 wrong-salt reveal reverts", wrongReverted);

  // ---- STEP 7: on-chain committed signer == off-chain recovered receipt signer ----
  const c = (await policy.read.commits([partAddr])) as { signer: Address };
  const recovered = await recoverReceiptSigner(lastReceipt!, lastSig!, receiptsAddr);
  check("STEP 7 committed signer == recovered receipt signer",
    c.signer.toLowerCase() === recovered.toLowerCase(), `${c.signer} == ${recovered}`);

  console.log("\nE2E PASSED");
}

main().catch((e) => {
  console.error("\n" + (e?.message ?? e));
  console.error("\nE2E FAILED");
  process.exit(1);
});
