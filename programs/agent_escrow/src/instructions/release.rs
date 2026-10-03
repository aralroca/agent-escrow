use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    constants::*,
    error::ErrorCode,
    state::{AgentProfile, Job, JobStatus},
    vault::Vault,
};

/// Accounts for paying the provider: by evaluator approval or by review timeout.
#[derive(Accounts)]
pub struct Release<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, has_one = client, has_one = provider, has_one = mint)]
    pub job: Account<'info, Job>,
    /// CHECK: bound to the job by `has_one`; only receives the vault rent it paid.
    #[account(mut)]
    pub client: UncheckedAccount<'info>,
    /// CHECK: bound to the job by `has_one`; only used to derive the accounts below.
    pub provider: UncheckedAccount<'info>,
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
        token::authority = provider,
        token::token_program = token_program,
    )]
    pub provider_token: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: fixed protocol address.
    #[account(address = TREASURY)]
    pub treasury: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = treasury,
        associated_token::token_program = token_program,
    )]
    pub treasury_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [AGENT_SEED, provider.key().as_ref()],
        bump = provider_profile.bump,
    )]
    pub provider_profile: Account<'info, AgentProfile>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// The evaluator approves the submission.
pub fn handle_complete(ctx: Context<Release>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.authority.key(),
        ctx.accounts.job.evaluator,
        ErrorCode::Unauthorized
    );

    release(ctx, JobStatus::Completed)
}

/// The provider collects once the review window closed without a verdict.
pub fn handle_claim_timeout(ctx: Context<Release>) -> Result<()> {
    let job = &ctx.accounts.job;
    let review_ends = job.review_ends()?;

    require_keys_eq!(
        ctx.accounts.authority.key(),
        job.provider,
        ErrorCode::Unauthorized
    );
    require!(
        Clock::get()?.unix_timestamp > review_ends,
        ErrorCode::ReviewWindowOpen
    );

    release(ctx, JobStatus::Claimed)
}

fn protocol_fee(amount: u64) -> Option<u64> {
    amount
        .checked_mul(FEE_BPS)
        .map(|scaled| scaled / BPS_DENOMINATOR)
}

fn release(ctx: Context<Release>, status: JobStatus) -> Result<()> {
    let accounts = ctx.accounts;
    let fee = protocol_fee(accounts.job.amount).ok_or(ErrorCode::Overflow)?;
    // Paying out the whole balance keeps the vault closable even if someone sent it extra tokens.
    let payout = accounts
        .vault
        .amount
        .checked_sub(fee)
        .ok_or(ErrorCode::Overflow)?;
    let vault = Vault {
        job: &accounts.job,
        vault: &accounts.vault,
        mint: &accounts.mint,
        token_program: &accounts.token_program,
    };

    require!(
        accounts.job.status == JobStatus::Submitted,
        ErrorCode::InvalidStatus
    );
    vault.pay(&accounts.provider_token, payout)?;
    if fee > 0 {
        vault.pay(&accounts.treasury_token, fee)?;
    }
    vault.close(&accounts.client)?;

    accounts.provider_profile.jobs_completed += 1;
    accounts.provider_profile.volume_settled = accounts
        .provider_profile
        .volume_settled
        .saturating_add(accounts.job.amount);

    accounts.job.settle(status)
}
