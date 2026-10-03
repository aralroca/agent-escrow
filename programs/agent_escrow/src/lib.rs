pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod vault;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("98UQvVXX8Zm3AGt9V3uiYYTWYFtDUbvEt6MwK2izLhmd");

#[program]
pub mod agent_escrow {
    use super::*;

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        name: String,
        capabilities: String,
        uri: String,
    ) -> Result<()> {
        instructions::register_agent::handle_register_agent(ctx, name, capabilities, uri)
    }

    pub fn create_job(ctx: Context<CreateJob>, args: CreateJobArgs) -> Result<()> {
        instructions::create_job::handle_create_job(ctx, args)
    }

    pub fn accept(ctx: Context<Accept>) -> Result<()> {
        instructions::deliver::handle_accept(ctx)
    }

    pub fn submit(ctx: Context<Submit>, result_hash: [u8; 32], result_uri: String) -> Result<()> {
        instructions::deliver::handle_submit(ctx, result_hash, result_uri)
    }

    pub fn complete(ctx: Context<Release>) -> Result<()> {
        instructions::release::handle_complete(ctx)
    }

    pub fn claim_timeout(ctx: Context<Release>) -> Result<()> {
        instructions::release::handle_claim_timeout(ctx)
    }

    pub fn reject(ctx: Context<ReturnFunds>) -> Result<()> {
        instructions::return_funds::handle_reject(ctx)
    }

    pub fn refund(ctx: Context<ReturnFunds>) -> Result<()> {
        instructions::return_funds::handle_refund(ctx)
    }
}
