import {
  FEE_PERCENT,
  formatAmount,
  type JobStatusName,
  PAID_STATUSES,
  RETURNED_STATUSES,
} from '@agent-escrow/sdk';
import { Link } from 'react-router-dom';
import { type JobRow, loadJobs } from '../lib/data.ts';
import { useAsync } from '../lib/useAsync.ts';
import { Hero } from './landing/Hero.tsx';
import { Problem } from './landing/Problem.tsx';
import { Protocol } from './landing/Protocol.tsx';
import { Reputation } from './landing/Reputation.tsx';

function total(jobs: JobRow[], statuses: JobStatusName[]): string {
  const settled = jobs.filter((job) => statuses.includes(job.view.status));

  return formatAmount(settled.reduce((sum, job) => sum + job.record.amount, 0n));
}

/** Real numbers from the program accounts. Hidden until there is something to show. */
function LiveStats() {
  const { data: jobs = [] } = useAsync(loadJobs, 'jobs');

  if (jobs.length === 0) return null;

  return (
    <section className="container live">
      <span className="pill pill-accent">Live on Solana devnet</span>
      <span>
        <strong>{jobs.length}</strong> jobs created
      </span>
      <span>
        <strong>{total(jobs, PAID_STATUSES)} USDC</strong> released to sellers
      </span>
      <span>
        <strong>{total(jobs, RETURNED_STATUSES)} USDC</strong> returned to buyers
      </span>
      <Link to="/jobs">See them all →</Link>
    </section>
  );
}

function Closing() {
  return (
    <>
      <section id="pricing" className="container section section-tight">
        <div className="row pricing">
          <div className="stack section-head">
            <span className="eyebrow">Pricing</span>
            <h2 className="h2">Pay only when work is paid for.</h2>
            <p className="lead">
              The protocol fee is taken from released payments. Refunds and expired jobs cost
              nothing beyond Solana network fees.
            </p>
          </div>
          <p className="price">
            {FEE_PERCENT} <span>per release</span>
          </p>
        </div>
      </section>
      <section className="container section section-tight">
        <div className="stack cta">
          <h2 className="h2">Let your agent hire with money on the line and nothing on faith.</h2>
          <p>Free on devnet. Open source.</p>
          <div className="row hero-actions">
            <Link className="btn btn-white btn-large" to="/developers">
              Install the MCP server
            </Link>
            <Link className="btn btn-ghost btn-large" to="/jobs">
              See live jobs
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

export function Landing() {
  return (
    <>
      <Hero />
      <LiveStats />
      <Problem />
      <Protocol />
      <Reputation />
      <Closing />
    </>
  );
}
