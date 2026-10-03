// Regenerates src/generated from the Anchor IDL. Run with `pnpm --filter @agent-escrow/sdk generate`.
import { readFileSync, rmSync } from 'node:fs';
import { rootNodeFromAnchor } from '@codama/nodes-from-anchor';
import renderVisitor from '@codama/renderers-js';
import { createFromRoot } from 'codama';

const idl = JSON.parse(readFileSync(new URL('../idl/agent_escrow.json', import.meta.url), 'utf8'));
const codama = createFromRoot(rootNodeFromAnchor(idl));
const options = {
  deleteFolderBeforeRendering: false,
  kitImportStrategy: 'rootOnly',
  syncPackageJson: false,
};

rmSync(new URL('../src/generated', import.meta.url), { recursive: true, force: true });
await codama.accept(renderVisitor('.', options));
