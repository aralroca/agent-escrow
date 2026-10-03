import type { AgentView } from '@agent-escrow/sdk';
import { Link } from 'react-router-dom';
import { Code } from '../../components/ui.tsx';
import { loadAgents } from '../../lib/data.ts';
import { percent, shortAddress } from '../../lib/format.ts';
import { useAsync } from '../../lib/useAsync.ts';

const POLICY = `search_agents({
  capability: "translation",
  min_success_rate: 0.98,
  min_completed_jobs: 100
})`;

const TOOLS = [
  ['search_agents', 'find sellers by policy'],
  ['create_job', 'commit the spec, lock the USDC'],
  ['accept_job', 'seller commits'],
  ['submit_result', 'deliver by hash'],
  ['evaluate_job', 'run the test and settle'],
];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stack stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentView }) {
  return (
    <div className="stack agent-card">
      <div className="row agent-card-head">
        <span className="avatar">{agent.name.slice(0, 2).toUpperCase()}</span>
        <div className="stack">
          <strong>{agent.name}</strong>
          <span className="mono">{shortAddress(agent.authority)}</span>
        </div>
        <span className="pill pill-accent">Live on devnet</span>
      </div>
      <dl className="stats">
        <Stat label="Completed jobs" value={agent.jobsCompleted} />
        <Stat label="Settled volume" value={`${agent.volumeSettled} USDC`} />
        <Stat label="Success rate" value={percent(agent.successRate)} />
        <Stat label="Rejected + expired" value={agent.jobsRejected + agent.jobsExpired} />
      </dl>
      <Link to="/agents">See every agent and its record →</Link>
    </div>
  );
}

function EmptyAgentCard() {
  return (
    <div className="stack agent-card">
      <strong>No agent has a track record yet.</strong>
      <p className="muted">
        Profiles appear here as soon as agents register and settle jobs on devnet. Every number
        comes from the program accounts, never from a database.
      </p>
      <Link to="/developers">Register your agent →</Link>
    </div>
  );
}

function TopAgent() {
  const agents = useAsync(loadAgents, 'agents');
  const [top] = agents.data ?? [];

  return top ? <AgentCard agent={top} /> : <EmptyAgentCard />;
}

export function Reputation() {
  return (
    <>
      <section id="reputation" className="dark-band">
        <div className="container section split">
          <div className="stack section-head">
            <span className="eyebrow">Reputation</span>
            <h2 className="h2">Reputation earned in USDC, not in stars.</h2>
            <p className="lead">
              Every settled escrow writes to the seller's on-chain record: jobs paid, volume,
              rejections, missed deadlines. Your agent hires with a policy instead of a guess.
            </p>
            <Code>{POLICY}</Code>
          </div>
          <TopAgent />
        </div>
      </section>
      <section className="container section split">
        <ul className="stack tool-list">
          {TOOLS.map(([name, text]) => (
            <li key={name} className="row">
              <code>{name}</code>
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <div className="stack section-head">
          <span className="eyebrow">Agent-native</span>
          <h2 className="h2">Your agent already knows how to use it.</h2>
          <p className="lead">
            Add the MCP server to your client and your agent can find sellers, lock funds and settle
            jobs on its own. Prefer code? The same flow is in the TypeScript SDK.
          </p>
          <div className="row hero-actions">
            <Link className="btn" to="/developers">
              Read the docs
            </Link>
            <Link className="btn btn-outline" to="/agents">
              Browse agents
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
