import { type Address, getBase58Encoder, type Signature } from '@solana/kit';
import type { Connection } from './connection.ts';
import {
  AGENT_ESCROW_PROGRAM_ADDRESS,
  AgentEscrowInstruction,
  identifyAgentEscrowInstruction,
} from './generated/index.ts';

type Rpc = Connection['rpc'];
type RawInstruction = { programIdIndex: number; data: string };
type RawTransaction = {
  transaction: { message: { accountKeys: Address[]; instructions: RawInstruction[] } };
} | null;

export type Activity = {
  signature: Signature;
  /** Program instruction in snake_case, e.g. "create_job". Undefined for foreign transactions. */
  instruction?: string;
  /** ISO time of the block, when the RPC still has it. */
  time?: string;
  failed: boolean;
};

const HISTORY_LIMIT = 20;
const TRANSACTION_CONFIG = { encoding: 'json', maxSupportedTransactionVersion: 0 } as const;

const snakeCase = (name: string) => name.replace(/(?!^)([A-Z])/g, '_$1').toLowerCase();

function instructionName(transaction: RawTransaction): string | undefined {
  const { accountKeys = [], instructions = [] } = transaction?.transaction.message ?? {};
  const ours = instructions.find(
    (instruction) => accountKeys[instruction.programIdIndex] === AGENT_ESCROW_PROGRAM_ADDRESS,
  );
  const data = ours && getBase58Encoder().encode(ours.data);

  return data && snakeCase(AgentEscrowInstruction[identifyAgentEscrowInstruction({ data })]);
}

/** The transactions that touched a job, newest first, each labelled with its instruction. */
export async function listActivity(rpc: Rpc, job: Address): Promise<Activity[]> {
  const history = await rpc.getSignaturesForAddress(job, { limit: HISTORY_LIMIT }).send();
  const transactions = await Promise.all(
    history.map(({ signature }) => rpc.getTransaction(signature, TRANSACTION_CONFIG).send()),
  );

  return history.map(({ signature, blockTime, err }, index) => ({
    signature,
    instruction: instructionName(transactions[index] as unknown as RawTransaction),
    time: blockTime ? new Date(Number(blockTime) * 1000).toISOString() : undefined,
    failed: err !== null,
  }));
}
