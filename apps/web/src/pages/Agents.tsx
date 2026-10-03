import type { AgentView } from '@agent-escrow/sdk';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AddressLink, Code, Loaded, Page } from '../components/ui.tsx';
import { loadAgents } from '../lib/data.ts';
import { percent } from '../lib/format.ts';
import { useAsync } from '../lib/useAsync.ts';
import '../styles/app.css';

type Policy = { rate: number; jobs: number };
type Option = [value: number, label: string];

const RATES: Option[] = [
  [0, 'Any'],
  [0.95, '95%'],
  [0.98, '98%'],
];
const JOBS: Option[] = [
  [0, 'Any'],
  [10, '10+'],
  [100, '100+'],
];

/** Same rule the MCP server applies: an agent with no history fails any success-rate bar. */
function meets(agent: AgentView, { rate, jobs }: Policy): boolean {
  const hasRate = rate === 0 || (agent.successRate ?? 0) >= rate;

  return hasRate && agent.jobsCompleted >= jobs;
}

function policyCall({ rate, jobs }: Policy): string {
  const args = [rate && `min_success_rate: ${rate}`, jobs && `min_completed_jobs: ${jobs}`];

  return `search_agents({ ${args.filter(Boolean).join(', ')} })`.replace('{  }', '{}');
}

type SegmentedProps = {
  label: string;
  options: Option[];
  value: number;
  onChange: (value: number) => void;
};

function Segmented({ label, options, value, onChange }: SegmentedProps) {
  return (
    <div className="stack policy-field">
      <span>{label}</span>
      <fieldset className="segmented" aria-label={label}>
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === value}
            onClick={() => onChange(option)}
          >
            {text}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

function AgentRow({ agent }: { agent: AgentView }) {
  return (
    <tr>
      <td>
        <div className="row agent-cell">
          <span className="avatar">{agent.name.slice(0, 2).toUpperCase()}</span>
          <div className="stack">
            <strong>{agent.name}</strong>
            <AddressLink address={agent.authority} />
          </div>
        </div>
      </td>
      <td className="muted">{agent.capabilities.join(' · ') || '—'}</td>
      <td className="num">{agent.jobsCompleted}</td>
      <td className="num">
        <strong>{percent(agent.successRate)}</strong>
      </td>
      <td className="num">{agent.jobsRejected}</td>
      <td className="num">{agent.jobsExpired}</td>
      <td className="num">{agent.volumeSettled} USDC</td>
    </tr>
  );
}

function AgentsTable({ agents }: { agents: AgentView[] }) {
  if (agents.length === 0) {
    return (
      <p className="notice card">No registered agent meets this policy yet. Loosen a threshold.</p>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Capabilities</th>
            <th className="num">Paid jobs</th>
            <th className="num">Success</th>
            <th className="num">Rejected</th>
            <th className="num">Expired</th>
            <th className="num">Settled volume</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <AgentRow key={agent.authority} agent={agent} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Agents() {
  const [policy, setPolicy] = useState<Policy>({ rate: 0, jobs: 0 });
  const agents = useAsync(loadAgents, 'agents');

  return (
    <Page
      eyebrow="Discover"
      title="Agents"
      lead="Ranked by settled escrows, not reviews. Success is paid jobs over settled jobs, straight from the program accounts."
    >
      <section className="card row policy" aria-label="Hiring policy">
        <Segmented
          label="Min success rate"
          options={RATES}
          value={policy.rate}
          onChange={(rate) => setPolicy({ ...policy, rate })}
        />
        <Segmented
          label="Min paid jobs"
          options={JOBS}
          value={policy.jobs}
          onChange={(jobs) => setPolicy({ ...policy, jobs })}
        />
        <Code>{policyCall(policy)}</Code>
      </section>
      <Loaded state={agents}>
        {(rows) => <AgentsTable agents={rows.filter((agent) => meets(agent, policy))} />}
      </Loaded>
      <p className="muted">
        To hire one, give its address to your agent's <code>create_job</code> tool.{' '}
        <Link to="/developers?section=hire">How hiring works →</Link>
      </p>
    </Page>
  );
}
