import Link from "next/link";

/* Consistent "how to read this page" box used by the tour pages (replay / hunter /
   verify). Plain-English pointers so a first-time visitor knows what to look at. */
export function PageGuide({
  points,
  next,
}: {
  points: string[];
  next?: { href: string; label: string };
}) {
  return (
    <div
      className="border p-5 flex flex-col gap-3"
      style={{ borderColor: "var(--color-ink)", background: "var(--color-wash)" }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-[13px] font-bold tracking-[-0.01em]">
          How to read this page
        </span>
        <Link href="/docs" className="mono text-[11.5px] link-underline">
          new to the terms? docs ↗
        </Link>
      </div>
      <ol className="flex flex-col gap-1.5">
        {points.map((p, i) => (
          <li key={i} className="flex gap-3 text-[13px] leading-relaxed">
            <span className="mono text-[11px] pt-0.5 text-[color:var(--color-keel-ink)]">
              {i + 1}.
            </span>
            <span className="text-[color:var(--color-ink2)]">{p}</span>
          </li>
        ))}
      </ol>
      {next && (
        <div className="mono text-[11.5px] text-[color:var(--color-muted)]">
          next stop:{" "}
          <Link href={next.href} className="link-underline">
            {next.label} →
          </Link>
        </div>
      )}
    </div>
  );
}
