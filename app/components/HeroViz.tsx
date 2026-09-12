/* Animated hero: the fixed threshold gets located (crosshair locks on),
   Keel's trigger keeps moving (jitter segments re-draw every cycle).
   Pure SMIL — honors the global prefers-reduced-motion kill switch. */
export function HeroViz() {
  // jitter segment heights (bp band 90–140 in viewBox y units), hand-picked spread
  const segs = [118, 96, 132, 104, 126, 94, 138, 110];
  const segW = 56;
  const x0 = 48;
  return (
    <svg
      viewBox="0 0 560 340"
      role="img"
      aria-label="A fixed liquidation trigger gets located; Keel's jittered trigger keeps moving"
      className="w-full block"
    >
      <title>Fixed threshold located — Keel&apos;s moving trigger never is</title>

      {/* frame + gridlines */}
      {[60, 130, 200, 270].map((y) => (
        <line key={y} x1={x0} x2={544} y1={y} y2={y} stroke="var(--color-line)" strokeWidth="1" />
      ))}

      {/* liquidation line */}
      <line x1={x0} x2={544} y1={296} y2={296} stroke="var(--color-danger)" strokeWidth="1" strokeDasharray="4 3" />
      <text x={544} y={290} textAnchor="end" fontSize="10" fill="var(--color-danger)" fontFamily="var(--font-mono)">
        LIQUIDATION $1,795
      </text>

      {/* STARTER: fixed threshold — a flat line the hunter locks onto */}
      <line x1={x0} x2={544} y1={200} y2={200} stroke="var(--color-danger)" strokeWidth="1.4" />
      <text x={x0} y={192} fontSize="10" fill="var(--color-danger)" fontFamily="var(--font-mono)">
        FIXED TRIGGER — LOCATED IN 3 OBSERVATIONS
      </text>
      {/* crosshair converging on the fixed line */}
      <g stroke="var(--color-danger)" fill="none" strokeWidth="1.2">
        <circle cx={430} cy={200} r={26}>
          <animate attributeName="r" values="60;9;9;60" keyTimes="0;0.35;0.8;1" dur="6s" repeatCount="indefinite" calcMode="spline" keySplines="0.42 0 0.58 1;0 0 1 1;0.42 0 0.58 1" />
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.3;0.85;1" dur="6s" repeatCount="indefinite" />
        </circle>
        <line x1={430} y1={182} x2={430} y2={218}>
          <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.3;0.4;0.85;1" dur="6s" repeatCount="indefinite" />
        </line>
        <line x1={412} y1={200} x2={448} y2={200}>
          <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.3;0.4;0.85;1" dur="6s" repeatCount="indefinite" />
        </line>
      </g>

      {/* KEEL: jitter band — segments jump to a fresh height every cycle */}
      <rect x={x0} y={88} width={544 - x0} height={56} fill="var(--color-keel)" opacity="0.05" />
      <text x={x0} y={80} fontSize="10" fill="var(--color-keel-ink)" fontFamily="var(--font-mono)">
        KEEL — FRESH SECRET DRAW EVERY PRICE LEVEL
      </text>
      {segs.map((y, i) => {
        const x = x0 + i * segW + 8;
        // each segment cycles through three heights inside the band, staggered
        const a = y;
        const b = 88 + ((y * 7 + i * 31) % 56);
        const c = 88 + ((y * 13 + i * 17) % 56);
        return (
          <line
            key={i}
            x1={x}
            x2={x + segW - 16}
            y1={a}
            y2={a}
            stroke="var(--color-keel)"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <animate
              attributeName="y1"
              values={`${a};${a};${b};${b};${c};${c};${a}`}
              keyTimes="0;0.3;0.34;0.63;0.67;0.96;1"
              dur="6s"
              begin={`${i * 0.12}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="y2"
              values={`${a};${a};${b};${b};${c};${c};${a}`}
              keyTimes="0;0.3;0.34;0.63;0.67;0.96;1"
              dur="6s"
              begin={`${i * 0.12}s`}
              repeatCount="indefinite"
            />
          </line>
        );
      })}

      {/* price path crashing through — drawn on loop */}
      <path
        d="M 48 40 L 128 70 L 208 56 L 288 120 L 368 180 L 430 250 L 480 210 L 544 110"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="1.8"
        strokeDasharray="700"
        strokeDashoffset="700"
      >
        <animate attributeName="stroke-dashoffset" values="700;0;0" keyTimes="0;0.6;1" dur="6s" repeatCount="indefinite" />
      </path>

      {/* defend pulse where price meets the band */}
      <circle cx={288} cy={120} r={5} fill="var(--color-keel)" stroke="var(--color-bg)" strokeWidth="1.5">
        <animate attributeName="r" values="0;0;7;5;5" keyTimes="0;0.32;0.4;0.5;1" dur="6s" repeatCount="indefinite" />
      </circle>
      <circle cx={288} cy={120} r={5} fill="none" stroke="var(--color-keel)" strokeWidth="1">
        <animate attributeName="r" values="5;22" keyTimes="0;1" dur="1.6s" begin="2.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0" dur="1.6s" begin="2.2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* small step glyphs for the how-it-works row */
export function GlyphCommit() {
  return (
    <svg viewBox="0 0 64 64" className="w-14 h-14" aria-hidden>
      <rect x="10" y="16" width="44" height="32" fill="none" stroke="var(--color-keel)" strokeWidth="2" strokeDasharray="152" strokeDashoffset="152">
        <animate attributeName="stroke-dashoffset" values="152;0;0;152" keyTimes="0;0.3;0.9;1" dur="5s" repeatCount="indefinite" />
      </rect>
      <path d="M 10 16 L 32 34 L 54 16" fill="none" stroke="var(--color-keel)" strokeWidth="2" strokeDasharray="60" strokeDashoffset="60">
        <animate attributeName="stroke-dashoffset" values="60;60;0;0;60" keyTimes="0;0.25;0.5;0.9;1" dur="5s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

export function GlyphJitter() {
  return (
    <svg viewBox="0 0 64 64" className="w-14 h-14" aria-hidden>
      {[16, 32, 48].map((x, i) => (
        <line key={x} x1={x - 6} x2={x + 6} y1={32} y2={32} stroke="var(--color-keel)" strokeWidth="2.6" strokeLinecap="round">
          <animate
            attributeName="y1"
            values={`${20 + i * 8};${44 - i * 10};${26 + i * 6};${20 + i * 8}`}
            dur="2.4s"
            begin={`${i * 0.3}s`}
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
          />
          <animate
            attributeName="y2"
            values={`${20 + i * 8};${44 - i * 10};${26 + i * 6};${20 + i * 8}`}
            dur="2.4s"
            begin={`${i * 0.3}s`}
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
          />
        </line>
      ))}
    </svg>
  );
}

export function GlyphVerify() {
  return (
    <svg viewBox="0 0 64 64" className="w-14 h-14" aria-hidden>
      <circle cx="32" cy="32" r="22" fill="none" stroke="var(--color-ok)" strokeWidth="2" strokeDasharray="140" strokeDashoffset="140">
        <animate attributeName="stroke-dashoffset" values="140;0;0;140" keyTimes="0;0.35;0.9;1" dur="5s" repeatCount="indefinite" />
      </circle>
      <path d="M 22 33 L 29 40 L 43 25" fill="none" stroke="var(--color-ok)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="32" strokeDashoffset="32">
        <animate attributeName="stroke-dashoffset" values="32;32;0;0;32" keyTimes="0;0.35;0.55;0.9;1" dur="5s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}
