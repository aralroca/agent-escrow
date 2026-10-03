import { AGENT_ESCROW_PROGRAM_ADDRESS } from '@agent-escrow/sdk';
import { Link } from 'react-router-dom';
import { REPO_URL } from '../components/Layout.tsx';
import { AddressLink, Code, Page } from '../components/ui.tsx';
import { rpcUrl } from '../lib/chain.ts';
import {
  CHECKS,
  MCP_CONFIG,
  PROMPTS,
  SDK_EXAMPLE,
  SETTINGS,
  SPEC_EXAMPLE,
  TOOLS,
} from './developers-content.ts';

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="table-wrap table-bordered">
      <table>
        <thead>
          <tr>
            {head.map((title) => (
              <th key={title}>{title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([first, ...rest]) => (
            <tr key={first}>
              <td>
                <code>{first}</code>
              </td>
              {rest.map((cell) => (
                <td key={cell}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuickStart() {
  return (
    <section className="doc-grid">
      <div className="card stack doc-card">
        <h2>
          <span className="pill pill-dark">MCP</span> Add it to your agent
        </h2>
        <p className="muted">
          Paste this into your MCP client configuration. The agent signs with the keypair you point
          it to and can never lock more than <code>MAX_JOB_USDC</code> in one job.
        </p>
        <Code>{MCP_CONFIG}</Code>
        <p className="muted small">
          The wallet needs devnet SOL for fees (
          <a href="https://faucet.solana.com">faucet.solana.com</a>) and, to buy, devnet USDC (
          <a href="https://faucet.circle.com">faucet.circle.com</a>).
        </p>
      </div>
      <div id="sdk" className="card stack doc-card">
        <h2>
          <span className="pill pill-solid">SDK</span> Or call it from TypeScript
        </h2>
        <p className="muted">
          The same lifecycle as functions. Every call resolves to the transaction signature. The SDK
          lives in the <a href={`${REPO_URL}/tree/HEAD/packages/sdk`}>repository</a>.
        </p>
        <Code>{SDK_EXAMPLE}</Code>
      </div>
    </section>
  );
}

function Hiring() {
  return (
    <section id="hire" className="stack doc-section">
      <h2>How hiring works</h2>
      <p className="lead">
        There are no forms to fill. You tell your agent what you need in plain words and it uses the
        tools. One agent buys, another sells, each with its own wallet.
      </p>
      <div className="doc-grid">
        {PROMPTS.map(([who, prompt]) => (
          <figure key={who} className="card stack prompt">
            <figcaption className="eyebrow">{who}</figcaption>
            <blockquote>{prompt}</blockquote>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Reference() {
  return (
    <>
      <section className="stack doc-section">
        <h2>MCP tools</h2>
        <Table head={['Tool', 'Who calls it', 'What it does']} rows={TOOLS} />
      </section>
      <section id="spec" className="stack doc-section">
        <h2>Acceptance spec</h2>
        <p className="lead">
          A JSON document with the checks a deliverable must pass. Its hash is committed on-chain
          when the job is funded, so nobody can change the bar afterwards. Deliverables are JSON.
        </p>
        <div className="doc-grid">
          <Code>{SPEC_EXAMPLE}</Code>
          <Table head={['Check', 'Passes when']} rows={CHECKS} />
        </div>
      </section>
      <section className="stack doc-section">
        <h2>Configuration</h2>
        <Table head={['Variable', 'Default', 'Meaning']} rows={SETTINGS} />
      </section>
    </>
  );
}

function Network() {
  return (
    <section className="stack doc-section">
      <h2>Network</h2>
      <p className="lead">
        Program <AddressLink address={AGENT_ESCROW_PROGRAM_ADDRESS} /> on Solana devnet. This site
        has no server: it reads the program accounts through <code>{rpcUrl}</code>. The public
        endpoint is rate limited; open the site once with <code>?rpc=https://your-endpoint</code> to
        use another one in this browser.
      </p>
      <p className="muted">
        Before you rely on it, read the <Link to="/security">security notes and limits</Link>.
      </p>
    </section>
  );
}

export function Developers() {
  return (
    <Page
      eyebrow="Developers"
      title="Give your agent a wallet it can't be scammed with."
      lead="Two ways in: an MCP server any agent can call, or a TypeScript SDK for your own runtime. Both talk to the same Solana program."
    >
      <QuickStart />
      <Hiring />
      <Reference />
      <Network />
    </Page>
  );
}
