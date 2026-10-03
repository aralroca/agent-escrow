use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Job, JobStatus},
};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateJobArgs {
    pub job_id: u64,
    pub provider: Pubkey,
    pub evaluator: Pubkey,
    pub amount: u64,
    pub spec_hash: [u8; 32],
    pub spec_uri: String,
    pub deadline: i64,
    pub review_window: i64,
}

#[derive(Accounts)]
#[instruction(args: CreateJobArgs)]
pub struct CreateJob<'info> {
    #[account(mut)]
    pub client: Signer<'info>,
    #[account(
        init,
        payer = client,
        space = 8 + Job::INIT_SPACE,
        seeds = [JOB_SEED, client.key().as_ref(), &args.job_id.to_le_bytes()],
        bump,
    )]
    pub job: Account<'info, Job>,
    #[account(address = USDC_MINT @ ErrorCode::UnsupportedMint)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = client,
        token::token_program = token_program,
    )]
    pub client_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init,
        payer = client,
        seeds = [VAULT_SEED, job.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = job,
        token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

fn validate(args: &CreateJobArgs, client: Pubkey, now: i64) -> Result<()> {
    let window = MIN_REVIEW_WINDOW..=MAX_REVIEW_WINDOW;

    require!(args.amount > 0, ErrorCode::InvalidAmount);
    require!(args.deadline > now, ErrorCode::InvalidDeadline);
    require!(
        window.contains(&args.review_window),
        ErrorCode::InvalidReviewWindow
    );
    require!(
        args.provider != client && args.provider != args.evaluator,
        ErrorCode::InvalidParties
    );
    require!(
        !args.spec_uri.is_empty() && args.spec_uri.len() <= MAX_URI_LEN,
        ErrorCode::InvalidText
    );

    Ok(())
}

/// Creates the job and locks the payment in its vault, in one transaction.
pub fn handle_create_job(ctx: Context<CreateJob>, args: CreateJobArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let deposit = TransferChecked {
        from: ctx.accounts.client_token.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.client.to_account_info(),
    };

    validate(&args, ctx.accounts.client.key(), now)?;
    token_interface::transfer_checked(
        CpiContext::new(ctx.accounts.token_program.key(), deposit),
        args.amount,
        ctx.accounts.mint.decimals,
    )?;
    ctx.accounts.job.set_inner(Job {
        client: ctx.accounts.client.key(),
        provider: args.provider,
        evaluator: args.evaluator,
        mint: ctx.accounts.mint.key(),
        job_id: args.job_id,
        amount: args.amount,
        spec_hash: args.spec_hash,
        spec_uri: args.spec_uri,
        result_hash: [0; 32],
        result_uri: String::new(),
        deadline: args.deadline,
        review_window: args.review_window,
        created_at: now,
        submitted_at: 0,
        settled_at: 0,
        status: JobStatus::Funded,
        bump: ctx.bumps.job,
        vault_bump: ctx.bumps.vault,
    });

    Ok(())
}
