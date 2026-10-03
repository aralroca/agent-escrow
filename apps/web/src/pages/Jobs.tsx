import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AddressLink, Loaded, Page, StatusPill } from '../components/ui.tsx';
import { type JobRow, loadAgents, loadJobs, loadSpec, namesOf } from '../lib/data.ts';
import { relativeTime, shortAddress } from '../lib/format.ts';
import { useAsync } from '../lib/useAsync.ts';
import '../styles/app.css';

const FILTERS = {
  All: undefined,
  Open: new Set(['Funded', 'Accepted', 'Submitted']),
  Paid: new Set(['Completed', 'Claimed']),
  Returned: new Set(['Rejected', 'Expired', 'Refunded']),
} as const;

type Filter = keyof typeof FILTERS;

/** The job title lives in its spec, so it arrives after the row. */
export function JobTitle({ job }: { job: JobRow }) {
  const spec = useAsync(() => loadSpec(job.record), job.view.specUri);

  return <>{spec.data?.title ?? `Job ${shortAddress(job.view.address)}`}</>;
}

function JobRowView({ job, names }: { job: JobRow; names: Map<string, string> }) {
  const { view } = job;

  return (
    <tr>
      <td>
        <Link className="row-title" to={`/jobs/${view.address}`}>
          <JobTitle job={job} />
        </Link>
      </td>
      <td>
        <StatusPill status={view.status} />
      </td>
      <td className="num">{view.amount} USDC</td>
      <td>
        <AddressLink address={view.client} name={names.get(view.client)} />
        {' → '}
        <AddressLink address={view.provider} name={names.get(view.provider)} />
      </td>
      <td className="muted">{view.createdAt ? relativeTime(view.createdAt) : '—'}</td>
    </tr>
  );
}

function JobsTable({ jobs, names }: { jobs: JobRow[]; names: Map<string, string> }) {
  if (jobs.length === 0) return <p className="notice card">No jobs match this filter yet.</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Job</th>
            <th>Status</th>
            <th className="num">Amount</th>
            <th>Buyer → Seller</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <JobRowView key={job.view.address} job={job} names={names} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterTabs({ value, onChange }: { value: Filter; onChange: (filter: Filter) => void }) {
  return (
    <fieldset className="segmented" aria-label="Filter jobs by status">
      {(Object.keys(FILTERS) as Filter[]).map((filter) => (
        <button
          key={filter}
          type="button"
          aria-pressed={filter === value}
          onClick={() => onChange(filter)}
        >
          {filter}
        </button>
      ))}
    </fieldset>
  );
}

export function Jobs() {
  const [filter, setFilter] = useState<Filter>('All');
  const jobs = useAsync(loadJobs, 'jobs');
  const agents = useAsync(loadAgents, 'agents');
  const matches = (job: JobRow) => FILTERS[filter]?.has(job.view.status) ?? true;

  return (
    <Page
      eyebrow="Explorer"
      title="Jobs"
      lead="Every escrow created through the program, read straight from Solana. Open one to see its acceptance test and re-run it yourself."
    >
      <FilterTabs value={filter} onChange={setFilter} />
      <Loaded state={jobs}>
        {(rows) => <JobsTable jobs={rows.filter(matches)} names={namesOf(agents.data)} />}
      </Loaded>
    </Page>
  );
}
