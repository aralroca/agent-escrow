import { runCheck } from './checks.ts';
import { sha256Hex } from './hash.ts';
import { parseJson, parseSpec } from './spec.ts';
import type { Spec, Verdict } from './types.ts';

export type Commitment = {
  specUri: string;
  specHash: string;
  resultUri: string;
  resultHash: string;
};

export type Evaluation = Verdict & { spec: Spec };

/** Runs every check of a spec against the raw bytes of a deliverable. */
export async function runChecks(spec: Spec, bytes: Uint8Array): Promise<Verdict> {
  const deliverable = { data: parseJson(bytes), hash: await sha256Hex(bytes) };
  const results = spec.checks.map((check) => runCheck(check, deliverable));

  return { passed: results.every((result) => result.passed), results };
}

const FETCH_TIMEOUT_MS = 30_000;
const MAX_BYTES = 5 * 1024 * 1024;

function httpOnly(uri: string): string {
  if (!/^https?:\/\//i.test(uri)) throw new Error(`Only http(s) URLs are supported: ${uri}`);

  return uri;
}

/**
 * Downloads a file chosen by a counterparty. Only http(s), bounded in time and size, so a hostile
 * URL cannot hang or exhaust whoever runs the acceptance test.
 */
export async function fetchBytes(uri: string): Promise<Uint8Array> {
  const response = await fetch(httpOnly(uri), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const bytes = new Uint8Array(await response.arrayBuffer());

  if (!response.ok) throw new Error(`Could not fetch ${uri}: HTTP ${response.status}`);
  if (bytes.length > MAX_BYTES) throw new Error(`${uri} is larger than ${MAX_BYTES} bytes`);

  return bytes;
}

/** Downloads a file and refuses it unless its sha256 equals the committed hash. */
export async function fetchVerified(uri: string, expectedHash: string): Promise<Uint8Array> {
  const bytes = await fetchBytes(uri);
  const actualHash = await sha256Hex(bytes);

  if (actualHash !== expectedHash.toLowerCase()) {
    throw new Error(`Content at ${uri} does not match the committed hash`);
  }

  return bytes;
}

function integrityFailure(error: unknown): Verdict {
  const detail = error instanceof Error ? error.message : String(error);

  return { passed: false, results: [{ type: 'integrity', passed: false, detail }] };
}

/**
 * Reproduces the verdict for a job from its on-chain commitments.
 * A spec that cannot be verified throws (nobody can judge the job);
 * a deliverable that cannot be verified fails (the seller did not deliver what it committed).
 */
export async function evaluate(commitment: Commitment): Promise<Evaluation> {
  // Both downloads start together; a failed deliverable is judged after the spec, not before.
  const deliverable = fetchVerified(commitment.resultUri, commitment.resultHash).catch(
    (error: unknown) => integrityFailure(error),
  );
  const spec = parseSpec(await fetchVerified(commitment.specUri, commitment.specHash));
  const outcome = await deliverable;
  const verdict = outcome instanceof Uint8Array ? await runChecks(spec, outcome) : outcome;

  return { ...verdict, spec };
}
