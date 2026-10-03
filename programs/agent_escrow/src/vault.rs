use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, CloseAccount, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{constants::JOB_SEED, state::Job};

/// The accounts every settlement needs to move funds out of a job vault.
pub struct Vault<'a, 'info> {
    pub job: &'a Account<'info, Job>,
    pub vault: &'a InterfaceAccount<'info, TokenAccount>,
    pub mint: &'a InterfaceAccount<'info, Mint>,
    pub token_program: &'a Interface<'info, TokenInterface>,
}

impl<'info> Vault<'_, 'info> {
    /// Runs a token-program call signed by the job account, which owns the vault.
    fn signed<A, T>(
        &self,
        accounts: A,
        call: impl FnOnce(CpiContext<'_, '_, '_, 'info, A>) -> Result<T>,
    ) -> Result<T>
    where
        A: ToAccountMetas + ToAccountInfos<'info>,
    {
        let job_id = self.job.job_id.to_le_bytes();
        let bump = [self.job.bump];
        let seeds: &[&[u8]] = &[JOB_SEED, self.job.client.as_ref(), &job_id, &bump];

        call(CpiContext::new_with_signer(
            self.token_program.key(),
            accounts,
            &[seeds],
        ))
    }

    pub fn pay(&self, to: &InterfaceAccount<'info, TokenAccount>, amount: u64) -> Result<()> {
        let accounts = TransferChecked {
            from: self.vault.to_account_info(),
            mint: self.mint.to_account_info(),
            to: to.to_account_info(),
            authority: self.job.to_account_info(),
        };

        self.signed(accounts, |cpi| {
            token_interface::transfer_checked(cpi, amount, self.mint.decimals)
        })
    }

    /// Closes the emptied vault and returns its rent to the client who paid for it.
    pub fn close(&self, client: &AccountInfo<'info>) -> Result<()> {
        let accounts = CloseAccount {
            account: self.vault.to_account_info(),
            destination: client.clone(),
            authority: self.job.to_account_info(),
        };

        self.signed(accounts, token_interface::close_account)
    }
}
