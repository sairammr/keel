"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Thesis", ix: "00" },
  { href: "/replay", label: "Replay", ix: "01" },
  { href: "/hunter", label: "Hunter", ix: "02" },
  { href: "/verify", label: "Verify", ix: "03" },
  { href: "/pitch", label: "Pitch", ix: "04" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="flex items-center">
      {NAV.map((n) => {
        const on = path === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            className="flex items-center gap-2 px-3 py-2 text-[13.5px] font-medium whitespace-nowrap transition-colors"
            style={{
              background: on ? "var(--color-keel)" : "transparent",
              color: on ? "#fff" : "var(--color-muted)",
            }}
          >
            <span
              className="mono text-[10.5px]"
              style={{ color: on ? "rgba(255,255,255,.7)" : "var(--color-line2)" }}
            >
              {n.ix}
            </span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
