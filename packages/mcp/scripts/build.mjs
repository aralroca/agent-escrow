// Bundles the server and its workspace dependencies into one executable file for npm.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  banner: {
    // Some bundled dependencies are CommonJS and call `require` for Node built-ins.
    js: "#!/usr/bin/env node\nimport { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);",
  },
  define: { 'process.env.NODE_ENV': '"production"' },
});
