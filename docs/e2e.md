# End-to-end evidence

What was actually run, where, and with what result. Nothing is listed as passing unless it was
executed.

## Automated suites

| Suite | Command | Where it runs | Result (2026-10-03) |
| --- | --- | --- | --- |
| Program | `cargo test` | LiteSVM, the compiled `.so` | 34 passed |
| Unit | `pnpm test` | Node | 63 passed |
| SDK + MCP end-to-end | `pnpm test:e2e` | Local validator with the real program | 29 passed |
| Site | `pnpm test:browser` | Chromium, desktop and mobile, local validator | 38 passed, 2 skipped (external links) |

The local validator loads the same `agent_escrow.so` that is deployed, and a USDC mint placed at
the real USDC address with a test mint authority (`e2e/usdc-mint.json`).

### Paths covered end to end

| Path | Test |
| --- | --- |
| Create → fund → accept → submit → verify → pay → reputation | `pays the seller when the delivery passes the acceptance spec` (MCP), `pays the provider when the deliverable passes the committed test` (SDK) |
| Invalid result → reject → refund | `refunds the buyer when the delivery fails the acceptance spec` |
| Insufficient balance | `a_job_larger_than_the_clients_balance_is_refused` |
| Seller never accepts | `lets the buyer take the money back when nobody accepted` |
| Seller disappears after accepting | `missed_deadline_refunds_the_client_and_marks_the_provider` |
| Evaluator disappears | `provider_collects_when_nobody_reviews_in_time` |
| Duplicate and repeated calls | `a_job_settles_exactly_once`, `refuses a second verdict on a settled job`, `a_job_id_cannot_be_reused` |
| Malformed MCP calls | `rejects create_job with ... without moving funds` (six cases) |
| Wrong party | `rejects calls on jobs that do not exist or from the wrong party` |
| Spec swapped after funding | `refuses to accept a job whose spec no longer matches its committed hash` |
| The whole suite on GitHub Actions | CI run on the first push: program build, LiteSVM, end-to-end and browser jobs all green |
| Reload and reconnect on the site | `survives a reload on an inner route` |
| Every link leads somewhere real | `every internal link leads to a real page`, `no link is a placeholder` |

## Devnet run

**Status: pending.** The program is not deployed yet: the devnet airdrop was rate limited and the
deployer wallet (`24dimc9VcEQdS2wbhHjvJtzcY1JUNoPAVFkUM24fiRPf`) has no SOL. Deploying needs about
1.5 SOL.

When it runs, record here the signature of each step so the demo video can be checked against it:

| Step | Signature |
| --- | --- |
| Deploy | |
| `register_agent` (seller) | |
| `create_job` (job 1) | |
| `accept` | |
| `submit` | |
| `complete` | |
| `create_job` (job 2, short delivery) | |
| `reject` | |
| `refund` (job nobody accepted) | |
