use anchor_lang::prelude::*;

use crate::constants::*;

/// Public identity and track record of an agent. Counters only change when a job settles.
#[account]
#[derive(InitSpace)]
pub struct AgentProfile {
    pub authority: Pubkey,
    #[max_len(MAX_NAME_LEN)]
    pub name: String,
    /// Comma-separated capability tags, e.g. "translation,localization".
    #[max_len(MAX_CAPABILITIES_LEN)]
    pub capabilities: String,
    #[max_len(MAX_URI_LEN)]
    pub uri: String,
    /// Jobs paid out, by evaluator approval or by review timeout.
    pub jobs_completed: u32,
    /// Submissions the evaluator rejected.
    pub jobs_rejected: u32,
    /// Jobs accepted but not delivered before the deadline.
    pub jobs_expired: u32,
    /// Total amount of the jobs paid out, in the smallest unit of each mint.
    pub volume_settled: u64,
    pub registered_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum JobStatus {
    /// Created and funded; waiting for the provider to accept.
    Funded,
    /// The provider committed to deliver before the deadline.
    Accepted,
    /// A result was submitted; the review window is running.
    Submitted,
    /// The evaluator approved; the provider was paid.
    Completed,
    /// The evaluator rejected; the client was refunded.
    Rejected,
    /// The client cancelled before anyone accepted.
    Refunded,
    /// The provider missed the deadline; the client was refunded.
    Expired,
    /// Nobody judged in time; the provider collected the payment.
    Claimed,
}

/// Fixed-size fields come first so RPC `memcmp` filters can target the parties and the status;
/// the variable-length URIs go last.
#[account]
#[derive(InitSpace)]
pub struct Job {
    pub client: Pubkey,
    pub provider: Pubkey,
    pub evaluator: Pubkey,
    pub mint: Pubkey,
    pub job_id: u64,
    pub amount: u64,
    /// Unix time by which the provider must submit.
    pub deadline: i64,
    /// Seconds the evaluator has to judge after a submission.
    pub review_window: i64,
    pub created_at: i64,
    pub submitted_at: i64,
    pub settled_at: i64,
    pub status: JobStatus,
    pub bump: u8,
    pub vault_bump: u8,
    /// sha256 of the acceptance spec, fixed when the job is funded.
    pub spec_hash: [u8; 32],
    /// sha256 of the deliverable, set on submit.
    pub result_hash: [u8; 32],
    #[max_len(MAX_URI_LEN)]
    pub spec_uri: String,
    #[max_len(MAX_URI_LEN)]
    pub result_uri: String,
}

impl Job {
    /// Records the final status of the job and when it was reached.
    pub fn settle(&mut self, status: JobStatus) -> Result<()> {
        self.status = status;
        self.settled_at = Clock::get()?.unix_timestamp;

        Ok(())
    }
}
