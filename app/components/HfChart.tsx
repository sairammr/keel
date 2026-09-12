import type { Tick } from "@/lib/engine";

// Hand-rolled SVG HF-over-time chart. No chart lib. Flat editorial styling.
// y = Health Factor (1.00–1.16 window). Shades the $205 window, marks the liquidation
// line, draws the realized-HF line + the (secret) arm trigger line + action dots.
export function HfChart({
  ticks,
  color,
  step,
  label,
}: {
  ticks: Tick[];
  color: "keel" | "danger";
  step: number; // reveal first `step` ticks (for animated replay)
  label?: string;
}) {
  const W = 520;
  const H = 230;
  const padL = 40;
  const padR = 14;
  const padT = 16;
  const padB = 24;
  const n = ticks.length;
  const yLo = 0.985;
  const yHi = 1.16;
  const stroke = color === "keel" ? "var(--color-keel)" : "var(--color-danger)";

  const x = (i: number) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
  const y = (hf: number) =>
    padT + (1 - (hf - yLo) / (yHi - yLo)) * (H - padT - padB);

  const shown = ticks.slice(0, Math.max(1, step));
  const linePts = shown.map((t, i) => `${x(i)},${y(t.hfBpAfter / 10000)}`).join(" ");
  const armPts = shown.map((t, i) => `${x(i)},${y(t.armBp / 10000)}`).join(" ");

  // window band: HF 1.00 ($1,795) → 1.114 ($2,000)
  const winTop = y(1.114);
  const winBot = y(1.0);
  const liqY = y(1.01);

  const gridHF = [1.0, 1.03, 1.08, 1.114, 1.15];

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" role="img">
        {/* $205 window shading */}
        <rect
          x={padL}
          y={winTop}
          width={W - padL - padR}
          height={winBot - winTop}
          fill="var(--color-keel)"
          opacity={0.05}
        />
        <line
          x1={padL}
          x2={W - padR}
          y1={winTop}
          y2={winTop}
          stroke="var(--color-line2)"
          strokeDasharray="2 3"
          strokeWidth={1}
        />
        {/* y gridlines + labels */}
        {gridHF.map((g) => (
          <g key={g}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(g)}
              y2={y(g)}
              stroke="var(--color-line)"
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={y(g) + 3}
              textAnchor="end"
              className="mono"
              fontSize={8.5}
              fill="var(--color-faint)"
            >
              {g.toFixed(3)}
            </text>
          </g>
        ))}
        {/* liquidation line */}
        <line
          x1={padL}
          x2={W - padR}
          y1={liqY}
          y2={liqY}
          stroke="var(--color-danger)"
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.8}
        />
        <text
          x={W - padR}
          y={liqY - 4}
          textAnchor="end"
          className="mono"
          fontSize={8}
          fill="var(--color-danger)"
        >
          LIQ 1.01
        </text>

        {/* secret arm trigger line */}
        {shown.length > 1 && (
          <polyline
            points={armPts}
            fill="none"
            stroke="var(--color-faint)"
            strokeWidth={1}
            strokeDasharray="3 2"
            opacity={0.85}
          />
        )}
        {/* realized HF line */}
        {shown.length > 1 && (
          <polyline
            points={linePts}
            fill="none"
            stroke={stroke}
            strokeWidth={1.6}
          />
        )}
        {/* action dots */}
        {shown.map((t, i) =>
          t.acted ? (
            <g key={i}>
              <circle
                cx={x(i)}
                cy={y(t.hfBp / 10000)}
                r={3.2}
                fill={t.emergency ? "var(--color-warn)" : stroke}
                stroke="var(--color-bg)"
                strokeWidth={1}
              />
            </g>
          ) : t.liquidated ? (
            <rect
              key={i}
              x={x(i) - 2.5}
              y={y(t.hfBp / 10000) - 2.5}
              width={5}
              height={5}
              fill="var(--color-danger)"
            />
          ) : null,
        )}
        {label && (
          <text x={padL} y={12} className="mono" fontSize={9} fill="var(--color-faint)">
            {label}
          </text>
        )}
      </svg>
    </div>
  );
}
