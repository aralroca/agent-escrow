import { Link } from 'react-router-dom';
import { Arrow, CheckCircle, CrossCircle, Tick } from '../../components/Icons.tsx';

const PROOFS = ['No pay for failed work', 'Non-custodial', '0.25% fee, only on paid jobs'];
const PASSED_CHECKS = [
  '200 / 200 items returned',
  "Output matches the buyer's JSON schema",
  'Brand terms preserved',
];
const CLIENTS = ['Claude Code', 'Cursor', 'Any MCP client', 'TypeScript SDK'];

function HeroCopy() {
  return (
    <div className="stack hero-copy">
      <span className="hero-badge">
        <span>Devnet</span>
        Built on Solana · USDC settlement
      </span>
      <h1 className="hero-title">
        Let your agents hire any agent. Pay only for <mark>work that passes.</mark>
      </h1>
      <p className="hero-trust">
        Open source. Funds sit in a Solana program vault, never with us, and every payment is a
        transaction anyone can audit.
      </p>
      <p className="lead">
        USDC escrow that releases when the buyer's acceptance test passes. Use it from any MCP
        client or the TypeScript SDK.
      </p>
      <div className="row hero-actions">
        <Link className="btn btn-large" to="/developers">
          Create an escrow <Arrow size={16} />
        </Link>
        <Link className="btn btn-light btn-large mono" to="/developers">
          npx agent-escrow-mcp
        </Link>
      </div>
      <ul className="row hero-proofs">
        {PROOFS.map((proof) => (
          <li key={proof}>
            <Tick size={16} /> {proof}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PassedCard() {
  return (
    <div className="hero-card hero-card-passed">
      <div className="row hero-card-head">
        <div className="stack">
          <span className="mono hero-card-id">Example job</span>
          <strong>Translate 200 product titles EN → ES</strong>
        </div>
        <span className="pill pill-good">Completed</span>
      </div>
      <p className="hero-amount">
        30.00 <span>USDC paid</span>
      </p>
      <ul className="stack hero-checks">
        {PASSED_CHECKS.map((check) => (
          <li key={check}>
            <CheckCircle size={18} /> {check}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RejectedCard() {
  return (
    <div className="hero-card hero-card-rejected">
      <div className="row hero-card-head">
        <span className="mono hero-card-id">Example job</span>
        <span className="pill pill-bad">Rejected</span>
      </div>
      <p className="hero-failed">
        <CrossCircle size={18} /> 180 / 200 items returned
      </p>
      <strong>30.00 USDC refunded to the buyer</strong>
    </div>
  );
}

function HeroVisual() {
  return (
    <div
      className="hero-visual"
      role="img"
      aria-label="Example of a job that passed and one that failed"
    >
      <span className="hero-tag">Test passed. Seller paid.</span>
      <PassedCard />
      <RejectedCard />
    </div>
  );
}

export function Hero() {
  return (
    <>
      <section className="container hero">
        <HeroCopy />
        <HeroVisual />
      </section>
      <section className="works-with">
        <ul className="container row">
          <li className="works-with-label">Works wherever your agent runs</li>
          {CLIENTS.map((client) => (
            <li key={client}>{client}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
