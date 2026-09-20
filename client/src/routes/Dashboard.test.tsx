import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach, afterEach, MockInstance } from "vitest";
import Dashboard from "./Dashboard";
import { AppErrorProvider } from "../context/AppErrorContext";
import type { Task, User } from "../types";

const users: User[] = [{ id: "u1", name: "Alice", email: "alice@example.com", role: "admin" }];

// Frozen "now" for this whole file (see beforeEach/afterEach below), so the
// overdue count never depends on the day/time the test suite actually runs.
const NOW = new Date("2026-06-15T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
function daysFromNow(n: number): string {
  return new Date(NOW.getTime() + n * DAY_MS).toISOString();
}
function daysAgo(n: number): string {
  return daysFromNow(-n);
}

// Two overdue tasks (t1, t2), one task overdue-looking but done (t3, must be
// excluded), one due soon (t4, not overdue) and one with no dueDate (t5).
const tasks: Task[] = [
  { id: "t1", title: "Alpha", status: "todo", priority: "low", dueDate: daysAgo(1) },
  { id: "t2", title: "Bravo", status: "in-progress", priority: "high", dueDate: daysAgo(5) },
  { id: "t3", title: "Charlie", status: "done", priority: "medium", dueDate: daysAgo(10) },
  { id: "t4", title: "Delta", status: "todo", priority: "low", dueDate: daysFromNow(1) },
  { id: "t5", title: "Echo", status: "todo", priority: "medium" }
];

let fetchSpy: MockInstance;

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body)));
}

function mockFetch() {
  fetchSpy.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/users")) return jsonResponse(users);
    if (url.includes("/api/tasks")) return jsonResponse(tasks);
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

function renderDashboard() {
  return render(
    <AppErrorProvider>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </AppErrorProvider>
  );
}

function renderDashboardInStrictMode() {
  return render(
    <StrictMode>
      <AppErrorProvider>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </AppErrorProvider>
    </StrictMode>
  );
}

describe("Dashboard overdue stat", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    fetchSpy = vi.spyOn(globalThis, "fetch");
    mockFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts only overdue, non-done tasks", async () => {
    renderDashboard();

    // The stat tiles render their labels and links before /api/tasks resolves,
    // so waiting for the label alone leaves the value racing the request. Wait
    // for the value itself.
    await waitFor(() => expect(screen.getByText("Overdue")).toBeInTheDocument());
    const overdueCard = screen.getByText("Overdue").closest("a");
    expect(overdueCard).not.toBeNull();
    // t1 and t2 are overdue; t3 is excluded because it's done, t4 is due
    // soon (not overdue), t5 has no dueDate at all.
    await waitFor(() => expect(overdueCard).toHaveTextContent("2"));
  });

  it("renders the Overdue stat as an accessible link to /tasks?due=overdue", async () => {
    renderDashboard();

    await waitFor(() => expect(screen.getByText("Overdue")).toBeInTheDocument());
    const link = screen.getByRole("link", { name: /Overdue/ });
    expect(link).toHaveAttribute("href", "/tasks?due=overdue");
  });
});

describe("Dashboard main stat links", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchSpy = vi.spyOn(globalThis, "fetch");
    mockFetch();
  });

  it("links Total Tasks to the unfiltered table", async () => {
    renderDashboard();
    const link = await screen.findByRole("link", { name: "View all tasks" });
    expect(link).toHaveAttribute("href", "/tasks?tab=table");
    // The plain value must still be readable as text, not hidden behind the link.
    await waitFor(() => expect(link).toHaveTextContent("5"));
  });

  it("links In Progress to the table filtered to in-progress", async () => {
    renderDashboard();
    const link = await screen.findByRole("link", { name: "View in-progress tasks" });
    expect(link).toHaveAttribute("href", "/tasks?tab=table&status=in-progress");
  });

  it("links High Priority to the table filtered to high priority", async () => {
    renderDashboard();
    const link = await screen.findByRole("link", { name: "View high-priority tasks" });
    expect(link).toHaveAttribute("href", "/tasks?tab=table&priority=high");
  });

  it("links Completion to completed tasks, even though the tile shows a percentage", async () => {
    renderDashboard();
    const link = await screen.findByRole("link", { name: "View completed tasks" });
    expect(link).toHaveAttribute("href", "/tasks?tab=table&status=done");
    await waitFor(() => expect(link).toHaveTextContent("%"));
  });

  it("gives every stat link a keyboard-focusable, real anchor element", async () => {
    renderDashboard();
    const link = await screen.findByRole("link", { name: "View all tasks" });
    expect(link.tagName).toBe("A");
    link.focus();
    expect(link).toHaveFocus();
  });

  it("does not turn a malformed tasks payload into a fake zero/complete statistic", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/users")) return jsonResponse(users);
      // Malformed: an object instead of an array.
      if (url.includes("/api/tasks")) return jsonResponse({ not: "a list" });
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    renderDashboard();

    // The malformed payload must be treated as a load failure, not silently
    // coerced into "zero tasks" and rendered as if it were a real, trustworthy
    // count - so neither a genuine "0" task count nor a fabricated "0%"
    // completion rate may ever appear for it.
    // Wait for the failure to be reported first: asserting the negatives while
    // the request is still in flight would pass for the wrong reason.
    expect(await screen.findByRole("alert")).toHaveTextContent(/Failed to load task statistics/);

    const link = screen.getByRole("link", { name: "View all tasks" });
    expect(link).not.toHaveTextContent("0");

    const completionLink = screen.getByRole("link", { name: "View completed tasks" });
    expect(completionLink).not.toHaveTextContent("NaN");
    expect(completionLink).not.toHaveTextContent("0%");
  });

  it("shows a Retry control on task-stat failure that reloads the stats on click", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/users")) return jsonResponse(users);
      if (url.includes("/api/tasks")) return jsonResponse({ not: "a list" });
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    renderDashboard();

    await screen.findByRole("alert");

    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/users")) return jsonResponse(users);
      if (url.includes("/api/tasks")) return jsonResponse(tasks);
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    const link = screen.getByRole("link", { name: "View all tasks" });
    await waitFor(() => expect(link).toHaveTextContent(String(tasks.length)));
  });
});

describe("Dashboard independent tasks/users load states", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  it("shows a local error and Retry for Team Overview when only users fails, while task stats still render", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/users")) return Promise.resolve(new Response("Server error", { status: 500 }));
      if (url.includes("/api/tasks")) return jsonResponse(tasks);
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    renderDashboard();

    const link = await screen.findByRole("link", { name: "View all tasks" });
    await waitFor(() => expect(link).toHaveTextContent(String(tasks.length)));

    expect(screen.getByRole("alert")).toHaveTextContent(/Failed to load team members/);
    expect(screen.queryByText(/Active Members/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows a local error and Retry for task stats when only tasks fails, while Team Overview still renders", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/users")) return jsonResponse(users);
      if (url.includes("/api/tasks")) return Promise.resolve(new Response("Server error", { status: 500 }));
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    renderDashboard();

    await waitFor(() => expect(screen.getByText("1 Active Members")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(/Failed to load task statistics/);
  });

  it("keeps the users error standing after a tasks-only retry succeeds (one section's success does not clear the other's error)", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/users")) return Promise.resolve(new Response("Server error", { status: 500 }));
      if (url.includes("/api/tasks")) return Promise.resolve(new Response("Server error", { status: 500 }));
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    renderDashboard();

    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));

    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/users")) return Promise.resolve(new Response("Server error", { status: 500 }));
      if (url.includes("/api/tasks")) return jsonResponse(tasks);
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    const tasksAlert = screen.getAllByRole("alert").find((el) => /Failed to load task statistics/.test(el.textContent ?? ""));
    fireEvent.click(within(tasksAlert!).getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      const link = screen.getByRole("link", { name: "View all tasks" });
      expect(link).toHaveTextContent(String(tasks.length));
    });
    // The users section's error must still be visible - a tasks-only retry
    // succeeding must never silently clear it.
    expect(screen.getByRole("alert")).toHaveTextContent(/Failed to load team members/);
  });

  it("shows a loading indicator for Team Overview and never a real-looking member count before users has loaded", () => {
    fetchSpy.mockImplementation(() => new Promise(() => {})); // never resolves
    renderDashboard();

    expect(screen.queryByText(/Active Members/)).not.toBeInTheDocument();
    expect(screen.getByText("Loading team members...")).toBeInTheDocument();
  });

  it("does not update state after unmount when a fetch resolves late", async () => {
    let resolveTasks!: (value: Response) => void;
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/users")) return jsonResponse(users);
      if (url.includes("/api/tasks")) return new Promise<Response>((resolve) => (resolveTasks = resolve));
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    const { unmount } = renderDashboard();
    unmount();

    expect(() => resolveTasks(new Response(JSON.stringify(tasks)))).not.toThrow();
  });
});

describe("Dashboard breakdown links", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchSpy = vi.spyOn(globalThis, "fetch");
    mockFetch();
  });

  it("links each status breakdown row to the matching table filter", async () => {
    renderDashboard();
    await screen.findByTestId("status-breakdown-todo");

    expect(screen.getByTestId("status-breakdown-todo")).toHaveAttribute("href", "/tasks?tab=table&status=todo");
    expect(screen.getByTestId("status-breakdown-in-progress")).toHaveAttribute(
      "href",
      "/tasks?tab=table&status=in-progress"
    );
    expect(screen.getByTestId("status-breakdown-done")).toHaveAttribute("href", "/tasks?tab=table&status=done");
  });

  it("links each priority breakdown tile to the matching table filter", async () => {
    renderDashboard();
    await screen.findByTestId("priority-breakdown-low");

    expect(screen.getByTestId("priority-breakdown-low")).toHaveAttribute("href", "/tasks?tab=table&priority=low");
    expect(screen.getByTestId("priority-breakdown-medium")).toHaveAttribute(
      "href",
      "/tasks?tab=table&priority=medium"
    );
    expect(screen.getByTestId("priority-breakdown-high")).toHaveAttribute("href", "/tasks?tab=table&priority=high");
  });

  it("links each Team Overview member to their user profile", async () => {
    renderDashboard();
    const link = await screen.findByTestId("team-overview-user-u1");
    expect(link).toHaveAttribute("href", "/users/u1");
    expect(link.tagName).toBe("A");
  });
});

describe("Dashboard stale response protection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  it("in React.StrictMode, only the latest of the double-invoked initial tasks requests ends up reflected in the UI", async () => {
    const responses: { resolve: (value: Response) => void }[] = [];
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/users")) return jsonResponse(users);
      if (url.includes("/api/tasks")) {
        return new Promise<Response>((resolve) => {
          responses.push({ resolve });
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    renderDashboardInStrictMode();

    // React.StrictMode (dev only) mounts, cleans up, and re-mounts effects -
    // so the tasks effect fires twice, producing two in-flight requests.
    await waitFor(() => expect(responses.length).toBeGreaterThanOrEqual(2));

    const olderTasks: Task[] = [{ id: "old1", title: "Stale", status: "todo", priority: "low" }];
    const newerTasksList: Task[] = [
      { id: "new1", title: "Fresh 1", status: "todo", priority: "low" },
      { id: "new2", title: "Fresh 2", status: "in-progress", priority: "medium" },
      { id: "new3", title: "Fresh 3", status: "done", priority: "high" }
    ];

    // Resolve the *later-started* request first, then the earlier one late,
    // with different data - the classic out-of-order race.
    responses[responses.length - 1].resolve(new Response(JSON.stringify(newerTasksList)));
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "View all tasks" })).toHaveTextContent(String(newerTasksList.length))
    );

    responses[0].resolve(new Response(JSON.stringify(olderTasks)));
    // Give the stale response's promise chain a chance to run.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const link = screen.getByRole("link", { name: "View all tasks" });
    expect(link).toHaveTextContent(String(newerTasksList.length));
    expect(link).not.toHaveTextContent(String(olderTasks.length));
  });

  it("in React.StrictMode, an aborted duplicate request never surfaces as an error", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/users")) return jsonResponse(users);
      if (url.includes("/api/tasks")) {
        return new Promise<Response>((resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
          // Only the still-current request actually resolves with data.
          if (!init?.signal?.aborted) {
            setTimeout(() => {
              if (!init?.signal?.aborted) resolve(new Response(JSON.stringify(tasks)));
            }, 0);
          }
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    renderDashboardInStrictMode();

    await waitFor(() => expect(screen.getByRole("link", { name: "View all tasks" })).toHaveTextContent(String(tasks.length)));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
