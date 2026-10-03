# Hackathon submission materials

Crypto World's Fair Hackathon (Colosseum). Deadline: October 12, 2026, 11:59 pm PT.

Everything here must stay true and checkable. Fields marked **[TO FILL]** need information only
the team has; do not invent it.

## Fields

| Field | Value |
| --- | --- |
| Product name | Agent Escrow |
| Tagline | Let your agents hire any agent. Pay only for work that passes. |
| Chains and tools | Solana (devnet), Anchor 1.2, USDC (SPL Token), `@solana/kit`, Codama, Model Context Protocol |
| Track | Solana |
| Repository | https://github.com/aralroca/agent-escrow |
| Live site | https://aralroca.github.io/agent-escrow/ |
| Program | `98UQvVXX8Zm3AGt9V3uiYYTWYFtDUbvEt6MwK2izLhmd` (devnet) |
| npm package | `agent-escrow-mcp` |
| Team, backgrounds, location | **[TO FILL]** |
| Logo | `apps/web/public/favicon.svg` |
| Pitch video (2–3 min) | **[TO FILL: link]** |
| Demo video (≤3 min) | **[TO FILL: link]** |

## One-sentence pitch

Agent Escrow is a Solana escrow for agent-to-agent work where the USDC is released only when the
delivery passes an acceptance test the buyer committed on-chain, and anyone can re-run that test.

## Description

**Problem.** AI agents are starting to hire other agents for data, translation, scraping and code.
Payment rails for agents exist, but they move money before or without checking the work. When two
agents trade, whoever goes first carries the risk: the buyer loses the payment on a bad delivery,
or the seller loses its compute when the buyer walks away.

**Solution.** A job is a Solana account with its own USDC vault. The buyer funds it together with
the SHA-256 hash of an acceptance spec: a JSON document of machine-checkable conditions (JSON
Schema, exact item counts, required terms per item, content hashes). The seller accepts, delivers,
and commits the deliverable by hash. The evaluator runs the spec. If every check passes the seller
is paid, otherwise the buyer is refunded. Because spec and deliverable are committed by hash, the
verdict is reproducible: the site re-runs it in the browser with one click.

**Agent-native.** The whole flow is exposed as an MCP server (`npx agent-escrow-mcp`) with ten
tools, so an agent can find sellers by track record, lock funds, deliver and settle without a
human. Two guards are enforced in code rather than left to the model: a per-job spending cap and
a hiring policy (minimum success rate and paid jobs).

**Reputation.** Every settlement updates the seller's on-chain record: jobs paid, rejected,
expired, and settled volume. There are no reviews; the record is derived from escrows.

**What it does not do.** It does not judge subjective quality, and it has no arbitration yet: the
evaluator is named by the buyer and can be the buyer. We state this in the product and in
`docs/security.md` rather than hide it.

## Why Solana

- The vault is a program-derived account per job, so custody is the program's and nobody else's.
- Create-and-fund, and verify-and-pay, are single atomic transactions.
- Fees are low enough that a 30 USDC job is practical: a full lifecycle is four transactions.
- USDC is native and the stablecoin agents already use on Solana (x402 volume).
- The site needs no backend because every account is readable from a public RPC.

## Technical architecture

- **Program** (`programs/agent_escrow`, Anchor 1.2): accounts `Job` and `AgentProfile`, a token
  vault PDA per job, eight instructions (`register_agent`, `create_job`, `accept`, `submit`,
  `complete`, `reject`, `refund`, `claim_timeout`). 34 LiteSVM tests cover the lifecycle, wrong
  signers, double settlement, account substitution, wrong mints and timing.
- **Checks** (`packages/checks`): the spec runner, pure TypeScript, identical in Node and browser.
- **SDK** (`packages/sdk`): `@solana/kit` client generated from the IDL with Codama, plus helpers.
- **MCP server** (`packages/mcp`): stdio server bundled into one file for `npx`.
- **Site** (`apps/web`): static Vite + React app on GitHub Pages; reads program accounts by RPC.
- **Tests**: unit, end-to-end against a local validator (SDK and MCP), and browser tests
  (Playwright) including a crawl of every link.

## Differentiation

- x402 and its facilitators settle payments but do not condition them on the delivery. Its
  batch-settlement scheme is a metering escrow.
- ERC-8183 (Virtuals ACP) defines the same Client / Provider / Evaluator roles on EVM chains. We
  follow that model on Solana and add the piece it leaves open: the acceptance condition is a
  committed, executable artifact whose verdict anyone can reproduce.
- Existing Solana projects in this space settle on oracle or LLM scoring. We settle only on
  deterministic checks and say what is out of scope.
- Reputation is derived from settled escrows in USDC, not from feedback.

## Business model

A 0.25% protocol fee on released payments, taken in the settling transaction. Refunds are free.
Later: neutral evaluators as a paid service, enterprise hiring policies, arbitration.

## Target user and go-to-market

**User.** Developers building agents that buy or sell work with a checkable output: structured
data, translation with glossaries, extraction, code with tests.

**Wedge.** Jobs worth dollars, not micropayments for API calls, where an escrow costs more than
the payment.

**Distribution.** The MCP server is the product surface: one line in a client config. First
channels are MCP server directories and the Solana and x402 developer communities.

**Demand validation. [TO FILL — only real evidence]** Record here, with links, each developer who
tried it, each job created by someone outside the team, and each piece of feedback. Do not
summarise sentiment; quote it. Until there is evidence, the submission says: "No external users
yet; the product was built during the hackathon."

## Development disclosure

The code was written during the hackathon period with AI coding tools (Claude Code), directed and
reviewed by the team. No prior code was reused.

## Demo script (≤ 3 minutes, real devnet transactions)

1. (0:00) The problem in one line, over the site hero.
2. (0:20) Terminal A, the seller agent: "Register as a translation agent and wait for jobs."
3. (0:40) Terminal B, the buyer agent: the hiring prompt with the budget and the conditions.
   Show `search_agents` and `create_job`; open the job on the site: 30 USDC locked.
4. (1:10) Seller accepts, translates, submits. The site shows the deliverable hash.
5. (1:30) Buyer runs `evaluate_job`: three checks pass, 29.925 USDC paid. Open the explorer link.
6. (1:50) The moment that matters: a second job where the seller returns too few items. The
   check fails, the buyer gets the 30 USDC back with no human involved.
7. (2:20) On the site, press "Verify independently" on the rejected job: the failure is
   reproduced in the browser.
8. (2:40) The seller's profile: one paid job, one rejected, 50% success.

Every screen in the video must correspond to a transaction listed in `docs/e2e.md`.

## Pitch script (2–3 minutes, recorded by the founder)

1. Who you are and why you are building this. **[TO FILL]**
2. The problem: agents hire agents, and somebody has to go first.
3. The insight: you cannot verify arbitrary AI work, so let the buyer fix a machine-checkable bar
   up front and make the money follow the test.
4. Twenty seconds of the demo: pass, then fail and refund.
5. Why now: agent payments are real (x402 volume on Solana), the trust layer is missing.
6. Business: 0.25% on released payments.
7. What is next: neutral evaluators, arbitration, mainnet after an audit.
8. First users and what you learned from them. **[TO FILL — only if real]**

## Checklist before submitting

- [x] Program deployed on devnet and visible in the explorer
- [ ] `docs/e2e.md` has devnet signatures for the full run and the failure paths
- [ ] Site live and `LINKS_EXTERNAL=1 pnpm test:browser` passes
- [ ] `npx -y agent-escrow-mcp` works from a clean directory
- [ ] Repository public, README current
- [ ] Both videos uploaded and reachable without login
- [ ] Every claim above re-read against the product
- [ ] Submission confirmed on Colosseum; confirmation URL recorded below

**Confirmation URL:** [TO FILL]
