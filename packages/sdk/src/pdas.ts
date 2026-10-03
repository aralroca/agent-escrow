import {
  type Address,
  getAddressEncoder,
  getProgramDerivedAddress,
  getU64Encoder,
} from '@solana/kit';
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { AGENT_ESCROW_PROGRAM_ADDRESS, findProfilePda, JOB_SEED } from './generated/index.ts';

export async function findJobPda(client: Address, jobId: bigint): Promise<Address> {
  const seeds = [JOB_SEED, getAddressEncoder().encode(client), getU64Encoder().encode(jobId)];
  const [job] = await getProgramDerivedAddress({
    programAddress: AGENT_ESCROW_PROGRAM_ADDRESS,
    seeds,
  });

  return job;
}

export async function findAgentPda(authority: Address): Promise<Address> {
  const [profile] = await findProfilePda({ authority });

  return profile;
}

/** The associated token account an owner holds for a mint. */
export async function findTokenAccount(owner: Address, mint: Address): Promise<Address> {
  const [account] = await findAssociatedTokenPda({
    owner,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  return account;
}
