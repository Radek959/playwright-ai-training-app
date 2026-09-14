import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { UserDetails } from "./UserDetails";
import { vi, describe, it, expect, beforeEach, afterEach, MockInstance } from "vitest";

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

const NOW = new Date("2026-06-15T12:00:00.000Z");

describe("UserDetails", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.useRealTimers();
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

    // task-1's dueDate (2024-12-31, well before the frozen "now") is overdue;
    // the assigned-task list must still show the exact due date next to it.
    const taskItem = screen.getByText("Active todo task").closest("li");
    expect(taskItem).not.toBeNull();
    const dueLabel = within(taskItem as HTMLElement).getByTestId("due-date-label");
    expect(dueLabel).toHaveTextContent("Overdue · Due: 12/31/2024");
  });

  it("shows a sensible empty state when the user has no assigned tasks, with genuine zero stats", async () => {
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
    // A real, successfully-fetched empty array is shown as genuine zeros.
    expect(screen.getAllByText("0")).toHaveLength(3);
  });

  it("does not show transient zero stats while the user loads before the tasks request settles", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/users/user-1") return Promise.resolve(new Response(JSON.stringify(mockUser)));
      if (url === "/api/tasks") return new Promise(() => {}); // never resolves within this test
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderComponent();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument());

    // The user resolved first, but tasks are still pending — stats must not
    // show a false 0 for data that hasn't actually arrived.
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getAllByText("…")).toHaveLength(3);
  });

  it("shows a loading state for the assigned-task lists while the tasks request is still pending", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/users/user-1") return Promise.resolve(new Response(JSON.stringify(mockUser)));
      if (url === "/api/tasks") return new Promise(() => {});
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderComponent();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument());

    expect(screen.getByText("Loading assigned tasks...")).toBeInTheDocument();
    expect(screen.queryByText("No active tasks assigned.")).not.toBeInTheDocument();
    expect(screen.queryByText("No completed tasks assigned.")).not.toBeInTheDocument();
  });

  it("shows unavailable stats and no empty-state messages when the tasks request fails", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/users/user-1") return Promise.resolve(new Response(JSON.stringify(mockUser)));
      if (url === "/api/tasks") return Promise.reject(new Error("Tasks Network Error"));
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderComponent();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/Failed to load assigned tasks/)).toBeInTheDocument());

    expect(screen.getAllByText("Unavailable")).toHaveLength(3);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText("No active tasks assigned.")).not.toBeInTheDocument();
    expect(screen.queryByText("No completed tasks assigned.")).not.toBeInTheDocument();
  });

  it("treats a non-array 200 response from GET /api/tasks as a controlled data error, not zero tasks", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/users/user-1") return Promise.resolve(new Response(JSON.stringify(mockUser)));
      if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify({ notAnArray: true })));
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderComponent();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/Failed to load assigned tasks/)).toBeInTheDocument());
    expect(screen.getAllByText("Unavailable")).toHaveLength(3);
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
    expect(screen.getAllByText("Unavailable")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText("Active todo task")).toBeInTheDocument());
    expect(screen.queryByText(/Failed to load assigned tasks/)).not.toBeInTheDocument();
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
    // Real stats are restored after a successful retry.
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
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

    it("blocks closing via Cancel or Escape while deletion is in flight, and still allows exactly one DELETE", async () => {
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

      // 1. Start the delete.
      fireEvent.click(confirmBtn);
      expect(confirmBtn).toBeDisabled();

      // 2. Try to close via Cancel — blocked while in flight.
      const cancelBtn = within(dialog).getByRole("button", { name: "Cancel" });
      expect(cancelBtn).toBeDisabled();
      fireEvent.click(cancelBtn);
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // ...and via Escape — also blocked.
      fireEvent.keyDown(dialog, { key: "Escape" });
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // 3. Retry confirming while still in flight — the button stays disabled.
      fireEvent.click(confirmBtn);

      // 4. Exactly one DELETE request was made throughout.
      const deleteCalls = fetchSpy.mock.calls.filter(
        (c) => c[0].toString() === "/api/users/user-1" && c[1]?.method === "DELETE"
      );
      expect(deleteCalls.length).toBe(1);

      resolveDelete?.();
      await waitFor(() => expect(screen.getByText("Users list page")).toBeInTheDocument());
    });

    it("allows cancelling and retrying normally after a failed delete", async () => {
      let deleteCallCount = 0;
      fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url === "/api/users/user-1" && init?.method === "DELETE") {
          deleteCallCount += 1;
          return Promise.reject(new Error("Network down"));
        }
        if (url === "/api/users/user-1") return Promise.resolve(new Response(JSON.stringify(mockUser)));
        if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify(mockTasks)));
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      renderComponent();
      await waitFor(() => expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument());

      const openBtn = screen.getByRole("button", { name: "Delete user: Alice Johnson" });
      fireEvent.click(openBtn);
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete user" }));

      await waitFor(() => expect(within(dialog).getByRole("alert")).toBeInTheDocument());
      expect(deleteCallCount).toBe(1);

      // Once the failed request has settled, Cancel works again.
      expect(within(dialog).getByRole("button", { name: "Cancel" })).not.toBeDisabled();
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      // And a fresh attempt fires a new request.
      fireEvent.click(openBtn);
      const reopenedDialog = await screen.findByRole("dialog");
      fireEvent.click(within(reopenedDialog).getByRole("button", { name: "Delete user" }));
      await waitFor(() => expect(deleteCallCount).toBe(2));
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

  describe("editing the user", () => {
    /**
     * Serves the user detail view and the task list, and answers a PUT with
     * whatever `putResponse` builds from the patch it received. Every request
     * is recorded so a test can assert on what was actually sent.
     */
    function mockEditableUser(putResponse: (patch: Record<string, unknown>) => Response) {
      const puts: Record<string, unknown>[] = [];
      let current = { ...mockUser };
      fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url === "/api/users/user-1" && init?.method === "PUT") {
          const patch = JSON.parse(String(init.body)) as Record<string, unknown>;
          puts.push(patch);
          const response = putResponse(patch);
          if (response.ok) current = { ...current, ...patch };
          return Promise.resolve(response);
        }
        if (url === "/api/users/user-1") return Promise.resolve(new Response(JSON.stringify(current)));
        if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify(mockTasks)));
        return Promise.resolve(new Response(null, { status: 404 }));
      });
      return { puts };
    }

    const okPut = (patch: Record<string, unknown>) =>
      new Response(JSON.stringify({ ...mockUser, ...patch }), { status: 200 });

    async function openEditDialog() {
      renderComponent();
      await waitFor(() => expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: "Edit user: Alice Johnson" }));
      return screen.findByRole("dialog");
    }

    it("opens an edit dialog prefilled with the loaded user", async () => {
      mockEditableUser(okPut);

      const dialog = await openEditDialog();

      expect(within(dialog).getByRole("heading", { name: "Edit user" })).toBeInTheDocument();
      expect((within(dialog).getByLabelText("Name") as HTMLInputElement).value).toBe("Alice Johnson");
      expect((within(dialog).getByLabelText("Email") as HTMLInputElement).value).toBe("alice@example.com");
      expect((within(dialog).getByLabelText("Role") as HTMLSelectElement).value).toBe("admin");
    });

    it("closes on Cancel without sending anything or changing the view", async () => {
      const { puts } = mockEditableUser(okPut);

      const dialog = await openEditDialog();
      fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Discarded" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(puts).toHaveLength(0);
      expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument();
    });

    it("saves, refreshes the detail view in place and keeps the URL on /users/:id", async () => {
      const { puts } = mockEditableUser(okPut);

      const dialog = await openEditDialog();
      fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Alice Cooper" } });
      fireEvent.change(within(dialog).getByLabelText("Role"), { target: { value: "editor" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      expect(puts).toEqual([{ name: "Alice Cooper", role: "editor" }]);
      // The view now shows the values the API returned, in place — no
      // navigation, no return to the users list.
      expect(screen.getByRole("heading", { name: "Alice Cooper" })).toBeInTheDocument();
      expect(screen.getByText("editor")).toBeInTheDocument();
      expect(screen.queryByText("Users list page")).not.toBeInTheDocument();
      expect(screen.getByText("ID: user-1")).toBeInTheDocument();
    });

    it("keeps the assigned tasks and their stats after a rename", async () => {
      mockEditableUser(okPut);

      const dialog = await openEditDialog();
      fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Alice Cooper" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

      await waitFor(() => expect(screen.getByRole("heading", { name: "Alice Cooper" })).toBeInTheDocument());

      // The tasks are matched by the stable userId, so a rename leaves both
      // the assignment lists and the summary counts exactly as they were.
      expect(screen.getByText("Active todo task")).toBeInTheDocument();
      expect(screen.getByText("Active in-progress task")).toBeInTheDocument();
      expect(screen.getByText("Finished task")).toBeInTheDocument();
      expect(screen.queryByText("Someone else's task")).not.toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("sends avatar: null and drops the avatar image when the field is cleared", async () => {
      const withAvatar = { ...mockUser, avatar: "https://example.com/old.png" };
      const puts: Record<string, unknown>[] = [];
      let current: Record<string, unknown> = { ...withAvatar };
      fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url === "/api/users/user-1" && init?.method === "PUT") {
          const patch = JSON.parse(String(init.body)) as Record<string, unknown>;
          puts.push(patch);
          current = { ...mockUser };
          return Promise.resolve(new Response(JSON.stringify(current), { status: 200 }));
        }
        if (url === "/api/users/user-1") return Promise.resolve(new Response(JSON.stringify(current)));
        if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify(mockTasks)));
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      const dialog = await openEditDialog();
      expect((within(dialog).getByLabelText("Avatar URL") as HTMLInputElement).value).toBe(
        "https://example.com/old.png"
      );
      fireEvent.change(within(dialog).getByLabelText("Avatar URL"), { target: { value: "" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(puts).toEqual([{ avatar: null }]);
      expect(screen.queryByRole("img", { name: "Alice Johnson" })).not.toBeInTheDocument();
    });

    it("keeps the dialog open with the entered values when the API rejects the save", async () => {
      const { puts } = mockEditableUser(() =>
        new Response(
          JSON.stringify({
            error: "Validation failed",
            details: [{ field: "email", message: "email is already in use" }]
          }),
          { status: 400 }
        )
      );

      const dialog = await openEditDialog();
      fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Alice Cooper" } });
      fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "taken@example.com" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

      await waitFor(() => expect(puts).toHaveLength(1));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect((within(dialog).getByLabelText("Name") as HTMLInputElement).value).toBe("Alice Cooper");
      expect((within(dialog).getByLabelText("Email") as HTMLInputElement).value).toBe("taken@example.com");
      // The detail view behind the dialog still shows the last saved values.
      expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument();
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    });

    it("keeps the dialog open and reports a network error", async () => {
      fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url === "/api/users/user-1" && init?.method === "PUT") {
          return Promise.reject(new Error("Network down"));
        }
        if (url === "/api/users/user-1") return Promise.resolve(new Response(JSON.stringify(mockUser)));
        if (url === "/api/tasks") return Promise.resolve(new Response(JSON.stringify(mockTasks)));
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      const dialog = await openEditDialog();
      fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Alice Cooper" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

      expect(await within(dialog).findByText("Network down")).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect((within(dialog).getByLabelText("Name") as HTMLInputElement).value).toBe("Alice Cooper");
      expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument();
    });

    it("succeeds on a retry after a rejected save", async () => {
      let attempt = 0;
      const { puts } = mockEditableUser((patch) => {
        attempt += 1;
        if (attempt === 1) {
          return new Response(
            JSON.stringify({
              error: "Validation failed",
              details: [{ field: "email", message: "email is already in use" }]
            }),
            { status: 400 }
          );
        }
        return new Response(JSON.stringify({ ...mockUser, ...patch }), { status: 200 });
      });

      const dialog = await openEditDialog();
      fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "taken@example.com" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
      await waitFor(() => expect(puts).toHaveLength(1));

      fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "free@example.com" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(puts).toEqual([{ email: "taken@example.com" }, { email: "free@example.com" }]);
      expect(screen.getByText("free@example.com")).toBeInTheDocument();
    });

    it("moves focus into the dialog on open and back to the trigger on close", async () => {
      mockEditableUser(okPut);
      renderComponent();
      await waitFor(() => expect(screen.getByRole("heading", { name: "Alice Johnson" })).toBeInTheDocument());

      // jsdom does not focus a button on click the way a browser does, so the
      // trigger is focused explicitly — what is under test is that closing
      // hands focus *back* to wherever it was, not how it got there.
      const trigger = screen.getByRole("button", { name: "Edit user: Alice Johnson" });
      trigger.focus();
      fireEvent.click(trigger);

      const dialog = await screen.findByRole("dialog");
      await waitFor(() => expect(within(dialog).getByLabelText("Name")).toHaveFocus());

      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(trigger).toHaveFocus());
    });
  });
});
