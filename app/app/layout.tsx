import type { Metadata } from "next";
import Link from "next/link";
import { Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { NavLinks } from "@/components/NavLinks";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-hanken",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "KEEL — verifiable secrecy",
  description:
    "The starter hides the number. Keel hides the number, hides what it will do next, and proves the number never changed.",
};

/* static dissolving 3×3 brand mark — the sealed number, grain by grain */
function BrandMark() {
  const cells: [number, number, number][] = [
    [0, 0, 1],
    [8, 0, 1],
    [16, 0, 0.55],
    [0, 8, 1],
    [8, 8, 1],
    [16, 8, 0.4],
    [0, 16, 1],
    [8, 16, 0.5],
    [16, 16, 0.25],
  ];
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      {cells.map(([x, y, o], i) => (
        <rect key={i} x={x} y={y} width="6" height="6" fill="var(--color-keel)" opacity={o} />
      ))}
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${hanken.variable} ${plexMono.variable}`}>
      <body className="min-h-full flex flex-col">
        <header
          className="sticky top-0 z-50 border-b"
          style={{
            borderColor: "var(--color-ink)",
            background: "rgba(232,230,224,.88)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="mx-auto max-w-[1180px] px-7 h-[60px] flex items-center justify-between gap-5">
            <Link href="/" className="flex items-center gap-2.5 flex-none">
              <BrandMark />
              <span className="text-[15px] font-bold tracking-[-0.02em]">KEEL</span>
              <span
                className="mono hidden sm:inline text-[10.5px] tracking-[0.06em] text-[color:var(--color-muted)] ml-1 pl-2.5 border-l"
                style={{ borderColor: "var(--color-line2)" }}
              >
                SEPOLIA / 11155111
              </span>
            </Link>
            <NavLinks />
          </div>
        </header>

        <main className="relative z-10 flex-1 mx-auto w-full max-w-[1120px] px-7 pt-8 pb-18">
          {children}
        </main>

        <footer className="border-t" style={{ borderColor: "var(--color-ink)" }}>
          <div className="mx-auto max-w-[1120px] px-7 py-6 flex items-center justify-between gap-4 flex-wrap mono text-[12px] text-[color:var(--color-muted)]">
            <span>KEEL — verifiable-secrecy liquidation protection · Chainlink CRE</span>
            <span>HF = price / 1794.87 · the $205 window</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
