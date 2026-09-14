import { useCallback, useEffect, useRef } from "react";

export type LatestRequestAttempt = {
  /** Pass to fetch(url, { signal }) so an outdated attempt is cancelled outright. */
  signal: AbortSignal;
  /**
   * True only if no newer attempt has started (and the component hasn't
   * unmounted) since this attempt began. Check this after every `await`
   * and before calling any state setter, so an older in-flight request's
   * response can never overwrite what a newer request already produced.
   */
  isCurrent: () => boolean;
};

/**
 * Guards a component's async fetches against the classic "stale response"
 * race: an older in-flight request resolving after a newer one (e.g. a fast
 * Retry click, React.StrictMode's double effect invocation in dev, or a
 * background refresh racing a just-started user action) and clobbering the
 * newer request's result.
 *
 * The hook returns `begin` directly (not wrapped in an object) so its
 * identity is stable across renders — safe to put straight into a
 * useCallback/useEffect dependency array without causing an extra render or,
 * worse, an effect that re-fires (and thus re-fetches) on every render.
 *
 * Each call to `begin()` aborts whatever attempt was previously started
 * through this hook and hands back a fresh AbortSignal plus an `isCurrent()`
 * check. A caller should pass the signal to `fetch` and confirm `isCurrent()`
 * right before using a response to update state:
 *
 *   const begin = useLatestRequest();
 *   const load = useCallback(async () => {
 *     const { signal, isCurrent } = begin();
 *     try {
 *       const res = await fetch(url, { signal });
 *       const data = await res.json();
 *       if (!isCurrent()) return; // a newer request has since started
 *       setState(data);
 *     } catch (err) {
 *       if (isAbortError(err) || !isCurrent()) return;
 *       setError(err);
 *     }
 *   }, [begin]);
 *
 * The in-flight attempt (if any) is also aborted automatically on unmount,
 * so an aborted request never surfaces as an error and never calls a state
 * setter after unmount. Unmount also invalidates the current attempt itself
 * (not just its signal): any `isCurrent()` captured before unmount reports
 * false afterwards, even if the async work driving it ignores the abort
 * signal and settles anyway.
 */
export function useLatestRequest(): () => LatestRequestAttempt {
  const controllerRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  const begin = useCallback((): LatestRequestAttempt => {
    controllerRef.current?.abort();
    const seq = ++seqRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    return {
      signal: controller.signal,
      isCurrent: () => seqRef.current === seq
    };
  }, []);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
      // Bump past any sequence number already handed out so a previously
      // returned isCurrent() can never report true again once unmounted -
      // otherwise an attempt that ignores the abort signal and resolves
      // anyway could still be mistaken for current after unmount.
      seqRef.current += 1;
    };
  }, []);

  return begin;
}

/** True for the AbortError a fetch rejects with when its signal fires. */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
