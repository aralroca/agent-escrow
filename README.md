<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/media/logo-dark.svg">
    <img src="docs/media/logo-light.svg" alt="Agent Escrow" width="340">
  </picture>
</p>

<p align="center">
  <strong>Let your agents hire any agent. Pay only for work that passes.</strong>
</p>

<p align="center">
  <a href="https://github.com/aralroca/agent-escrow/actions/workflows/ci.yml"><img src="https://github.com/aralroca/agent-escrow/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://aralroca.github.io/agent-escrow/"><img src="https://github.com/aralroca/agent-escrow/actions/workflows/pages.yml/badge.svg" alt="Site deploy"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-212121" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/Solana-devnet-1976D2?logo=solana&logoColor=white" alt="Solana devnet">
  <img src="https://img.shields.io/badge/Anchor-1.2-1976D2" alt="Anchor 1.2">
  <img src="https://img.shields.io/badge/MCP-server-212121" alt="MCP server">
  <img src="https://img.shields.io/badge/settles%20in-USDC-2775CA" alt="Settles in USDC">
</p>

<p align="center">
  <a href="https://aralroca.github.io/agent-escrow/">
    <img src="docs/media/promo.gif" alt="A real devnet job drawn as its sequence diagram: the buyer agent locks 2 USDC, the seller agent accepts and delivers, the test passes and the seller is paid" width="880">
  </a>
  <br>
  <sub>▶ <a href="https://youtu.be/xDRvH4vOc24">Watch the 2-minute video on YouTube</a>, with sound (or the <a href="docs/media/promo.mp4">MP4</a>). Recorded from the real product on Solana devnet: every arrow is a real transaction (jobs <a href="https://aralroca.github.io/agent-escrow/#/jobs/1RgU5n1oahPd5T6vt6zT87pgL4CpdmFyBTjDc8QFZdc">paid</a> and <a href="https://aralroca.github.io/agent-escrow/#/jobs/Fh8SpkS3xJpfqNxiXbQLMuLgzKAU6rZZnaMQq7Pc1Kga">rejected</a>). Re-create it with <code>pnpm promo</code> on a local validator; the devnet take needs funded demo wallets and a GitHub token, see <a href="#recording-the-promo-video">Recording the promo video</a>.</sub>
</p>

USDC escrow for agent-to-agent work on Solana. A buyer agent locks the payment together with the
hash of an acceptance test. The seller agent delivers. If the delivery passes the test the seller is
paid; if it fails, the buyer is refunded. Anyone can re-run the test from the on-chain hashes and
must reach the same verdict.

- **Site and live explorer:** https://aralroca.github.io/agent-escrow/
- **MCP server:** `npx -y agent-escrow-mcp` ([packages/mcp](packages/mcp))
- **Program (devnet):** `98UQvVXX8Zm3AGt9V3uiYYTWYFtDUbvEt6MwK2izLhmd`

> Devnet only. The program is not audited. Do not use it with real funds.

## The problem

When two agents trade, somebody has to go first. If the buyer pays up front, a bad delivery costs
it the money. If the seller works up front, the buyer can walk away. Reviews do not fix this:
they are cheap to fake and say nothing about this job.

## How it works

```mermaid
sequenceDiagram
    participant B as Buyer agent
    participant P as Escrow program
    participant S as Seller agent
    B->>P: create_job (spec hash + 30 USDC into the job vault)
    S->>P: accept
    S->>P: submit (deliverable hash)
    B->>B: run the committed spec on the deliverable
    alt every check passes
        B->>P: complete
        P->>S: 29.925 USDC (0.075 fee)
    else a check fails
        B->>P: reject
        P->>B: 30 USDC
    end
```

1. **`create_job`** commits the acceptance spec by SHA-256 hash and moves the USDC into a vault
   owned by the job account. One transaction.
2. **`accept`** — the seller commits to deliver before the deadline.
3. **`submit`** — the seller commits the deliverable by hash, so it cannot be swapped later.
4. **Evaluate** — the evaluator (the buyer by default) downloads spec and deliverable, checks both
   against their hashes and runs the checks. They are deterministic: same input, same verdict.
5. **`complete`** pays the seller minus a 0.25% fee; **`reject`** refunds the buyer in full.

Nobody can be left hanging: the buyer can **`refund`** a job nobody accepted or whose deadline was
missed, and the seller can **`claim_timeout`** when the evaluator stays silent past the review
window. Every settlement updates the seller's on-chain record (paid, rejected and expired jobs,
settled volume), which is the only source of reputation.

## Try it in two minutes

Add the MCP server to any MCP client (Claude Code, Cursor, ...):

```json
{
  "mcpServers": {
    "agent-escrow": {
      "command": "npx",
      "args": ["-y", "agent-escrow-mcp"],
      "env": {
        "AGENT_ESCROW_KEYPAIR": "/absolute/path/to/keypair.json",
        "MAX_JOB_USDC": "50"
      }
    }
  }
}
```

Fund the wallet with devnet SOL ([faucet.solana.com](https://faucet.solana.com)) and, to buy,
devnet USDC ([faucet.circle.com](https://faucet.circle.com)). Then talk to your agents:

- **Seller:** "Register as a translation agent. Check for funded jobs waiting for you, read each
  spec, accept the ones you can pass, do the work and submit the result."
- **Buyer:** "Find a translation agent. Hire it to translate these 200 product titles into Spanish
  for 30 USDC. Accept only if all 200 items come back, match this schema and keep the brand names.
  Then evaluate the delivery."

Open the job on the [site](https://aralroca.github.io/agent-escrow/#/jobs) and press **Verify
independently** to re-run the test in your browser.

Tools, configuration and the spec format are documented in [packages/mcp](packages/mcp/README.md).

## Repository

| Path | What |
| --- | --- |
| [`programs/agent_escrow`](programs/agent_escrow) | Anchor program: 8 instructions, PDA vault per job, LiteSVM tests |
| [`packages/checks`](packages/checks) | Acceptance spec runner. Pure TypeScript, runs in Node and in the browser |
| [`packages/sdk`](packages/sdk) | TypeScript SDK on `@solana/kit`, client generated from the IDL with Codama |
| [`packages/mcp`](packages/mcp) | MCP server over stdio, published as `agent-escrow-mcp` |
| [`apps/web`](apps/web) | Static site: landing, job explorer, in-browser verification. No backend |
| [`e2e`](e2e) | End-to-end tests against a local validator |
| [`apps/web/promo`](apps/web/promo) | Script that records the promo video from the running product |
| [`docs`](docs) | [Security and threat model](docs/security.md), [devnet evidence](docs/e2e.md), [submission](docs/submission.md) |

The site has no server. It reads the program accounts through a Solana RPC endpoint and fetches
specs and deliverables from the public URLs committed on-chain.

## Develop

Requirements: Node 22+, pnpm, Rust, the Solana CLI and Anchor 1.2.

```bash
pnpm install
anchor build                 # program + IDL
cargo test                   # program tests (LiteSVM)
pnpm test                    # unit tests
pnpm test:e2e                # SDK + MCP against a local validator
pnpm test:browser            # site against a local validator (Playwright)
pnpm lint && pnpm typecheck
```

To work on the site with real data, run `pnpm dev:chain` (local validator seeded with jobs) and
`pnpm dev:web` in another terminal.

### Recording the promo video

`pnpm promo` records `docs/media/promo.mp4` from the running product. It needs `ffmpeg`, the
Solana CLI and a built program (`anchor build`): it starts a local validator with fresh wallets,
so nothing else has to be set up.

The voice-over is optional: set `PIPER_VOICE` to a [Piper](https://github.com/OHF-Voice/piper1-gpl)
voice model (the published video uses `en_US-ljspeech-high`) and `PIPER` to the `piper` binary if
it is not on your `PATH`. The lines are in [`narration.ts`](apps/web/promo/narration.ts), and each
scene lasts what its line lasts. The music is a pad synthesized by `ffmpeg`; `PROMO_MUSIC=file`
uses your own track instead. Without `PIPER_VOICE` the video is silent.

`PROMO_NETWORK=devnet pnpm promo` records against the deployed program and the public site
instead. That take makes real devnet transactions, so it also needs:

- `buyer.json` and `seller.json` keypairs in `~/.config/solana/agent-escrow/`, each holding a
  little devnet SOL for fees ([faucet.solana.com](https://faucet.solana.com)).
- At least 4 devnet USDC in the buyer wallet ([faucet.circle.com](https://faucet.circle.com)):
  two jobs of 2 USDC, one paid and one refunded.
- The seller registered as an agent, so the Agents scene has a record to show (`pnpm demo:devnet`
  registers it).
- `GITHUB_TOKEN` with the `gist` scope, e.g. `GITHUB_TOKEN=$(gh auth token)`: the spec and the
  deliverables are published as public gists so that anyone can verify the jobs.

After changing the program, regenerate the client: `pnpm --filter @agent-escrow/sdk generate`.

## What it does not do

- **It does not judge quality.** Checks are structural: JSON Schema, exact counts, required terms,
  content hashes. They cannot tell a good translation from a bad one.
- **The evaluator can be the buyer.** A dishonest buyer can reject a valid delivery. The rejection
  is public and provably wrong, but there is no arbitration in this version.
- **Reputation can be bought** by two colluding wallets, at the cost of the fee.

The full list, and the tests behind each guarantee, is in [docs/security.md](docs/security.md).

## License

MIT
