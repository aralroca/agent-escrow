import type { Check, CheckResult, Evaluation } from '@agent-escrow/checks';
import { describeError, verifyJob } from '@agent-escrow/sdk';
import { useState } from 'react';
import { CheckCircle, CrossCircle, PendingCircle } from '../../components/Icons.tsx';
import { type JobRow, loadSpec, specKey } from '../../lib/data.ts';
import { useAsync } from '../../lib/useAsync.ts';

type Run = { verdict?: Evaluation; error?: string; running?: boolean };

const AGREES: Record<string, boolean | undefined> = {
  Completed: true,
  Rejected: false,
};

function checkLabel(check: Check): string {
  if (check.type === 'json-schema') return 'Deliverable matches the JSON schema';
  if (check.type === 'count')
    return `Exactly ${check.equals} items${check.path ? ` at ${check.path}` : ''}`;
  if (check.type === 'sha256') return 'Content hash matches';

  return `Required terms present in "${check.field}" (${Object.keys(check.terms).length} items)`;
}

function ResultIcon({ result }: { result?: CheckResult }) {
  if (!result) return <PendingCircle size={22} className="icon-pending" />;

  return result.passed ? (
    <CheckCircle size={22} className="icon-good" />
  ) : (
    <CrossCircle size={22} className="icon-bad" />
  );
}

function CheckRow({ check, result }: { check: Check; result?: CheckResult }) {
  return (
    <li className="check-row">
      <ResultIcon result={result} />
      <div className="stack">
        <strong>{checkLabel(check)}</strong>
        <span>{result?.detail ?? 'Not run in this browser yet'}</span>
      </div>
      <code>{check.type}</code>
    </li>
  );
}

/** How the reproduced verdict compares with what the evaluator did on-chain. */
function comparison(verdict: Evaluation, status: string): string {
  const passed = verdict.results.filter((result) => result.passed).length;
  const outcome = `${passed} of ${verdict.results.length} checks passed in your browser.`;
  const evaluatorSaidPass = AGREES[status];

  if (evaluatorSaidPass === undefined) return `${outcome} The evaluator has not ruled on this job.`;

  return evaluatorSaidPass === verdict.passed
    ? `${outcome} This matches the on-chain verdict (${status}).`
    : `${outcome} This does NOT match the on-chain verdict (${status}).`;
}

function useVerification(job: JobRow) {
  const [run, setRun] = useState<Run>({});

  function verify() {
    setRun({ running: true });
    verifyJob(job.record)
      .then((verdict) => setRun({ verdict }))
      .catch((error) => setRun({ error: describeError(error) }));
  }

  return { run, verify };
}

function Summary({ run, status }: { run: Run; status: string }) {
  if (run.error)
    return <p className="verify-summary" role="alert">{`Could not verify: ${run.error}`}</p>;
  if (!run.verdict) return null;
  const integrity = run.verdict.results.find((result) => result.type === 'integrity');

  return (
    <p className="verify-summary" role="status">
      {integrity ? `The deliverable failed its integrity check: ${integrity.detail}. ` : ''}
      {comparison(run.verdict, status)}
    </p>
  );
}

export function VerificationCard({ job }: { job: JobRow }) {
  const spec = useAsync(() => loadSpec(job.record), specKey(job.record));
  const { run, verify } = useVerification(job);
  const hasSubmission = Boolean(job.view.resultUri);
  const results = run.verdict?.results.filter((result) => result.type !== 'integrity');

  return (
    <section className="card stack verification">
      <div className="row card-head">
        <h2>Acceptance test</h2>
        <button
          className="btn"
          type="button"
          onClick={verify}
          disabled={!hasSubmission || run.running}
        >
          {run.running ? 'Verifying…' : 'Verify independently'}
        </button>
      </div>
      <p className="muted">
        {hasSubmission
          ? 'Downloads the spec and the deliverable, checks both against the hashes committed on-chain, and runs the test here. No server involved.'
          : 'Nothing to verify yet: the seller has not submitted a deliverable.'}
      </p>
      {spec.error && (
        <p role="alert">{`The spec could not be loaded or does not match its hash: ${spec.error}`}</p>
      )}
      <ul className="stack checks">
        {spec.data?.checks.map((check, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a spec's checks have a fixed order
          <CheckRow key={index} check={check} result={results?.[index]} />
        ))}
      </ul>
      <Summary run={run} status={job.view.status} />
    </section>
  );
}
