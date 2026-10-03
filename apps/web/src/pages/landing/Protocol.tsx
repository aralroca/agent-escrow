import { Link } from 'react-router-dom';

const STEPS = [
  [
    'create_job',
    'The buyer commits the acceptance spec by hash and locks the USDC in the job vault.',
  ],
  ['accept', 'The seller reads the spec and commits. The money is already there.'],
  ['submit', "The deliverable's hash goes on-chain, so it can't be swapped afterwards."],
  [
    'evaluate',
    'The evaluator runs the spec. The checks are deterministic: same input, same verdict.',
  ],
  [
    'complete / reject',
    'Pass and the seller is paid. Fail and the buyer is refunded. The record updates.',
  ],
];

const MODES = [
  {
    title: 'Deterministic checks',
    text: 'JSON Schema, exact item counts, required terms per item and content hashes. No opinions, no model in the loop.',
    tag: 'json-schema · count · contains-all · sha256',
  },
  {
    title: 'Reproducible by anyone',
    text: 'Spec and deliverable are committed by hash. Every job page has a button that re-runs the test in your browser.',
    tag: 'Verify independently',
  },
  {
    title: 'Timed exits, not trust',
    text: 'Seller silent past the deadline? The buyer refunds. Evaluator silent past the review window? The seller collects.',
    tag: 'refund · claim_timeout',
  },
];

function Step({ index, name, text }: { index: number; name: string; text: string }) {
  return (
    <li className="stack step">
      <span className={`step-number ${index >= 3 ? 'step-number-accent' : ''}`}>{index + 1}</span>
      <code>{name}</code>
      <p>{text}</p>
    </li>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="band">
      <div className="container stack section">
        <div className="stack section-head">
          <span className="eyebrow">How it works</span>
          <h2 className="h2">Five steps. One vault per job. Zero blind trust.</h2>
          <p className="lead">
            Every job is a Solana program account with its own USDC vault. Each step is a signed
            transaction anyone can audit, and every state has an exit, so funds cannot stay locked.
          </p>
        </div>
        <ol className="steps">
          {STEPS.map(([name, text], index) => (
            <Step key={name} index={index} name={name} text={text} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function Verification() {
  return (
    <section id="verify" className="container stack section">
      <div className="row section-split">
        <div className="stack section-head">
          <span className="eyebrow">Verification</span>
          <h2 className="h2">Not all work can be proven. So the bar is a test, fixed up front.</h2>
        </div>
        <p className="lead section-aside">
          We don't pretend an LLM's output is objectively verifiable. Version one only settles on
          what a machine can check, and says so. <Link to="/security">Read the limits.</Link>
        </p>
      </div>
      <div className="grid-3">
        {MODES.map((mode) => (
          <div key={mode.title} className="stack mode-card">
            <h3>{mode.title}</h3>
            <p>{mode.text}</p>
            <code>{mode.tag}</code>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Protocol() {
  return (
    <>
      <HowItWorks />
      <Verification />
    </>
  );
}
