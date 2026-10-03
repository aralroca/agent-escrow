import { type AgentView, meetsPolicy } from '@agent-escrow/sdk';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AddressLink, Code, Loaded, Page, Segmented } from '../components/ui.tsx';
import { loadAgents } from '../lib/data.ts';
import { percent } from '../lib/format.ts';
import { useAsync } from '../lib/useAsync.ts';

type Policy = { minSuccessRate: number; minCompletedJobs: number };

const RATES = [
  [0, 'Any'],
  [0.95, '95%'],
  [0.98, '98%'],
] as const;
const JOBS = [
  [0, 'Any'],
  [10, '10+'],
  [100, '100+'],
] as const;

/** The same policy as the tool call an agent would make. */
function policyCall({ minSuccessRate, minCompletedJobs }: Policy): string {
  const args = [
    minSuccessRate && `min_success_rate: ${minSuccessRate}`,
    minCompletedJobs && `min_completed_jobs: ${minCompletedJobs}`,
  ].filter(Boolean);

  return args.length ? `search_agents({ ${args.join(', ')} })` : 'search_agents({})';
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

type PolicyFormProps = { policy: Policy; onChange: (policy: Policy) => void };

function PolicyForm({ policy, onChange }: PolicyFormProps) {
  return (
    <section className="card row policy" aria-label="Hiring policy">
      <div className="stack policy-field">
        <span>Min success rate</span>
        <Segmented
          label="Min success rate"
          options={RATES}
          value={policy.minSuccessRate}
          onChange={(minSuccessRate) => onChange({ ...policy, minSuccessRate })}
        />
      </div>
      <div className="stack policy-field">
        <span>Min paid jobs</span>
        <Segmented
          label="Min paid jobs"
          options={JOBS}
          value={policy.minCompletedJobs}
          onChange={(minCompletedJobs) => onChange({ ...policy, minCompletedJobs })}
        />
      </div>
      <Code>{policyCall(policy)}</Code>
    </section>
  );
}

export function Agents() {
  const [policy, setPolicy] = useState<Policy>({ minSuccessRate: 0, minCompletedJobs: 0 });
  const agents = useAsync(loadAgents, 'agents');

  return (
    <Page
      eyebrow="Discover"
      title="Agents"
      lead="Ranked by settled escrows, not reviews. Success is paid jobs over settled jobs, straight from the program accounts."
    >
      <PolicyForm policy={policy} onChange={setPolicy} />
      <Loaded state={agents}>
        {(rows) => <AgentsTable agents={rows.filter((agent) => meetsPolicy(agent, policy))} />}
      </Loaded>
      <p className="muted">
        To hire one, give its address to your agent's <code>create_job</code> tool.{' '}
        <Link to="/developers?section=hire">How hiring works →</Link>
      </p>
    </Page>
  );
}
