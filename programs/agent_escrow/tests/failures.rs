mod common;

use {
    agent_escrow::{error::ErrorCode, instruction, CreateJobArgs, JobStatus},
    anchor_lang::{error::ErrorCode as AnchorError, prelude::Pubkey},
    common::*,
    litesvm_token::{CreateAssociatedTokenAccount, CreateMint},
    solana_signer::Signer,
};

const AMOUNT: u64 = 30 * USDC;

// --- Wrong signer -----------------------------------------------------------

#[test]
fn only_the_named_provider_can_accept_and_submit() {
    let mut env = Env::new();
    let (provider, stranger) = (env.provider.insecure_clone(), env.stranger.insecure_clone());

    env.create_job(1, AMOUNT).unwrap();
    env.register(&stranger, "impostor").unwrap();
    assert_code(env.accept(1, &stranger), ErrorCode::Unauthorized);
    env.accept(1, &provider).unwrap();
    assert_code(env.submit(1, &stranger), ErrorCode::Unauthorized);
}

#[test]
fn unregistered_agents_cannot_accept() {
    let mut env = Env::new();
    let args = CreateJobArgs {
        provider: env.stranger.pubkey(),
        ..env.job_args(1, AMOUNT)
    };
    let stranger = env.stranger.insecure_clone();

    env.create_job_with(args).unwrap();
    assert_code(env.accept(1, &stranger), AnchorError::AccountNotInitialized);
}

#[test]
fn only_the_evaluator_can_approve_or_reject() {
    let mut env = Env::new();
    let outsiders = [&env.client, &env.provider, &env.stranger].map(|key| key.insecure_clone());

    env.submitted_job(1, AMOUNT);
    for signer in &outsiders {
        assert_code(env.complete(1, signer), ErrorCode::Unauthorized);
        assert_code(env.reject(1, signer), ErrorCode::Unauthorized);
    }
    assert_eq!(env.job_state(1).status, JobStatus::Submitted);
    assert_eq!(env.balance(&env.vault(1)), AMOUNT);
}

#[test]
fn only_the_client_can_refund_and_only_the_provider_can_claim() {
    let mut env = Env::new();
    let (evaluator, provider, stranger) = (
        env.evaluator.insecure_clone(),
        env.provider.insecure_clone(),
        env.stranger.insecure_clone(),
    );

    env.create_job(1, AMOUNT).unwrap();
    for signer in [&evaluator, &provider, &stranger] {
        assert_code(env.refund(1, signer), ErrorCode::Unauthorized);
    }
    env.submitted_job(2, AMOUNT);
    env.warp(REVIEW_WINDOW + 1);
    for signer in [&evaluator, &stranger] {
        assert_code(env.claim_timeout(2, signer), ErrorCode::Unauthorized);
    }
}

// --- Double settlement ------------------------------------------------------

#[test]
fn a_job_settles_exactly_once() {
    let mut env = Env::new();
    let (client, evaluator, provider) = (
        env.client.insecure_clone(),
        env.evaluator.insecure_clone(),
        env.provider.insecure_clone(),
    );

    env.submitted_job(1, AMOUNT);
    env.complete(1, &evaluator).unwrap();
    env.warp(REVIEW_WINDOW + 3_601);

    // The vault is gone, so every second settlement fails before moving anything.
    assert!(env.complete(1, &evaluator).is_err());
    assert!(env.reject(1, &evaluator).is_err());
    assert!(env.refund(1, &client).is_err());
    assert!(env.claim_timeout(1, &provider).is_err());
    assert_eq!(env.balance(&env.provider_token), AMOUNT - 75_000);
    assert_eq!(env.balance(&env.client_token), 70 * USDC);
    assert_eq!(env.profile_state(&provider.pubkey()).jobs_completed, 1);
}

#[test]
fn a_refunded_job_cannot_be_refunded_or_paid_again() {
    let mut env = Env::new();
    let (client, evaluator) = (env.client.insecure_clone(), env.evaluator.insecure_clone());

    env.submitted_job(1, AMOUNT);
    env.reject(1, &evaluator).unwrap();

    assert!(env.reject(1, &evaluator).is_err());
    assert!(env.complete(1, &evaluator).is_err());
    assert!(env.refund(1, &client).is_err());
    assert_eq!(env.balance(&env.client_token), 100 * USDC);
}

#[test]
fn a_job_id_cannot_be_reused() {
    let mut env = Env::new();

    env.create_job(1, AMOUNT).unwrap();
    assert!(env.create_job(1, AMOUNT).is_err());
    assert_eq!(env.balance(&env.client_token), 70 * USDC);
}

// --- Account substitution ---------------------------------------------------

#[test]
fn payment_cannot_be_redirected_to_another_token_account() {
    let mut env = Env::new();
    let evaluator = env.evaluator.insecure_clone();
    let mut release = {
        env.submitted_job(1, AMOUNT);
        env.release_accounts(1, &evaluator)
    };
    let mut refund = env.return_accounts(1, &evaluator);

    release.provider_token = env.stranger_token;
    refund.client_token = env.stranger_token;
    assert_code(
        env.send(instruction::Complete {}, release, &evaluator),
        AnchorError::ConstraintTokenOwner,
    );
    assert_code(
        env.send(instruction::Reject {}, refund, &evaluator),
        AnchorError::ConstraintTokenOwner,
    );
}

#[test]
fn the_fee_cannot_be_redirected_to_another_treasury() {
    let mut env = Env::new();
    let evaluator = env.evaluator.insecure_clone();
    let mut release = {
        env.submitted_job(1, AMOUNT);
        env.release_accounts(1, &evaluator)
    };

    release.treasury = env.stranger.pubkey();
    release.treasury_token = env.stranger_token;
    assert_code(
        env.send(instruction::Complete {}, release, &evaluator),
        AnchorError::ConstraintAddress,
    );
}

#[test]
fn a_job_cannot_be_settled_from_another_jobs_vault() {
    let mut env = Env::new();
    let evaluator = env.evaluator.insecure_clone();
    let mut release = {
        env.submitted_job(1, AMOUNT);
        env.submitted_job(2, 60 * USDC);
        env.release_accounts(1, &evaluator)
    };

    release.vault = env.vault(2);
    assert_code(
        env.send(instruction::Complete {}, release, &evaluator),
        AnchorError::ConstraintSeeds,
    );
}

#[test]
fn the_parties_passed_to_a_settlement_must_be_the_jobs_own() {
    let mut env = Env::new();
    let (evaluator, stranger) = (
        env.evaluator.insecure_clone(),
        env.stranger.insecure_clone(),
    );
    let mut wrong_client = {
        env.submitted_job(1, AMOUNT);
        env.register(&stranger, "impostor").unwrap();
        env.release_accounts(1, &evaluator)
    };
    let mut wrong_provider = env.release_accounts(1, &evaluator);

    wrong_client.client = stranger.pubkey();
    wrong_provider.provider = stranger.pubkey();
    wrong_provider.provider_token = env.stranger_token;
    wrong_provider.provider_profile = env.profile(&stranger.pubkey());
    assert_code(
        env.send(instruction::Complete {}, wrong_client, &evaluator),
        AnchorError::ConstraintHasOne,
    );
    assert_code(
        env.send(instruction::Complete {}, wrong_provider, &evaluator),
        AnchorError::ConstraintHasOne,
    );
}

// --- Wrong mint -------------------------------------------------------------

#[test]
fn a_job_only_moves_the_mint_it_was_funded_with() {
    let mut env = Env::new();
    let (client, evaluator) = (env.client.insecure_clone(), env.evaluator.insecure_clone());
    let other_mint = CreateMint::new(&mut env.svm, &client)
        .decimals(6)
        .send()
        .unwrap();
    let other_token = CreateAssociatedTokenAccount::new(&mut env.svm, &client, &other_mint)
        .send()
        .unwrap();
    let mut release = {
        env.submitted_job(1, AMOUNT);
        env.release_accounts(1, &evaluator)
    };

    release.mint = other_mint;
    assert!(env
        .send(instruction::Complete {}, release, &evaluator)
        .is_err());
    assert_eq!(env.balance(&env.vault(1)), AMOUNT);

    let mut create = agent_escrow::accounts::CreateJob {
        client: client.pubkey(),
        job: env.job(2),
        mint: env.mint,
        client_token: other_token,
        vault: env.vault(2),
        token_program: anchor_spl::token::ID,
        system_program: anchor_lang::solana_program::system_program::ID,
    };
    let args = env.job_args(2, AMOUNT);
    assert_code(
        env.send(instruction::CreateJob { args }, create.clone(), &client),
        AnchorError::ConstraintTokenMint,
    );
    create.mint = Pubkey::new_unique();
    let args = env.job_args(2, AMOUNT);
    assert!(env
        .send(instruction::CreateJob { args }, create, &client)
        .is_err());
}

// --- Timing -----------------------------------------------------------------

#[test]
fn an_accepted_job_cannot_be_refunded_before_the_deadline() {
    let mut env = Env::new();
    let (client, provider) = (env.client.insecure_clone(), env.provider.insecure_clone());

    env.create_job(1, AMOUNT).unwrap();
    env.accept(1, &provider).unwrap();
    assert_code(env.refund(1, &client), ErrorCode::DeadlineNotReached);
    env.warp(3_600);
    assert_code(env.refund(1, &client), ErrorCode::DeadlineNotReached);
}

#[test]
fn a_submitted_job_cannot_be_refunded_by_the_client() {
    let mut env = Env::new();
    let client = env.client.insecure_clone();

    env.submitted_job(1, AMOUNT);
    env.warp(3_601);
    assert_code(env.refund(1, &client), ErrorCode::InvalidStatus);
}

#[test]
fn the_provider_cannot_claim_while_the_review_window_is_open() {
    let mut env = Env::new();
    let provider = env.provider.insecure_clone();

    env.submitted_job(1, AMOUNT);
    assert_code(env.claim_timeout(1, &provider), ErrorCode::ReviewWindowOpen);
    env.warp(REVIEW_WINDOW);
    assert_code(env.claim_timeout(1, &provider), ErrorCode::ReviewWindowOpen);
}

#[test]
fn nothing_can_be_claimed_before_a_submission() {
    let mut env = Env::new();
    let (evaluator, provider) = (
        env.evaluator.insecure_clone(),
        env.provider.insecure_clone(),
    );

    env.create_job(1, AMOUNT).unwrap();
    env.accept(1, &provider).unwrap();
    env.warp(REVIEW_WINDOW + 1);
    assert_code(env.claim_timeout(1, &provider), ErrorCode::InvalidStatus);
    assert_code(env.complete(1, &evaluator), ErrorCode::InvalidStatus);
    assert_code(env.reject(1, &evaluator), ErrorCode::InvalidStatus);
}

#[test]
fn late_accepts_and_submissions_are_refused() {
    let mut env = Env::new();
    let provider = env.provider.insecure_clone();

    env.create_job(1, AMOUNT).unwrap();
    env.create_job(2, AMOUNT).unwrap();
    env.accept(1, &provider).unwrap();
    env.warp(3_601);
    assert_code(env.accept(2, &provider), ErrorCode::DeadlinePassed);
    assert_code(env.submit(1, &provider), ErrorCode::DeadlinePassed);
}

#[test]
fn steps_cannot_be_skipped_or_repeated() {
    let mut env = Env::new();
    let provider = env.provider.insecure_clone();

    env.create_job(1, AMOUNT).unwrap();
    assert_code(env.submit(1, &provider), ErrorCode::InvalidStatus);
    env.accept(1, &provider).unwrap();
    assert_code(env.accept(1, &provider), ErrorCode::InvalidStatus);
    env.submit(1, &provider).unwrap();
    assert_code(env.submit(1, &provider), ErrorCode::InvalidStatus);
}

// --- Invalid input ----------------------------------------------------------

#[test]
fn invalid_job_parameters_are_refused() {
    let mut env = Env::new();
    let (client, evaluator) = (env.client.pubkey(), env.evaluator.pubkey());
    let cases = [
        (
            CreateJobArgs {
                amount: 0,
                ..env.job_args(1, 0)
            },
            ErrorCode::InvalidAmount,
        ),
        (
            CreateJobArgs {
                deadline: START,
                ..env.job_args(1, AMOUNT)
            },
            ErrorCode::InvalidDeadline,
        ),
        (
            CreateJobArgs {
                deadline: START - 1,
                ..env.job_args(1, AMOUNT)
            },
            ErrorCode::InvalidDeadline,
        ),
        (
            CreateJobArgs {
                review_window: 59,
                ..env.job_args(1, AMOUNT)
            },
            ErrorCode::InvalidReviewWindow,
        ),
        (
            CreateJobArgs {
                review_window: 2_592_001,
                ..env.job_args(1, AMOUNT)
            },
            ErrorCode::InvalidReviewWindow,
        ),
        (
            CreateJobArgs {
                provider: client,
                ..env.job_args(1, AMOUNT)
            },
            ErrorCode::InvalidParties,
        ),
        (
            CreateJobArgs {
                provider: evaluator,
                ..env.job_args(1, AMOUNT)
            },
            ErrorCode::InvalidParties,
        ),
        (
            CreateJobArgs {
                spec_uri: String::new(),
                ..env.job_args(1, AMOUNT)
            },
            ErrorCode::InvalidText,
        ),
        (
            CreateJobArgs {
                spec_uri: "x".repeat(201),
                ..env.job_args(1, AMOUNT)
            },
            ErrorCode::InvalidText,
        ),
    ];

    for (args, expected) in cases {
        assert_code(env.create_job_with(args), expected);
    }
    assert_eq!(env.balance(&env.client_token), 100 * USDC);
}

#[test]
fn a_job_larger_than_the_clients_balance_is_refused() {
    let mut env = Env::new();

    assert!(env.create_job(1, 101 * USDC).is_err());
    assert!(!env.exists(&env.job(1)));
    assert_eq!(env.balance(&env.client_token), 100 * USDC);
}

#[test]
fn settlements_after_acceptance_require_the_provider_profile() {
    let mut env = Env::new();
    let (client, evaluator, provider) = (
        env.client.insecure_clone(),
        env.evaluator.insecure_clone(),
        env.provider.insecure_clone(),
    );
    let mut reject = {
        env.submitted_job(1, AMOUNT);
        env.return_accounts(1, &evaluator)
    };
    let mut expire = {
        env.create_job(2, AMOUNT).unwrap();
        env.accept(2, &provider).unwrap();
        env.warp(3_601);
        env.return_accounts(2, &client)
    };

    reject.provider_profile = None;
    expire.provider_profile = None;
    assert_code(
        env.send(instruction::Reject {}, reject, &evaluator),
        ErrorCode::MissingProfile,
    );
    assert_code(
        env.send(instruction::Refund {}, expire, &client),
        ErrorCode::MissingProfile,
    );
}

#[test]
fn invalid_profiles_and_submissions_are_refused() {
    let mut env = Env::new();
    let provider = env.provider.insecure_clone();
    let empty_uri = instruction::Submit {
        result_hash: RESULT_HASH,
        result_uri: String::new(),
    };
    let metas = {
        env.create_job(1, AMOUNT).unwrap();
        env.accept(1, &provider).unwrap();
        agent_escrow::accounts::Submit {
            provider: provider.pubkey(),
            job: env.job(1),
        }
    };

    assert_code(
        env.send(empty_uri, metas, &provider),
        ErrorCode::InvalidText,
    );
    assert_code(env.register(&provider, ""), ErrorCode::InvalidText);
    assert_code(
        env.register(&provider, &"x".repeat(33)),
        ErrorCode::InvalidText,
    );
}
