import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  connect,
  findTokenAccount,
  nowSeconds,
  sendInstructions,
  USDC_DEVNET_MINT,
  usdcBalance,
} from '@agent-escrow/sdk';
import {
  type Address,
  airdropFactory,
  createKeyPairSignerFromBytes,
  generateKeyPairSigner,
  type KeyPairSigner,
  lamports,
} from '@solana/kit';
import {
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getMintToInstruction,
} from '@solana-program/token';
import { RPC_URL } from './validator.ts';

export const connection = connect(RPC_URL);
export const USDC = 1_000_000n;

const AIRDROP = lamports(10_000_000_000n);

export async function fundedSigner(): Promise<KeyPairSigner> {
  const signer = await generateKeyPairSigner();
  const airdrop = airdropFactory(connection);

  await airdrop({ recipientAddress: signer.address, lamports: AIRDROP, commitment: 'confirmed' });

  return signer;
}

/** Throwaway key that controls the USDC mint of the local chain (see usdc-mint.json). */
const MINT_AUTHORITY = [
  174, 47, 154, 16, 202, 193, 206, 113, 199, 190, 53, 133, 169, 175, 31, 56, 222, 53, 138, 189, 224,
  216, 117, 173, 10, 149, 53, 45, 73, 251, 237, 246, 15, 185, 186, 82, 177, 240, 148, 69, 241, 227,
  167, 80, 141, 89, 240, 121, 121, 35, 172, 247, 68, 251, 226, 218, 48, 63, 176, 109, 168, 89, 238,
  135,
];

/** Gives `owner` test USDC, creating its token account when needed. */
export async function mintUsdc(owner: Address, amount: bigint) {
  const authority = await createKeyPairSignerFromBytes(Uint8Array.from(MINT_AUTHORITY));
  const token = await findTokenAccount(owner, USDC_DEVNET_MINT);
  const payer = await fundedSigner();
  const instructions = [
    await getCreateAssociatedTokenIdempotentInstructionAsync({
      payer,
      owner,
      mint: USDC_DEVNET_MINT,
    }),
    getMintToInstruction({ mint: USDC_DEVNET_MINT, token, mintAuthority: authority, amount }),
  ];

  await sendInstructions(connection, payer, instructions);
}

export const balanceOf = (owner: Address) => usdcBalance(connection.rpc, owner);

export const inOneHour = () => nowSeconds() + 3_600n;

/** Serves in-memory JSON files over HTTP, the way an agent would host a spec or a deliverable. */
export async function serveFiles() {
  const files = new Map<string, string>();
  const server = createServer((request, response) => {
    const body = files.get(request.url ?? '');

    // Browsers verifying a job fetch these files cross-origin, like they would a gist.
    response.writeHead(body === undefined ? 404 : 200, {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
    });
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
