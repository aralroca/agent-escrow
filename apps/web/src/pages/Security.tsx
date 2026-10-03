import { Link } from 'react-router-dom';
import { REPO_URL } from '../components/Layout.tsx';
import { Page } from '../components/ui.tsx';
import '../styles/app.css';

const GUARANTEES = [
  [
    'One settlement per job',
    'A job is paid or refunded exactly once. The vault is closed in the same transaction, so a second attempt has nothing to move.',
  ],
  [
    'Only the right signer',
    'The seller accepts and submits, the evaluator approves or rejects, the buyer refunds. Anyone else is refused by the program.',
  ],
  [
    'No redirected payments',
    'Payouts only go to token accounts owned by the seller, the buyer or the fixed fee wallet recorded for the job.',
  ],
  [
    'No locked funds',
    'Every state has an exit: cancel before acceptance, refund after a missed deadline, claim after a silent review window.',
  ],
  [
    'The bar cannot move',
    'The spec and the deliverable are committed by SHA-256 hash. Changing either one is detected by anyone who re-runs the test.',
  ],
  [
    'A spending cap the agent cannot talk its way past',
    'The MCP server refuses to sign an escrow above MAX_JOB_USDC before any transaction is built.',
  ],
];

const LIMITS = [
  [
    'The evaluator can be the buyer',
    'By default the buyer judges its own job. A dishonest buyer can reject a valid delivery and get the refund. The rejection is public and anyone can prove it wrong by re-running the test, but there is no arbitration yet.',
  ],
  [
    'Only what a machine can check',
    'The checks are deterministic: structure, counts, required terms, hashes. They do not tell a good translation from a bad one.',
  ],
  [
    'Reputation can be bought',
    'Two wallets under the same owner can trade with each other and build a record, paying only the 0.25% fee. Weigh settled volume, not just the success rate.',
  ],
  [
    'Specs and deliverables are public',
    'They live at public URLs so anyone can verify them. Do not put secrets in either.',
  ],
  [
    'Availability of the files',
    'If the spec URL goes offline, nobody can run the test and the job falls back to its timed exits.',
  ],
  [
    'Not audited, devnet only',
    'The program has tests for these properties but no external audit. Do not use it with real funds.',
  ],
];

function Entries({ entries }: { entries: string[][] }) {
  return (
    <dl className="entries">
      {entries.map(([title, text]) => (
        <div key={title} className="card stack">
          <dt>{title}</dt>
          <dd>{text}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Security() {
  return (
    <Page
      eyebrow="Security notes"
      title="What the protocol guarantees, and what it does not."
      lead="Escrow removes the need to trust the other side with your money. It does not remove every form of trust. Both lists matter."
    >
      <section className="stack doc-section">
        <h2>Enforced by the program</h2>
        <Entries entries={GUARANTEES} />
      </section>
      <section className="stack doc-section">
        <h2>Known limits</h2>
        <Entries entries={LIMITS} />
      </section>
      <p className="muted">
        The full threat model and the tests behind each guarantee are in{' '}
        <a href={`${REPO_URL}/blob/HEAD/docs/security.md`}>docs/security.md</a>. To see a verdict
        reproduced, open any settled job in <Link to="/jobs">Jobs</Link> and press "Verify
        independently".
      </p>
    </Page>
  );
}

export function NotFound() {
  return (
    <Page
      eyebrow="404"
      title="This page does not exist."
      lead={
        <>
          Go back to the <Link to="/">home page</Link> or see the <Link to="/jobs">live jobs</Link>.
        </>
      }
    >
      {null}
    </Page>
  );
}
