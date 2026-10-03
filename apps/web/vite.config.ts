import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served from https://aralroca.github.io/agent-escrow/ on GitHub Pages.
export default defineConfig(({ mode }) => ({
  base: '/agent-escrow/',
  plugins: [react()],
  // The generated program client reads process.env.NODE_ENV, which browsers do not have.
  define: { 'process.env': JSON.stringify({ NODE_ENV: mode }) },
}));
