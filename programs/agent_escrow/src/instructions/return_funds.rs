use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{
    constants::*,
    error::ErrorCode,
    state::{AgentProfile, Job, JobStatus},
    vault::Vault,
};

/// Accounts for sending the payment back to the client: rejection, cancellation or expiry.
#[derive(Accounts)]
pub struct ReturnFunds<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = client, has_one = mint)]
    pub job: Account<'info, Job>,
    /// CHECK: bound to the job by `has_one`; only receives the vault rent it paid.
    #[account(mut)]
    pub client: UncheckedAccount<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        seeds = [VAULT_SEED, job.key().as_ref()],
        bump = job.vault_bump,
        token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = client,
        token::token_program = token_program,
    )]
    pub client_token: InterfaceAccount<'info, TokenAccount>,
    /// Required whenever the provider had accepted the job, so its record is updated.
    #[account(
        mut,
        seeds = [AGENT_SEED, job.provider.as_ref()],
        bump = provider_profile.bump,
    )]
    pub provider_profile: Option<Account<'info, AgentProfile>>,
    pub token_program: Interface<'info, TokenInterface>,
}

/// The evaluator rejects the submission.
pub fn handle_reject(ctx: Context<ReturnFunds>) -> Result<()> {
    let job = &ctx.accounts.job;

    require_keys_eq!(
        ctx.accounts.authority.key(),
        job.evaluator,
        ErrorCode::Unauthorized
    );
    require!(job.status == JobStatus::Submitted, ErrorCode::InvalidStatus);
    profile(ctx.accounts)?.jobs_rejected += 1;

    return_funds(ctx, JobStatus::Rejected)
}

/// The client takes the payment back: before anyone accepted, or after a missed deadline.
pub fn handle_refund(ctx: Context<ReturnFunds>) -> Result<()> {
    let job = &ctx.accounts.job;
    let status = job.status;
    let overdue = Clock::get()?.unix_timestamp > job.deadline;

    require_keys_eq!(
        ctx.accounts.authority.key(),
        job.client,
        ErrorCode::Unauthorized
    );
    match status {
        JobStatus::Funded => return_funds(ctx, JobStatus::Refunded),
        JobStatus::Accepted if overdue => {
            profile(ctx.accounts)?.jobs_expired += 1;

            return_funds(ctx, JobStatus::Expired)
        }
        JobStatus::Accepted => err!(ErrorCode::DeadlineNotReached),
        _ => err!(ErrorCode::InvalidStatus),
    }
}

fn profile<'a, 'info>(
    accounts: &'a mut ReturnFunds<'info>,
) -> Result<&'a mut Account<'info, AgentProfile>> {
    accounts
        .provider_profile
        .as_mut()
        .ok_or_else(|| error!(ErrorCode::MissingProfile))
}

fn return_funds(ctx: Context<ReturnFunds>, status: JobStatus) -> Result<()> {
    let accounts = ctx.accounts;
    let vault = Vault {
        job: &accounts.job,
        vault: &accounts.vault,
        mint: &accounts.mint,
        token_program: &accounts.token_program,
    };

    vault.pay(&accounts.client_token, accounts.vault.amount)?;
    vault.close(&accounts.client)?;

    accounts.job.settle(status)
}
