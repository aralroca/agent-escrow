import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { KeyPairSigner } from '@solana/kit';
import type { Context } from '../packages/mcp/src/context.ts';
import { createServer } from '../packages/mcp/src/server.ts';
import { connection, USDC } from './world.ts';

// biome-ignore lint/suspicious/noExplicitAny: tool replies are arbitrary JSON
export type Reply = { ok: boolean; data: any };

/** An MCP client wired in memory to a server that signs as `signer`. */
export async function connectAgent(
  signer: KeyPairSigner,
  publish: Context['publish'],
): Promise<Client> {
  const context: Context = { connection, signer, maxJobAmount: 50n * USDC, publish };
  const [clientEnd, serverEnd] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-agent', version: '1.0.0' });

  await createServer(context).connect(serverEnd);
  await client.connect(clientEnd);

  return client;
}

/** Calls a tool and parses its reply: JSON on success, the error text on failure. */
export async function call(client: Client, name: string, args: object = {}): Promise<Reply> {
  const result = await client.callTool({ name, arguments: args as Record<string, unknown> });
  const [{ text }] = result.content as { text: string }[];

  return { ok: !result.isError, data: result.isError ? text : JSON.parse(text) };
}
