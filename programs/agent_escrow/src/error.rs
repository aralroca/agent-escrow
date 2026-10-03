use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("The signer is not allowed to perform this action on the job")]
    Unauthorized,
    #[msg("The job is not in the status this action requires")]
    InvalidStatus,
    #[msg("The amount must be greater than zero")]
    InvalidAmount,
    #[msg("The deadline must be in the future")]
    InvalidDeadline,
    #[msg("The review window is outside the allowed range")]
    InvalidReviewWindow,
    #[msg("The provider must differ from the client and from the evaluator")]
    InvalidParties,
    #[msg("Text field is empty or longer than allowed")]
    InvalidText,
    #[msg("The submission deadline has passed")]
    DeadlinePassed,
    #[msg("The submission deadline has not passed yet")]
    DeadlineNotReached,
    #[msg("The review window is still open")]
    ReviewWindowOpen,
    #[msg("Jobs can only be paid in USDC")]
    UnsupportedMint,
    #[msg("The provider profile account is required")]
    MissingProfile,
    #[msg("Arithmetic overflow")]
    Overflow,
}
