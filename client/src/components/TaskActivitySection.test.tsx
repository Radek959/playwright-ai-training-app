import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskActivitySection } from "./TaskActivitySection";
import { Task } from "../types";

describe("TaskActivitySection", () => {
  const users = [{ id: "u1", name: "Alice", email: "alice@a.com", role: "admin" as const }];
  const allTasks = [{ id: "t2", title: "Dependent Task" }] as Task[];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state initially", () => {
    // Return unresolved promise
    globalThis.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

    render(<TaskActivitySection taskId="t1" refreshKey={0} users={users} allTasks={allTasks} />);
    expect(screen.getByText("Loading activity...")).toBeInTheDocument();
  });

  it("shows empty state if no activity", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => []
    });

    render(<TaskActivitySection taskId="t1" refreshKey={0} users={users} allTasks={allTasks} />);
    expect(await screen.findByText("No activity yet")).toBeInTheDocument();
  });

  it("shows error state with retry", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Internal Server Error"
    });

    render(<TaskActivitySection taskId="t1" refreshKey={0} users={users} allTasks={allTasks} />);
    expect(await screen.findByText("Failed to load activity: Internal Server Error")).toBeInTheDocument();

    // Mock success on retry
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => []
    });

    const retryBtn = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryBtn);

    expect(await screen.findByText("No activity yet")).toBeInTheDocument();
  });

  it("renders history events in correct order and formats fields", async () => {
    const activities = [
      {
        id: "a1",
        taskId: "t1",
        type: "task_updated",
        createdAt: "2023-01-02T10:00:00Z",
        changes: [
          { field: "assigneeId", before: "u1", after: null },
          { field: "requiresApproval", before: false, after: true },
          { field: "tags", before: ["a"], after: [] },
          { field: "dependencies", before: [], after: ["t2", "non-existent"] }
        ]
      },
      {
        id: "a2",
        taskId: "t1",
        type: "task_created",
        createdAt: "2023-01-01T10:00:00Z",
        changes: []
      }
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => activities
    });

    render(<TaskActivitySection taskId="t1" refreshKey={0} users={users} allTasks={allTasks} />);

    // Check titles
    const eventTitles = await screen.findAllByText(/Task (updated|created)/);
    expect(eventTitles).toHaveLength(2);
    expect(eventTitles[0]).toHaveTextContent("Task updated"); // Assuming API returned sorted
    expect(eventTitles[1]).toHaveTextContent("Task created");

    // Check formatting
    expect(screen.getByText("Alice")).toBeInTheDocument(); // u1 resolved
    expect(screen.getByText("→ Not set")).toBeInTheDocument(); // null -> Not set
    expect(screen.getByText("No")).toBeInTheDocument(); // boolean false
    expect(screen.getByText(/→ Yes/)).toBeInTheDocument(); // boolean true
    expect(screen.getByText("a")).toBeInTheDocument(); // array -> string
    expect(screen.getByText("→ Empty")).toBeInTheDocument(); // empty array

    // dependencies: t2 resolved, non-existent falls back to id
    expect(screen.getByText(/Dependent Task, non-existent/)).toBeInTheDocument();
  });

  it("formats approval_decided correctly", async () => {
    const activities = [
      {
        id: "a1",
        taskId: "t1",
        type: "approval_decided",
        createdAt: "2023-01-02T10:00:00Z",
        changes: [
          { field: "approvalStatus", before: "pending", after: "approved" }
        ]
      }
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => activities
    });

    render(<TaskActivitySection taskId="t1" refreshKey={0} users={users} allTasks={allTasks} />);
    expect(await screen.findByText("Approval approved")).toBeInTheDocument();
  });

  it("shows disclaimer about unauthenticated users", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => []
    });

    render(<TaskActivitySection taskId="t1" refreshKey={0} users={users} allTasks={allTasks} />);
    expect(await screen.findByText(/Activity records operations performed in this local app/)).toBeInTheDocument();
  });

  it("handles race conditions on multiple fetch requests", async () => {
    let resolveFirst: (v: unknown) => void;
    const promiseFirst = new Promise((resolve) => { resolveFirst = resolve; });

    let resolveSecond: (v: unknown) => void;
    const promiseSecond = new Promise((resolve) => { resolveSecond = resolve; });

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return promiseFirst;
      if (callCount === 2) return promiseSecond;
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    const { rerender } = render(<TaskActivitySection taskId="t1" refreshKey={0} users={users} allTasks={allTasks} />);

    // First request is in flight
    expect(screen.getByText("Loading activity...")).toBeInTheDocument();

    // Trigger second request by changing refreshKey
    rerender(<TaskActivitySection taskId="t1" refreshKey={1} users={users} allTasks={allTasks} />);

    // Resolve second request with new history
    resolveSecond!({
      ok: true,
      json: async () => [
        { id: "a2", taskId: "t1", type: "task_created", createdAt: "2023-01-01T10:00:00Z", changes: [] }
      ]
    });

    expect(await screen.findByText("Task created")).toBeInTheDocument();

    // Now resolve the first request with outdated history
    resolveFirst!({
      ok: true,
      json: async () => [
        { id: "a1", taskId: "t1", type: "task_updated", createdAt: "2023-01-02T10:00:00Z", changes: [] }
      ]
    });

    // Wait a bit to ensure UI doesn't update (since it should be aborted/ignored)
    await new Promise(r => setTimeout(r, 50));

    // UI should still show "Task created" and not "Task updated"
    expect(screen.getByText("Task created")).toBeInTheDocument();
    expect(screen.queryByText("Task updated")).not.toBeInTheDocument();
  });

  it("handles invalid payload format and allows retry", async () => {
    // First request returns invalid payload (object instead of array)
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ not: "an array" })
    });

    render(<TaskActivitySection taskId="t1" refreshKey={0} users={users} allTasks={allTasks} />);

    expect(await screen.findByText("Invalid response format")).toBeInTheDocument();

    // Setup retry to return valid empty array
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => []
    });

    const retryBtn = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryBtn);

    expect(await screen.findByText("No activity yet")).toBeInTheDocument();
  });
});
