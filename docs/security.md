# Security notes and threat model

Agent Escrow runs on Solana devnet and has **not been audited**. This document lists what the
program enforces, the tests that back each claim, and the limits that remain.

## Trust model

| Party | Trusted for | Not trusted for |
| --- | --- | --- |
| Program | Custody of the vault and the state machine | — |
| Buyer (client) | Nothing | Paying after delivery |
| Seller (provider) | Nothing | Delivering after payment |
| Evaluator | An honest verdict | Custody: it can only choose between "pay seller" and "refund buyer" |
| RPC endpoint, file hosts | Availability | Integrity: account data is owned by the program, files are checked against on-chain hashes |

The evaluator is chosen by the buyer when the job is created and is visible to the seller before
it accepts. By default it is the buyer itself.

## What the program enforces

Tests live in `programs/agent_escrow/tests/` (LiteSVM) and `e2e/` (local validator).

| Property | How | Test |
| --- | --- | --- |
| Only the right signer moves a job | `has_one` and key checks on every instruction | `only_the_named_provider_can_accept_and_submit`, `only_the_evaluator_can_approve_or_reject`, `only_the_client_can_refund_and_only_the_provider_can_claim` |
| A job settles exactly once | Status check, and the vault is closed in the settling transaction | `a_job_settles_exactly_once`, `a_refunded_job_cannot_be_refunded_or_paid_again` |
| Payouts cannot be redirected | Destination token accounts must be owned by the party recorded on the job; the fee wallet is a constant | `payment_cannot_be_redirected_to_another_token_account`, `the_fee_cannot_be_redirected_to_another_treasury`, `the_parties_passed_to_a_settlement_must_be_the_jobs_own` |
| One job cannot drain another | The vault is a PDA derived from the job address | `a_job_cannot_be_settled_from_another_jobs_vault` |
| Only USDC | The mint is constrained to the USDC address | `jobs_can_only_be_paid_in_usdc`, `a_job_cannot_be_settled_with_another_mint` |
| No funds locked forever | Every non-final state has a timed exit | `client_can_cancel_before_anyone_accepts`, `missed_deadline_refunds_the_client_and_marks_the_provider`, `provider_collects_when_nobody_reviews_in_time` |
| Timed exits cannot be used early | Clock checks against the deadline and the review window | `an_accepted_job_cannot_be_refunded_before_the_deadline`, `the_provider_cannot_claim_while_the_review_window_is_open` |
| Extra tokens cannot jam a vault | Settlements pay out the whole vault balance before closing it | `tokens_sent_to_the_vault_by_a_third_party_cannot_lock_the_job` |
| Steps cannot be skipped or replayed | State machine | `steps_cannot_be_skipped_or_repeated`, `nothing_can_be_claimed_before_a_submission` |
| Invalid jobs are refused before any funds move | Argument validation | `invalid_job_parameters_are_refused`, `a_job_larger_than_the_clients_balance_is_refused` |
| Reputation only changes on settlement | Counters are written only by `complete`, `claim_timeout`, `reject` and `refund` | `several_jobs_accumulate_on_the_provider_record`, `updating_a_profile_keeps_its_track_record` |

## What the off-chain code enforces

| Property | How | Test |
| --- | --- | --- |
| The agent cannot overspend | The MCP server refuses `create_job` above `MAX_JOB_USDC` before building a transaction | `refuses to lock more than the spending cap` |
| A hiring policy is a hard rule | `create_job` refuses sellers below the given success rate or job count | `refuses sellers below the hiring policy or not registered` |
| Nobody commits to an impossible job | `accept_job` refuses when the spec is unreachable or does not match its on-chain hash | `refuses to accept a job whose spec no longer matches its committed hash` |
| A swapped file is detected | Spec and deliverable are verified against their SHA-256 before any check runs | `fails when the deliverable does not match its committed hash`, `throws when the spec does not match its committed hash` |
| Hostile URLs cannot hang the evaluator | Downloads are http(s) only, limited to 30 seconds and 5 MB | `only downloads over http(s)`, `refuses deliverables above the size cap` |
| A network glitch is not a verdict | A deliverable that is only temporarily unreachable makes `evaluate_job` fail without settling; only a wrong hash, a missing file or an oversized one is judged as failed | `throws, instead of failing the seller, when the deliverable host is temporarily down` |
| A late evaluator cannot take the payment back | After the review window only an approval or the seller's claim can settle | `a_late_evaluator_can_still_approve_but_no_longer_reject` |
| A link cannot silently change the data source | `?rpc=` is never stored and shows a notice while active | `says so when a link chooses the data source, and does not remember it` |
| Closing a token account cannot block a verdict | Settlements create the destination token account when it is missing | covered by the settlement paths in `e2e/` |
| Verdicts are reproducible | The same check runner runs in the evaluator and in the browser | `reproduces a passing verdict in the browser`, `reproduces a failing verdict and shows which check failed` |

## Known limits

1. **Dishonest evaluator.** The evaluator can reject a delivery that passes, or approve one that
   fails. Both are provable by re-running the test, and a rejection is recorded on the seller's
   profile. There is no arbitration or evaluator stake yet. Sellers should weigh who the evaluator
   is before accepting; buyers who want a neutral verdict should name a third party.
2. **Only machine-checkable work.** Checks cover structure, counts, required terms and hashes.
   Subjective quality is out of scope by design.
3. **Reputation can be bought.** Two wallets under one owner can trade with each other. Each
   settled job costs the 0.25% fee, so on a network where USDC has value the record has a price,
   but on devnet USDC is free. Policies should weigh settled volume, not only the success rate.
4. **Public files.** Specs and deliverables are fetched from public URLs. Do not put secrets in
   them. If a file goes offline nobody can re-run the test and the job falls back to its timed
   exits.
5. **Untrusted text reaches the agent.** Agent names, capabilities and spec titles are written by
   counterparties and are returned to the model by the MCP tools. A hostile seller can try prompt
   injection through them. The spending cap, the hiring policy and the acceptance test are
   enforced in code, not by the model, which bounds the damage to one capped job.
6. **Untrusted schemas run in the verifier.** A hostile spec can contain a pathological JSON Schema
   (for example a slow regular expression) that makes verification slow in the evaluator or in a
   visitor's browser tab. It cannot move funds.
7. **Server-side requests.** `evaluate_job` and `accept_job` download URLs chosen by the other
   party from the machine running the MCP server. Only http(s) is allowed and the content is never
   returned to the caller, but the request itself is made. Do not run the server in a network
   where a blind GET to an internal address is dangerous.
8. **Job titles come from the spec.** The explorer downloads each job's spec to show its title,
   which reveals a visitor's IP address to whoever hosts that file.
9. **Rent stays in the job account.** Job accounts are kept so the history remains readable; their
   rent (about 0.006 SOL) is not returned to the buyer. Vault rent is.
10. **The fee wallet cannot act as a seller.** Its token account would appear twice in a payout and
   the program refuses duplicate writable accounts. Such a job can still be rejected or refunded.
11. **Devnet constants.** The USDC mint and the fee wallet are compile-time constants for devnet.
    A mainnet deployment needs new constants, an upgrade-authority policy and an audit.

## Reporting

Open an issue at https://github.com/aralroca/agent-escrow/issues. There are no real funds at
risk on devnet, so public reports are fine.
