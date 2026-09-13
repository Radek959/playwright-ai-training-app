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
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  it("fetches and displays task details", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/tasks/task-1") return Promise.resolve(new Response(JSON.stringify(mockTask)));
      if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify(mockUsers)));
      if (url === "/api/tasks/task-2") return Promise.resolve(new Response(JSON.stringify(mockDepTask)));
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

    // Check assignee and approver
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/\(user-1\)/)).toBeInTheDocument();
    
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
});
