import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { contextFromEnv } from './context.ts';
import { createServer } from './server.ts';

const context = await contextFromEnv().catch((error: Error) => {
  // stdout carries the protocol, so configuration problems go to stderr.
  console.error(`agent-escrow-mcp could not start: ${error.message}`);
  process.exit(1);
});

serveStdio(() => createServer(context));
