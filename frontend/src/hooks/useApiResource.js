import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbortError } from '../services/apiClient.js';

/**
 * Loads data with `loader(signal)` whenever `key` changes, aborting stale requests.
 * Keeps the previous data while reloading so the UI does not flash.
 *
 * @returns {{ data, error, isLoading: boolean, reload: () => void, mutate: (updater) => void }}
 *   `mutate(updater)` updates the cached data locally (e.g. after a successful API call).
 */
export function useApiResource(loader, key) {
  const [state, setState] = useState({ data: null, error: null, isLoading: true });
  const [reloadToken, setReloadToken] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, error: null, isLoading: true }));

    loaderRef
      .current(controller.signal)
      .then((data) => setState({ data, error: null, isLoading: false }))
      .catch((error) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setState((previous) => ({ ...previous, error, isLoading: false }));
      });

    return () => controller.abort();
  }, [key, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  const mutate = useCallback(
    (updater) => setState((previous) => (previous.data ? { ...previous, data: updater(previous.data) } : previous)),
    []
  );

  return { ...state, reload, mutate };
}
