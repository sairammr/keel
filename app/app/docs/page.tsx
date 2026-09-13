import Link from "next/link";
import { DEPLOYMENT, etherscanAddr } from "@/lib/deployment";

export const metadata = { title: "KEEL — docs" };

const REPO = "https://github.com/sairammr/keel";

const TOC = [
  ["#one-minute", "Keel in one minute"],
  ["#problem", "The problem it solves"],
  ["#how", "How Keel works"],
  ["#tour", "Using this site"],
  ["#glossary", "Glossary"],
  ["#verify-yourself", "Verify it yourself"],
  ["#run", "Run it locally"],
] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="display text-[clamp(22px,2.6vw,30px)] mb-4">{title}</h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[14.5px] leading-relaxed text-[color:var(--color-ink2)] max-w-[68ch] mb-3">
      {children}
    </p>
  );
}

export default function DocsPage() {
  return (
    <div className="viewin flex flex-col gap-12 max-w-[820px]">
      <header>
        <div className="eyebrow mb-3">docs</div>
        <h1 className="display text-[clamp(30px,4vw,46px)]">
          What Keel is, and how to use this site.
        </h1>
        <p className="lead mt-4 text-[14.5px]">
          Everything on this site is explained here in plain language: the problem,
          the fix, what each page shows, and how to check the on-chain proof yourself.
        </p>
        <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
          {TOC.map(([href, label]) => (
            <a key={href} href={href} className="mono text-[12px] link-underline">
              {label}
            </a>
          ))}
        </nav>
        <div className="rule" />
      </header>

      <Section id="one-minute" title="Keel in one minute">
        <P>
          On lending protocols like Aave, a loan is safe while its <strong>health
          factor (HF)</strong> stays above 1.0. If the collateral price falls far
          enough, the loan is liquidated and the borrower pays a penalty. So borrowers
          run defense bots: when HF drops to some trigger level, the bot adds
          collateral or repays debt.
        </P>
        <P>
          The problem: everything the bot does is public. Watch when it acts and when
          it stays quiet, and you can work out its trigger, then push the price to that
          exact level to drain its reserve. Hiding the trigger in secure hardware does
          not help, because the bot&apos;s <em>behavior</em> still leaks the number.
        </P>
        <P>
          Keel is a defense bot whose trigger <strong>cannot be worked out from
          watching it</strong>, and which still <strong>proves afterward</strong> that
          it followed one fixed, pre-committed policy the whole time. It runs as a
          Chainlink CRE confidential workflow, built for the ETHOnline 2026 Chainlink
          challenge.
        </P>
      </Section>

      <Section id="problem" title="The problem it solves">
        <P>
          In the official challenge, health factor is a straight line in price:
          <span className="mono"> HF = price / 1794.87</span>. The position opens at
          $2,000 (HF 1.114) and is liquidated near $1,795 (HF 1.00). The whole game
          happens inside that $205 window.
        </P>
        <P>
          A bot with a fixed trigger gives one bit of information at every price
          level: it acted, or it did not. Each observation narrows the range where the
          trigger can be. Three or four well-chosen price pushes locate a fixed
          trigger to within a few dollars. After that, an attacker can tap the price
          to just below the trigger, force a spend, let the price recover, and repeat
          until the defender has nothing left for the real crash.
        </P>
        <P>
          The bot&apos;s reserve is a public token balance, so the attacker always
          knows how much is left to drain. The only thing that can stay secret is when
          the bot will act, and only if it is built so that acting does not give the
          secret away.
        </P>
      </Section>

      <Section id="how" title="How Keel works">
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="text-[15.5px] font-bold tracking-[-0.01em] mb-1.5">
              1. The trigger moves, upward only
            </h3>
            <P>
              Keel&apos;s trigger is not one number. Each time the price changes, the
              trigger is re-drawn: a secret base level, plus a volatility term, plus a
              random offset derived from a secret salt. The offset only ever raises
              the trigger, so randomness can make Keel act earlier but never later. It
              never costs survival. And because every price level gets a fresh
              independent draw, no amount of watching narrows the base below the
              offset&apos;s width. The algorithm is public; the secrecy lives entirely
              in the salt.
            </P>
          </div>
          <div>
            <h3 className="text-[15.5px] font-bold tracking-[-0.01em] mb-1.5">
              2. The policy is sealed before the market moves
            </h3>
            <P>
              Before the scenario starts, Keel posts a hash of its entire policy
              (all parameters plus the salt) to a <span className="mono">PolicyCommit</span>{" "}
              contract on Sepolia. Think of it as a sealed envelope handed to the
              referee before the match. The policy cannot be swapped later without
              breaking the hash.
            </P>
          </div>
          <div>
            <h3 className="text-[15.5px] font-bold tracking-[-0.01em] mb-1.5">
              3. Every action carries a receipt, and the seal opens after
            </h3>
            <P>
              Each defense transaction is followed by an EIP-712 receipt, signed by a
              key derived from the same salt inside the enclave. After the challenge,
              Keel reveals the policy and salt. Anyone can then recompute every
              round&apos;s trigger from public price logs and check that every action,
              and every non-action, matched the sealed policy. That is the difference
              between <em>private</em> and <em>provably unchanged</em>.
            </P>
          </div>
          <div>
            <h3 className="text-[15.5px] font-bold tracking-[-0.01em] mb-1.5">
              Where it runs
            </h3>
            <P>
              The decision code runs inside a Chainlink CRE confidential workflow
              (<span className="mono">handlerInTee</span>, AWS Nitro enclave). Policy
              parameters, the salt, the wallet key and the RPC credential are Vault
              DON secrets, released only to the enclave. The handler reads the chain,
              decides, defends if needed, and reports a single word:{" "}
              <span className="mono">IDLE</span>, <span className="mono">SAFE</span> or{" "}
              <span className="mono">DEFENDED</span>. No number ever leaves the
              enclave.
            </P>
          </div>
        </div>
      </Section>

      <Section id="tour" title="Using this site">
        <P>
          The three demo pages are a tour. Take them in order:
        </P>
        <div className="border" style={{ borderColor: "var(--color-ink)" }}>
          {[
            {
              href: "/replay",
              name: "Replay",
              what: "The same falling market, played against two defenders side by side: the official starter bot (fixed threshold) and Keel (sealed policy).",
              use: "Pick a scenario, press PLAY, and watch the strip under each chart. That strip is the attacker's live estimate of the bot's trigger. The starter's estimate collapses to a point; Keel's stays wide. Switch the source to CHAIN to see Keel's real recorded Sepolia run instead, with every action linked to Etherscan.",
            },
            {
              href: "/hunter",
              name: "Hunter",
              what: "A real Bayesian attacker that watches both bots across every market and then tries to drain them.",
              use: "Compare the “next-trigger band” numbers: how precisely the attacker can predict each bot's next move. Then press ATTACK to watch it tap the price at the starter's discovered trigger and milk its reserve. The ×1000 toggle scales the dollar figures to a realistically sized position.",
            },
            {
              href: "/verify",
              name: "Verify",
              what: "The proof. Everything on this page is reconstructed live from Sepolia events by an independent verifier package.",
              use: "Check the three green ticks: the commitment hash matches, every receipt's signer matches the committed signer, and every round's action matches the revealed policy. Every row links to the real transaction on Etherscan.",
            },
            {
              href: "/pitch",
              name: "Pitch",
              what: "The 10-slide story for judges.",
              use: "Arrow keys, scroll or the side dots step through the slides.",
            },
          ].map((r, i, arr) => (
            <div
              key={r.href}
              className={`p-5 ${i < arr.length - 1 ? "border-b" : ""}`}
              style={{ borderColor: "var(--color-ink)" }}
            >
              <div className="flex items-baseline gap-3 mb-1.5">
                <Link href={r.href} className="text-[15px] font-bold link-underline">
                  {r.name}
                </Link>
                <span className="text-[13px] text-[color:var(--color-muted)]">{r.what}</span>
              </div>
              <p className="text-[13px] leading-relaxed text-[color:var(--color-ink2)] max-w-[75ch]">
                {r.use}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="glossary" title="Glossary">
        <div className="border" style={{ borderColor: "var(--color-line2)" }}>
          {[
            ["Health factor (HF)", "How safe a loan is. Above 1.0 the loan is fine; at 1.0 or below it can be liquidated. Here HF = price / 1794.87, so HF is just the price in disguise."],
            ["bp (basis points)", "Hundredths of a percent. 100 bp of HF = 0.01 HF. A 300 bp band means the trigger is only known to within 0.03 HF, roughly a $54 price range."],
            ["Trigger / arm", "The HF level at which the bot defends. Keel re-draws it at every price level."],
            ["Target", "The HF level the bot restores to after defending, set above the trigger so it does not immediately re-fire."],
            ["Jitter", "Keel's secret random offset, drawn per price level from HMAC(salt, level). Upward only: it can move an action earlier, never later."],
            ["Hunter", "The attacker model shipped with the project. It infers triggers from public data only, the same way a real stop-hunter would."],
            ["M1 / M2", "The Hunter's two models. M1 assumes a fixed threshold, which is right for the starter. M2 knows Keel's algorithm (threshold plus jitter) and still cannot narrow the base below the jitter width."],
            ["Posterior / band", "The attacker's belief about where the trigger is, after watching. A narrow band means the bot is predictable; a wide band means it is not."],
            ["Hunt price", "How deep an attacker must push the price to be ~90% sure of forcing the bot to spend."],
            ["Commit", "The hash keccak(policy ‖ salt) posted on-chain before the scenario starts. Seals the policy without revealing it."],
            ["Receipt", "An EIP-712 message posted after each defense, signed by a key derived from the salt inside the enclave. Ties the action to the sealed policy."],
            ["Reveal", "Publishing the policy and salt after the challenge, which lets anyone re-check every round against the commitment."],
            ["TEE / enclave", "Trusted execution environment (here AWS Nitro). Hardware that runs code without even its operator seeing the data inside."],
            ["CRE", "Chainlink Runtime Environment: the platform that runs Keel's workflow on a decentralized oracle network, with secrets held in a Vault DON."],
          ].map(([term, def], i, arr) => (
            <div
              key={term}
              className={`grid sm:grid-cols-[190px_1fr] gap-x-5 gap-y-1 px-4 py-3 ${i < arr.length - 1 ? "border-b hairline" : ""}`}
            >
              <span className="mono text-[12px] font-semibold text-[color:var(--color-keel-ink)] pt-0.5">
                {term}
              </span>
              <span className="text-[13px] leading-relaxed text-[color:var(--color-ink2)]">
                {def}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="verify-yourself" title="Verify it yourself">
        <P>
          You do not have to trust this site. Three checks, all from public data:
        </P>
        <ol className="flex flex-col gap-3 mb-4">
          {[
            <>The commitment came first. On <a className="link-underline" href={etherscanAddr(DEPLOYMENT.policyCommit)} target="_blank" rel="noreferrer">PolicyCommit</a>, the commit block number precedes the scenario start block. The policy was sealed before the market moved.</>,
            <>Receipts are signed by the committed key. Each receipt on <a className="link-underline" href={etherscanAddr(DEPLOYMENT.receipts)} target="_blank" rel="noreferrer">Receipts</a> recovers to the signer address stored with the commitment, and its action transaction sits at the previous nonce of the same wallet.</>,
            <>The reveal matches. After reveal, hash the revealed policy and salt: it must equal the on-chain commitment. Then recompute each round&apos;s trigger from public PriceUpdate logs and check every action against it. The <Link href="/verify" className="link-underline">Verify page</Link> runs all three checks live, but nothing stops you from doing them by hand.</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed max-w-[70ch]">
              <span className="mono text-[12px] pt-0.5 text-[color:var(--color-keel-ink)]">{i + 1}.</span>
              <span className="text-[color:var(--color-ink2)]">{step}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="run" title="Run it locally">
        <P>
          The repo is public:{" "}
          <a className="link-underline" href={REPO} target="_blank" rel="noreferrer">
            github.com/sairammr/keel
          </a>
          . No policy parameter or salt is committed anywhere in it.
        </P>
        <pre
          className="mono text-[12px] leading-relaxed p-4 overflow-x-auto border"
          style={{ background: "var(--color-panel2)", borderColor: "var(--color-line2)" }}
        >
{`git clone ${REPO} && cd keel && bun install
bun run test          # 44 unit tests: controller + scenario + hunter
bun run e2e           # full lifecycle on a local Anvil chain, ends E2E PASSED
bun run tune          # grid search over policies vs starter baselines
bun run replay --vs starter   # text side-by-side replay
(cd app && bun run dev)       # this site on :3000

# CRE confidential workflow (simulation needs no deploy approval)
cre workflow simulate workflow --target staging-settings \\
  --non-interactive --trigger-index 0`}
        </pre>
        <p className="mono text-[11.5px] mt-3 text-[color:var(--color-muted)]">
          the handler only ever logs one word: COMMITTED / IDLE / SAFE / DEFENDED
        </p>
      </Section>
    </div>
  );
}
