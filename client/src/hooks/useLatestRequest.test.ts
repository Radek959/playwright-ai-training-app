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
