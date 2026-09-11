import {
  parseAbi,
  encodeFunctionData,
  decodeFunctionResult,
  encodeEventTopics,
  decodeEventLog,
  numberToHex,
  fromHex,
  type Address,
  type Hex,
} from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { HTTPClient, type TeeRuntime } from "@chainlink/cre-sdk";
import type { Config } from "./config.ts";
import { roundOfBlock, pricesFrom } from "./plan.ts";

// Signatures verbatim from the official ChallengeLending (Sepolia 0x8857…1ba1, Solidity 0.8.36).
export const LENDING_ABI = parseAbi([
  "function getUserPosition(address) view returns (uint256 collateral,uint256 debt,uint256 hf,uint256 numOperations,uint256 lastUpdateTime,uint256 cumulativeDebtTime)",
  "function vETHPrice() view returns (uint256)",
  "function scenarioStartTime() view returns (uint256)",
  "function scenarioEndTime() view returns (uint256)",
  "function challengeOpen() view returns (bool)",
  "function isUser(address) view returns (bool)",
  "function vETH() view returns (address)",
  "function vUSD() view returns (address)",
  "function deposit(uint256 amount)",
  "function repay(uint256 amount)",
  "event PriceUpdate(uint256 oldPrice,uint256 newPrice)",
  "event ChallengeStarted(uint256 startTime)",
  "event Repay(address indexed user,uint256 amount)",
  "event Deposit(address indexed user,uint256 amount)",
  "event WithdrawCollateral(address indexed user,uint256 amount)",
  "event Borrow(address indexed user,uint256 amount)",
]);

const TOKEN_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
]);

const POLICY_COMMIT_ABI = parseAbi([
  "function commits(address) view returns (bytes32 hash,address signer,uint64 blockNumber,uint64 timestamp)",
  "function commit(bytes32 hash,address signer)",
]);

const RECEIPTS_ABI = parseAbi([
  "function post((bytes32 commit,uint64 round,uint64 blockObserved,uint256 price,uint256 hfBp,uint8 action,uint256 amount,uint64 actionNonce) r,bytes sig)",
]);

export const MAX_UINT256 = (1n << 256n) - 1n;
const GAS_LIMIT = 500_000n; // ponytail: fixed gas; add eth_estimateGas only if a call ever OOGs.
const MAX_RESP_BYTES = 90 * 1024; // CRE HTTP response cap is 100 KB; guard at 90 KB (K5).

interface RawLog {
  data: Hex;
  topics: Hex[];
  blockNumber: bigint;
}

export interface Position {
  collateral: bigint;
  debt: bigint;
}

export interface CommitState {
  hash: Hex;
  signer: Address;
}

export interface Balances {
  vETH: bigint;
  vUSD: bigint;
}

/** Everything the handler needs for one tick — fetched in ONE batched HTTP request. */
export interface TickState {
  blockNumber: bigint;
  gasPrice: bigint; // already ×1.25
  nonce: number; // pending
  price: bigint;
  position: Position;
  scenarioStartTime: bigint;
  scenarioEndTime: bigint;
  challengeOpen: boolean;
  isUser: boolean;
  commit: CommitState;
  balances: Balances;
  startedBlock: bigint | null;
  priceLevels: bigint[]; // observed PriceUpdate levels since ChallengeStarted (P0 prepended by caller)
  lastActionRound: number;
}

export interface Tx {
  to: Address;
  data: Hex;
}

type Call = { method: string; params: unknown[] };

/** Minimal HTTP surface we use — the SDK's HTTPClient satisfies it; tests inject a counting fake. */
export interface HttpLike {
  sendRequest(rt: unknown, req: { url: string; method: string; headers: Record<string, string>; body: string }): { result(): { body: Uint8Array } };
}

/** All chain I/O as raw JSON-RPC over the enclave HTTP capability, batched to fit CRE's 5-call quota. */
export class ChainReader {
  private readonly http: HttpLike;

  constructor(
    private readonly rt: TeeRuntime<Config>,
    private readonly rpcUrl: string,
    private readonly cfg: Config,
    http?: HttpLike,
  ) {
    this.http = http ?? (new HTTPClient() as unknown as HttpLike);
  }

  /** One HTTP request carrying a JSON-RPC batch; results matched by id (never by position). */
  private rpcBatch(calls: Call[]): unknown[] {
    const payload = JSON.stringify(calls.map((c, i) => ({ jsonrpc: "2.0", id: i, method: c.method, params: c.params })));
    const resp = this.http
      .sendRequest(this.rt, {
        url: this.rpcUrl,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: Buffer.from(payload).toString("base64"),
      })
      .result();
    const bytes = resp.body as Uint8Array;
    if (bytes.length > MAX_RESP_BYTES) throw new Error(`rpc batch response ${bytes.length}B exceeds ${MAX_RESP_BYTES}B cap`);
    const arr = JSON.parse(new TextDecoder().decode(bytes)) as Array<{ id: number; result?: unknown; error?: { message: string } }>;
    const byId = new Array<unknown>(calls.length);
    for (const r of arr) {
      if (r.error) throw new Error(`rpc ${calls[r.id]?.method} failed: ${r.error.message}`);
      byId[r.id] = r.result;
    }
    return byId;
  }

  private callData(abi: readonly unknown[], to: Address, fn: string, args: unknown[] = []): Call {
    // viem's generics can't type dynamic (fn, args) dispatch; the ABI guarantees correctness at runtime.
    const data = encodeFunctionData({ abi, functionName: fn, args } as Parameters<typeof encodeFunctionData>[0]);
    return { method: "eth_call", params: [{ to, data }, "latest"] };
  }

  private logsCall(address: Address, topics: (Hex | Hex[] | null)[], fromBlock: number): Call {
    return { method: "eth_getLogs", params: [{ address, topics, fromBlock: numberToHex(fromBlock), toBlock: "latest" }] };
  }

  private decodeCall<T>(abi: readonly unknown[], fn: string, data: Hex): T {
    return decodeFunctionResult({ abi, functionName: fn, data } as Parameters<typeof decodeFunctionResult>[0]) as T;
  }

  private toLogs(raw: Array<{ data: Hex; topics: Hex[]; blockNumber: Hex }>): RawLog[] {
    return raw.map((l) => ({ data: l.data, topics: l.topics, blockNumber: fromHex(l.blockNumber, "bigint") }));
  }

  /**
   * REQUEST 1: fetch the entire tick state in a single batched JSON-RPC call.
   * ~15 sub-calls (3 node + 9 eth_call + 3 getLogs) but exactly one HTTP request.
   */
  readAll(addr: Address): TickState {
    const me = addr;
    // OR all four action-event topic0s in one getLogs; they all carry `user` as the first indexed arg.
    const actionTopics = (["Repay", "Deposit", "WithdrawCollateral", "Borrow"] as const).map(
      (ev) => encodeEventTopics({ abi: LENDING_ABI, eventName: ev })[0]!,
    );
    const [, userTopic] = encodeEventTopics({ abi: LENDING_ABI, eventName: "Repay", args: { user: me } });
    const [priceTopic] = encodeEventTopics({ abi: LENDING_ABI, eventName: "PriceUpdate" });
    const [startedTopic] = encodeEventTopics({ abi: LENDING_ABI, eventName: "ChallengeStarted" });

    const L = this.cfg.lending;
    const from = this.cfg.startBlock;
    const calls: Call[] = [
      { method: "eth_blockNumber", params: [] }, // 0
      { method: "eth_gasPrice", params: [] }, // 1
      { method: "eth_getTransactionCount", params: [me, "pending"] }, // 2
      this.callData(LENDING_ABI, L, "vETHPrice"), // 3
      this.callData(LENDING_ABI, L, "getUserPosition", [me]), // 4
      this.callData(LENDING_ABI, L, "scenarioStartTime"), // 5
      this.callData(LENDING_ABI, L, "scenarioEndTime"), // 6
      this.callData(LENDING_ABI, L, "challengeOpen"), // 7
      this.callData(LENDING_ABI, L, "isUser", [me]), // 8
      this.callData(POLICY_COMMIT_ABI, this.cfg.policyCommit, "commits", [me]), // 9
      this.callData(TOKEN_ABI, this.cfg.vETH, "balanceOf", [me]), // 10
      this.callData(TOKEN_ABI, this.cfg.vUSD, "balanceOf", [me]), // 11
      this.logsCall(L, [startedTopic!], from), // 12
      this.logsCall(L, [priceTopic!], from), // 13
      this.logsCall(L, [actionTopics as Hex[], userTopic!], from), // 14: all 4 action events, my user
    ];
    const r = this.rpcBatch(calls);

    const pos = this.decodeCall<readonly bigint[]>(LENDING_ABI, "getUserPosition", r[4] as Hex);
    const commitRaw = this.decodeCall<readonly [Hex, Address, bigint, bigint]>(POLICY_COMMIT_ABI, "commits", r[9] as Hex);

    const startedLogs = this.toLogs(r[12] as never);
    const startedBlock = startedLogs.length ? startedLogs[0]!.blockNumber : null;
    const minBlock = startedBlock ?? 0n;

    const priceLogs = this.toLogs(r[13] as never).map((l) => ({
      price: (decodeEventLog({ abi: LENDING_ABI, eventName: "PriceUpdate", data: l.data, topics: l.topics as [Hex, ...Hex[]] }).args as { newPrice: bigint }).newPrice,
      block: l.blockNumber,
    }));

    const priceBlocks = priceLogs.filter((p) => p.block >= minBlock).map((p) => p.block);
    let lastActionRound = -1;
    for (const l of this.toLogs(r[14] as never)) {
      if (l.blockNumber >= minBlock) lastActionRound = Math.max(lastActionRound, roundOfBlock(l.blockNumber, priceBlocks));
    }

    return {
      blockNumber: fromHex(r[0] as Hex, "bigint"),
      gasPrice: (fromHex(r[1] as Hex, "bigint") * 125n) / 100n,
      nonce: fromHex(r[2] as Hex, "number"),
      price: this.decodeCall<bigint>(LENDING_ABI, "vETHPrice", r[3] as Hex),
      position: { collateral: pos[0]!, debt: pos[1]! },
      scenarioStartTime: this.decodeCall<bigint>(LENDING_ABI, "scenarioStartTime", r[5] as Hex),
      scenarioEndTime: this.decodeCall<bigint>(LENDING_ABI, "scenarioEndTime", r[6] as Hex),
      challengeOpen: this.decodeCall<boolean>(LENDING_ABI, "challengeOpen", r[7] as Hex),
      isUser: this.decodeCall<boolean>(LENDING_ABI, "isUser", r[8] as Hex),
      commit: { hash: commitRaw[0], signer: commitRaw[1] },
      balances: { vETH: this.decodeCall<bigint>(TOKEN_ABI, "balanceOf", r[10] as Hex), vUSD: this.decodeCall<bigint>(TOKEN_ABI, "balanceOf", r[11] as Hex) },
      startedBlock,
      priceLevels: pricesFrom(priceLogs, minBlock),
      lastActionRound,
    };
  }

  // ---- tx builders (calldata) ----
  depositTx(amount: bigint): Tx {
    return { to: this.cfg.lending, data: encodeFunctionData({ abi: LENDING_ABI, functionName: "deposit", args: [amount] }) };
  }
  repayTx(amount: bigint): Tx {
    return { to: this.cfg.lending, data: encodeFunctionData({ abi: LENDING_ABI, functionName: "repay", args: [amount] }) };
  }
  commitTx(hash: Hex, signer: Address): Tx {
    return { to: this.cfg.policyCommit, data: encodeFunctionData({ abi: POLICY_COMMIT_ABI, functionName: "commit", args: [hash, signer] }) };
  }
  approveMaxTx(which: "vETH" | "vUSD"): Tx {
    const token = which === "vETH" ? this.cfg.vETH : this.cfg.vUSD;
    return { to: token, data: encodeFunctionData({ abi: TOKEN_ABI, functionName: "approve", args: [this.cfg.lending, MAX_UINT256] }) };
  }
  postReceiptTx(receipt: {
    commit: Hex; round: bigint; blockObserved: bigint; price: bigint; hfBp: bigint; action: number; amount: bigint; actionNonce: bigint;
  }, sig: Hex): Tx {
    return { to: this.cfg.receipts, data: encodeFunctionData({ abi: RECEIPTS_ABI, functionName: "post", args: [receipt, sig] }) };
  }

  /** Sign a legacy tx in-enclave (no I/O). */
  async sign(account: PrivateKeyAccount, tx: Tx, nonce: number, gasPrice: bigint): Promise<Hex> {
    return account.signTransaction({
      type: "legacy",
      to: tx.to,
      data: tx.data,
      value: 0n,
      gas: GAS_LIMIT,
      gasPrice,
      nonce,
      chainId: this.cfg.chainId,
    });
  }

  /** REQUEST 2: broadcast every signed tx in one batched JSON-RPC request (ordered by nonce). */
  sendRawBatch(signed: Hex[]): Hex[] {
    if (signed.length === 0) return [];
    const results = this.rpcBatch(signed.map((s) => ({ method: "eth_sendRawTransaction", params: [s] })));
    return results as Hex[];
  }
}
