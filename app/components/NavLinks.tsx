"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/replay", label: "Replay" },
  { href: "/hunter", label: "Hunter" },
  { href: "/verify", label: "Verify" },
  { href: "/docs", label: "Docs" },
  { href: "/pitch", label: "Pitch" },
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
            className="px-3 py-2 text-[13.5px] font-medium whitespace-nowrap transition-colors"
            style={{
              background: on ? "var(--color-keel)" : "transparent",
              color: on ? "#fff" : "var(--color-muted)",
            }}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
