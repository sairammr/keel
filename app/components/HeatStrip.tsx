import type { Posterior } from "@/lib/hunter";
import { PRICE_DIVISOR } from "@/lib/policy";

// Hunter posterior heat bar over the secret trigger (base bp). A collapsed strip = the
// number is known; a wide glowing band = verifiable secrecy holding.
export function HeatStrip({
  post,
  tone = "hunt",
  showHpd = true,
}: {
  post: Posterior;
  tone?: "hunt" | "keel" | "danger";
  showHpd?: boolean;
}) {
  const max = Math.max(...post.heat, 1e-9);
  const col =
    tone === "keel"
      ? "46,230,166"
      : tone === "danger"
        ? "255,92,77"
        : "124,108,255";
  const n = post.grid.length;
  const loFrac = (post.hpdLoBp - post.grid[0]!) / (post.grid[n - 1]! - post.grid[0]!);
  const hiFrac = (post.hpdHiBp - post.grid[0]!) / (post.grid[n - 1]! - post.grid[0]!);

  const armLo = (post.hpdLoBp / 10000).toFixed(3);
  const armHi = (post.hpdHiBp / 10000).toFixed(3);
  const priceLo = Math.round((post.hpdLoBp / 10000) * PRICE_DIVISOR);
  const priceHi = Math.round((post.hpdHiBp / 10000) * PRICE_DIVISOR);

  return (
    <div className="w-full">
      <div className="relative h-9 w-full overflow-hidden rounded-[3px] border hairline bg-[color:var(--color-panel2)]">
        <div className="absolute inset-0 flex">
          {post.heat.map((h, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: `rgba(${col},${(h / max) * 0.92})`,
              }}
            />
          ))}
        </div>
        {showHpd && (
          <div
            className="absolute top-0 bottom-0 border-x"
            style={{
              left: `${loFrac * 100}%`,
              width: `${Math.max(1, (hiFrac - loFrac) * 100)}%`,
              borderColor: `rgba(${col},0.9)`,
              background: `rgba(${col},0.06)`,
            }}
          />
        )}
      </div>
      {showHpd && (
        <div className="mt-1.5 flex items-center justify-between mono text-[10.5px] text-[color:var(--color-muted)]">
          <span>
            HF {armLo}–{armHi}{" "}
            <span className="text-[color:var(--color-faint)]">
              (${priceLo}–${priceHi})
            </span>
          </span>
          <span>
            90% HPD{" "}
            <span
              className="font-semibold"
              style={{ color: `rgb(${col})` }}
            >
              {post.widthBp} bp
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
