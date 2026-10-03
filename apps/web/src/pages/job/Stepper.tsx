import type { JobView } from '@agent-escrow/sdk';

/** How many of the three opening steps a job in each status went through. */
const REACHED: Record<JobView['status'], number> = {
  Funded: 1,
  Refunded: 1,
  Accepted: 2,
  Expired: 2,
  Submitted: 3,
  Completed: 3,
  Rejected: 3,
  Claimed: 3,
};
const STEPS = [
  ['create_job', 'USDC locked in the vault'],
  ['accept', 'Seller committed'],
  ['submit', 'Deliverable committed by hash'],
];
const OUTCOMES: Partial<Record<JobView['status'], [string, string]>> = {
  Completed: ['complete', 'Test passed, seller paid'],
  Claimed: ['claim_timeout', 'No verdict in time, seller paid'],
  Rejected: ['reject', 'Test failed, buyer refunded'],
  Refunded: ['refund', 'Cancelled, buyer refunded'],
  Expired: ['refund', 'Deadline missed, buyer refunded'],
};

export function Stepper({ view }: { view: JobView }) {
  const outcome = OUTCOMES[view.status] ?? ['settle', 'Waiting for a verdict or a timeout'];
  const steps = [...STEPS, outcome];
  const done = (index: number) =>
    index < 3 ? index < REACHED[view.status] : Boolean(view.settledAt);

  return (
    <ol className="card stepper" aria-label="Job lifecycle">
      {steps.map(([name, caption], index) => (
        <li key={name} className={done(index) ? 'step-done' : undefined}>
          <code>{name}</code>
          <span>{caption}</span>
        </li>
      ))}
    </ol>
  );
}
