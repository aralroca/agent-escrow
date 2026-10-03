import { connect, DEVNET_RPC } from '@agent-escrow/sdk';

const DEFAULT_RPC: string = import.meta.env.VITE_RPC_URL ?? DEVNET_RPC;

/**
 * The public devnet RPC is rate limited, so `?rpc=<url>` reads from another endpoint. It applies
 * only while it is in the address and is never stored: whoever controls the endpoint controls
 * what this page shows, so one link must not be able to switch it for later visits.
 */
const requestedRpc = new URLSearchParams(window.location.search).get('rpc');

export const rpcUrl = requestedRpc || DEFAULT_RPC;

/** True when the data on screen comes from an endpoint named in the link. */
export const usesCustomRpc = rpcUrl !== DEFAULT_RPC;

export const { rpc } = connect(rpcUrl);

const cluster = rpcUrl === DEVNET_RPC ? 'devnet' : `custom&customUrl=${encodeURIComponent(rpcUrl)}`;

export function explorerUrl(kind: 'address' | 'tx', id: string): string {
  return `https://explorer.solana.com/${kind}/${id}?cluster=${cluster}`;
}
