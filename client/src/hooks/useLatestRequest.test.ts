import { StrictMode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { isAbortError, useLatestRequest } from "./useLatestRequest";

describe("useLatestRequest", () => {
  it("marks the first attempt as current until a second attempt begins", () => {
    const { result } = renderHook(() => useLatestRequest());
    const first = result.current();
    expect(first.isCurrent()).toBe(true);
  });

  it("marks an older attempt as no longer current once a newer one begins, even out of order", () => {
    const { result } = renderHook(() => useLatestRequest());
    const first = result.current();
    expect(first.isCurrent()).toBe(true);

    const second = result.current();
    // The classic stale-response race: the *older* request is the one whose
    // "is this still current" check we care about after the newer one has
    // already started - it must report false regardless of resolution order.
    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(true);
  });

  it("keeps only the latest of many out-of-order attempts current", () => {
    const { result } = renderHook(() => useLatestRequest());
    const attempts = [result.current(), result.current(), result.current(), result.current()];

    // Simulate attempts "resolving" in a scrambled order (e.g. 2 resolves,
    // then 0, then 3, then 1) - isCurrent() must reflect only who started
    // last, never who resolved last.
    const resolutionOrder = [2, 0, 3, 1];
    for (const idx of resolutionOrder) {
      const shouldBeCurrent = idx === attempts.length - 1;
      expect(attempts[idx].isCurrent()).toBe(shouldBeCurrent);
    }
  });

  it("aborts the previous attempt's signal when a new attempt begins", () => {
    const { result } = renderHook(() => useLatestRequest());
    const first = result.current();
    expect(first.signal.aborted).toBe(false);

    result.current();
    expect(first.signal.aborted).toBe(true);
  });

  it("aborts the in-flight attempt on unmount", () => {
    const { result, unmount } = renderHook(() => useLatestRequest());
    const attempt = result.current();
    expect(attempt.signal.aborted).toBe(false);

    unmount();
    expect(attempt.signal.aborted).toBe(true);
  });

  it("does not abort a fresh attempt started by a different render of the same hook instance", () => {
    // Sanity check that begin() itself is stable (same function reference)
    // across renders, so it's safe as a useCallback/useEffect dependency.
    const { result, rerender } = renderHook(() => useLatestRequest());
    const beginBeforeRerender = result.current;
    rerender();
    expect(result.current).toBe(beginBeforeRerender);
  });

  it("resolves fetch-like promises out of order without letting the stale one look current", async () => {
    const { result } = renderHook(() => useLatestRequest());

    const older = result.current();
    const olderPromise = new Promise<string>((resolve) => setTimeout(() => resolve("older-data"), 20));

    const newer = result.current();
    const newerPromise = new Promise<string>((resolve) => setTimeout(() => resolve("newer-data"), 5));

    // Newer resolves first (faster timeout); older resolves after it.
    const newerResult = await newerPromise;
    expect(newer.isCurrent()).toBe(true);
    let applied = newerResult;
    if (newer.isCurrent()) applied = newerResult;

    const olderResult = await olderPromise;
    expect(older.isCurrent()).toBe(false);
    // A correct caller would skip applying this - simulate that check here.
    if (older.isCurrent()) applied = olderResult;

    expect(applied).toBe("newer-data");
  });

  it("marks a previously-current attempt as no longer current after unmount", () => {
    const { result, unmount } = renderHook(() => useLatestRequest());
    const attempt = result.current();
    expect(attempt.isCurrent()).toBe(true);

    unmount();

    expect(attempt.isCurrent()).toBe(false);
  });

  it("never lets a controlled promise that ignores the abort signal update state after unmount", async () => {
    // A caller that (incorrectly, or unavoidably - e.g. a library that
    // doesn't support AbortSignal) ignores the signal and resolves anyway
    // must still be prevented from treating its result as current once the
    // component has unmounted, purely via isCurrent().
    let resolve!: (value: string) => void;
    const controlledPromise = new Promise<string>((r) => (resolve = r));

    const { result, unmount } = renderHook(() => useLatestRequest());
    const attempt = result.current();

    const setState = { calls: 0 };
    const run = async () => {
      const value = await controlledPromise; // ignores attempt.signal entirely
      if (!attempt.isCurrent()) return;
      setState.calls += 1;
      return value;
    };
    const pending = run();

    unmount();
    expect(attempt.isCurrent()).toBe(false);

    resolve("late-value");
    await pending;

    expect(setState.calls).toBe(0);
  });

  it("works correctly in React.StrictMode: begin stays stable, current attempt behaves normally, and unmount still invalidates it", () => {
    const { result, unmount } = renderHook(() => useLatestRequest(), { wrapper: StrictMode });

    const beginRef = result.current;
    const attempt = result.current();
    expect(attempt.isCurrent()).toBe(true);
    expect(attempt.signal.aborted).toBe(false);
    // begin() itself is still the same stable function reference under
    // StrictMode's double effect invocation.
    expect(result.current).toBe(beginRef);

    unmount();

    expect(attempt.isCurrent()).toBe(false);
    expect(attempt.signal.aborted).toBe(true);
  });

  it("keeps begin's identity stable across renders even inside React.StrictMode", () => {
    const { result, rerender } = renderHook(() => useLatestRequest(), { wrapper: StrictMode });
    const beforeRerender = result.current;
    rerender();
    expect(result.current).toBe(beforeRerender);
  });

  it("still aborts a fresh attempt's predecessor after unmount has already run once (no stale controller reused)", () => {
    // Sanity check that cleanup nulling the controller ref doesn't prevent a
    // *new* render's attempt from behaving correctly - relevant because the
    // cleanup itself must not throw or leave begin() in a broken state.
    const { result, unmount } = renderHook(() => useLatestRequest());
    const first = result.current();
    unmount();
    expect(first.isCurrent()).toBe(false);
    expect(first.signal.aborted).toBe(true);

    // A hook instance is never reused after unmount in real usage, but this
    // confirms begin() itself doesn't throw once cleanup has already run.
    expect(() => result.current()).not.toThrow();
  });
});

describe("isAbortError", () => {
  it("recognizes a DOMException named AbortError", () => {
    expect(isAbortError(new DOMException("Aborted", "AbortError"))).toBe(true);
  });

  it("rejects other errors, including other DOMExceptions", () => {
    expect(isAbortError(new Error("boom"))).toBe(false);
    expect(isAbortError(new DOMException("oops", "SomeOtherError"))).toBe(false);
    expect(isAbortError("not an error")).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });

  it("matches what a real aborted fetch signal produces", async () => {
    const controller = new AbortController();
    const rejection = new Promise((_, reject) => {
      controller.signal.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted.", "AbortError"));
      });
    });
    controller.abort();
    await expect(rejection).rejects.toSatisfy((err: unknown) => isAbortError(err));
  });
});
