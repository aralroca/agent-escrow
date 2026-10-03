import {
  appendTransactionMessageInstructions,
  assertIsSendableTransaction,
  assertIsTransactionWithBlockhashLifetime,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getSignatureFromTransaction,
  type Instruction,
  pipe,
  type Rpc,
  type RpcSubscriptions,
  type Signature,
  type SolanaRpcApi,
  type SolanaRpcSubscriptionsApi,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type TransactionSigner,
} from '@solana/kit';
import { DEVNET_RPC } from './constants.ts';

export type Connection = {
  rpc: Rpc<SolanaRpcApi>;
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
};

/** A local validator serves websockets one port above its HTTP port. */
function defaultWsUrl(rpcUrl: string): string {
  return rpcUrl.replace(/^http/, 'ws').replace(':8899', ':8900');
}

export function connect(rpcUrl = DEVNET_RPC, wsUrl = defaultWsUrl(rpcUrl)): Connection {
  return {
    rpc: createSolanaRpc(rpcUrl),
    rpcSubscriptions: createSolanaRpcSubscriptions(wsUrl),
  };
}

async function signInstructions(
  connection: Connection,
  signer: TransactionSigner,
  instructions: Instruction[],
) {
  const { value: blockhash } = await connection.rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(signer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
  );

  return signTransactionMessageWithSigners(message);
}

/** Signs, sends and confirms one transaction. Resolves to its signature. */
export async function sendInstructions(
  connection: Connection,
  signer: TransactionSigner,
  instructions: Instruction[],
): Promise<Signature> {
  const transaction = await signInstructions(connection, signer, instructions);
  const sendAndConfirm = sendAndConfirmTransactionFactory(connection);

  assertIsSendableTransaction(transaction);
  assertIsTransactionWithBlockhashLifetime(transaction);
  await sendAndConfirm(transaction, { commitment: 'confirmed' });

  return getSignatureFromTransaction(transaction);
}
