// scripts/ui.ts — ANSI formatting for the on-camera terminal demo. Zero deps.
// Colors align with the app's paper/klein/electric system, tuned for dark terminals.
const on = process.stdout.isTTY || !!process.env.FORCE_COLOR;
const c =
  (code: string) =>
  (s: string): string =>
    on ? `\x1b[${code}m${s}\x1b[0m` : s;

export const bold = c("1");
export const dim = c("2");
export const inv = c("7");
export const blue = c("38;5;69"); // klein, terminal-bright
export const electric = c("38;5;63");
export const green = c("38;5;42");
export const red = c("38;5;203");
export const yellow = c("38;5;221");
export const gray = c("38;5;245");

export const OK = green("✓");
export const BAD = red("✗");
export const DOT = blue("●");

const W = 76;

export function banner(title: string, sub?: string): void {
  const t = ` ${title} `;
  const pad = Math.max(0, W - t.length);
  const l = Math.floor(pad / 2);
  console.log("");
  console.log(blue("╔" + "═".repeat(W) + "╗"));
  console.log(blue("║") + " ".repeat(l) + bold(t) + " ".repeat(pad - l) + blue("║"));
  if (sub) {
    const s = ` ${sub} `;
    const p2 = Math.max(0, W - s.length);
    const l2 = Math.floor(p2 / 2);
    console.log(blue("║") + " ".repeat(l2) + gray(s) + " ".repeat(p2 - l2) + blue("║"));
  }
  console.log(blue("╚" + "═".repeat(W) + "╝"));
}

export function section(label: string): void {
  console.log("");
  console.log(blue("┌─ ") + bold(label) + " " + blue("─".repeat(Math.max(0, W - label.length - 4))));
}

export function line(s = ""): void {
  console.log(blue("│") + "  " + s);
}

export function endSection(): void {
  console.log(blue("└" + "─".repeat(W + 1)));
}

export function kv(k: string, v: string): void {
  line(gray(k.padEnd(24)) + v);
}

/* HF on the contract's ×100 scale: 100 = liquidation line. Green ≥1.08, amber ≥1.03, red below. */
export function hf(h: bigint | number): string {
  const n = Number(h);
  const s = (n / 100).toFixed(2);
  return n >= 108 ? green(bold(s)) : n >= 103 ? yellow(bold(s)) : red(bold(s));
}

/* position bar over the $205 window: HF 1.00 … 1.15 */
export function hfBar(h: bigint | number): string {
  const n = Number(h);
  const width = 30;
  const pos = Math.max(0, Math.min(width - 1, Math.round(((n - 100) / 15) * (width - 1))));
  const cells = Array.from({ length: width }, (_, i) => (i === pos ? "●" : "─"));
  const bar = cells.join("");
  const colored = n >= 108 ? green(bar) : n >= 103 ? yellow(bar) : red(bar);
  return dim("LIQ 1.00 [") + colored + dim("] 1.15");
}

export function money(p: number): string {
  return bold("$" + (p / 100).toLocaleString("en-US", { minimumFractionDigits: 2 }));
}

export function txLink(url: string): string {
  return dim(url);
}
