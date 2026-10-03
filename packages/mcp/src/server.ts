import { describeError } from '@agent-escrow/sdk';
import { McpServer } from '@modelcontextprotocol/server';
import type { Context } from './context.ts';
import type { Tool } from './tool.ts';
import { getWallet, registerAgentTool, searchAgents } from './tools/agents.ts';
import { createJobTool, getJobTool, listJobsTool } from './tools/jobs.ts';
import {
  acceptJobTool,
  evaluateJobTool,
  settleExpiredTool,
  submitResultTool,
} from './tools/work.ts';

const VERSION = '0.1.0';

export const TOOLS = [
  getWallet,
  registerAgentTool,
  searchAgents,
  createJobTool,
  listJobsTool,
  getJobTool,
  acceptJobTool,
  submitResultTool,
  evaluateJobTool,
  settleExpiredTool,
] as Tool[];

/** Bigints (lamports, job ids) are not JSON; agents read them fine as strings. */
function toJson(output: unknown): string {
  return JSON.stringify(
    output,
    (_key, value) => (typeof value === 'bigint' ? `${value}` : value),
    2,
  );
}

function register(server: McpServer, context: Context, tool: Tool): void {
  const config = { description: tool.description, inputSchema: tool.input };

  server.registerTool(tool.name, config, async (args) => {
    // Thrown errors become `isError` results; make their text the reason an agent can act on.
    const output = await tool.run(context, args as never).catch((error) => {
      throw new Error(describeError(error));
    });

    return { content: [{ type: 'text' as const, text: toJson(output) }] };
  });
}

export function createServer(context: Context): McpServer {
  const server = new McpServer({ name: 'agent-escrow', version: VERSION });

  for (const tool of TOOLS) register(server, context, tool);

  return server;
}
