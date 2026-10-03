#![allow(dead_code)]

use {
    agent_escrow::{
        accounts, instruction, AgentProfile, CreateJobArgs, Job, AGENT_SEED, JOB_SEED, TREASURY,
        USDC_MINT, VAULT_SEED,
    },
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    anchor_spl::{associated_token, token},
    litesvm::{types::FailedTransactionMetadata, LiteSVM},
    litesvm_token::{
        spl_token::state::{Account as TokenAccount, Mint},
        CreateAssociatedTokenAccount, MintTo,
    },
    solana_account::Account,
    solana_keypair::Keypair,
    solana_program_option::COption,
    solana_program_pack::Pack,
    solana_signer::Signer,
    solana_transaction::Transaction,
};

pub type TxResult = Result<(), FailedTransactionMetadata>;

pub const USDC: u64 = 1_000_000;
pub const START: i64 = 1_700_000_000;
pub const DEADLINE: i64 = START + 3_600;
pub const REVIEW_WINDOW: i64 = 600;
pub const SPEC_HASH: [u8; 32] = [7; 32];
pub const RESULT_HASH: [u8; 32] = [9; 32];

/// Puts a USDC mint, controlled by `authority`, at the address the program expects.
fn install_usdc(svm: &mut LiteSVM, authority: &Pubkey) -> Pubkey {
    let mut data = vec![0; Mint::LEN];
    let mint = Mint {
        mint_authority: COption::Some(*authority),
        supply: 0,
        decimals: 6,
        is_initialized: true,
        freeze_authority: COption::None,
    };

    Mint::pack(mint, &mut data).unwrap();
    let account = Account {
        lamports: 1_000_000_000,
        data,
        owner: token::ID,
        executable: false,
        rent_epoch: 0,
    };
    svm.set_account(USDC_MINT, account).unwrap();

    USDC_MINT
}

/// A funded world: one client, one registered provider, one evaluator and an outsider.
pub struct Env {
    pub svm: LiteSVM,
    pub client: Keypair,
    pub provider: Keypair,
    pub evaluator: Keypair,
    pub stranger: Keypair,
    pub mint: Pubkey,
    pub client_token: Pubkey,
    pub provider_token: Pubkey,
    pub stranger_token: Pubkey,
}

impl Env {
    pub fn new() -> Self {
        let mut svm = LiteSVM::new();
        let [client, provider, evaluator, stranger] = [(); 4].map(|_| Keypair::new());
        let program = include_bytes!(concat!(
            env!("CARGO_TARGET_TMPDIR"),
            "/../deploy/agent_escrow.so"
        ));

        svm.add_program(agent_escrow::id(), program).unwrap();
        for key in [&client, &provider, &evaluator, &stranger] {
            svm.airdrop(&key.pubkey(), 10_000_000_000).unwrap();
        }
        let mint = install_usdc(&mut svm, &client.pubkey());
        let [client_token, provider_token, stranger_token] =
            [&client, &provider, &stranger].map(|owner| {
                CreateAssociatedTokenAccount::new(&mut svm, owner, &mint)
                    .send()
                    .unwrap()
            });
        MintTo::new(&mut svm, &client, &mint, &client_token, 100 * USDC)
            .send()
            .unwrap();
        MintTo::new(&mut svm, &client, &mint, &stranger_token, 100 * USDC)
            .send()
            .unwrap();

        let mut env = Env {
            svm,
            client,
            provider,
            evaluator,
            stranger,
            mint,
            client_token,
            provider_token,
            stranger_token,
        };
        env.warp(START);
        env.register(&env.provider.insecure_clone(), "lingua-7")
            .unwrap();

        env
    }

    /// Moves the on-chain clock forward by `seconds`.
    pub fn warp(&mut self, seconds: i64) {
        let mut clock = self.svm.get_sysvar::<Clock>();

        clock.unix_timestamp += seconds;
        self.svm.set_sysvar(&clock);
    }

    pub fn send(
        &mut self,
        data: impl InstructionData,
        metas: impl ToAccountMetas,
        signer: &Keypair,
    ) -> TxResult {
        let ix = Instruction::new_with_bytes(
            agent_escrow::id(),
            &data.data(),
            metas.to_account_metas(None),
        );
        let tx = Transaction::new_signed_with_payer(
            &[ix],
            Some(&signer.pubkey()),
            &[signer],
            self.svm.latest_blockhash(),
        );
        let result = self.svm.send_transaction(tx).map(|_| ());

        // A fresh blockhash lets tests repeat an identical instruction.
        self.svm.expire_blockhash();

        result
    }

    pub fn job(&self, job_id: u64) -> Pubkey {
        let (client, job_id) = (self.client.pubkey(), job_id.to_le_bytes());

        Pubkey::find_program_address(&[JOB_SEED, client.as_ref(), &job_id], &agent_escrow::id()).0
    }

    pub fn vault(&self, job_id: u64) -> Pubkey {
        Pubkey::find_program_address(
            &[VAULT_SEED, self.job(job_id).as_ref()],
            &agent_escrow::id(),
        )
        .0
    }

    pub fn profile(&self, owner: &Pubkey) -> Pubkey {
        Pubkey::find_program_address(&[AGENT_SEED, owner.as_ref()], &agent_escrow::id()).0
    }

    pub fn treasury_token(&self) -> Pubkey {
        associated_token::get_associated_token_address(&TREASURY, &self.mint)
    }

    pub fn register(&mut self, agent: &Keypair, name: &str) -> TxResult {
        let data = instruction::RegisterAgent {
            name: name.into(),
            capabilities: "translation".into(),
            uri: "https://example.com/agent.json".into(),
        };
        let metas = accounts::RegisterAgent {
            authority: agent.pubkey(),
            profile: self.profile(&agent.pubkey()),
            system_program: system_program::ID,
        };

        self.send(data, metas, agent)
    }

    pub fn job_args(&self, job_id: u64, amount: u64) -> CreateJobArgs {
        CreateJobArgs {
            job_id,
            provider: self.provider.pubkey(),
            evaluator: self.evaluator.pubkey(),
            amount,
            spec_hash: SPEC_HASH,
            spec_uri: "https://example.com/spec.json".into(),
            deadline: DEADLINE,
            review_window: REVIEW_WINDOW,
        }
    }

    pub fn create_job_with(&mut self, args: CreateJobArgs) -> TxResult {
        let metas = accounts::CreateJob {
            client: self.client.pubkey(),
            job: self.job(args.job_id),
            mint: self.mint,
            client_token: self.client_token,
            vault: self.vault(args.job_id),
            token_program: token::ID,
            system_program: system_program::ID,
        };

        self.send(
            instruction::CreateJob { args },
            metas,
            &self.client.insecure_clone(),
        )
    }

    pub fn create_job(&mut self, job_id: u64, amount: u64) -> TxResult {
        self.create_job_with(self.job_args(job_id, amount))
    }

    pub fn accept(&mut self, job_id: u64, signer: &Keypair) -> TxResult {
        let metas = accounts::Accept {
            provider: signer.pubkey(),
            job: self.job(job_id),
            provider_profile: self.profile(&signer.pubkey()),
        };

        self.send(instruction::Accept {}, metas, signer)
    }

    pub fn submit(&mut self, job_id: u64, signer: &Keypair) -> TxResult {
        let data = instruction::Submit {
            result_hash: RESULT_HASH,
            result_uri: "https://example.com/result.json".into(),
        };
        let metas = accounts::Submit {
            provider: signer.pubkey(),
            job: self.job(job_id),
        };

        self.send(data, metas, signer)
    }

    pub fn release_accounts(&self, job_id: u64, signer: &Keypair) -> accounts::Release {
        accounts::Release {
            authority: signer.pubkey(),
            job: self.job(job_id),
            client: self.client.pubkey(),
            provider: self.provider.pubkey(),
            mint: self.mint,
            vault: self.vault(job_id),
            provider_token: self.provider_token,
            treasury: TREASURY,
            treasury_token: self.treasury_token(),
            provider_profile: self.profile(&self.provider.pubkey()),
            token_program: token::ID,
            associated_token_program: associated_token::ID,
            system_program: system_program::ID,
        }
    }

    pub fn complete(&mut self, job_id: u64, signer: &Keypair) -> TxResult {
        self.send(
            instruction::Complete {},
            self.release_accounts(job_id, signer),
            signer,
        )
    }

    pub fn claim_timeout(&mut self, job_id: u64, signer: &Keypair) -> TxResult {
        self.send(
            instruction::ClaimTimeout {},
            self.release_accounts(job_id, signer),
            signer,
        )
    }

    pub fn return_accounts(&self, job_id: u64, signer: &Keypair) -> accounts::ReturnFunds {
        accounts::ReturnFunds {
            authority: signer.pubkey(),
            job: self.job(job_id),
            client: self.client.pubkey(),
            mint: self.mint,
            vault: self.vault(job_id),
            client_token: self.client_token,
            provider_profile: Some(self.profile(&self.provider.pubkey())),
            token_program: token::ID,
        }
    }

    pub fn reject(&mut self, job_id: u64, signer: &Keypair) -> TxResult {
        self.send(
            instruction::Reject {},
            self.return_accounts(job_id, signer),
            signer,
        )
    }

    pub fn refund(&mut self, job_id: u64, signer: &Keypair) -> TxResult {
        self.send(
            instruction::Refund {},
            self.return_accounts(job_id, signer),
            signer,
        )
    }

    /// Creates, accepts and submits a job with the honest parties.
    pub fn submitted_job(&mut self, job_id: u64, amount: u64) {
        let provider = self.provider.insecure_clone();

        self.create_job(job_id, amount).unwrap();
        self.accept(job_id, &provider).unwrap();
        self.submit(job_id, &provider).unwrap();
    }

    pub fn job_state(&self, job_id: u64) -> Job {
        let account = self.svm.get_account(&self.job(job_id)).unwrap();

        Job::try_deserialize(&mut account.data.as_slice()).unwrap()
    }

    pub fn profile_state(&self, owner: &Pubkey) -> AgentProfile {
        let account = self.svm.get_account(&self.profile(owner)).unwrap();

        AgentProfile::try_deserialize(&mut account.data.as_slice()).unwrap()
    }

    pub fn balance(&self, token_account: &Pubkey) -> u64 {
        litesvm_token::get_spl_account::<TokenAccount>(&self.svm, token_account)
            .map_or(0, |account| account.amount)
    }

    pub fn exists(&self, address: &Pubkey) -> bool {
        self.svm
            .get_account(address)
            .is_some_and(|account| account.lamports > 0)
    }
}

/// Asserts that a transaction failed with the given custom program error code.
pub fn assert_code(result: TxResult, code: impl Into<u32>) {
    let expected = format!("Custom({})", code.into());
    let error = format!(
        "{:?}",
        result.expect_err("transaction should have failed").err
    );

    assert!(
        error.contains(&expected),
        "expected {expected}, got {error}"
    );
}
