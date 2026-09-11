import {
  createPublicClient,
  http,
  decodeFunctionData,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { hfBpOf, INIT_COLLATERAL, INIT_DEBT, P0, type Receipt } from "keel-controller";
import { LENDING_ABI, POLICYCOMMIT_ABI, RECEIPTS_ABI } from "./abi.ts";

export interface ReconstructTargets {
  rpcUrl: string;
  lending: Address;
  policyCommit: Address;
  receipts: Address;
  participant: Address;
  fromBlock: bigint;
}

/** One receipt as observed on-chain, plus the signature recovered from the post() tx calldata. */
export interface ObservedReceipt {
  receipt: Receipt;
  digest: Hex; // emitted in ReceiptPosted
  sig: Hex; // decoded from the post() tx input
  txHash: Hex;
}

/** Per price level: position entering the round, price, and any action taken. */
export interface ReconRound {
  round: number;
  price: bigint;
  cPre: bigint; // collateral entering the round (before this round's action)
  dPre: bigint; // debt entering the round
  hfBpPre: bigint; // HF entering the round
  acted: boolean;
  kind?: "repay" | "deposit" | "withdraw" | "borrow";
  amount?: bigint;
  receipt?: ObservedReceipt;
}

export interface ReconstructedRun {
  participant: Address;
  commit?: { hash: Hex; signer: Address; blockNumber: bigint };
  reveal?: { policyHash: Hex; salt: Hex; policy: Hex };
  startedBlock?: bigint;
  startedS?: bigint;
  prices: bigint[];
  rounds: ReconRound[];
  receipts: ObservedReceipt[];
  liquidated: boolean;
}

const ACTION_KIND = { 1: "repay", 2: "deposit", 3: "withdraw", 4: "borrow" } as const;

export function makeClient(rpcUrl: string): PublicClient {
  return createPublicClient({ transport: http(rpcUrl) }) as PublicClient;
}

export async function reconstruct(
  t: ReconstructTargets,
  client: PublicClient = makeClient(t.rpcUrl),
): Promise<ReconstructedRun> {
  const range = { fromBlock: t.fromBlock, toBlock: "latest" as const };

  // --- commitment + reveal ------------------------------------------------
  const committedLogs = await client.getLogs({
    address: t.policyCommit,
    event: POLICYCOMMIT_ABI[0],
    args: { participant: t.participant },
    ...range,
  });
  const revealedLogs = await client.getLogs({
    address: t.policyCommit,
    event: POLICYCOMMIT_ABI[1],
    args: { participant: t.participant },
    ...range,
  });
  const commit = committedLogs[0]
    ? {
        hash: committedLogs[0].args.hash!,
        signer: committedLogs[0].args.signer!,
        blockNumber: BigInt(committedLogs[0].args.blockNumber!),
      }
    : undefined;
  const reveal = revealedLogs[0]
    ? {
        policyHash: revealedLogs[0].args.policyHash!,
        salt: revealedLogs[0].args.salt!,
        policy: revealedLogs[0].args.policy!,
      }
    : undefined;

  // --- price path + scenario start ---------------------------------------
  const startedLogs = await client.getLogs({ address: t.lending, event: LENDING_ABI[1], ...range });
  const priceLogs = await client.getLogs({ address: t.lending, event: LENDING_ABI[0], ...range });
  // PriceUpdate logs after ChallengeStarted define the rounds (round 0 = P0 at start).
  const startedBlock = startedLogs[0]?.blockNumber;
  const startedS = startedLogs[0]?.args.startTime ? BigInt(startedLogs[0]!.args.startTime!) : undefined;
  const pricesAfterStart = priceLogs
    .filter((l) => startedBlock === undefined || l.blockNumber >= startedBlock)
    .map((l) => l.args.newPrice!);
  const prices = [P0, ...pricesAfterStart];
  const priceBlocks = priceLogs
    .filter((l) => startedBlock === undefined || l.blockNumber >= startedBlock)
    .map((l) => l.blockNumber);
  // round r begins at roundStart[r]: r=0 at startedBlock, r>=1 at the (r-1)-th PriceUpdate block.
  const roundStart: bigint[] = [startedBlock ?? 0n, ...priceBlocks];

  // --- participant position events ---------------------------------------
  const [deposits, repays, withdraws, borrows, liquidations] = await Promise.all([
    client.getLogs({ address: t.lending, event: LENDING_ABI[3], args: { user: t.participant }, ...range }),
    client.getLogs({ address: t.lending, event: LENDING_ABI[4], args: { user: t.participant }, ...range }),
    client.getLogs({ address: t.lending, event: LENDING_ABI[5], args: { user: t.participant }, ...range }),
    client.getLogs({ address: t.lending, event: LENDING_ABI[6], args: { user: t.participant }, ...range }),
    client.getLogs({ address: t.lending, event: LENDING_ABI[7], args: { user: t.participant }, ...range }),
  ]);
  type Ev = { block: bigint; logIndex: number; kind: "deposit" | "repay" | "withdraw" | "borrow"; amount: bigint };
  const evs: Ev[] = [
    ...deposits.map((l) => ({ block: l.blockNumber!, logIndex: l.logIndex!, kind: "deposit" as const, amount: l.args.amount! })),
    ...repays.map((l) => ({ block: l.blockNumber!, logIndex: l.logIndex!, kind: "repay" as const, amount: l.args.amount! })),
    ...withdraws.map((l) => ({ block: l.blockNumber!, logIndex: l.logIndex!, kind: "withdraw" as const, amount: l.args.amount! })),
    ...borrows.map((l) => ({ block: l.blockNumber!, logIndex: l.logIndex!, kind: "borrow" as const, amount: l.args.amount! })),
  ].sort((a, b) => (a.block === b.block ? a.logIndex - b.logIndex : Number(a.block - b.block)));

  const roundOf = (block: bigint): number => {
    let r = 0;
    for (let i = 0; i < roundStart.length; i++) if (block >= roundStart[i]!) r = i;
    return r;
  };
  const evByRound = new Map<number, Ev[]>();
  for (const e of evs) {
    const r = roundOf(e.block);
    (evByRound.get(r) ?? evByRound.set(r, []).get(r)!).push(e);
  }

  // --- receipts (+ independent sig recovery from calldata) ---------------
  const receiptLogs = await client.getLogs({
    address: t.receipts,
    event: RECEIPTS_ABI[0],
    args: { participant: t.participant },
    ...range,
  });
  const receipts: ObservedReceipt[] = [];
  for (const log of receiptLogs) {
    const tx = await client.getTransaction({ hash: log.transactionHash! });
    const { args } = decodeFunctionData({ abi: RECEIPTS_ABI, data: tx.input });
    const [r, sig] = args as unknown as [Receipt, Hex];
    receipts.push({ receipt: r, digest: log.args.digest!, sig, txHash: log.transactionHash! });
  }
  const receiptByRound = new Map<number, ObservedReceipt>();
  for (const or of receipts) receiptByRound.set(Number(or.receipt.round), or);

  // --- fold events into per-round position -------------------------------
  const rounds: ReconRound[] = [];
  let C = INIT_COLLATERAL;
  let D = INIT_DEBT;
  for (let r = 0; r < prices.length; r++) {
    const or = receiptByRound.get(r);
    const cPre = C;
    const dPre = D;
    const hfBpPre = or ? or.receipt.hfBp : hfBpOf(cPre, dPre, prices[r]!);
    const roundEvs = evByRound.get(r) ?? [];
    for (const e of roundEvs) {
      if (e.kind === "deposit") C += e.amount;
      else if (e.kind === "repay") D -= e.amount;
      else if (e.kind === "withdraw") C -= e.amount;
      else if (e.kind === "borrow") D += e.amount;
    }
    const acted = roundEvs.length > 0 || or !== undefined;
    const first = roundEvs[0];
    rounds.push({
      round: r,
      price: prices[r]!,
      cPre,
      dPre,
      hfBpPre,
      acted,
      kind: first?.kind ?? (or ? ACTION_KIND[or.receipt.action as 1 | 2 | 3] : undefined),
      amount: first?.amount ?? or?.receipt.amount,
      receipt: or,
    });
  }

  return {
    participant: t.participant,
    commit,
    reveal,
    startedBlock,
    startedS,
    prices,
    rounds,
    receipts,
    liquidated: liquidations.length > 0,
  };
}

export { ACTION_KIND };
