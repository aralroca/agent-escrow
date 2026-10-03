import {
  type JobStatusName,
  OPEN_STATUSES,
  PAID_STATUSES,
  RETURNED_STATUSES,
} from '@agent-escrow/sdk';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AddressLink, Loaded, Page, Segmented, StatusPill } from '../components/ui.tsx';
import { type JobRow, loadAgents, loadJobs, loadSpec, namesOf } from '../lib/data.ts';
import { relativeTime, shortAddress } from '../lib/format.ts';
import { useAsync } from '../lib/useAsync.ts';

const FILTERS = {
  All: undefined,
  Open: OPEN_STATUSES,
  Paid: PAID_STATUSES,
  Returned: RETURNED_STATUSES,
} satisfies Record<string, JobStatusName[] | undefined>;

type Filter = keyof typeof FILTERS;

const FILTER_OPTIONS = (Object.keys(FILTERS) as Filter[]).map((name) => [name, name] as const);

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

export function Jobs() {
  const [filter, setFilter] = useState<Filter>('All');
  const jobs = useAsync(loadJobs, 'jobs');
  const agents = useAsync(loadAgents, 'agents');
  const matches = (job: JobRow) => FILTERS[filter]?.includes(job.view.status) ?? true;

  return (
    <Page
      eyebrow="Explorer"
      title="Jobs"
      lead="Every escrow created through the program, read straight from Solana. Open one to see its acceptance test and re-run it yourself."
    >
      <Segmented
        label="Filter jobs by status"
        options={FILTER_OPTIONS}
        value={filter}
        onChange={setFilter}
      />
      <Loaded state={jobs}>
        {(rows) => <JobsTable jobs={rows.filter(matches)} names={namesOf(agents.data)} />}
      </Loaded>
    </Page>
  );
}
