import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { UserDetails } from "./UserDetails";
import { vi, describe, it, expect, beforeEach, MockInstance } from "vitest";

const mockUser = {
  id: "user-1",
  name: "Alice Johnson",
  email: "alice@example.com",
  role: "admin"
};

const mockTasks = [
  { id: "task-1", title: "Active todo task", status: "todo", priority: "high", assigneeId: "user-1", dueDate: "2024-12-31T00:00:00Z" },
  { id: "task-2", title: "Active in-progress task", status: "in-progress", priority: "medium", assigneeId: "user-1" },
  { id: "task-3", title: "Finished task", status: "done", priority: "low", assigneeId: "user-1" },
  { id: "task-4", title: "Someone else's task", status: "todo", priority: "low", assigneeId: "user-2" }
];

let fetchSpy: MockInstance;

function renderComponent(id = "user-1") {
  return render(
    <MemoryRouter initialEntries={[`/users/${id}`]}>
      <Routes>
        <Route path="/users/:id" element={<UserDetails />} />
        <Route path="/users" element={<div>Users list page</div>} />
        <Route path="/tasks/:id" element={<div>Task details page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("UserDetails", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  function mockFetches(userStatus = 200) {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/users/user-1") {
        if (userStatus === 404) return Promise.resolve(new Response(null, { status: 404 }));
        return Promise.resolve(new Response(JSON.stringify(mockUser), { status: userStatus }));
      }
      if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify(mockTasks)));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
  }

  it("loads and displays user details with active/completed task stats and links", async () => {
    mockFetches();
    renderComponent();

    expect(screen.getByText("Loading user details...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument();
    });

    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("ID: user-1")).toBeInTheDocument();

    expect(screen.getByText("Total assigned")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // total
    expect(screen.getByText("2")).toBeInTheDocument(); // active
    expect(screen.getByText("1")).toBeInTheDocument(); // completed

    expect(screen.getByText("Active todo task")).toBeInTheDocument();
    expect(screen.getByText("Active in-progress task")).toBeInTheDocument();
    expect(screen.getByText("Finished task")).toBeInTheDocument();
    expect(screen.queryByText("Someone else's task")).not.toBeInTheDocument();

    const taskLinks = screen.getAllByRole("link", { name: /View details for/ });
    expect(taskLinks.length).toBe(3);
    expect(taskLinks[0]).toHaveAttribute("href", "/tasks/task-1");
  });

  it("shows a sensible empty state when the user has no assigned tasks", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/users/user-1") return Promise.resolve(new Response(JSON.stringify(mockUser)));
      if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify([])));
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderComponent();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument());

    expect(screen.getByText("No active tasks assigned.")).toBeInTheDocument();
    expect(screen.getByText("No completed tasks assigned.")).toBeInTheDocument();
  });

  it("shows User not found for a 404", async () => {
    mockFetches(404);
    renderComponent();

    await waitFor(() => expect(screen.getByText("User not found")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Back to users list" })).toHaveAttribute("href", "/users");
  });

  it("does not render a partial profile when the user fetch fails", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/users/user-1") return Promise.reject(new Error("Network Error"));
      if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify(mockTasks)));
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderComponent();

    await waitFor(() => expect(screen.getByText("Failed to load user")).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Alice Johnson" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows the user profile plus a retryable error when only the tasks fetch fails", async () => {
    let taskCallCount = 0;
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/users/user-1") return Promise.resolve(new Response(JSON.stringify(mockUser)));
      if (url === "/api/tasks") {
        taskCallCount += 1;
        if (taskCallCount === 1) return Promise.reject(new Error("Tasks Network Error"));
        return Promise.resolve(new Response(JSON.stringify(mockTasks)));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderComponent();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument());
    expect(screen.getByText(/Failed to load assigned tasks/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText("Active todo task")).toBeInTheDocument());
    expect(screen.queryByText(/Failed to load assigned tasks/)).not.toBeInTheDocument();
  });

  describe("delete flow", () => {
    it("opens and cancels the delete confirmation dialog", async () => {
      mockFetches();
      renderComponent();

      await waitFor(() => expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument());

      const deleteBtn = screen.getByRole("button", { name: "Delete user: Alice Johnson" });
      deleteBtn.focus();
      fireEvent.click(deleteBtn);

      const dialog = await screen.findByRole("dialog", { name: "Delete Alice Johnson?" });
      expect(within(dialog).getByText(/cannot be undone/)).toBeInTheDocument();
      expect(within(dialog).getByText(/no active/)).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      // Focus restored to the button that opened the dialog.
      await waitFor(() => expect(deleteBtn).toHaveFocus());
    });

    it("blocks a second click while deletion is in flight", async () => {
      mockFetches();
      let resolveDelete: (() => void) | undefined;
      fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url === "/api/users/user-1" && init?.method === "DELETE") {
          return new Promise((resolve) => {
            resolveDelete = () => resolve(new Response(null, { status: 204 }));
          });
        }
        if (url === "/api/users/user-1") return Promise.resolve(new Response(JSON.stringify(mockUser)));
        if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify(mockTasks)));
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      renderComponent();
      await waitFor(() => expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument());

      fireEvent.click(screen.getByRole("button", { name: "Delete user: Alice Johnson" }));
      const dialog = await screen.findByRole("dialog");
      const confirmBtn = within(dialog).getByRole("button", { name: "Delete user" });

      fireEvent.click(confirmBtn);
      expect(confirmBtn).toBeDisabled();
      fireEvent.click(confirmBtn);

      const deleteCalls = fetchSpy.mock.calls.filter(
        (c) => c[0].toString() === "/api/users/user-1" && c[1]?.method === "DELETE"
      );
      expect(deleteCalls.length).toBe(1);

      resolveDelete?.();
      await waitFor(() => expect(screen.getByText("Users list page")).toBeInTheDocument());
    });

    it("navigates to /users and shows a success message on 204", async () => {
      mockFetches();
      fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url === "/api/users/user-1" && init?.method === "DELETE") {
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        if (url === "/api/users/user-1") return Promise.resolve(new Response(JSON.stringify(mockUser)));
        if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify(mockTasks)));
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      renderComponent();
      await waitFor(() => expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument());

      fireEvent.click(screen.getByRole("button", { name: "Delete user: Alice Johnson" }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete user" }));

      await waitFor(() => expect(screen.getByText("Users list page")).toBeInTheDocument());
    });

    it("shows the conflicting tasks list on 409 and keeps the dialog open without removing the user", async () => {
      fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url === "/api/users/user-1" && init?.method === "DELETE") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                error: "Cannot delete user with active tasks",
                conflictingTasks: [
                  { id: "task-1", title: "Active todo task", status: "todo" },
                  { id: "task-2", title: "Active in-progress task", status: "in-progress" }
                ]
              }),
              { status: 409 }
            )
          );
        }
        if (url === "/api/users/user-1") return Promise.resolve(new Response(JSON.stringify(mockUser)));
        if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify(mockTasks)));
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      renderComponent();
      await waitFor(() => expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument());

      fireEvent.click(screen.getByRole("button", { name: "Delete user: Alice Johnson" }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete user" }));

      await waitFor(() => expect(within(dialog).getByRole("alert")).toBeInTheDocument());
      expect(within(dialog).getByText("Cannot delete user with active tasks")).toBeInTheDocument();
      expect(within(dialog).getByText("Active todo task")).toBeInTheDocument();
      expect(within(dialog).getByText("Active in-progress task")).toBeInTheDocument();

      const conflictLinks = within(dialog).getAllByRole("link", { name: "View details" });
      expect(conflictLinks[0]).toHaveAttribute("href", "/tasks/task-1");

      // Dialog stays open, user not removed from the page.
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument();
    });

    it("clears a previous error when the dialog is closed and reopened", async () => {
      let deleteCallCount = 0;
      fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url === "/api/users/user-1" && init?.method === "DELETE") {
          deleteCallCount += 1;
          return Promise.resolve(
            new Response(
              JSON.stringify({
                error: "Cannot delete user with active tasks",
                conflictingTasks: [{ id: "task-1", title: "Active todo task", status: "todo" }]
              }),
              { status: 409 }
            )
          );
        }
        if (url === "/api/users/user-1") return Promise.resolve(new Response(JSON.stringify(mockUser)));
        if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify(mockTasks)));
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      renderComponent();
      await waitFor(() => expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument());

      fireEvent.click(screen.getByRole("button", { name: "Delete user: Alice Johnson" }));
      let dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete user" }));
      await waitFor(() => expect(within(dialog).getByRole("alert")).toBeInTheDocument());

      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole("button", { name: "Delete user: Alice Johnson" }));
      dialog = await screen.findByRole("dialog");
      expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole("button", { name: "Delete user" }));
      await waitFor(() => expect(deleteCallCount).toBe(2));
    });

    it("keeps the dialog open and shows a retryable message on a network error", async () => {
      fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url === "/api/users/user-1" && init?.method === "DELETE") {
          return Promise.reject(new Error("Network down"));
        }
        if (url === "/api/users/user-1") return Promise.resolve(new Response(JSON.stringify(mockUser)));
        if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify(mockTasks)));
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      renderComponent();
      await waitFor(() => expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument());

      fireEvent.click(screen.getByRole("button", { name: "Delete user: Alice Johnson" }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete user" }));

      await waitFor(() => expect(within(dialog).getByRole("alert")).toBeInTheDocument());
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Delete user" })).not.toBeDisabled();
    });
  });
});
