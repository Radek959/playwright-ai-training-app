import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TaskDetails } from "./TaskDetails";
import { AppErrorProvider } from "../context/AppErrorContext";
import { vi, describe, it, expect, beforeEach, MockInstance } from "vitest";

const mockTask = {
  id: "task-1",
  title: "Test Task",
  description: "Test description",
  status: "in-progress",
  priority: "high",
  taskType: "bug",
  severity: "critical",
  dueDate: "2024-12-31T00:00:00Z",
  completedAt: null,
  estimatedHours: 5,
  assigneeId: "user-1",
  tags: ["frontend", "urgent"],
  dependencies: ["task-2"],
  requiresApproval: true,
  approver: "user-2",
  coverImage: "http://example.com/image.png"
};

const mockUsers = [
  { id: "user-1", name: "Alice" },
  { id: "user-2", name: "Bob" }
];

const mockDepTask = {
  id: "task-2",
  title: "Dependency Task"
};

let fetchSpy: MockInstance;

function renderComponent(id = "task-1") {
  return render(
    <AppErrorProvider>
      <MemoryRouter initialEntries={[`/tasks/${id}`]}>
        <Routes>
          <Route path="/tasks/:id" element={<TaskDetails />} />
        </Routes>
      </MemoryRouter>
    </AppErrorProvider>
  );
}

describe("TaskDetails", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchSpy = vi.spyOn(global, "fetch");
  });

  it("fetches and displays task details", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/tasks/task-1") return Promise.resolve(new Response(JSON.stringify(mockTask)));
      if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify(mockUsers)));
      if (url === "/api/tasks/task-2") return Promise.resolve(new Response(JSON.stringify(mockDepTask)));
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderComponent();

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

    // Check assignee and approver
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/\(user-1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText(/\(user-2\)/)).toBeInTheDocument();

    // Check dependencies
    expect(screen.getByText("Dependency Task")).toBeInTheDocument();
    expect(screen.getByText(/\(task-2\)/)).toBeInTheDocument();

    // Check tags
    expect(screen.getByText("frontend")).toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
  });

  it("displays Not set for missing optional fields", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/tasks/task-empty") return Promise.resolve(new Response(JSON.stringify({
        id: "task-empty",
        title: "Empty Task",
        status: "todo",
        priority: "low"
      })));
      if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify([])));
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderComponent("task-empty");

    await waitFor(() => {
      expect(screen.getByText("Empty Task")).toBeInTheDocument();
    });

    const notSetElements = screen.getAllByText("Not set");
    expect(notSetElements.length).toBeGreaterThan(0);
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
});
