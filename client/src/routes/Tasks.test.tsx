import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it, vi, beforeEach, MockInstance } from "vitest";
import Tasks from "./Tasks";
import { AppErrorProvider, useAppError } from "../context/AppErrorContext";
import type { Task, User } from "../types";

const users: User[] = [
  { id: "u1", name: "Alice", email: "alice@example.com", role: "admin" },
  { id: "u2", name: "Bob", email: "bob@example.com", role: "editor" }
];

// Titles are deliberately alphabetical so the Table tab's default
// sort-by-title order doubles as an easy sanity check. All tab panels stay
// mounted in the DOM at once (only `hidden`), so assertions below target a
// specific task's data-testid rather than its title text, to avoid matching
// the same task rendered simultaneously in Active/Grid/Table/Archive.
const tasks: Task[] = [
  { id: "t1", title: "Alpha", status: "todo", priority: "low", assigneeId: "u1" },
  { id: "t2", title: "Bravo", status: "todo", priority: "medium", assigneeId: "u2" },
  { id: "t3", title: "Charlie", status: "in-progress", priority: "high", assigneeId: "u1" },
  { id: "t4", title: "Delta", status: "in-progress", priority: "low" },
  { id: "t5", title: "Echo", status: "todo", priority: "high", assigneeId: "u2" },
  { id: "t6", title: "Foxtrot", status: "in-progress", priority: "medium" },
  { id: "t7", title: "Golf", status: "todo", priority: "low", assigneeId: "u1" },
  { id: "t8", title: "Hotel", status: "done", priority: "high", assigneeId: "u1" }
];

let fetchSpy: MockInstance;

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body)));
}

function mockFetch(options: { usersResponse?: Promise<Response>; tasksResponse?: Promise<Response> } = {}) {
  fetchSpy.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/users")) {
      return options.usersResponse ?? jsonResponse(users);
    }
    if (url.includes("/api/tasks")) {
      return options.tasksResponse ?? jsonResponse(tasks);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname + location.search}</div>;
}

// Tasks.tsx reports fetch failures via useAppError() (rendered as a banner
// elsewhere, in App.tsx) rather than in its own markup, so tests that need
// to know a failed request has settled read it directly through this probe.
function ErrorProbe() {
  const { error } = useAppError();
  return <div data-testid="error-probe">{error ?? ""}</div>;
}

function NavControls() {
  const navigate = useNavigate();
  return (
    <div>
      <button onClick={() => navigate(-1)}>go-back</button>
      <button onClick={() => navigate(1)}>go-forward</button>
    </div>
  );
}

function renderTasks(initialEntries: string[] = ["/tasks"]) {
  return render(
    <AppErrorProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <LocationProbe />
        <ErrorProbe />
        <NavControls />
        <Routes>
          <Route path="/tasks" element={<Tasks />} />
        </Routes>
      </MemoryRouter>
    </AppErrorProvider>
  );
}

function locationSearch() {
  return screen.getByTestId("location-probe").textContent?.replace("/tasks", "") ?? "";
}

function errorProbeText() {
  return screen.getByTestId("error-probe").textContent ?? "";
}

async function waitForFetchError() {
  await waitFor(() => expect(errorProbeText()).not.toBe(""));
}

// Waits until the Active tab has finished its first data load: either at
// least one task card is showing, or the empty-state message is (both only
// ever appear once `tasksLoaded` flips true).
async function waitForActiveTabLoaded() {
  await waitFor(() => {
    const panel = screen.getByTestId("tab-content-active");
    const hasCards = within(panel).queryAllByTestId(/^task-card-/).length > 0;
    const empty = within(panel).queryByText("No tasks match your criteria");
    expect(hasCards || Boolean(empty)).toBe(true);
  });
}

async function waitForTableLoaded() {
  await waitFor(() => expect(screen.queryAllByTestId(/^task-row-/).length).toBeGreaterThan(0));
}

function activePanel() {
  return within(screen.getByTestId("tab-content-active"));
}

describe("Tasks view URL state", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchSpy = vi.spyOn(globalThis, "fetch");
    mockFetch();
  });

  it("restores the active tab and its filters/page from the URL on load", async () => {
    renderTasks(["/tasks?status=todo&priority=low&assignee=u1"]);
    await waitForActiveTabLoaded();

    expect(screen.getByTestId("tab-active")).toHaveAttribute("aria-selected", "true");
    expect((screen.getByLabelText("Filter by status") as HTMLSelectElement).value).toBe("todo");
    expect((screen.getByLabelText("Filter by priority") as HTMLSelectElement).value).toBe("low");
    expect(screen.getByTestId("filter-assignee-u1")).toHaveAttribute("aria-pressed", "true");

    // status=todo + priority=low + assignee=u1 matches "Alpha" (t1) and "Golf" (t7),
    // but not "Bravo" (t2, priority medium/assignee u2).
    expect(activePanel().getByTestId("task-card-t1")).toBeInTheDocument();
    expect(activePanel().getByTestId("task-card-t7")).toBeInTheDocument();
    expect(activePanel().queryByTestId("task-card-t2")).not.toBeInTheDocument();
  });

  it("restores a non-default tab and its page from the URL", async () => {
    renderTasks(["/tasks?page=2"]);
    await waitForActiveTabLoaded();

    // Page 2 of the 7 non-done tasks (5 per page) is Foxtrot (t6), Golf (t7).
    expect(activePanel().getByTestId("task-card-t6")).toBeInTheDocument();
    expect(activePanel().getByTestId("task-card-t7")).toBeInTheDocument();
    expect(activePanel().queryByTestId("task-card-t1")).not.toBeInTheDocument();
  });

  it("restores the Table tab's sort field and direction from the URL", async () => {
    renderTasks(["/tasks?tab=table&sort=priority&order=desc"]);
    await waitForTableLoaded();

    expect(screen.getByTestId("tab-table")).toHaveAttribute("aria-selected", "true");
    const priorityHeader = screen.getByTestId("sort-header-priority").closest("th");
    expect(priorityHeader).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByTestId("table-info")).toHaveTextContent("Sorted by: Priority descending");
  });

  it("updates the URL when the active tab changes and drops params the new tab doesn't use", async () => {
    renderTasks(["/tasks?status=todo&page=2"]);
    await waitForActiveTabLoaded();
    // page=2 has already been normalized down to 1 (status=todo only matches
    // 4 tasks, one page) before we interact further.
    await waitFor(() => expect(locationSearch()).toBe("?status=todo"));

    fireEvent.click(screen.getByTestId("tab-grid"));

    await waitFor(() => expect(locationSearch()).toBe("?tab=grid"));
    expect(screen.getByTestId("tab-grid")).toHaveAttribute("aria-selected", "true");
  });

  it("updates the URL after each Active-tab filter changes", async () => {
    renderTasks();
    await waitForActiveTabLoaded();

    fireEvent.change(screen.getByLabelText("Filter by status"), { target: { value: "todo" } });
    await waitFor(() => expect(locationSearch()).toBe("?status=todo"));

    fireEvent.change(screen.getByLabelText("Filter by priority"), { target: { value: "high" } });
    await waitFor(() => expect(locationSearch()).toBe("?status=todo&priority=high"));

    fireEvent.click(screen.getByTestId("filter-assignee-u2"));
    await waitFor(() => expect(locationSearch()).toBe("?status=todo&priority=high&assignee=u2"));
  });

  it("updates the URL after the page changes", async () => {
    renderTasks();
    await waitForActiveTabLoaded();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(locationSearch()).toBe("?page=2"));
  });

  it("updates the URL after the table sort changes", async () => {
    renderTasks(["/tasks?tab=table"]);
    await waitForTableLoaded();

    fireEvent.click(screen.getByTestId("sort-header-priority"));
    await waitFor(() => expect(locationSearch()).toBe("?tab=table&sort=priority"));

    // Clicking the same header again flips the direction instead of the key.
    fireEvent.click(screen.getByTestId("sort-header-priority"));
    await waitFor(() => expect(locationSearch()).toBe("?tab=table&sort=priority&order=desc"));
  });

  it("resets the page to 1 when a filter changes", async () => {
    renderTasks(["/tasks?page=2"]);
    await waitForActiveTabLoaded();
    expect(activePanel().getByTestId("task-card-t6")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by status"), { target: { value: "todo" } });

    await waitFor(() => expect(locationSearch()).toBe("?status=todo"));
    // Back on page 1 of the todo-only results.
    expect(activePanel().getByTestId("task-card-t1")).toBeInTheDocument();
  });

  it("corrects a page number beyond the available range once tasks have loaded", async () => {
    renderTasks(["/tasks?page=99"]);
    await waitForActiveTabLoaded();

    // 7 non-done tasks / 5 per page = 2 pages; page 99 is corrected to 2.
    await waitFor(() => expect(locationSearch()).toBe("?page=2"));
    expect(activePanel().getByTestId("task-card-t6")).toBeInTheDocument();
    expect(activePanel().getByTestId("task-card-t7")).toBeInTheDocument();
  });

  it("drops parameters that the selected tab doesn't support", async () => {
    renderTasks(["/tasks?tab=grid&status=todo&priority=high&assignee=u1&page=2&sort=priority&order=desc"]);
    await waitFor(() => expect(locationSearch()).toBe("?tab=grid"));
  });

  it("falls back to defaults and normalizes an invalid tab, status, priority, page and sort field/direction", async () => {
    renderTasks(["/tasks?tab=bogus&status=archived&priority=urgent&page=-5&sort=owner&order=sideways"]);
    await waitForActiveTabLoaded();

    // tab=bogus -> active (default, omitted); status/priority invalid -> "all" (omitted);
    // page=-5 -> 1 (omitted). Nothing here is table-only, so sort/order are dropped too.
    await waitFor(() => expect(locationSearch()).toBe(""));
    expect(screen.getByTestId("tab-active")).toHaveAttribute("aria-selected", "true");
  });

  it("keeps a valid assignee id in the URL while users are still loading, and shows its matching tasks", async () => {
    let resolveUsers!: (r: Response) => void;
    mockFetch({ usersResponse: new Promise((resolve) => (resolveUsers = resolve)) });

    renderTasks(["/tasks?assignee=u1"]);

    // Tasks load (they don't depend on the users response), so u1's tasks are
    // already visible even though /api/users hasn't resolved yet.
    await waitForActiveTabLoaded();
    expect(activePanel().getByTestId("task-card-t1")).toBeInTheDocument();
    expect(activePanel().queryByTestId("task-card-t2")).not.toBeInTheDocument();
    // A valid id is not stripped from the URL just because users haven't loaded.
    expect(locationSearch()).toBe("?assignee=u1");

    resolveUsers(new Response(JSON.stringify(users)));
    await waitFor(() => expect(screen.getByTestId("filter-assignee-u1")).toHaveAttribute("aria-pressed", "true"));
    expect(locationSearch()).toBe("?assignee=u1");
  });

  it("normalizes an assignee id that doesn't match any user once the user list has loaded", async () => {
    renderTasks(["/tasks?assignee=no-such-user"]);
    await waitForActiveTabLoaded();

    await waitFor(() => expect(locationSearch()).toBe(""));
    expect(screen.getByTestId("filter-assignee-all")).toHaveAttribute("aria-pressed", "true");
    // Falls back to showing every active task instead of an empty result.
    expect(activePanel().getByTestId("task-card-t1")).toBeInTheDocument();
  });

  it("restores the previous view after Back/Forward without a full reload", async () => {
    renderTasks(["/tasks"]);
    await waitForActiveTabLoaded();

    fireEvent.click(screen.getByTestId("tab-grid"));
    await waitFor(() => expect(locationSearch()).toBe("?tab=grid"));

    fireEvent.click(screen.getByText("go-back"));
    await waitFor(() => expect(locationSearch()).toBe(""));
    expect(screen.getByTestId("tab-active")).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByText("go-forward"));
    await waitFor(() => expect(locationSearch()).toBe("?tab=grid"));
    expect(screen.getByTestId("tab-grid")).toHaveAttribute("aria-selected", "true");
  });

  it("omits every parameter that is already at its default value", async () => {
    renderTasks(["/tasks?tab=active&status=all&priority=all&assignee=all&page=1"]);
    await waitForActiveTabLoaded();

    await waitFor(() => expect(locationSearch()).toBe(""));
  });

  it("still filters, sorts and paginates correctly end-to-end (no regression)", async () => {
    renderTasks();
    await waitForActiveTabLoaded();

    // Filtering: priority=high on the Active tab leaves Charlie (t3) and Echo (t5).
    fireEvent.change(screen.getByLabelText("Filter by priority"), { target: { value: "high" } });
    await waitFor(() => expect(locationSearch()).toBe("?priority=high"));
    expect(activePanel().getByTestId("task-card-t3")).toBeInTheDocument();
    expect(activePanel().getByTestId("task-card-t5")).toBeInTheDocument();
    expect(activePanel().queryByTestId("task-card-t1")).not.toBeInTheDocument();

    // Switch to Table: shows every task (including "done"), sorted by title asc by default.
    fireEvent.click(screen.getByTestId("tab-table"));
    await waitForTableLoaded();
    const table = screen.getByTestId("task-table");
    const rowIds = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.getAttribute("data-testid"));
    expect(rowIds[0]).toBe("task-row-t1");
    expect(rowIds[rowIds.length - 1]).toBe("task-row-t8");

    // Sorting: click Status header, which changes the sort key in the URL.
    fireEvent.click(screen.getByTestId("sort-header-status"));
    await waitFor(() => expect(locationSearch()).toBe("?tab=table&sort=status"));
  });

  it("keeps a valid assignee filter in the URL when GET /api/users fails, instead of normalizing it away", async () => {
    mockFetch({ usersResponse: Promise.resolve(new Response("Internal Server Error", { status: 500 })) });

    renderTasks(["/tasks?assignee=u1"]);
    await waitForActiveTabLoaded();
    await waitForFetchError();

    // Tasks did load successfully, and assignee=u1 is still applied to them.
    expect(activePanel().getByTestId("task-card-t1")).toBeInTheDocument();
    expect(activePanel().queryByTestId("task-card-t2")).not.toBeInTheDocument();
    // A failed users request must not be mistaken for "no such user" and
    // strip the filter from the URL.
    expect(locationSearch()).toBe("?assignee=u1");
  });

  it("keeps the page number in the URL when GET /api/tasks fails, instead of clamping it against an empty list", async () => {
    mockFetch({ tasksResponse: Promise.resolve(new Response("Internal Server Error", { status: 500 })) });

    renderTasks(["/tasks?page=2"]);
    await waitForFetchError();

    // A failed tasks request must not be mistaken for "there are no results"
    // and correct page=2 down to 1.
    expect(locationSearch()).toBe("?page=2");
  });

  it("still corrects a page number beyond range once GET /api/tasks succeeds (no regression)", async () => {
    renderTasks(["/tasks?page=99"]);
    await waitForActiveTabLoaded();

    await waitFor(() => expect(locationSearch()).toBe("?page=2"));
    expect(activePanel().getByTestId("task-card-t6")).toBeInTheDocument();
    expect(activePanel().getByTestId("task-card-t7")).toBeInTheDocument();
  });

  it("still normalizes an assignee id absent from a successfully loaded user list (no regression)", async () => {
    renderTasks(["/tasks?assignee=no-such-user"]);
    await waitForActiveTabLoaded();

    await waitFor(() => expect(locationSearch()).toBe(""));
    expect(screen.getByTestId("filter-assignee-all")).toHaveAttribute("aria-pressed", "true");
    expect(activePanel().getByTestId("task-card-t1")).toBeInTheDocument();
  });

  it("navigates tabs with the keyboard and updates focus and the URL", async () => {
    renderTasks();
    await waitForActiveTabLoaded();

    const activeTabBtn = screen.getByTestId("tab-active");
    activeTabBtn.focus();
    expect(document.activeElement).toBe(activeTabBtn);

    fireEvent.keyDown(activeTabBtn, { key: "ArrowRight" });
    await waitFor(() => expect(locationSearch()).toBe("?tab=grid"));
    const gridTabBtn = screen.getByTestId("tab-grid");
    expect(gridTabBtn).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(gridTabBtn);

    fireEvent.keyDown(gridTabBtn, { key: "End" });
    await waitFor(() => expect(locationSearch()).toBe("?tab=analytics"));
    const analyticsTabBtn = screen.getByTestId("tab-analytics");
    expect(analyticsTabBtn).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(analyticsTabBtn);

    fireEvent.keyDown(analyticsTabBtn, { key: "Home" });
    await waitFor(() => expect(locationSearch()).toBe(""));
    const activeTabBtnAgain = screen.getByTestId("tab-active");
    expect(activeTabBtnAgain).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(activeTabBtnAgain);
  });
});
