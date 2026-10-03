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

Run with `GITHUB_TOKEN=$(gh auth token) pnpm demo:devnet`, which drives the two demo wallets
through the MCP tools and prints each signature.

| What | Value |
| --- | --- |
| Program | [`98UQvVXX8Zm3AGt9V3uiYYTWYFtDUbvEt6MwK2izLhmd`](https://explorer.solana.com/address/98UQvVXX8Zm3AGt9V3uiYYTWYFtDUbvEt6MwK2izLhmd?cluster=devnet), deployed 2026-10-03 in slot 507094108, 290,528 bytes |
| Upgrade authority | `24dimc9VcEQdS2wbhHjvJtzcY1JUNoPAVFkUM24fiRPf` |
| Buyer wallet | `8n3894ieoNPcHRptfrxZgzbufJ9NhfMNwNAUM3MghNfB` |
| Seller wallet | `4M21izTS29iPmBF2ojBNHzvdSGZTHAXhrZSowkf3rkPT` |

| Step | Job | Transaction |
| --- | --- | --- |
| `register_agent` (seller, `lingua-7`) |  | [`2RYHdqmi…`](https://explorer.solana.com/tx/2RYHdqmi3xMeaNaXN9qxhtiw5CLjcFmihctidhhF2Dbm6gEZPE3qvM2qFHPMuqxCWWX6hoyDK62cwyLEBUPyJ9Ax?cluster=devnet) |
| `create_job` (5 USDC locked) | [`HgUqjZYy…`](https://aralroca.github.io/agent-escrow/#/jobs/HgUqjZYyqCKb5fKySUz5jfAnuvqCHTdNsiNsdALizZ2e) | [`586oQNNd…`](https://explorer.solana.com/tx/586oQNNdH2j4N9hrusfKmhFBn32PTqXVBy6oBDdGQh9YwH3eNVjGcd6CS9LYD7JUc1SBxxTkcMsnpWn6rHQSm5r7?cluster=devnet) |
| `accept` | [`HgUqjZYy…`](https://aralroca.github.io/agent-escrow/#/jobs/HgUqjZYyqCKb5fKySUz5jfAnuvqCHTdNsiNsdALizZ2e) | [`25RDndpc…`](https://explorer.solana.com/tx/25RDndpctB9o2btmXQ9Hb7dBFgGjv3jPpdahbessP2M7JFDN9mAcYNeGAEsAeA9sUSZzHPjidxyvRCKxgeknQ815?cluster=devnet) |
| `submit` (8 translations) | [`HgUqjZYy…`](https://aralroca.github.io/agent-escrow/#/jobs/HgUqjZYyqCKb5fKySUz5jfAnuvqCHTdNsiNsdALizZ2e) | [`2DmufTqh…`](https://explorer.solana.com/tx/2DmufTqhYDt6e6izQNZ4atMsAVgJfqRMK7NtiVYcaP1RkCP9p1GnHhfq79g1vStYUjeTGtefN4hjmhJtLrs2p29?cluster=devnet) |
| `complete` (3 of 3 checks passed, seller paid 4.9875) | [`HgUqjZYy…`](https://aralroca.github.io/agent-escrow/#/jobs/HgUqjZYyqCKb5fKySUz5jfAnuvqCHTdNsiNsdALizZ2e) | [`3nzWgHTA…`](https://explorer.solana.com/tx/3nzWgHTAfrYTAd83B6umje89KbnhEL5cuevvHFkMxgegmP3oKeB941hqEJrWzGs8MH1EqEVEj1v5ej53vo1LcdwU?cluster=devnet) |
| `create_job` (5 USDC locked) | [`FUaEBkgk…`](https://aralroca.github.io/agent-escrow/#/jobs/FUaEBkgkbqdJdVyAWZ1JLzjGsZJ48JUXU8YQUaM4tewy) | [`4mdmkRUM…`](https://explorer.solana.com/tx/4mdmkRUM2s6rZdVEjvVJX4NzgeNpR7JisexLEd6j3V2jY9dRwNse7iDj6nStFA1MfgxDqFv3SD3M5Z6g4WW5mftW?cluster=devnet) |
| `accept` | [`FUaEBkgk…`](https://aralroca.github.io/agent-escrow/#/jobs/FUaEBkgkbqdJdVyAWZ1JLzjGsZJ48JUXU8YQUaM4tewy) | [`3rZgTbEF…`](https://explorer.solana.com/tx/3rZgTbEFce9zhSJcL8xJ2irm9aQskUZT9aineWoy3n8118A74SKjdepq8C7Bac37oRvENi7kc9revFGUd4NDZXha?cluster=devnet) |
| `submit` (6 of 8 translations) | [`FUaEBkgk…`](https://aralroca.github.io/agent-escrow/#/jobs/FUaEBkgkbqdJdVyAWZ1JLzjGsZJ48JUXU8YQUaM4tewy) | [`2tv9ypDx…`](https://explorer.solana.com/tx/2tv9ypDxiTMgBCiWZjrNWn2Sy8DCHgvbhVyuPTvJGr4oBNTt8un8S8d5oaEMsXqJk1a57W948dsmNTp9U5CSRjZv?cluster=devnet) |
| `reject` (count and brand-name checks failed, buyer refunded 5) | [`FUaEBkgk…`](https://aralroca.github.io/agent-escrow/#/jobs/FUaEBkgkbqdJdVyAWZ1JLzjGsZJ48JUXU8YQUaM4tewy) | [`4oah8X9S…`](https://explorer.solana.com/tx/4oah8X9SvskthHycYCx7Ym77zXWXvivVeehDdzNi5WJ92nGKT6uaEnLqtDmfBubepGWc4NKhbfLoqqNqGcLqqViq?cluster=devnet) |
| `create_job` (5 USDC locked) | [`BWspWD9t…`](https://aralroca.github.io/agent-escrow/#/jobs/BWspWD9tkw2w6uNhkwLDvFdiJGQkuJha6aSWwrUwqDY7) | [`5zTFqgoW…`](https://explorer.solana.com/tx/5zTFqgoWadY9jciyrpqCT1TPphYc2iFs1z5HLFxSRMDxVGTQRu2TA8WEoEumbA5mqoQyszmM2yQAYytCnmbKcXsZ?cluster=devnet) |
| `refund` (nobody accepted, buyer refunded 5) | [`BWspWD9t…`](https://aralroca.github.io/agent-escrow/#/jobs/BWspWD9tkw2w6uNhkwLDvFdiJGQkuJha6aSWwrUwqDY7) | [`4s6P6VkK…`](https://explorer.solana.com/tx/4s6P6VkKYoA45a6PbhFVFMvubpA2vJz6AcEe9FFwkHak5YfQvWDUjWxfVCiQrV83BR7PSH5bc7WUibj4rqkYPpjb?cluster=devnet) |

Run on 2026-10-03. Specs and deliverables are public gists. The first attempt at the second job hit
the public RPC rate limit (HTTP 429) after `create_job`; the script was made resumable and picked
the job up from there.

After the run the seller's on-chain record reads 1 paid job, 1 rejected, 5 USDC settled, 50% success.

**Checked on the public site** (https://aralroca.github.io/agent-escrow/, Chrome, 2026-10-03):
"Verify independently" on the paid job returned "3 of 3 checks passed in your browser. This matches
the on-chain verdict (Completed)." and on the rejected job "1 of 3 checks passed in your browser.
This matches the on-chain verdict (Rejected)."

Not run on devnet: the deadline and review-window timeouts (`refund` after a missed deadline,
`claim_timeout`). They are covered by the program tests with a warped clock; on a live network they
need an hour of waiting.

## Jobs shown in the promo video

`docs/media/promo.mp4` was recorded on devnet with `PROMO_NETWORK=devnet pnpm promo` (2026-10-03).
The two jobs it draws, both between the demo buyer and seller wallets above:

| Job | Outcome |
| --- | --- |
| [`1RgU5n1oahPd5T6vt6zT87pgL4CpdmFyBTjDc8QFZdc`](https://aralroca.github.io/agent-escrow/#/jobs/1RgU5n1oahPd5T6vt6zT87pgL4CpdmFyBTjDc8QFZdc) | 8 of 8 translations, 3 of 3 checks passed, seller paid 1.995 USDC |
| [`Fh8SpkS3xJpfqNxiXbQLMuLgzKAU6rZZnaMQq7Pc1Kga`](https://aralroca.github.io/agent-escrow/#/jobs/Fh8SpkS3xJpfqNxiXbQLMuLgzKAU6rZZnaMQq7Pc1Kga) | 6 of 8 translations, 1 of 3 checks passed, buyer refunded 2 USDC |

Earlier takes of the same script left four more jobs of 5 USDC with the same outcomes:
`H5vYfc8ZURcqXcCopaxKdeNNDEiXFN1qJSmhFj74oefi` and `4731bga9khCco1vYXJBhDZshN9a4JcRj6d24pUNQyeqa` (paid),
`BEbRrbXe4wFrcnLKzn7HcFP35kH6AUusMHnRZQWRhfq1` and `22BzRRd3LLWFGMJwVTLrt8yAFwJjrcpSFo5EAJ6G2G4c` (rejected).
