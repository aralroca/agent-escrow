import {
  type AgentView,
  describeAgent,
  findTokenAccount,
  formatAmount,
  getAgent,
  listAgents,
  registerAgent,
} from '@agent-escrow/sdk';
import { fetchMaybeToken } from '@solana-program/token';
import * as z from 'zod/v4';
import type { Context } from '../context.ts';
import { defineTool } from '../tool.ts';

const SOL_DECIMALS = 9;

const policyShape = {
  capability: z.string().optional().describe('Only agents listing this capability tag'),
  min_success_rate: z.number().min(0).max(1).optional().describe('Between 0 and 1, e.g. 0.98'),
  min_completed_jobs: z.number().int().min(0).optional(),
};

export type Policy = z.infer<z.ZodObject<typeof policyShape>>;

/** Whether an agent's on-chain track record satisfies a hiring policy. */
export function meetsPolicy(agent: AgentView, policy: Policy): boolean {
  const { capability, min_success_rate = 0, min_completed_jobs = 0 } = policy;
  const hasCapability = !capability || agent.capabilities.includes(capability);
  const hasRecord = (agent.successRate ?? 0) >= min_success_rate;

  return (
    hasCapability && agent.jobsCompleted >= min_completed_jobs && (hasRecord || !min_success_rate)
  );
}

async function tokenBalance({ connection, signer, mint }: Context): Promise<string> {
  const account = await fetchMaybeToken(
    connection.rpc,
    await findTokenAccount(signer.address, mint),
  );

  return formatAmount(account.exists ? account.data.amount : 0n);
}

export const getWallet = defineTool({
  name: 'get_wallet',
  description:
    'Show the wallet this agent signs with: its address (give it to buyers so they can hire you), ' +
    'its SOL and USDC balances, its spending cap per job and its registered profile, if any.',
  input: z.object({}),
  async run(context) {
    const { connection, signer, maxJobAmount } = context;
    const { value: lamports } = await connection.rpc.getBalance(signer.address).send();
    const agent = await getAgent(connection.rpc, signer.address);

    return {
      address: signer.address,
      sol: formatAmount(lamports, SOL_DECIMALS),
      usdc: await tokenBalance(context),
      maxJobUsdc: formatAmount(maxJobAmount),
      profile: agent ? describeAgent(agent) : 'Not registered. Call register_agent to take jobs.',
    };
  },
});

export const registerAgentTool = defineTool({
  name: 'register_agent',
  description:
    'Register this agent as a seller, or update its profile. Required before accepting jobs. ' +
    'The track record (completed, rejected, expired jobs) is kept across updates.',
  input: z.object({
    name: z.string().min(1).max(32).describe('Public name, up to 32 characters'),
    capabilities: z.array(z.string()).default([]).describe('Tags like "translation"'),
    uri: z.string().max(200).optional().describe('Optional URL with more about the agent'),
  }),
  async run({ connection, signer }, agent) {
    const signature = await registerAgent(connection, signer, agent);

    return { signature, authority: signer.address, ...agent };
  },
});

export const searchAgents = defineTool({
  name: 'search_agents',
  description:
    'Find seller agents by capability and by on-chain track record. Reputation comes only from ' +
    'settled escrows: successRate = jobs paid / jobs settled. Returns each agent address to hire.',
  input: z.object(policyShape),
  async run({ connection }, policy) {
    const agents = await listAgents(connection.rpc);

    return agents.map(describeAgent).filter((agent) => meetsPolicy(agent, policy));
  },
});
