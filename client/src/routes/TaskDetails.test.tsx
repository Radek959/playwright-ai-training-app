import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { TaskDetails } from "./TaskDetails";
import { AppErrorProvider } from "../context/AppErrorContext";
import { vi, describe, it, expect, beforeEach, MockInstance } from "vitest";

// Mirrors formatDueDateUtc's own formatting call, so the expectation tracks
// the runtime's locale (e.g. CI) instead of hardcoding an en-US string.
function utcDisplay(dateStr: string): string {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" }).format(
    new Date(dateStr)
  );
}

const mockTask = {
  id: "task-1",
  title: "Test Task",
  description: "Test description",
  status: "in-progress",
  priority: "high",
  taskType: "bug",
  severity: "critical",
  dueDate: "2024-12-31T00:00:00Z",
  estimatedHours: 5,
  assigneeId: "user-1",
  tags: ["frontend", "urgent"],
  dependencies: ["task-2"],
  requiresApproval: true,
  approver: "manager-a",
  coverImage: "http://example.com/image.png"
};

const mockUsers = [
  { id: "user-1", name: "Alice" }
];

const mockDepTask = {
  id: "task-2",
  title: "Dependency Task",
  status: "todo",
  priority: "low"
};

const mockOtherTask = {
  id: "task-3",
  title: "Third task",
  status: "todo",
  priority: "low"
};

let fetchSpy: MockInstance;

function CurrentPath() {
  const location = useLocation();
  return <span data-testid="current-path">{location.pathname}</span>;
}

function renderComponent(id = "task-1") {
  return render(
    <AppErrorProvider>
      <MemoryRouter initialEntries={[`/tasks/${id}`]}>
        <CurrentPath />
        <Routes>
          <Route path="/tasks/:id" element={<TaskDetails />} />
        </Routes>
      </MemoryRouter>
    </AppErrorProvider>
  );
}

/**
 * Serves task-1 (plus the user list, the full task list for the dependency
 * picker, and the dependency itself) and records every PUT body sent.
 */
function mockEditableTask(options: { putResponse?: () => Response } = {}) {
  const puts: unknown[] = [];
  fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    if (init?.method === "PUT") {
      puts.push(JSON.parse(String(init.body)));
      const response = options.putResponse?.() ?? new Response(JSON.stringify(mockTask), { status: 200 });
      return Promise.resolve(response);
    }
    if (url === "/api/tasks") {
      return Promise.resolve(new Response(JSON.stringify([mockTask, mockDepTask, mockOtherTask])));
    }
    if (url === "/api/tasks/task-1") return Promise.resolve(new Response(JSON.stringify(mockTask)));
    if (url === "/api/tasks/task-2") return Promise.resolve(new Response(JSON.stringify(mockDepTask)));
    if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify(mockUsers)));
    if (url === "/api/tasks/task-1/comments") return Promise.resolve(new Response(JSON.stringify([])));
    return Promise.resolve(new Response(null, { status: 404 }));
  });
  return { puts };
}

async function openEditModal() {
  await waitFor(() => expect(screen.getByTestId("open-edit-task-btn")).toBeInTheDocument());
  fireEvent.click(screen.getByTestId("open-edit-task-btn"));
  await waitFor(() => expect(screen.getByTestId("task-edit-modal")).toBeInTheDocument());
}

describe("TaskDetails", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  it("fetches and displays task details", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/tasks/task-1") return Promise.resolve(new Response(JSON.stringify(mockTask)));
      if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify(mockUsers)));
      if (url === "/api/tasks/task-2") return Promise.resolve(new Response(JSON.stringify(mockDepTask)));
      if (url === "/api/tasks/task-1/comments") return Promise.resolve(new Response(JSON.stringify([])));
      if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify([mockTask, mockDepTask])));
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const { container } = renderComponent();

    expect(screen.getByText("Loading task details...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Test Task")).toBeInTheDocument();
    });

    // Check basic fields
    expect(screen.getByText("ID: task-1")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
    expect(screen.getByText("in-progress")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(screen.getByText("critical")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();

    // Check date rendering independently of timezone
    const timeElements = container.querySelectorAll("time");
    expect(timeElements.length).toBeGreaterThan(0);
    expect(timeElements[0]).toHaveAttribute("dateTime", "2024-12-31T00:00:00.000Z");

    // Check cover image link
    const coverImageLink = screen.getByRole("link", { name: "http://example.com/image.png" });
    expect(coverImageLink).toHaveAttribute("href", "http://example.com/image.png");

    // Check assignee and approver. The assignee's name also appears in the
    // comments section's author <select> once its own /api/users request
    // resolves, so match the assignee entry itself instead of any element
    // containing "Alice" - otherwise the assertion passes or fails depending
    // on which request settles first.
    const assignee = screen.getByText(/\(user-1\)/).parentElement;
    expect(assignee).toHaveTextContent("Alice");
    
    expect(screen.getByText("Manager A (manager-a)")).toBeInTheDocument();

    // Check dependencies
    expect(screen.getByText("Dependency Task")).toBeInTheDocument();
    expect(screen.getByText(/\(task-2\)/)).toBeInTheDocument();
    
    // Check dependency link
    const depLink = screen.getByRole("link", { name: "View details", hidden: false });
    expect(depLink).toHaveAttribute("href", "/tasks/task-2");

    // Check tags
    expect(screen.getByText("frontend")).toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
  });

  it("displays correct placeholders for missing optional fields", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/tasks/task-empty") return Promise.resolve(new Response(JSON.stringify({
        id: "task-empty",
        title: "Empty Task",
        status: "todo",
        priority: "low",
        requiresApproval: false
      })));
      if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify([])));
      if (url === "/api/tasks/task-empty/comments") return Promise.resolve(new Response(JSON.stringify([])));
      if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify([])));
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const { container } = renderComponent("task-empty");

    await waitFor(() => {
      expect(screen.getByText("Empty Task")).toBeInTheDocument();
    });

    const getDdForDt = (dtText: string) => {
      const dts = Array.from(container.querySelectorAll("dt"));
      const dt = dts.find(el => el.textContent === dtText);
      return dt?.nextElementSibling?.textContent;
    };

    expect(getDdForDt("Description")).toBe("Not set");
    expect(getDdForDt("Task Type")).toBe("Not set");
    expect(getDdForDt("Severity")).toBe("Not set");
    expect(getDdForDt("Tags")).toBe("Not set");
    expect(getDdForDt("Due Date")).toBe("Not set");
    expect(getDdForDt("Completed At")).toBe("Not set");
    expect(getDdForDt("Estimated Hours")).toBe("Not set");
    expect(getDdForDt("Assignee")).toBe("Not set");
    expect(getDdForDt("Requires Approval")).toBe("No");
    expect(getDdForDt("Approver")).toBe("Not set");
    expect(getDdForDt("Cover Image")).toBe("Not set");
    
    // Dependencies section has no dt
    const depsHeading = screen.getByText("Dependencies");
    expect(depsHeading.nextElementSibling?.textContent).toBe("Not set");
  });

  it("displays 404 message if task not found", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.startsWith("/api/tasks/")) return Promise.resolve(new Response(null, { status: 404 }));
      if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify([])));
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderComponent("task-not-found");

    await waitFor(() => {
      expect(screen.getByText("Task not found")).toBeInTheDocument();
    });
  });

  it("displays error state with retry on network error", async () => {
    fetchSpy.mockImplementation(() => {
      return Promise.reject(new Error("Network Error"));
    });

    renderComponent("task-error");

    await waitFor(() => {
      expect(screen.getByText("Failed to load task")).toBeInTheDocument();
      expect(screen.getByText("Network Error")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: "Retry" });
    expect(retryBtn).toBeInTheDocument();
    
    const backLink = screen.getByRole("link", { name: "Back to tasks list" });
    expect(backLink).toBeInTheDocument();
  });
  
  it("displays error state on non-404 API error", async () => {
    fetchSpy.mockImplementation(() => {
      return Promise.resolve(new Response(null, { status: 500, statusText: "Internal Server Error" }));
    });

    renderComponent("task-error-500");

    await waitFor(() => {
      expect(screen.getByText("Failed to load task")).toBeInTheDocument();
      expect(screen.getByText("Failed to load task: Internal Server Error")).toBeInTheDocument();
    });
  });

  it("marks non-done dependencies as blocking while keeping done ones unmarked", async () => {
    const taskWithMixedDeps = {
      id: "task-mixed",
      title: "Task With Mixed Deps",
      status: "todo",
      priority: "medium",
      requiresApproval: false,
      dependencies: ["dep-done", "dep-blocking"]
    };
    const depDone = { id: "dep-done", title: "Finished dependency", status: "done", priority: "low" };
    const depBlocking = { id: "dep-blocking", title: "Unfinished dependency", status: "in-progress", priority: "low" };

    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/tasks/task-mixed") return Promise.resolve(new Response(JSON.stringify(taskWithMixedDeps)));
      if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify([])));
      if (url === "/api/tasks/dep-done") return Promise.resolve(new Response(JSON.stringify(depDone)));
      if (url === "/api/tasks/dep-blocking") return Promise.resolve(new Response(JSON.stringify(depBlocking)));
      if (url === "/api/tasks/task-mixed/comments") return Promise.resolve(new Response(JSON.stringify([])));
      if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify([taskWithMixedDeps, depDone, depBlocking])));
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderComponent("task-mixed");

    await waitFor(() => {
      expect(screen.getByText("Task With Mixed Deps")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("dependency-blocking-dep-done")).not.toBeInTheDocument();
    expect(screen.getByTestId("dependency-blocking-dep-blocking")).toBeInTheDocument();

    const links = screen.getAllByRole("link", { name: "View details" });
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/tasks/dep-done", "/tasks/dep-blocking"]);
  });

  it("shows the same due-date classification as the task list (Overdue for a past, non-done dueDate)", async () => {
    const overdueTask = {
      id: "task-overdue",
      title: "Overdue Task",
      status: "todo",
      priority: "medium",
      requiresApproval: false,
      dueDate: "2020-01-01T00:00:00Z"
    };

    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/tasks/task-overdue") return Promise.resolve(new Response(JSON.stringify(overdueTask)));
      if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify([])));
      if (url === "/api/tasks/task-overdue/comments") return Promise.resolve(new Response(JSON.stringify([])));
      if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify([overdueTask])));
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderComponent("task-overdue");

    await waitFor(() => {
      expect(screen.getByText("Overdue Task")).toBeInTheDocument();
    });

    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("shows the Overdue label without repeating the exact due date a second time", async () => {
    const overdueTask = {
      id: "task-overdue-2",
      title: "Overdue Task Two",
      status: "todo",
      priority: "medium",
      requiresApproval: false,
      dueDate: "2020-01-01T00:00:00Z"
    };

    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/tasks/task-overdue-2") return Promise.resolve(new Response(JSON.stringify(overdueTask)));
      if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify([])));
      if (url === "/api/tasks/task-overdue-2/comments") return Promise.resolve(new Response(JSON.stringify([])));
      if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify([overdueTask])));
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const { container } = renderComponent("task-overdue-2");

    await waitFor(() => {
      expect(screen.getByText("Overdue Task Two")).toBeInTheDocument();
    });

    // The Due Date field shows the date exactly once (via the plain date
    // field), and the Overdue label next to it carries no second date.
    const overdueDisplay = utcDisplay("2020-01-01T00:00:00Z");
    expect(screen.getByText(overdueDisplay)).toBeInTheDocument();
    expect(screen.queryByText(`Due: ${overdueDisplay}`)).not.toBeInTheDocument();
    const overdueLabel = screen.getByTestId("due-date-label");
    expect(overdueLabel).toHaveTextContent("Overdue");
    expect(overdueLabel.textContent).not.toMatch(/\d/);

    // Only one <time> element renders the dueDate for this task (no
    // dependencies/completedAt here to add another).
    const timeElements = container.querySelectorAll("time");
    expect(timeElements).toHaveLength(1);
  });

  it("opens the shared edit modal from the details view with every field pre-filled", async () => {
    mockEditableTask();
    renderComponent();
    await openEditModal();

    const modal = screen.getByTestId("task-edit-modal");
    expect(within(modal).getByRole("heading", { name: "Edit task" })).toBeInTheDocument();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Test Task");
    expect((screen.getByLabelText("Task type") as HTMLSelectElement).value).toBe("bug");
    expect((screen.getByLabelText("Severity") as HTMLSelectElement).value).toBe("critical");
    expect((screen.getByLabelText("Estimated hours") as HTMLInputElement).value).toBe("5");
    expect((screen.getByLabelText("Tags (comma separated)") as HTMLInputElement).value).toBe("frontend, urgent");
    expect((screen.getByLabelText("Requires manager approval") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Approver") as HTMLSelectElement).value).toBe("manager-a");
    expect(screen.getByTestId("edit-task-dependency-task-2")).toBeInTheDocument();
  });

  it("offers the other existing tasks as dependencies, excluding the task being edited", async () => {
    mockEditableTask();
    renderComponent();
    await openEditModal();

    const options = Array.from((screen.getByLabelText("Add dependency") as HTMLSelectElement).options);
    // task-1 is the task itself and task-2 is already a dependency.
    expect(options.map((o) => o.value)).toEqual(["", "task-3"]);
    expect(options.map((o) => o.textContent)).toContain("Third task (task-3)");
  });

  it("saves with a PUT carrying only the changed field and shows the API's response without leaving the URL", async () => {
    const { puts } = mockEditableTask({
      putResponse: () =>
        new Response(JSON.stringify({ ...mockTask, title: "Renamed task", dependencies: [] }), { status: 200 })
    });
    renderComponent();
    await openEditModal();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Renamed task" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByTestId("task-edit-modal")).not.toBeInTheDocument());
    expect(puts).toEqual([{ title: "Renamed task" }]);

    // The response — not an optimistic guess — is what gets rendered, and
    // the dependency list is refreshed from it.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Renamed task");
    expect(screen.queryByTestId("dependency-task-2")).not.toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/tasks/task-1");
  });

  it("sends the explicit clearing values when extended fields are emptied", async () => {
    const { puts } = mockEditableTask();
    renderComponent();
    await openEditModal();

    fireEvent.change(screen.getByLabelText("Task type"), { target: { value: "feature" } });
    fireEvent.change(screen.getByLabelText("Estimated hours"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Tags (comma separated)"), { target: { value: "" } });
    fireEvent.click(screen.getByLabelText("Requires manager approval"));
    fireEvent.click(screen.getByRole("button", { name: "Remove dependency Dependency Task" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({
      taskType: "feature",
      severity: null,
      estimatedHours: null,
      tags: [],
      dependencies: [],
      requiresApproval: false,
      approver: null
    });
  });

  it("still saves an unrelated field when the task list could not be fetched, without touching dependencies", async () => {
    // TaskDetails logs a failed dependency-picker task list fetch via
    // console.warn; this test deliberately triggers that failure, so the
    // expected warning is suppressed here and restored immediately after -
    // this file's beforeEach uses vi.resetAllMocks() (not restoreAllMocks()),
    // which would otherwise leave console.warn silently mocked for every
    // later test in this file.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const puts: unknown[] = [];
    let listRequests = 0;
    fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (init?.method === "PUT") {
        puts.push(JSON.parse(String(init.body)));
        return Promise.resolve(new Response(JSON.stringify({ ...mockTask, title: "Renamed task" }), { status: 200 }));
      }
      // The task itself and its dependency load fine; only the list used by
      // the dependency picker fails.
      if (url === "/api/tasks") {
        listRequests += 1;
        return Promise.resolve(new Response(null, { status: 500, statusText: "Internal Server Error" }));
      }
      if (url === "/api/tasks/task-1") return Promise.resolve(new Response(JSON.stringify(mockTask)));
      if (url === "/api/tasks/task-2") return Promise.resolve(new Response(JSON.stringify(mockDepTask)));
      if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify(mockUsers)));
      if (url === "/api/tasks/task-1/comments") return Promise.resolve(new Response(JSON.stringify([])));
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderComponent();

    // The read-only view still works, dependencies included.
    await waitFor(() => expect(screen.getByText("Dependency Task")).toBeInTheDocument());

    await openEditModal();

    // A failed list is not "an empty list": dependency editing is blocked
    // and explained, with a way to retry, while the saved dependency stays
    // visible and is never reported as unknown.
    const status = screen.getByTestId("edit-task-dependency-status");
    expect(status).toHaveTextContent(/task list could not be loaded/i);
    expect(screen.getByLabelText("Add dependency")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove dependency task-2" })).toBeDisabled();
    expect(screen.getByTestId("edit-task-dependency-task-2")).toBeInTheDocument();
    expect(listRequests).toBe(1);
    fireEvent.click(screen.getByTestId("edit-task-dependency-retry"));
    await waitFor(() => expect(listRequests).toBe(2));

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Renamed task" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ title: "Renamed task" });
    expect(screen.queryByText(/Unknown dependency ids/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("task-edit-modal")).not.toBeInTheDocument());
    warnSpy.mockRestore();
  });

  it("does not send a change or a clear for a dueDate stored in a non-ISO format the API accepts", async () => {
    const puts: unknown[] = [];
    const textDueDateTask = { ...mockTask, id: "task-text-date", dueDate: "May 1, 2026 00:00:00 GMT", dependencies: [] };
    fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (init?.method === "PUT") {
        puts.push(JSON.parse(String(init.body)));
        return Promise.resolve(new Response(JSON.stringify({ ...textDueDateTask, title: "Renamed task" }), { status: 200 }));
      }
      if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify([textDueDateTask])));
      if (url === "/api/tasks/task-text-date") return Promise.resolve(new Response(JSON.stringify(textDueDateTask)));
      if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify(mockUsers)));
      if (url === "/api/tasks/task-text-date/comments") return Promise.resolve(new Response(JSON.stringify([])));
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderComponent("task-text-date");
    await openEditModal();

    expect((screen.getByLabelText("Due date") as HTMLInputElement).value).toBe("2026-05-01");

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Renamed task" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ title: "Renamed task" });
  });

  it("leaves the displayed data untouched when the edit is cancelled", async () => {
    const { puts } = mockEditableTask();
    renderComponent();
    await openEditModal();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Never saved" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByTestId("task-edit-modal")).not.toBeInTheDocument());
    expect(puts).toHaveLength(0);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Test Task");
  });

  it("keeps the modal open and the last saved data on screen when the save fails", async () => {
    mockEditableTask({
      putResponse: () =>
        new Response(JSON.stringify({ error: "Validation failed", details: [{ field: "title", message: "title must be at least 3 characters" }] }), { status: 400 })
    });
    renderComponent();
    await openEditModal();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Rejected title" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getAllByText("title must be at least 3 characters").length).toBeGreaterThan(0)
    );
    expect(screen.getByTestId("task-edit-modal")).toBeInTheDocument();
    // The details view still shows the last successfully saved version.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Test Task");
    expect(screen.getByTestId("current-path")).toHaveTextContent("/tasks/task-1");
  });

  it("reports a 409 naming the blocking dependencies and does not present 'done' as saved", async () => {
    mockEditableTask({
      putResponse: () =>
        new Response(
          JSON.stringify({
            error: "Cannot complete task with incomplete dependencies",
            blockingDependencies: [{ id: "task-2", title: "Dependency Task", status: "todo" }]
          }),
          { status: 409 }
        )
    });
    renderComponent();
    await openEditModal();

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "done" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(
        screen.getAllByText(/Cannot complete task with incomplete dependencies: Dependency Task \(todo\)/).length
      ).toBeGreaterThan(0)
    );
    expect(screen.getByTestId("task-edit-modal")).toBeInTheDocument();
    // The rejected status is not shown as if it had been stored, in the form
    // or in the details view behind it.
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("in-progress");
    const statusDd = Array.from(document.querySelectorAll("dt")).find((dt) => dt.textContent === "Status")
      ?.nextElementSibling;
    expect(statusDd?.textContent).toBe("in-progress");
  });

  it("does not show an overdue/soon label for a done task with a past dueDate", async () => {
    const doneTask = {
      id: "task-done",
      title: "Finished Task",
      status: "done",
      priority: "medium",
      requiresApproval: false,
      dueDate: "2020-01-01T00:00:00Z"
    };

    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/tasks/task-done") return Promise.resolve(new Response(JSON.stringify(doneTask)));
      if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify([])));
      if (url === "/api/tasks/task-done/comments") return Promise.resolve(new Response(JSON.stringify([])));
      if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify([doneTask])));
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderComponent("task-done");

    await waitFor(() => {
      expect(screen.getByText("Finished Task")).toBeInTheDocument();
    });

    expect(screen.queryByText("Overdue")).not.toBeInTheDocument();
    expect(screen.queryByText("Due soon")).not.toBeInTheDocument();
  });

  describe("Approval section", () => {
    it("sends decision + comment to PUT /api/tasks/:id/approval and refreshes from the response", async () => {
      const approvalPuts: unknown[] = [];
      const approvedTask = { ...mockTask, approvalStatus: "approved", approvalComment: "Ship it", approvalDecidedAt: "2026-09-14T08:00:00.000Z" };
      fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url === "/api/tasks/task-1/approval" && init?.method === "PUT") {
          approvalPuts.push(JSON.parse(String(init.body)));
          return Promise.resolve(new Response(JSON.stringify(approvedTask), { status: 200 }));
        }
        if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify([mockTask, mockDepTask, mockOtherTask])));
        if (url === "/api/tasks/task-1") return Promise.resolve(new Response(JSON.stringify(mockTask)));
        if (url === "/api/tasks/task-2") return Promise.resolve(new Response(JSON.stringify(mockDepTask)));
        if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify(mockUsers)));
        if (url === "/api/tasks/task-1/comments") return Promise.resolve(new Response(JSON.stringify([])));
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      renderComponent();
      await waitFor(() => expect(screen.getByTestId("approve-task-btn")).toBeInTheDocument());

      fireEvent.change(screen.getByTestId("approval-comment-input"), { target: { value: "Ship it" } });
      fireEvent.click(screen.getByTestId("approve-task-btn"));

      await waitFor(() => expect(screen.getByTestId("approval-status-badge")).toHaveTextContent("Approved"));
      expect(approvalPuts).toEqual([{ decision: "approved", comment: "Ship it" }]);
      expect(screen.getByTestId("current-path")).toHaveTextContent("/tasks/task-1");
    });

    it("shows a conflict error and does not update the badge when the decision endpoint returns 409", async () => {
      fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url === "/api/tasks/task-1/approval" && init?.method === "PUT") {
          return Promise.resolve(
            new Response(
              JSON.stringify({ error: "Approval decision conflict", currentApproval: { status: "approved", comment: "ok", decidedAt: "2026-01-01T00:00:00.000Z" } }),
              { status: 409 }
            )
          );
        }
        if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify([mockTask, mockDepTask, mockOtherTask])));
        if (url === "/api/tasks/task-1") return Promise.resolve(new Response(JSON.stringify(mockTask)));
        if (url === "/api/tasks/task-2") return Promise.resolve(new Response(JSON.stringify(mockDepTask)));
        if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify(mockUsers)));
        if (url === "/api/tasks/task-1/comments") return Promise.resolve(new Response(JSON.stringify([])));
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      renderComponent();
      await waitFor(() => expect(screen.getByTestId("reject-task-btn")).toBeInTheDocument());
      fireEvent.click(screen.getByTestId("reject-task-btn"));

      await waitFor(() => expect(screen.getByTestId("approval-error")).toHaveTextContent("Approval decision conflict"));
      expect(screen.getByTestId("approval-status-badge")).toHaveTextContent("Pending approval");
    });

    it("reflects a reset to pending immediately after a significant edit, without a URL change", async () => {
      const resetTask = { ...mockTask, approvalStatus: "pending", approvalComment: undefined, approvalDecidedAt: undefined, title: "Renamed task" };
      const { puts } = mockEditableTask({ putResponse: () => new Response(JSON.stringify(resetTask), { status: 200 }) });

      renderComponent();
      await openEditModal();
      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Renamed task" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(screen.queryByTestId("task-edit-modal")).not.toBeInTheDocument());
      expect(puts.length).toBe(1);
      expect(screen.getByTestId("approval-status-badge")).toHaveTextContent("Pending approval");
      expect(screen.getByTestId("current-path")).toHaveTextContent("/tasks/task-1");
    });

    it("reverts the edit modal's status to the real value and keeps it open on an approval-blocked completion attempt", async () => {
      const { puts } = mockEditableTask({
        putResponse: () =>
          new Response(
            JSON.stringify({ error: "Cannot complete task without approval", approvalBlocker: { status: "pending", approver: "manager-a" } }),
            { status: 409 }
          )
      });

      renderComponent();
      await openEditModal();
      fireEvent.change(screen.getByLabelText("Status"), { target: { value: "done" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(document.getElementById("task-edit-modal-error")).toHaveTextContent("Cannot complete task without approval"));
      expect(puts.length).toBe(1);
      // Modal stays open, status field reverted to the task's real (unsaved) status.
      expect(screen.getByTestId("task-edit-modal")).toBeInTheDocument();
      expect(screen.getByLabelText("Status")).toHaveValue(mockTask.status);
      expect(screen.getByTestId("current-path")).toHaveTextContent("/tasks/task-1");
    });
  });

  describe("Comments section", () => {
    it("renders below Approval, loading and showing the task's comments without breaking the rest of the view", async () => {
      const taskComments = [
        { id: "c1", taskId: "task-1", content: "Looks good", authorId: "user-1", authorName: "Alice", createdAt: "2026-01-01T00:00:00.000Z" }
      ];
      fetchSpy.mockImplementation((input: RequestInfo | URL) => {
        const url = input.toString();
        if (url === "/api/tasks/task-1") return Promise.resolve(new Response(JSON.stringify(mockTask)));
        if (url === "/api/tasks/task-1/comments") return Promise.resolve(new Response(JSON.stringify(taskComments)));
        if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify(mockUsers)));
        if (url === "/api/tasks/task-2") return Promise.resolve(new Response(JSON.stringify(mockDepTask)));
        if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify([mockTask, mockDepTask])));
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      renderComponent();
      await waitFor(() => expect(screen.getByTestId("comment-c1")).toBeInTheDocument());

      // Approval section still renders correctly alongside Comments.
      expect(screen.getByTestId("approval-section")).toBeInTheDocument();
      expect(screen.getByTestId("comment-c1")).toHaveTextContent("Looks good");

      // Comments comes after Approval in document order.
      const approvalEl = screen.getByTestId("approval-section");
      const commentsEl = screen.getByTestId("comments-section");
      expect(approvalEl.compareDocumentPosition(commentsEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("a comments-fetch failure does not break the rest of the task details view", async () => {
      // Deliberately triggers CommentsSection's own "Failed to fetch
      // comments" console.warn (and, since /api/tasks isn't mocked here,
      // TaskDetails' "Failed to fetch tasks" one too) - see the note on the
      // "still saves an unrelated field..." test above for why this is
      // manually restored rather than left to beforeEach.
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      fetchSpy.mockImplementation((input: RequestInfo | URL) => {
        const url = input.toString();
        if (url === "/api/tasks/task-1") return Promise.resolve(new Response(JSON.stringify(mockTask)));
        if (url === "/api/tasks/task-1/comments") return Promise.resolve(new Response(null, { status: 500 }));
        if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify(mockUsers)));
        if (url === "/api/tasks/task-2") return Promise.resolve(new Response(JSON.stringify(mockDepTask)));
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      renderComponent();
      await waitFor(() => expect(screen.getByText("Test Task")).toBeInTheDocument());
      await waitFor(() => expect(screen.getByTestId("comments-error")).toBeInTheDocument());
      // The rest of the details view (and Approval) is unaffected.
      expect(screen.getByTestId("approval-section")).toBeInTheDocument();
      expect(screen.queryByText("Failed to load task")).not.toBeInTheDocument();
      warnSpy.mockRestore();
    });
  });
});
