import { isSolanaError, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM } from '@solana/kit';
import idl from '../idl/agent_escrow.json' with { type: 'json' };

const PROGRAM_ERRORS = new Map(idl.errors.map(({ code, msg }) => [code, msg]));

/** An error and everything that caused it, outermost first. */
function causeChain(error: unknown): unknown[] {
  return error instanceof Error ? [error, ...causeChain(error.cause)] : [];
}

/** The custom program error code buried in a failed transaction, if any. */
export function programErrorCode(error: unknown): number | undefined {
  const custom = causeChain(error).find((cause) =>
    isSolanaError(cause, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM),
  );

  return (custom as { context?: { code?: number } } | undefined)?.context?.code;
}

/** A human-readable reason for a failed call, preferring the program's own error message. */
export function describeError(error: unknown): string {
  const programMessage = PROGRAM_ERRORS.get(programErrorCode(error) ?? -1);
  const messages = causeChain(error).map((cause) => (cause as Error).message);

  return programMessage ?? (messages.join(': ') || String(error));
}
