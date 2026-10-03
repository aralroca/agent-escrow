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

export type EvaluateOptions = {
  /**
   * Judge a deliverable that cannot be downloaded right now as failed, instead of throwing so
   * the caller can retry. For evaluators who retried and must rule before the window closes.
   */
  unreachableFails?: boolean;
};

/**
 * The file is definitively wrong or missing: bad hash, not found, too large, not http(s).
 * Anything else that goes wrong while downloading is transient and worth a retry.
 */
export class DeliveryError extends Error {}

const FETCH_TIMEOUT_MS = 30_000;
const MAX_BYTES = 5 * 1024 * 1024;
const RETRYABLE_STATUS = new Set([408, 425, 429]);

/** Runs every check of a spec against the raw bytes of a deliverable. */
export async function runChecks(spec: Spec, bytes: Uint8Array): Promise<Verdict> {
  const deliverable = { data: parseJson(bytes), hash: await sha256Hex(bytes) };
  const results = spec.checks.map((check) => runCheck(check, deliverable));

  return { passed: results.every((result) => result.passed), results };
}

function httpOnly(uri: string): string {
  if (!/^https?:\/\//i.test(uri))
    throw new DeliveryError(`Only http(s) URLs are supported: ${uri}`);

  return uri;
}

/** A 4xx means the file is not there; a 5xx or a throttle means "ask again later". */
function httpError(uri: string, status: number): Error {
  const message = `Could not fetch ${uri}: HTTP ${status}`;
  const missing = status >= 400 && status < 500 && !RETRYABLE_STATUS.has(status);

  return missing ? new DeliveryError(message) : new Error(message);
}

function concat(chunks: Uint8Array[], size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  const offsets = chunks.map((_, index) =>
    chunks.slice(0, index).reduce((total, chunk) => total + chunk.length, 0),
  );

  chunks.forEach((chunk, index) => {
    bytes.set(chunk, offsets[index]);
  });

  return bytes;
}

/** Reads a body chunk by chunk and stops at the cap, so a huge response is never buffered. */
async function readCapped(response: Response, uri: string): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  // A stream can only be drained step by step, and stopping early is the point.
  for (let step = await reader?.read(); step && !step.done; step = await reader?.read()) {
    size += step.value.length;
    if (size > MAX_BYTES) {
      await reader?.cancel();
      throw new DeliveryError(`${uri} is larger than ${MAX_BYTES} bytes`);
    }
    chunks.push(step.value);
  }

  return concat(chunks, size);
}

/**
 * Downloads a file chosen by a counterparty. Only http(s), bounded in time and size, so a hostile
 * URL cannot hang or exhaust whoever runs the acceptance test.
 */
export async function fetchBytes(uri: string): Promise<Uint8Array> {
  const response = await fetch(httpOnly(uri), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

  if (!response.ok) throw httpError(uri, response.status);

  return readCapped(response, uri);
}

/** Downloads a file and refuses it unless its sha256 equals the committed hash. */
export async function fetchVerified(uri: string, expectedHash: string): Promise<Uint8Array> {
  const bytes = await fetchBytes(uri);
  const actualHash = await sha256Hex(bytes);

  if (actualHash !== expectedHash.toLowerCase()) {
    throw new DeliveryError(`Content at ${uri} does not match the committed hash`);
  }

  return bytes;
}

function integrityFailure(error: unknown): Verdict {
  const detail = error instanceof Error ? error.message : String(error);

  return { passed: false, results: [{ type: 'integrity', passed: false, detail }] };
}

/** Turns what came back for the deliverable into a verdict, or rethrows a transient failure. */
async function judge(spec: Spec, delivered: unknown, options: EvaluateOptions): Promise<Verdict> {
  if (delivered instanceof Uint8Array) return runChecks(spec, delivered);
  if (delivered instanceof DeliveryError || options.unreachableFails) {
    return integrityFailure(delivered);
  }

  throw delivered;
}

/**
 * Reproduces the verdict for a job from its on-chain commitments.
 * A spec that cannot be verified throws: nobody can judge the job.
 * A deliverable that is wrong or missing fails: the seller did not deliver what it committed.
 * A deliverable that is temporarily unreachable throws, because a verdict cannot be undone.
 */
export async function evaluate(
  commitment: Commitment,
  options: EvaluateOptions = {},
): Promise<Evaluation> {
  // Both downloads start together; the deliverable is judged after the spec, not before.
  const delivered = fetchVerified(commitment.resultUri, commitment.resultHash).catch(
    (error: unknown) => error,
  );
  const spec = parseSpec(await fetchVerified(commitment.specUri, commitment.specHash));
  const verdict = await judge(spec, await delivered, options);

  return { ...verdict, spec };
}
