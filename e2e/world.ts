import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { connect, findTokenAccount, sendInstructions } from '@agent-escrow/sdk';
import {
  type Address,
  airdropFactory,
  generateKeyPairSigner,
  type KeyPairSigner,
  lamports,
} from '@solana/kit';
import { getCreateAccountInstruction } from '@solana-program/system';
import {
  fetchMaybeToken,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getInitializeMintInstruction,
  getMintSize,
  getMintToInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';

export const RPC_URL = 'http://127.0.0.1:8899';
export const connection = connect(RPC_URL);
export const USDC = 1_000_000n;

const AIRDROP = lamports(10_000_000_000n);

export async function fundedSigner(): Promise<KeyPairSigner> {
  const signer = await generateKeyPairSigner();
  const airdrop = airdropFactory(connection);

  await airdrop({ recipientAddress: signer.address, lamports: AIRDROP, commitment: 'confirmed' });

  return signer;
}

/** Creates a 6-decimal mint controlled by `authority`, standing in for USDC. */
export async function createMint(authority: KeyPairSigner): Promise<Address> {
  const mint = await generateKeyPairSigner();
  const space = BigInt(getMintSize());
  const rent = await connection.rpc.getMinimumBalanceForRentExemption(space).send();
  const instructions = [
    getCreateAccountInstruction({
      payer: authority,
      newAccount: mint,
      lamports: rent,
      space,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    getInitializeMintInstruction({
      mint: mint.address,
      decimals: 6,
      mintAuthority: authority.address,
    }),
  ];

  await sendInstructions(connection, authority, instructions);

  return mint.address;
}

export async function mintTo(
  authority: KeyPairSigner,
  mint: Address,
  owner: Address,
  amount: bigint,
) {
  const token = await findTokenAccount(owner, mint);
  const instructions = [
    await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: authority, owner, mint }),
    getMintToInstruction({ mint, token, mintAuthority: authority, amount }),
  ];

  await sendInstructions(connection, authority, instructions);
}

export async function balanceOf(owner: Address, mint: Address): Promise<bigint> {
  const token = await fetchMaybeToken(connection.rpc, await findTokenAccount(owner, mint));

  return token.exists ? token.data.amount : 0n;
}

/** Serves in-memory JSON files over HTTP, the way an agent would host a spec or a deliverable. */
export async function serveFiles() {
  const files = new Map<string, string>();
  const server = createServer((request, response) => {
    const body = files.get(request.url ?? '');

    response.writeHead(body === undefined ? 404 : 200, { 'content-type': 'application/json' });
    response.end(body);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  return {
    host(name: string, content: unknown): string {
      files.set(`/${name}`, JSON.stringify(content));

      return `http://127.0.0.1:${(server.address() as AddressInfo).port}/${name}`;
    },
    close: () => server.close(),
  };
}
