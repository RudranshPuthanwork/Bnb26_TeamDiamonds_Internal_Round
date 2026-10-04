import { useCallback, useEffect, useRef, useState } from 'react';
import { describeError, type Described } from './errors';

/** Load data with loading and error state. `refreshMs` polls without flipping back to loading. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[], refreshMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Described | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setData(await fnRef.current());
      setError(null);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    if (!refreshMs) return;
    const id = setInterval(() => void reload(true), refreshMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, refreshMs, ...deps]);

  return { data, loading, error, reload: () => reload() };
}

/** Run a transaction: pending while it runs, error in plain words if it fails. */
export function useTx() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Described | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setPending(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(describeError(e));
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);
  return { pending, error, run, clear: () => setError(null) };
}
