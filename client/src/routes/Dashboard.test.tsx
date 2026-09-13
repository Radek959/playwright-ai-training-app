import { render, screen, waitFor } from "@testing-library/react";
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

    await waitFor(() => expect(screen.getByText("Overdue")).toBeInTheDocument());
    // t1 and t2 are overdue; t3 is excluded because it's done, t4 is due
    // soon (not overdue), t5 has no dueDate at all.
    const overdueCard = screen.getByText("Overdue").closest("a");
    expect(overdueCard).not.toBeNull();
    expect(overdueCard).toHaveTextContent("2");
  });

  it("renders the Overdue stat as an accessible link to /tasks?due=overdue", async () => {
    renderDashboard();

    await waitFor(() => expect(screen.getByText("Overdue")).toBeInTheDocument());
    const link = screen.getByRole("link", { name: /Overdue/ });
    expect(link).toHaveAttribute("href", "/tasks?due=overdue");
  });
});
