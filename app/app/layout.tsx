import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "KEEL — verifiable secrecy",
  description:
    "The starter hides the number. Keel hides the number, hides what it will do next, and proves the number never changed.",
};

const NAV = [
  { href: "/", label: "Thesis" },
  { href: "/replay", label: "Replay" },
  { href: "/hunter", label: "Hunter" },
  { href: "/verify", label: "Verify" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-50 border-b hairline bg-[color:var(--color-bg)]/85 backdrop-blur">
          <div className="mx-auto max-w-[1180px] px-5 h-13 flex items-center justify-between py-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <span className="inline-block h-3 w-3 rounded-[2px] bg-[color:var(--color-keel)] live-dot" />
              <span className="mono text-[15px] font-semibold tracking-[0.2em]">
                KEEL
              </span>
              <span className="eyebrow hidden sm:inline ml-1">verifiable secrecy</span>
            </Link>
            <nav className="flex items-center gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="mono text-[12px] tracking-wide text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] px-3 py-1.5 transition-colors"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="relative z-10 flex-1 mx-auto w-full max-w-[1180px] px-5 py-8">
          {children}
        </main>
        <footer className="relative z-10 border-t hairline">
          <div className="mx-auto max-w-[1180px] px-5 py-4 flex items-center justify-between eyebrow">
            <span>KEEL · Chainlink CRE · verifiable-secrecy liquidation protection</span>
            <span className="hidden sm:inline">HF = price / 1794.87 · the $205 window</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
