// Local chain for developing the web app: `pnpm dev:chain`, then `pnpm dev:web` in another shell.
import { seed } from './seed.ts';
import startValidator from './validator.ts';

await startValidator();
const { completed, rejected, funded } = await seed();

console.log(`Local validator ready with seeded jobs:
  completed  ${completed}
  rejected   ${rejected}
  funded     ${funded}
Press Ctrl+C to stop.`);
