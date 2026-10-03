mod common;

use {
    agent_escrow::{instruction, JobStatus},
    common::*,
    litesvm_token::Transfer,
    solana_signer::Signer,
};

const AMOUNT: u64 = 30 * USDC;
const FEE: u64 = AMOUNT * 25 / 10_000;

#[test]
fn create_job_locks_the_payment_in_the_vault() {
    let mut env = Env::new();

    env.create_job(1, AMOUNT).unwrap();

    let job = env.job_state(1);
    assert_eq!(job.status, JobStatus::Funded);
    assert_eq!(job.amount, AMOUNT);
    assert_eq!(job.spec_hash, SPEC_HASH);
    assert_eq!(job.created_at, START);
    assert_eq!(env.balance(&env.vault(1)), AMOUNT);
    assert_eq!(env.balance(&env.client_token), 70 * USDC);
}

#[test]
fn approved_job_pays_the_provider_minus_the_fee() {
    let mut env = Env::new();
    let evaluator = env.evaluator.insecure_clone();

    env.submitted_job(1, AMOUNT);
    assert_eq!(env.job_state(1).status, JobStatus::Submitted);
    assert_eq!(env.job_state(1).result_hash, RESULT_HASH);
    env.complete(1, &evaluator).unwrap();

    let profile = env.profile_state(&env.provider.pubkey());
    assert_eq!(env.job_state(1).status, JobStatus::Completed);
    assert_eq!(env.balance(&env.provider_token), AMOUNT - FEE);
    assert_eq!(env.balance(&env.treasury_token()), FEE);
    assert_eq!(FEE, 75_000);
    assert!(!env.exists(&env.vault(1)), "vault must be closed");
    assert_eq!(
        (profile.jobs_completed, profile.volume_settled),
        (1, AMOUNT)
    );
}

#[test]
fn rejected_job_refunds_the_client_in_full() {
    let mut env = Env::new();
    let evaluator = env.evaluator.insecure_clone();

    env.submitted_job(1, AMOUNT);
    env.reject(1, &evaluator).unwrap();

    let profile = env.profile_state(&env.provider.pubkey());
    assert_eq!(env.job_state(1).status, JobStatus::Rejected);
    assert_eq!(env.balance(&env.client_token), 100 * USDC);
    assert_eq!(env.balance(&env.provider_token), 0);
    assert!(!env.exists(&env.vault(1)));
    assert_eq!(
        (
            profile.jobs_rejected,
            profile.jobs_completed,
            profile.volume_settled
        ),
        (1, 0, 0)
    );
}

#[test]
fn client_can_cancel_before_anyone_accepts() {
    let mut env = Env::new();
    let client = env.client.insecure_clone();
    let mut accounts = {
        env.create_job(1, AMOUNT).unwrap();
        env.return_accounts(1, &client)
    };

    // No provider ever accepted, so no profile is needed.
    accounts.provider_profile = None;
    env.send(instruction::Refund {}, accounts, &client).unwrap();

    assert_eq!(env.job_state(1).status, JobStatus::Refunded);
    assert_eq!(env.balance(&env.client_token), 100 * USDC);
}

#[test]
fn missed_deadline_refunds_the_client_and_marks_the_provider() {
    let mut env = Env::new();
    let (client, provider) = (env.client.insecure_clone(), env.provider.insecure_clone());

    env.create_job(1, AMOUNT).unwrap();
    env.accept(1, &provider).unwrap();
    env.warp(3_601);
    env.refund(1, &client).unwrap();

    assert_eq!(env.job_state(1).status, JobStatus::Expired);
    assert_eq!(env.balance(&env.client_token), 100 * USDC);
    assert_eq!(env.profile_state(&provider.pubkey()).jobs_expired, 1);
}

#[test]
fn provider_collects_when_nobody_reviews_in_time() {
    let mut env = Env::new();
    let provider = env.provider.insecure_clone();

    env.submitted_job(1, AMOUNT);
    env.warp(REVIEW_WINDOW + 1);
    env.claim_timeout(1, &provider).unwrap();

    assert_eq!(env.job_state(1).status, JobStatus::Claimed);
    assert_eq!(env.balance(&env.provider_token), AMOUNT - FEE);
    assert_eq!(env.profile_state(&provider.pubkey()).jobs_completed, 1);
}

#[test]
fn evaluator_can_still_judge_after_the_window_if_unclaimed() {
    let mut env = Env::new();
    let evaluator = env.evaluator.insecure_clone();

    env.submitted_job(1, AMOUNT);
    env.warp(REVIEW_WINDOW + 1);
    env.reject(1, &evaluator).unwrap();

    assert_eq!(env.job_state(1).status, JobStatus::Rejected);
}

#[test]
fn tokens_sent_to_the_vault_by_a_third_party_cannot_lock_the_job() {
    let mut env = Env::new();
    let (evaluator, stranger) = (
        env.evaluator.insecure_clone(),
        env.stranger.insecure_clone(),
    );
    let (mint, vault) = (env.mint, env.vault(1));

    env.submitted_job(1, AMOUNT);
    Transfer::new(&mut env.svm, &stranger, &mint, &vault, 5 * USDC)
        .send()
        .unwrap();
    env.complete(1, &evaluator).unwrap();

    assert_eq!(env.balance(&env.provider_token), AMOUNT + 5 * USDC - FEE);
    assert!(!env.exists(&vault));
}

#[test]
fn tiny_amounts_settle_with_a_zero_fee() {
    let mut env = Env::new();
    let evaluator = env.evaluator.insecure_clone();

    env.submitted_job(1, 1);
    env.complete(1, &evaluator).unwrap();

    assert_eq!(env.balance(&env.provider_token), 1);
}

#[test]
fn several_jobs_accumulate_on_the_provider_record() {
    let mut env = Env::new();
    let evaluator = env.evaluator.insecure_clone();

    env.submitted_job(1, AMOUNT);
    env.submitted_job(2, 10 * USDC);
    env.complete(1, &evaluator).unwrap();
    env.complete(2, &evaluator).unwrap();

    let profile = env.profile_state(&env.provider.pubkey());
    assert_eq!(
        (profile.jobs_completed, profile.volume_settled),
        (2, 40 * USDC)
    );
}

#[test]
fn updating_a_profile_keeps_its_track_record() {
    let mut env = Env::new();
    let (evaluator, provider) = (
        env.evaluator.insecure_clone(),
        env.provider.insecure_clone(),
    );

    env.submitted_job(1, AMOUNT);
    env.complete(1, &evaluator).unwrap();
    env.register(&provider, "lingua-8").unwrap();

    let profile = env.profile_state(&provider.pubkey());
    assert_eq!(profile.name, "lingua-8");
    assert_eq!(profile.registered_at, START);
    assert_eq!(profile.jobs_completed, 1);
}
