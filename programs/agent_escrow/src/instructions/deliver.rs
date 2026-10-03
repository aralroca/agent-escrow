use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{AgentProfile, Job, JobStatus},
};

#[derive(Accounts)]
pub struct Accept<'info> {
    pub provider: Signer<'info>,
    #[account(mut, has_one = provider @ ErrorCode::Unauthorized)]
    pub job: Account<'info, Job>,
    /// Only registered agents can take jobs, so every settlement has a profile to update.
    #[account(seeds = [AGENT_SEED, provider.key().as_ref()], bump = provider_profile.bump)]
    pub provider_profile: Account<'info, AgentProfile>,
}

pub fn handle_accept(ctx: Context<Accept>) -> Result<()> {
    let job = &mut ctx.accounts.job;

    require!(job.status == JobStatus::Funded, ErrorCode::InvalidStatus);
    require!(
        Clock::get()?.unix_timestamp < job.deadline,
        ErrorCode::DeadlinePassed
    );
    job.status = JobStatus::Accepted;

    Ok(())
}

#[derive(Accounts)]
pub struct Submit<'info> {
    pub provider: Signer<'info>,
    #[account(mut, has_one = provider @ ErrorCode::Unauthorized)]
    pub job: Account<'info, Job>,
}

/// Commits the deliverable by hash and starts the review window.
pub fn handle_submit(
    ctx: Context<Submit>,
    result_hash: [u8; 32],
    result_uri: String,
) -> Result<()> {
    let job = &mut ctx.accounts.job;
    let now = Clock::get()?.unix_timestamp;

    require!(job.status == JobStatus::Accepted, ErrorCode::InvalidStatus);
    require!(now <= job.deadline, ErrorCode::DeadlinePassed);
    require!(
        !result_uri.is_empty() && result_uri.len() <= MAX_URI_LEN,
        ErrorCode::InvalidText
    );
    job.result_hash = result_hash;
    job.result_uri = result_uri;
    job.submitted_at = now;
    job.status = JobStatus::Submitted;

    Ok(())
}
