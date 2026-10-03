import type { JobView } from '@agent-escrow/sdk';
import type { ReactNode } from 'react';
import { explorerUrl } from '../lib/chain.ts';
import { shortAddress } from '../lib/format.ts';
import { highlight } from '../lib/highlight.ts';
import type { Async } from '../lib/useAsync.ts';

const STATUS_STYLE: Record<JobView['status'], string> = {
  Funded: 'pill-accent',
  Accepted: 'pill-accent',
  Submitted: 'pill-warn',
  Completed: 'pill-good',
  Claimed: 'pill-good',
  Rejected: 'pill-bad',
  Expired: 'pill-bad',
  Refunded: '',
};

export function StatusPill({ status }: { status: JobView['status'] }) {
  return <span className={`pill ${STATUS_STYLE[status]}`}>{status}</span>;
}

/** A syntax-coloured block of JSON or TypeScript. */
export function Code({ children }: { children: string }) {
  return (
    <pre className="code">
      {highlight(children).map((token, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: tokens are static and never reorder
        <span key={index} className={token.kind && `tok-${token.kind}`}>
          {token.text}
        </span>
      ))}
    </pre>
  );
}

/** A wallet or account address that links to the Solana explorer. */
export function AddressLink({ address, name }: { address: string; name?: string }) {
  return (
    <a className={name ? undefined : 'mono'} href={explorerUrl('address', address)} title={address}>
      {name ?? shortAddress(address)}
    </a>
  );
}

type LoadedProps<T> = { state: Async<T>; children: (data: T) => ReactNode };

/** Renders loading and error notices for chain data, and the children once it arrived. */
export function Loaded<T>({ state, children }: LoadedProps<T>) {
  if (state.loading) return <p className="notice">Reading from Solana…</p>;
  if (state.error) return <p className="notice" role="alert">{`Could not load: ${state.error}`}</p>;

  return <>{children(state.data as T)}</>;
}

type PageProps = { eyebrow: string; title: string; lead: ReactNode; children: ReactNode };

/** The shared frame of the app pages: grey ground, heading block, content. */
export function Page({ eyebrow, title, lead, children }: PageProps) {
  return (
    <div className="page">
      <div className="container stack page-inner">
        <div className="stack page-head">
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="page-title">{title}</h1>
          <p className="lead">{lead}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
