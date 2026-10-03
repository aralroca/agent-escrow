use anchor_lang::prelude::*;

#[constant]
pub const AGENT_SEED: &[u8] = b"agent";

#[constant]
pub const JOB_SEED: &[u8] = b"job";

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

/// Protocol fee, in basis points, taken only from released payments.
#[constant]
pub const FEE_BPS: u64 = 25;

pub const BPS_DENOMINATOR: u64 = 10_000;

/// Bounds, in seconds, for the time an evaluator has to judge a submission.
pub const MIN_REVIEW_WINDOW: i64 = 60;
pub const MAX_REVIEW_WINDOW: i64 = 30 * 24 * 60 * 60;

pub const MAX_NAME_LEN: usize = 32;
pub const MAX_CAPABILITIES_LEN: usize = 128;
pub const MAX_URI_LEN: usize = 200;

/// The only token jobs can be paid in: Circle's USDC on devnet. Accepting any mint would let two
/// colluding wallets build a track record for free with a worthless token.
pub const USDC_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

/// Wallet that owns the token accounts receiving protocol fees.
pub const TREASURY: Pubkey = pubkey!("2goJXc872qgfEEcMC4szM3HAf5u3cUHsR7mdULAfQPHm");
