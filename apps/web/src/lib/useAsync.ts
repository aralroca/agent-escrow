import { describeError } from '@agent-escrow/sdk';
import { useEffect, useState } from 'react';

export type Async<T> = { data?: T; error?: string; loading: boolean };

const RATE_LIMITED =
  'The public Solana RPC is rate limiting this browser. Wait a few seconds and reload.';

function readableError(error: unknown): string {
  const message = describeError(error);

  return message.includes('429') ? RATE_LIMITED : message;
}

/**
 * Loads data once per `key`, ignoring responses that arrive after the key changed.
 * Data already on screen stays there while a newer version loads.
 */
export function useAsync<T>(load: () => Promise<T>, key: string): Async<T> {
  const [state, setState] = useState<Async<T>>({ loading: true });

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` identifies what `load` fetches
  useEffect(
    function loadForKey() {
      let current = true;
      const whileCurrent = (update: (previous: Async<T>) => Async<T>) =>
        current && setState(update);
      // A failed refresh keeps what is already on screen instead of replacing it with an error.
      const fail = (error: unknown) => (previous: Async<T>) =>
        previous.data === undefined ? { error: readableError(error), loading: false } : previous;

      whileCurrent((previous) => ({ data: previous.data, loading: previous.data === undefined }));
      load()
        .then((data) => whileCurrent(() => ({ data, loading: false })))
        .catch((error) => whileCurrent(fail(error)));

      return () => {
        current = false;
      };
    },
    [key],
  );

  return state;
}
