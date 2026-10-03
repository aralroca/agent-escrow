import { connect, DEVNET_RPC } from '@agent-escrow/sdk';

const STORAGE_KEY = 'agent-escrow:rpc';

/**
 * The public devnet RPC is rate limited. Opening the site once with `?rpc=<url>` stores another
 * endpoint in this browser; `?rpc=` with an empty value goes back to the default.
 */
function rpcOverride(): string | undefined {
  const requested = new URLSearchParams(window.location.search).get('rpc');

  try {
    if (requested) localStorage.setItem(STORAGE_KEY, requested);
    if (requested === '') localStorage.removeItem(STORAGE_KEY);

    return localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return requested || undefined;
  }
}

export const rpcUrl: string = rpcOverride() ?? import.meta.env.VITE_RPC_URL ?? DEVNET_RPC;

export const { rpc } = connect(rpcUrl);

const cluster = rpcUrl === DEVNET_RPC ? 'devnet' : `custom&customUrl=${encodeURIComponent(rpcUrl)}`;

export function explorerUrl(kind: 'address' | 'tx', id: string): string {
  return `https://explorer.solana.com/${kind}/${id}?cluster=${cluster}`;
}
