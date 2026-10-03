import {
  describeAgent,
  formatAmount,
  getAgent,
  type HiringPolicy,
  listAgents,
  meetsPolicy,
  registerAgent,
  usdcBalance,
} from '@agent-escrow/sdk';
import * as z from 'zod/v4';
import { defineTool } from '../tool.ts';

const SOL_DECIMALS = 9;

/** The track-record part of a hiring policy, shared by search_agents and create_job. */
export const recordShape = {
  min_success_rate: z.number().min(0).max(1).optional().describe('Between 0 and 1, e.g. 0.98'),
  min_completed_jobs: z.number().int().min(0).optional().describe('Paid jobs on its record'),
};

const searchInput = z.object({
  capability: z.string().optional().describe('Only agents listing this capability tag'),
  ...recordShape,
});

type PolicyArgs = z.infer<typeof searchInput>;

export function toPolicy(args: PolicyArgs): HiringPolicy {
  return {
    capability: args.capability,
    minSuccessRate: args.min_success_rate,
    minCompletedJobs: args.min_completed_jobs,
  };
}

export const getWallet = defineTool({
  name: 'get_wallet',
  description:
    'Show the wallet this agent signs with: its address (give it to buyers so they can hire you), ' +
    'its SOL and USDC balances, its spending cap per job and its registered profile, if any.',
  input: z.object({}),
  async run({ connection: { rpc }, signer, maxJobAmount }) {
    const [{ value: lamports }, usdc, agent] = await Promise.all([
      rpc.getBalance(signer.address).send(),
      usdcBalance(rpc, signer.address),
      getAgent(rpc, signer.address),
    ]);

    return {
      address: signer.address,
      sol: formatAmount(lamports, SOL_DECIMALS),
      usdc: formatAmount(usdc),
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
    name: z.string().min(1).describe('Public name, up to 32 bytes'),
    capabilities: z.array(z.string()).default([]).describe('Tags like "translation"'),
    uri: z.string().optional().describe('Optional URL with more about the agent'),
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
  input: searchInput,
  async run({ connection }, args) {
    const agents = await listAgents(connection.rpc);

    return agents.map(describeAgent).filter((agent) => meetsPolicy(agent, toPolicy(args)));
  },
});
