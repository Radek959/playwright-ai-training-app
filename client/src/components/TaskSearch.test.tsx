import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { TaskSearch } from "./TaskSearch";
import type { Task } from "../types";

const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  title: `Task ${id}`,
  status: "todo",
  priority: "medium",
  ...overrides
});

let fetchSpy: MockInstance;

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname + location.search}</div>;
}

function renderSearch(initialEntries: string[] = ["/tasks"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LocationProbe />
      <Routes>
        <Route path="/tasks" element={<TaskSearch />} />
        <Route path="/tasks/:id" element={<div>Task details page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const input = () => screen.getByTestId("task-search-input");
const locationPath = () => screen.getByTestId("location-probe").textContent ?? "";

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

/** A promise the test resolves by hand, so a response can be held open. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/**
 * Advances the fake clock and lets the resulting promises settle, inside
 * act() so the React updates they cause are flushed the way the component
 * would flush them in the browser.
 */
async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Types into the search box and lets the debounce window elapse. */
async function type(value: string) {
  fireEvent.focus(input());
  fireEvent.change(input(), { target: { value } });
  await settle(300);
}

/** The query string the nth fetch call asked for. */
function requestedQuery(call = 0) {
  const url = String(fetchSpy.mock.calls[call][0]);
  return decodeURIComponent(url.replace("/api/tasks/search?q=", ""));
}

describe("TaskSearch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Fake timers so the 300ms debounce is advanced explicitly rather than
    // waited out; shouldAdvanceTime keeps testing-library's own async helpers
    // (which poll on a timer) working against them.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("requests", () => {
    it("searches for what was typed once the debounce elapses", async () => {
      fetchSpy.mockResolvedValue(jsonResponse([task("t1", { title: "Login bug" })]));
      renderSearch();

      await type("login");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(requestedQuery()).toBe("login");
      expect(await screen.findByTestId("search-result-t1")).toBeInTheDocument();
    });

    it("sends the trimmed query", async () => {
      fetchSpy.mockResolvedValue(jsonResponse([]));
      renderSearch();

      await type("   login   ");

      expect(requestedQuery()).toBe("login");
    });

    it("does not fire a second request when only surrounding whitespace changes", async () => {
      fetchSpy.mockResolvedValue(jsonResponse([]));
      renderSearch();

      await type("login");
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      await type("  login  ");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("fires no request for an empty query", async () => {
      fetchSpy.mockResolvedValue(jsonResponse([]));
      renderSearch();

      await type("");

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("fires no request for a whitespace-only query", async () => {
      fetchSpy.mockResolvedValue(jsonResponse([]));
      renderSearch();

      await type("     ");

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(screen.queryByTestId("search-results-dropdown")).not.toBeInTheDocument();
    });

    it("fires no request for a query shorter than two characters, and says so", async () => {
      fetchSpy.mockResolvedValue(jsonResponse([]));
      renderSearch();

      await type("l");

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(screen.getByText("Type at least 2 characters to start searching")).toBeInTheDocument();
    });

    it("debounces, firing one request for a quickly-typed query", async () => {
      fetchSpy.mockResolvedValue(jsonResponse([]));
      renderSearch();

      fireEvent.focus(input());
      fireEvent.change(input(), { target: { value: "l" } });
      fireEvent.change(input(), { target: { value: "lo" } });
      fireEvent.change(input(), { target: { value: "log" } });
      await settle(300);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(requestedQuery()).toBe("log");
    });
  });

  describe("states", () => {
    it("shows a loading state while the request is in flight", async () => {
      const pending = deferred<Response>();
      fetchSpy.mockReturnValue(pending.promise);
      renderSearch();

      await type("login");

      expect(screen.getByTestId("search-loading")).toBeInTheDocument();
      expect(screen.getByTestId("search-spinner")).toBeInTheDocument();

      pending.resolve(jsonResponse([]));
      await waitFor(() => expect(screen.queryByTestId("search-loading")).not.toBeInTheDocument());
    });

    it("shows an empty state when nothing matches", async () => {
      fetchSpy.mockResolvedValue(jsonResponse([]));
      renderSearch();

      await type("nothingmatches");

      const empty = await screen.findByTestId("search-no-results");
      expect(within(empty).getByText(/No results for/)).toBeInTheDocument();
    });

    it("shows a controlled error state instead of looking like an empty result", async () => {
      fetchSpy.mockRejectedValue(new Error("Network down"));
      renderSearch();

      await type("login");

      const error = await screen.findByTestId("search-error");
      // Announced as an alert, so it does not depend on colour alone.
      expect(within(error).getByRole("alert")).toHaveTextContent("Could not load search results: Network down");
      expect(screen.queryByTestId("search-no-results")).not.toBeInTheDocument();
    });

    it("shows the error state for a non-ok response", async () => {
      fetchSpy.mockResolvedValue(new Response("boom", { status: 500 }));
      renderSearch();

      await type("login");

      expect(await screen.findByTestId("search-error")).toHaveTextContent("Search failed: 500");
    });

    it("retries the same query and recovers", async () => {
      fetchSpy
        .mockRejectedValueOnce(new Error("Network down"))
        .mockResolvedValueOnce(jsonResponse([task("t1", { title: "Login bug" })]));
      renderSearch();

      await type("login");
      expect(await screen.findByTestId("search-error")).toBeInTheDocument();

      fireEvent.mouseDown(screen.getByTestId("search-retry"));
      await settle(300);

      expect(await screen.findByTestId("search-result-t1")).toBeInTheDocument();
      expect(screen.queryByTestId("search-error")).not.toBeInTheDocument();
      expect(requestedQuery(1)).toBe("login");
    });

    it("never shows the previous query's results while a new query is loading", async () => {
      const first = deferred<Response>();
      const second = deferred<Response>();
      fetchSpy.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      renderSearch();

      await type("login");
      first.resolve(jsonResponse([task("old", { title: "Login bug" })]));
      expect(await screen.findByTestId("search-result-old")).toBeInTheDocument();

      await type("parser");

      // The old result is gone the moment the new query starts loading.
      expect(screen.queryByTestId("search-result-old")).not.toBeInTheDocument();
      expect(screen.getByTestId("search-loading")).toBeInTheDocument();

      second.resolve(jsonResponse([task("new", { title: "Parser bug" })]));
      expect(await screen.findByTestId("search-result-new")).toBeInTheDocument();
    });

    it("clears the results when the query drops below the minimum length", async () => {
      fetchSpy.mockResolvedValue(jsonResponse([task("t1", { title: "Login bug" })]));
      renderSearch();

      await type("login");
      expect(await screen.findByTestId("search-result-t1")).toBeInTheDocument();

      await type("l");

      expect(screen.queryByTestId("search-results-dropdown")).not.toBeInTheDocument();
    });
  });

  describe("out-of-order responses", () => {
    it("ignores a stale response that resolves after a newer one", async () => {
      const slowOld = deferred<Response>();
      const fastNew = deferred<Response>();
      fetchSpy.mockReturnValueOnce(slowOld.promise).mockReturnValueOnce(fastNew.promise);
      renderSearch();

      await type("login");
      await type("parser");

      // The newer query answers first...
      fastNew.resolve(jsonResponse([task("new", { title: "Parser bug" })]));
      expect(await screen.findByTestId("search-result-new")).toBeInTheDocument();

      // ...and the older, slower one must not overwrite it when it finally lands.
      slowOld.resolve(jsonResponse([task("old", { title: "Login bug" })]));
      await settle();

      expect(screen.getByTestId("search-result-new")).toBeInTheDocument();
      expect(screen.queryByTestId("search-result-old")).not.toBeInTheDocument();
    });

    it("ignores a stale failure that resolves after a newer success", async () => {
      const slowOld = deferred<Response>();
      const fastNew = deferred<Response>();
      fetchSpy
        .mockReturnValueOnce(slowOld.promise.then(() => Promise.reject(new Error("stale failure"))))
        .mockReturnValueOnce(fastNew.promise);
      renderSearch();

      await type("login");
      await type("parser");

      fastNew.resolve(jsonResponse([task("new", { title: "Parser bug" })]));
      expect(await screen.findByTestId("search-result-new")).toBeInTheDocument();

      slowOld.resolve(jsonResponse([]));
      await settle();

      expect(screen.queryByTestId("search-error")).not.toBeInTheDocument();
      expect(screen.getByTestId("search-result-new")).toBeInTheDocument();
    });
  });

  describe("selecting a result", () => {
    it("navigates to the task's detail page and closes the widget", async () => {
      fetchSpy.mockResolvedValue(jsonResponse([task("t1", { title: "Login bug" })]));
      renderSearch();

      await type("login");
      fireEvent.mouseDown(await screen.findByTestId("search-result-t1"));

      await waitFor(() => expect(locationPath()).toBe("/tasks/t1"));
      expect(screen.queryByTestId("search-results-dropdown")).not.toBeInTheDocument();
      expect(screen.getByText("Task details page")).toBeInTheDocument();
    });

    it("clears the typed query after navigating", async () => {
      fetchSpy.mockResolvedValue(jsonResponse([task("t1")]));
      renderSearch();

      await type("task");
      fireEvent.mouseDown(await screen.findByTestId("search-result-t1"));

      await waitFor(() => expect(locationPath()).toBe("/tasks/t1"));
      // The widget unmounts with the route here, so the check that matters is
      // that no stale search state survived into the destination.
      expect(screen.queryByTestId("task-search-input")).not.toBeInTheDocument();
    });
  });

  describe("keyboard support", () => {
    it("moves through the results with the arrow keys and opens one with Enter", async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse([task("t1", { title: "First" }), task("t2", { title: "Second" })])
      );
      renderSearch();

      await type("task");
      await screen.findByTestId("search-result-t1");

      expect(input()).toHaveAttribute("aria-activedescendant", "search-result-t1");

      fireEvent.keyDown(input(), { key: "ArrowDown" });
      expect(input()).toHaveAttribute("aria-activedescendant", "search-result-t2");

      fireEvent.keyDown(input(), { key: "ArrowUp" });
      expect(input()).toHaveAttribute("aria-activedescendant", "search-result-t1");

      // Wrapping around the end of the list keeps every result reachable.
      fireEvent.keyDown(input(), { key: "ArrowUp" });
      expect(input()).toHaveAttribute("aria-activedescendant", "search-result-t2");

      fireEvent.keyDown(input(), { key: "Enter" });
      await waitFor(() => expect(locationPath()).toBe("/tasks/t2"));
    });

    it("closes the dropdown on Escape without clearing the query", async () => {
      fetchSpy.mockResolvedValue(jsonResponse([task("t1")]));
      renderSearch();

      await type("task");
      await screen.findByTestId("search-result-t1");

      fireEvent.keyDown(input(), { key: "Escape" });

      expect(screen.queryByTestId("search-results-dropdown")).not.toBeInTheDocument();
      expect((input() as HTMLInputElement).value).toBe("task");
      expect(locationPath()).toBe("/tasks");
    });

    it("does not navigate on Enter while the search is still loading", async () => {
      const pending = deferred<Response>();
      fetchSpy.mockReturnValue(pending.promise);
      renderSearch();

      await type("login");
      fireEvent.keyDown(input(), { key: "Enter" });

      expect(locationPath()).toBe("/tasks");

      pending.resolve(jsonResponse([]));
      await waitFor(() => expect(screen.queryByTestId("search-loading")).not.toBeInTheDocument());
    });
  });

  describe("accessibility", () => {
    it("gives every result an accessible name of its own", async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse([task("t1", { title: "Login bug", status: "in-progress", priority: "high" })])
      );
      renderSearch();

      await type("login");

      const option = await screen.findByRole("option", {
        name: "Login bug, status in-progress, priority high"
      });
      expect(option).toBeInTheDocument();
    });

    it("exposes the results as a labelled listbox owned by the combobox", async () => {
      fetchSpy.mockResolvedValue(jsonResponse([task("t1")]));
      renderSearch();

      await type("task");
      await screen.findByTestId("search-result-t1");

      expect(input()).toHaveAttribute("aria-expanded", "true");
      expect(input()).toHaveAttribute("aria-controls", "task-search-listbox");
      expect(screen.getByRole("listbox")).toHaveAttribute("id", "task-search-listbox");
    });
  });

  describe("URL state", () => {
    it("never writes the typed query into the URL", async () => {
      fetchSpy.mockResolvedValue(jsonResponse([task("t1")]));
      renderSearch(["/tasks?tab=grid"]);

      await type("task");
      await screen.findByTestId("search-result-t1");

      expect(locationPath()).toBe("/tasks?tab=grid");
    });
  });
});
