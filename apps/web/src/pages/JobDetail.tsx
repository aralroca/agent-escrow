import type { JobView } from '@agent-escrow/sdk';
import { FEE_PERCENT, formatAmount, protocolFee } from '@agent-escrow/sdk';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AddressLink, Loaded, StatusPill } from '../components/ui.tsx';
import { explorerUrl } from '../lib/chain.ts';
import { type JobRow, loadActivity, loadAgents, loadJob, namesOf } from '../lib/data.ts';
import { dateTime, relativeTime, shortAddress } from '../lib/format.ts';
import { useAsync } from '../lib/useAsync.ts';
import { JobTitle } from './Jobs.tsx';
import { Stepper } from './job/Stepper.tsx';
import { VerificationCard } from './job/VerificationCard.tsx';

const REFRESH_MS = 12_000;

function Money({ job: { record, view } }: { job: JobRow }) {
  const { amount } = record;

  return (
    <section className="card stack money">
      <span>Escrow amount</span>
      <p className="money-amount">
        {view.amount} <span>USDC</span>
      </p>
      <dl>
        <div>
          <dt>To the seller if it passes</dt>
          <dd>{formatAmount(amount - protocolFee(amount))}</dd>
        </div>
        <div>
          <dt>Protocol fee ({FEE_PERCENT})</dt>
          <dd>{view.fee}</dd>
        </div>
        <div>
          <dt>To the buyer if it fails</dt>
          <dd>{view.amount}</dd>
        </div>
      </dl>
    </section>
  );
}

function Parties({ view }: { view: JobView }) {
  const agents = useAsync(loadAgents, 'agents');
  const names = namesOf(agents.data);
  const parties = [
    ['Buyer', view.client],
    ['Seller', view.provider],
    ['Evaluator', view.evaluator],
  ];

  return (
    <section className="card stack">
      <h2>Parties</h2>
      {parties.map(([role, address]) => (
        <div key={role} className="row party">
          <span>{role}</span>
          <AddressLink address={address} name={names.get(address)} />
        </div>
      ))}
      {view.evaluator === view.client && (
        <p className="muted small">
          The buyer is its own evaluator here. <Link to="/security">What that means.</Link>
        </p>
      )}
    </section>
  );
}

function Activity({ job }: { job: JobRow }) {
  const activity = useAsync(() => loadActivity(job.view), `${job.view.address}:${job.view.status}`);

  return (
    <section className="card stack">
      <h2>On-chain activity</h2>
      <Loaded state={activity}>
        {(entries) => (
          <ul className="stack activity">
            {entries.map((entry) => (
              <li key={entry.signature} className="row">
                <code className="pill pill-accent">{entry.instruction ?? 'transaction'}</code>
                <span className="muted">{entry.time ? relativeTime(entry.time) : ''}</span>
                <a className="mono" href={explorerUrl('tx', entry.signature)}>
                  {shortAddress(entry.signature)} ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </Loaded>
    </section>
  );
}

function JobBody({ job }: { job: JobRow }) {
  const { view } = job;

  return (
    <div className="stack job">
      <div className="stack job-head">
        <span className="muted">
          <Link to="/jobs">Jobs</Link> / <span className="mono">{shortAddress(view.address)}</span>
        </span>
        <h1 className="page-title">
          <JobTitle job={job} />
        </h1>
        <div className="row job-pills">
          <StatusPill status={view.status} />
          <span className="pill">Deliver by {dateTime(view.deadline)}</span>
          <span className="pill">
            Review window {Math.round(view.reviewWindowSeconds / 60)} min
          </span>
          <a className="pill" href={view.specUri}>
            Spec ↗
          </a>
          {view.resultUri && (
            <a className="pill" href={view.resultUri}>
              Deliverable ↗
            </a>
          )}
        </div>
      </div>
      <Stepper view={view} />
      <div className="job-columns">
        <div className="stack job-main">
          <VerificationCard job={job} />
          <Activity job={job} />
        </div>
        <div className="stack job-side">
          <Money job={job} />
          <Parties view={view} />
        </div>
      </div>
    </div>
  );
}

/** Refetches an open job every few seconds; settled jobs and hidden tabs cost no requests. */
function useJob(address: string) {
  const [tick, setTick] = useState(0);
  const job = useAsync(() => loadJob(address), `${address}:${tick}`);
  const settled = Boolean(job.data?.view.settledAt);

  useEffect(
    function pollWhileOpen() {
      const refresh = () => document.hidden || setTick((value) => value + 1);
      const id = settled ? undefined : setInterval(refresh, REFRESH_MS);

      return () => clearInterval(id);
    },
    [settled],
  );

  return job;
}

function JobLoader({ address }: { address: string }) {
  return <Loaded state={useJob(address)}>{(row) => <JobBody job={row} />}</Loaded>;
}

export function JobDetail() {
  const { address = '' } = useParams();

  return (
    <div className="page">
      <div className="container page-inner">
        {/* Keyed by address so one job's data is never shown under another's URL. */}
        <JobLoader key={address} address={address} />
      </div>
    </div>
  );
}
