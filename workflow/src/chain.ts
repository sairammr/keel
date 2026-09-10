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
import { roundOfBlock } from "./plan.ts";

const LENDING_ABI = parseAbi([
  "function getUserPosition(address) view returns (uint256 collateral,uint256 debt,uint256 hf,uint256 numOperations,uint256 lastUpdateTime,uint256 cumulativeDebtTime)",
  "function vETHPrice() view returns (uint256)",
  "function scenarioStartTime() view returns (uint256)",
  "function vETH() view returns (address)",
  "function vUSD() view returns (address)",
  "function deposit(uint256 amount)",
  "function repay(uint256 amount)",
  "event PriceUpdate(uint256 newPrice)",
  "event Repay(address indexed participant,uint256 amount,uint256 hf)",
  "event Deposit(address indexed participant,uint256 amount,uint256 hf)",
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

interface RawLog {
  data: Hex;
  topics: Hex[];
  blockNumber: bigint;
}

interface PriceLog {
  price: bigint;
  block: bigint;
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

/** All chain I/O as raw JSON-RPC over the enclave HTTP capability. */
export class ChainReader {
  private readonly http = new HTTPClient();
  private tokens?: { vETH: Address; vUSD: Address };

  constructor(
    private readonly rt: TeeRuntime<Config>,
    private readonly rpcUrl: string,
    private readonly cfg: Config,
  ) {}

  // ---- raw JSON-RPC ----
  private rpc<T = unknown>(method: string, params: unknown[]): T {
    const payload = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
    const resp = this.http
      .sendRequest(this.rt, {
        url: this.rpcUrl,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: Buffer.from(payload).toString("base64"),
      })
      .result();
    const text = new TextDecoder().decode(resp.body);
    const parsed = JSON.parse(text) as { result?: T; error?: { message: string } };
    if (parsed.error) throw new Error(`rpc ${method} failed: ${parsed.error.message}`);
    return parsed.result as T;
  }

  private ethCall(to: Address, data: Hex): Hex {
    return this.rpc<Hex>("eth_call", [{ to, data }, "latest"]);
  }

  private getLogs(address: Address, topics: (Hex | Hex[] | null)[], fromBlock: number): RawLog[] {
    const raw = this.rpc<Array<{ data: Hex; topics: Hex[]; blockNumber: Hex }>>("eth_getLogs", [
      { address, topics, fromBlock: numberToHex(fromBlock), toBlock: "latest" },
    ]);
    return raw.map((l) => ({ data: l.data, topics: l.topics, blockNumber: fromHex(l.blockNumber, "bigint") }));
  }

  // ---- reads ----
  blockNumber(): bigint {
    return fromHex(this.rpc<Hex>("eth_blockNumber", []), "bigint");
  }

  price(): bigint {
    const data = encodeFunctionData({ abi: LENDING_ABI, functionName: "vETHPrice" });
    const res = decodeFunctionResult({
      abi: LENDING_ABI,
      functionName: "vETHPrice",
      data: this.ethCall(this.cfg.lending, data),
    });
    return res as bigint;
  }

  scenarioStartTime(): bigint {
    const data = encodeFunctionData({ abi: LENDING_ABI, functionName: "scenarioStartTime" });
    const res = decodeFunctionResult({
      abi: LENDING_ABI,
      functionName: "scenarioStartTime",
      data: this.ethCall(this.cfg.lending, data),
    });
    return res as bigint;
  }

  /** Positional decode of collateral/debt. HF is NEVER trusted here — recompute from C/D/price. */
  position(addr: Address): Position {
    const data = encodeFunctionData({ abi: LENDING_ABI, functionName: "getUserPosition", args: [addr] });
    const res = decodeFunctionResult({
      abi: LENDING_ABI,
      functionName: "getUserPosition",
      data: this.ethCall(this.cfg.lending, data),
    }) as readonly bigint[];
    return { collateral: res[0]!, debt: res[1]! };
  }

  commitOf(addr: Address): CommitState {
    const data = encodeFunctionData({ abi: POLICY_COMMIT_ABI, functionName: "commits", args: [addr] });
    const res = decodeFunctionResult({
      abi: POLICY_COMMIT_ABI,
      functionName: "commits",
      data: this.ethCall(this.cfg.policyCommit, data),
    }) as readonly [Hex, Address, bigint, bigint];
    return { hash: res[0], signer: res[1] };
  }

  private tokenAddrs(): { vETH: Address; vUSD: Address } {
    if (this.tokens) return this.tokens;
    const readAddr = (fn: "vETH" | "vUSD"): Address =>
      decodeFunctionResult({
        abi: LENDING_ABI,
        functionName: fn,
        data: this.ethCall(this.cfg.lending, encodeFunctionData({ abi: LENDING_ABI, functionName: fn })),
      }) as Address;
    this.tokens = { vETH: readAddr("vETH"), vUSD: readAddr("vUSD") };
    return this.tokens;
  }

  balances(addr: Address): Balances {
    const t = this.tokenAddrs();
    const bal = (token: Address): bigint =>
      decodeFunctionResult({
        abi: TOKEN_ABI,
        functionName: "balanceOf",
        data: this.ethCall(token, encodeFunctionData({ abi: TOKEN_ABI, functionName: "balanceOf", args: [addr] })),
      }) as bigint;
    return { vETH: bal(t.vETH), vUSD: bal(t.vUSD) };
  }

  private priceLogs(fromBlock: number): PriceLog[] {
    const [topic0] = encodeEventTopics({ abi: LENDING_ABI, eventName: "PriceUpdate" });
    const logs = this.getLogs(this.cfg.lending, [topic0!], fromBlock);
    return logs.map((l) => {
      const { args } = decodeEventLog({ abi: LENDING_ABI, eventName: "PriceUpdate", data: l.data, topics: l.topics as [Hex, ...Hex[]] });
      return { price: (args as { newPrice: bigint }).newPrice, block: l.blockNumber };
    });
  }

  /** [P_1, P_2, ...] since startBlock (P0 is prepended by the caller). */
  priceUpdatesSince(fromBlock: number): bigint[] {
    return this.priceLogs(fromBlock).map((p) => p.price);
  }

  /**
   * lastActionRound: the price-level index at which my most recent Repay/Deposit landed.
   * round index = number of PriceUpdate logs at or before the action's block. -1 if never acted.
   */
  myActions(addr: Address, fromBlock: number): number {
    const priceBlocks = this.priceLogs(fromBlock).map((p) => p.block);
    let last = -1;
    for (const ev of ["Repay", "Deposit"] as const) {
      const [topic0, participantTopic] = encodeEventTopics({ abi: LENDING_ABI, eventName: ev, args: { participant: addr } });
      const logs = this.getLogs(this.cfg.lending, [topic0!, participantTopic!], fromBlock);
      for (const l of logs) last = Math.max(last, roundOfBlock(l.blockNumber, priceBlocks));
    }
    return last;
  }

  nonce(addr: Address, tag: "pending" | "latest"): number {
    return fromHex(this.rpc<Hex>("eth_getTransactionCount", [addr, tag]), "number");
  }

  private gasPrice(): bigint {
    const raw = fromHex(this.rpc<Hex>("eth_gasPrice", []), "bigint");
    return (raw * 125n) / 100n; // legacy gasPrice ×1.25
  }

  // ---- tx builders (calldata) ----
  depositTx(amount: bigint): { to: Address; data: Hex } {
    return { to: this.cfg.lending, data: encodeFunctionData({ abi: LENDING_ABI, functionName: "deposit", args: [amount] }) };
  }
  repayTx(amount: bigint): { to: Address; data: Hex } {
    return { to: this.cfg.lending, data: encodeFunctionData({ abi: LENDING_ABI, functionName: "repay", args: [amount] }) };
  }
  commitTx(hash: Hex, signer: Address): { to: Address; data: Hex } {
    return { to: this.cfg.policyCommit, data: encodeFunctionData({ abi: POLICY_COMMIT_ABI, functionName: "commit", args: [hash, signer] }) };
  }
  approveMaxTx(which: "vETH" | "vUSD"): { to: Address; data: Hex } {
    const token = this.tokenAddrs()[which];
    return { to: token, data: encodeFunctionData({ abi: TOKEN_ABI, functionName: "approve", args: [this.cfg.lending, MAX_UINT256] }) };
  }
  postReceiptTx(receipt: {
    commit: Hex; round: bigint; blockObserved: bigint; price: bigint; hfBp: bigint; action: number; amount: bigint; actionNonce: bigint;
  }, sig: Hex): { to: Address; data: Hex } {
    return { to: this.cfg.receipts, data: encodeFunctionData({ abi: RECEIPTS_ABI, functionName: "post", args: [receipt, sig] }) };
  }

  /** Sign a legacy tx in-enclave and broadcast. Returns tx hash. */
  async send(account: PrivateKeyAccount, tx: { to: Address; data: Hex }, nonce: number): Promise<Hex> {
    const signed = await account.signTransaction({
      type: "legacy",
      to: tx.to,
      data: tx.data,
      value: 0n,
      gas: GAS_LIMIT,
      gasPrice: this.gasPrice(),
      nonce,
      chainId: this.cfg.chainId,
    });
    return this.rpc<Hex>("eth_sendRawTransaction", [signed]);
  }
}
