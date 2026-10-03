import { describeError, isRateLimited } from '@agent-escrow/sdk';
import { useEffect, useState } from 'react';

export type Async<T> = { data?: T; error?: string; loading: boolean };

const RATE_LIMITED =
  'The public Solana RPC is rate limiting this browser. Wait a few seconds and reload.';

function readableError(error: unknown): string {
  return isRateLimited(error) ? RATE_LIMITED : describeError(error);
}

/** While a newer version loads, what is already on screen stays there. */
function reloading<T>(previous: Async<T>): Async<T> {
  return { data: previous.data, loading: previous.data === undefined };
}

/** A failed refresh keeps the data on screen instead of replacing it with an error. */
function failed<T>(error: unknown) {
  return (previous: Async<T>): Async<T> =>
    previous.data === undefined ? { error: readableError(error), loading: false } : previous;
}

/** Loads data once per `key`, ignoring responses that arrive after the key changed. */
export function useAsync<T>(load: () => Promise<T>, key: string): Async<T> {
  const [state, setState] = useState<Async<T>>({ loading: true });

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` identifies what `load` fetches
  useEffect(
    function loadForKey() {
      let current = true;
      const update = (next: (previous: Async<T>) => Async<T>) => current && setState(next);

      update(reloading);
      load()
        .then((data) => update(() => ({ data, loading: false })))
        .catch((error) => update(failed(error)));

      return () => {
        current = false;
      };
    },
    [key],
  );

  return state;
}
