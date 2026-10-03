use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::AgentProfile};

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + AgentProfile::INIT_SPACE,
        seeds = [AGENT_SEED, authority.key().as_ref()],
        bump,
    )]
    pub profile: Account<'info, AgentProfile>,
    pub system_program: Program<'info, System>,
}

/// Creates the agent profile, or updates its public fields without touching the counters.
pub fn handle_register_agent(
    ctx: Context<RegisterAgent>,
    name: String,
    capabilities: String,
    uri: String,
) -> Result<()> {
    let profile = &mut ctx.accounts.profile;

    require!(
        !name.is_empty() && name.len() <= MAX_NAME_LEN,
        ErrorCode::InvalidText
    );
    require!(
        capabilities.len() <= MAX_CAPABILITIES_LEN,
        ErrorCode::InvalidText
    );
    require!(uri.len() <= MAX_URI_LEN, ErrorCode::InvalidText);

    if profile.authority == Pubkey::default() {
        profile.authority = ctx.accounts.authority.key();
        profile.registered_at = Clock::get()?.unix_timestamp;
        profile.bump = ctx.bumps.profile;
    }
    profile.name = name;
    profile.capabilities = capabilities;
    profile.uri = uri;

    Ok(())
}
