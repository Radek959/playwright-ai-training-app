import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it, vi, beforeEach, afterEach, MockInstance } from "vitest";
import Tasks from "./Tasks";
import { AppErrorProvider } from "../context/AppErrorContext";
import { useAppError } from "../context/useAppError";
import type { Task, User } from "../types";

const users: User[] = [
  { id: "u1", name: "Alice", email: "alice@example.com", role: "admin" },
  { id: "u2", name: "Bob", email: "bob@example.com", role: "editor" }
];

// Frozen "now" for every test in this file (see the beforeEach/afterEach
// pairs below) so due-date classification and its displayed date never
// depend on the day/time/timezone the test suite actually runs in.
const NOW = new Date("2026-06-15T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
function daysFromNow(n: number): string {
  return new Date(NOW.getTime() + n * DAY_MS).toISOString();
}
function daysAgo(n: number): string {
  return daysFromNow(-n);
}

// Mirrors formatDueDateUtc's own formatting call, so the expectation tracks
// the runtime's locale (e.g. CI) instead of hardcoding an en-US string.
function utcDisplay(dateStr: string): string {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" }).format(
    new Date(dateStr)
  );
}

// Titles are deliberately alphabetical so the Table tab's default
// sort-by-title order doubles as an easy sanity check. All tab panels stay
// mounted in the DOM at once (only `hidden`), so assertions below target a
// specific task's data-testid rather than its title text, to avoid matching
// the same task rendered simultaneously in Active/Grid/Table/Archive.
// t1 is overdue, t5 is overdue (and high priority), t6 is due soon; the rest
// have no dueDate and so never match an overdue/soon filter.
const tasks: Task[] = [
  { id: "t1", title: "Alpha", status: "todo", priority: "low", assigneeId: "u1", dueDate: daysAgo(1) },
  { id: "t2", title: "Bravo", status: "todo", priority: "medium", assigneeId: "u2" },
  { id: "t3", title: "Charlie", status: "in-progress", priority: "high", assigneeId: "u1" },
  { id: "t4", title: "Delta", status: "in-progress", priority: "low" },
  { id: "t5", title: "Echo", status: "todo", priority: "high", assigneeId: "u2", dueDate: daysAgo(2) },
  { id: "t6", title: "Foxtrot", status: "in-progress", priority: "medium", dueDate: daysFromNow(2) },
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
// ever appear once tasksLoadState flips to "success").
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
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    fetchSpy = vi.spyOn(globalThis, "fetch");
    mockFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
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

describe("Tasks view due-date filter", () => {
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

  it("restores due=overdue from the URL, selects the control and shows only overdue tasks", async () => {
    renderTasks(["/tasks?due=overdue"]);
    await waitForActiveTabLoaded();

    expect((screen.getByLabelText("Filter by due date") as HTMLSelectElement).value).toBe("overdue");
    // t1 and t5 are overdue; t6 is due soon (not overdue) and the rest have no dueDate.
    expect(activePanel().getByTestId("task-card-t1")).toBeInTheDocument();
    expect(activePanel().getByTestId("task-card-t5")).toBeInTheDocument();
    expect(activePanel().queryByTestId("task-card-t6")).not.toBeInTheDocument();
    expect(activePanel().queryByTestId("task-card-t2")).not.toBeInTheDocument();
  });

  it("restores due=soon from the URL and shows only due-soon tasks", async () => {
    renderTasks(["/tasks?due=soon"]);
    await waitForActiveTabLoaded();

    expect((screen.getByLabelText("Filter by due date") as HTMLSelectElement).value).toBe("soon");
    expect(activePanel().getByTestId("task-card-t6")).toBeInTheDocument();
    expect(activePanel().queryByTestId("task-card-t1")).not.toBeInTheDocument();
    expect(activePanel().queryByTestId("task-card-t5")).not.toBeInTheDocument();
  });

  it("combines the due filter with priority, status and assignee filters", async () => {
    // t5 (Echo) is the only overdue task that is also high priority, todo and assigned to u2.
    renderTasks(["/tasks?due=overdue&priority=high&status=todo&assignee=u2"]);
    await waitForActiveTabLoaded();

    expect(activePanel().getByTestId("task-card-t5")).toBeInTheDocument();
    expect(activePanel().queryByTestId("task-card-t1")).not.toBeInTheDocument();
  });

  it("updates the URL when the due filter control changes and resets the page to 1", async () => {
    renderTasks(["/tasks?page=1"]);
    await waitForActiveTabLoaded();

    fireEvent.change(screen.getByLabelText("Filter by due date"), { target: { value: "overdue" } });
    await waitFor(() => expect(locationSearch()).toBe("?due=overdue"));
    expect(activePanel().getByTestId("task-card-t1")).toBeInTheDocument();
  });

  it("resets an existing page number to 1 when the due filter changes", async () => {
    renderTasks(["/tasks?page=2"]);
    await waitForActiveTabLoaded();

    fireEvent.change(screen.getByLabelText("Filter by due date"), { target: { value: "soon" } });
    await waitFor(() => expect(locationSearch()).toBe("?due=soon"));
  });

  it("omits the default due=all from the URL", async () => {
    renderTasks(["/tasks?due=all"]);
    await waitForActiveTabLoaded();

    await waitFor(() => expect(locationSearch()).toBe(""));
    expect((screen.getByLabelText("Filter by due date") as HTMLSelectElement).value).toBe("all");
  });

  it("normalizes an unknown due value back to 'all'", async () => {
    renderTasks(["/tasks?due=someday"]);
    await waitForActiveTabLoaded();

    await waitFor(() => expect(locationSearch()).toBe(""));
    expect((screen.getByLabelText("Filter by due date") as HTMLSelectElement).value).toBe("all");
  });

  it("drops the due parameter when navigating to a tab that doesn't support it", async () => {
    renderTasks(["/tasks?due=overdue"]);
    await waitForActiveTabLoaded();

    fireEvent.click(screen.getByTestId("tab-grid"));
    await waitFor(() => expect(locationSearch()).toBe("?tab=grid"));
  });

  it("restores the due filter after Back/Forward navigation", async () => {
    renderTasks(["/tasks"]);
    await waitForActiveTabLoaded();

    fireEvent.change(screen.getByLabelText("Filter by due date"), { target: { value: "overdue" } });
    await waitFor(() => expect(locationSearch()).toBe("?due=overdue"));

    fireEvent.click(screen.getByText("go-back"));
    await waitFor(() => expect(locationSearch()).toBe(""));

    fireEvent.click(screen.getByText("go-forward"));
    await waitFor(() => expect(locationSearch()).toBe("?due=overdue"));
    expect((screen.getByLabelText("Filter by due date") as HTMLSelectElement).value).toBe("overdue");
  });

  it("keeps existing URL parameters working alongside the due filter (no regression)", async () => {
    renderTasks(["/tasks?status=todo&priority=high"]);
    await waitForActiveTabLoaded();

    expect((screen.getByLabelText("Filter by status") as HTMLSelectElement).value).toBe("todo");
    expect((screen.getByLabelText("Filter by priority") as HTMLSelectElement).value).toBe("high");
    expect((screen.getByLabelText("Filter by due date") as HTMLSelectElement).value).toBe("all");
    expect(activePanel().getByTestId("task-card-t5")).toBeInTheDocument();
  });

  it("shows the Overdue label with the exact due date on the Active tab's task card", async () => {
    renderTasks();
    await waitForActiveTabLoaded();

    // t1's dueDate is daysAgo(1) relative to the frozen NOW (2026-06-15), so
    // its UTC calendar day is 2026-06-14.
    const card = activePanel().getByTestId("task-card-t1");
    const label = within(card).getByTestId("due-date-label");
    expect(label).toHaveTextContent(`Overdue · Due: ${utcDisplay(daysAgo(1))}`);
  });

  it("shows the Due soon label with the exact due date in Grid View", async () => {
    renderTasks(["/tasks?tab=grid"]);
    await waitFor(() => expect(screen.getByTestId("tab-grid")).toHaveAttribute("aria-selected", "true"));

    // t6's dueDate is daysFromNow(2) relative to the frozen NOW, so its UTC
    // calendar day is 2026-06-17.
    const gridItem = screen.getByTestId("task-grid-item-t6");
    const label = within(gridItem).getByTestId("due-date-label");
    expect(label).toHaveTextContent(`Due soon · Due: ${utcDisplay(daysFromNow(2))}`);
  });
});

describe("Tasks view table filters", () => {
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

  function tableRowIds() {
    const table = screen.getByTestId("task-table");
    return within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.getAttribute("data-testid"));
  }

  it("restores status/priority/assignee filters from the URL, combined with AND", async () => {
    renderTasks(["/tasks?tab=table&status=done&priority=high&assignee=u1"]);
    await waitForTableLoaded();

    expect((screen.getByTestId("table-filter-status") as HTMLSelectElement).value).toBe("done");
    expect((screen.getByTestId("table-filter-priority") as HTMLSelectElement).value).toBe("high");
    expect((screen.getByTestId("table-filter-assignee") as HTMLSelectElement).value).toBe("u1");

    // Only t8 (done, high, u1) matches all three filters together.
    expect(tableRowIds()).toEqual(["task-row-t8"]);
  });

  it("accepts status=done on the Table tab, unlike the Active tab", async () => {
    renderTasks(["/tasks?tab=table&status=done"]);
    await waitForTableLoaded();

    expect(tableRowIds()).toEqual(["task-row-t8"]);
  });

  it("filters the table by status=todo", async () => {
    renderTasks(["/tasks?tab=table&status=todo"]);
    await waitForTableLoaded();

    expect(tableRowIds()).toEqual(["task-row-t1", "task-row-t2", "task-row-t5", "task-row-t7"]);
  });

  it("filters the table by status=in-progress", async () => {
    renderTasks(["/tasks?tab=table&status=in-progress"]);
    await waitForTableLoaded();

    expect(tableRowIds()).toEqual(["task-row-t3", "task-row-t4", "task-row-t6"]);
  });

  it("filters the table by priority", async () => {
    renderTasks(["/tasks?tab=table&priority=high"]);
    await waitForTableLoaded();

    expect(tableRowIds()).toEqual(["task-row-t3", "task-row-t5", "task-row-t8"]);
  });

  it("filters the table by a specific assignee", async () => {
    renderTasks(["/tasks?tab=table&assignee=u1"]);
    await waitForTableLoaded();

    expect(tableRowIds()).toEqual(["task-row-t1", "task-row-t3", "task-row-t7", "task-row-t8"]);
  });

  it("filters the table to unassigned tasks", async () => {
    renderTasks(["/tasks?tab=table&assignee=unassigned"]);
    await waitForTableLoaded();

    expect(tableRowIds()).toEqual(["task-row-t4", "task-row-t6"]);
  });

  it("normalizes unknown status/priority/assignee values back to their defaults", async () => {
    renderTasks(["/tasks?tab=table&status=bogus&priority=bogus&assignee=does-not-exist"]);
    await waitForTableLoaded();

    await waitFor(() => expect(locationSearch()).toBe("?tab=table"));
    expect((screen.getByTestId("table-filter-status") as HTMLSelectElement).value).toBe("all");
  });

  it("strips default filter values from the canonical URL", async () => {
    renderTasks(["/tasks?tab=table&status=all&priority=all&assignee=all"]);
    await waitForTableLoaded();

    await waitFor(() => expect(locationSearch()).toBe("?tab=table"));
  });

  it("updates the URL as each table filter control changes", async () => {
    renderTasks(["/tasks?tab=table"]);
    await waitForTableLoaded();

    fireEvent.change(screen.getByTestId("table-filter-status"), { target: { value: "done" } });
    await waitFor(() => expect(locationSearch()).toBe("?tab=table&status=done"));

    fireEvent.change(screen.getByTestId("table-filter-priority"), { target: { value: "high" } });
    await waitFor(() => expect(locationSearch()).toBe("?tab=table&status=done&priority=high"));

    fireEvent.change(screen.getByTestId("table-filter-assignee"), { target: { value: "u1" } });
    await waitFor(() => expect(locationSearch()).toBe("?tab=table&status=done&priority=high&assignee=u1"));
  });

  it("keeps sort/order working alongside table filters", async () => {
    renderTasks(["/tasks?tab=table&priority=high"]);
    await waitForTableLoaded();

    fireEvent.click(screen.getByTestId("sort-header-dueDate"));
    await waitFor(() => expect(locationSearch()).toBe("?tab=table&priority=high&sort=dueDate"));
    // The filter itself must still be in effect after sorting.
    expect(tableRowIds().sort()).toEqual(["task-row-t3", "task-row-t5", "task-row-t8"].sort());
  });

  it("restores table filters after Back/Forward navigation", async () => {
    renderTasks(["/tasks?tab=table"]);
    await waitForTableLoaded();

    fireEvent.change(screen.getByTestId("table-filter-status"), { target: { value: "done" } });
    await waitFor(() => expect(locationSearch()).toBe("?tab=table&status=done"));

    fireEvent.click(screen.getByText("go-back"));
    await waitFor(() => expect(locationSearch()).toBe("?tab=table"));

    fireEvent.click(screen.getByText("go-forward"));
    await waitFor(() => expect(locationSearch()).toBe("?tab=table&status=done"));
  });

  it("removes table filters from the URL when switching to a tab that doesn't support them", async () => {
    renderTasks(["/tasks?tab=table&status=done&priority=high&assignee=u1"]);
    await waitForTableLoaded();

    fireEvent.click(screen.getByTestId("tab-grid"));
    await waitFor(() => expect(locationSearch()).toBe("?tab=grid"));
  });

  it("shows a proper empty state, not a broken table, when filters match nothing", async () => {
    // No task is both low priority and done.
    renderTasks(["/tasks?tab=table&status=done&priority=low"]);
    await waitFor(() => expect(screen.getByTestId("tab-table")).toHaveAttribute("aria-selected", "true"));

    const table = screen.getByTestId("task-table");
    expect(within(table).getByText("No tasks to display")).toBeInTheDocument();
  });

  it("does not affect the Grid/Archived/Analytics tabs' own (unfiltered) content", async () => {
    renderTasks(["/tasks?tab=table&status=done&priority=high&assignee=u1"]);
    await waitForTableLoaded();

    fireEvent.click(screen.getByTestId("tab-grid"));
    await waitFor(() => expect(screen.getByTestId("tab-grid")).toHaveAttribute("aria-selected", "true"));
    // Grid View shows every task again, not just the done/high/u1 subset.
    expect(screen.getByTestId("task-grid-item-t1")).toBeInTheDocument();
    expect(screen.getByTestId("task-grid-item-t2")).toBeInTheDocument();
  });
});

describe("Tasks view analytics links", () => {
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

  it("links All Tasks to the unfiltered table, with a count matching what Analytics shows", async () => {
    renderTasks(["/tasks?tab=analytics"]);
    const link = await screen.findByTestId("analytics-link-all");
    expect(link).toHaveAttribute("href", "/tasks?tab=table");
    expect(link).toHaveTextContent(String(tasks.length));
  });

  it("links Completed to status=done, with a count matching what Analytics shows", async () => {
    renderTasks(["/tasks?tab=analytics"]);
    const link = await screen.findByTestId("analytics-link-completed");
    expect(link).toHaveAttribute("href", "/tasks?tab=table&status=done");
    const doneCount = tasks.filter((t) => t.status === "done").length;
    expect(link).toHaveTextContent(String(doneCount));

    fireEvent.click(link);
    await waitForTableLoaded();
    const table = screen.getByTestId("task-table");
    expect(within(table).getAllByRole("row")).toHaveLength(doneCount + 1); // +1 header row
  });

  it("links In Progress to status=in-progress", async () => {
    renderTasks(["/tasks?tab=analytics"]);
    const link = await screen.findByTestId("analytics-link-in-progress");
    expect(link).toHaveAttribute("href", "/tasks?tab=table&status=in-progress");
  });

  it("links High Priority to priority=high", async () => {
    renderTasks(["/tasks?tab=analytics"]);
    const link = await screen.findByTestId("analytics-link-high-priority");
    expect(link).toHaveAttribute("href", "/tasks?tab=table&priority=high");
  });

  it("links each team member to their user profile", async () => {
    renderTasks(["/tasks?tab=analytics"]);
    const link = await screen.findByTestId("analytics-link-user-u1");
    expect(link).toHaveAttribute("href", "/users/u1");
  });

  it("links Unassigned to assignee=unassigned, with a matching count", async () => {
    renderTasks(["/tasks?tab=analytics"]);
    const link = await screen.findByTestId("analytics-link-unassigned");
    expect(link).toHaveAttribute("href", "/tasks?tab=table&assignee=unassigned");
    const unassignedCount = tasks.filter((t) => !t.assigneeId).length;
    expect(link).toHaveTextContent(String(unassignedCount));

    fireEvent.click(link);
    await waitForTableLoaded();
    const table = screen.getByTestId("task-table");
    expect(within(table).getAllByRole("row")).toHaveLength(unassignedCount + 1);
  });

  it("does not turn a malformed tasks payload into fake analytics numbers", async () => {
    mockFetch({ tasksResponse: jsonResponse({ not: "a list" }) });
    renderTasks(["/tasks?tab=analytics"]);

    const link = await screen.findByTestId("analytics-link-all");
    expect(link).toHaveTextContent("0");
    expect(link).not.toHaveTextContent("NaN");
  });
});

describe("Tasks view assignee avatars", () => {
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a newly-set avatar (not just legacy avatarUrl) on the assignee's tasks", async () => {
    mockFetch({
      usersResponse: jsonResponse([
        { id: "u1", name: "Alice", email: "alice@example.com", role: "admin", avatar: "https://example.com/new.png" }
      ]),
      tasksResponse: jsonResponse([{ id: "t1", title: "Alpha", status: "todo", priority: "low", assigneeId: "u1" }])
    });
    renderTasks(["/tasks?tab=grid"]);

    const gridItem = await screen.findByTestId("task-grid-item-t1");
    const img = within(gridItem).getByTestId("user-avatar-image") as HTMLImageElement;
    expect(img.src).toBe("https://example.com/new.png");
  });

  it("prefers avatar over legacy avatarUrl for an assignee that has both", async () => {
    mockFetch({
      usersResponse: jsonResponse([
        {
          id: "u1",
          name: "Alice",
          email: "alice@example.com",
          role: "admin",
          avatar: "https://example.com/new.png",
          avatarUrl: "https://example.com/legacy.png"
        }
      ]),
      tasksResponse: jsonResponse([{ id: "t1", title: "Alpha", status: "todo", priority: "low", assigneeId: "u1" }])
    });
    renderTasks(["/tasks?tab=grid"]);

    const gridItem = await screen.findByTestId("task-grid-item-t1");
    const img = within(gridItem).getByTestId("user-avatar-image") as HTMLImageElement;
    expect(img.src).toBe("https://example.com/new.png");
  });

  it("falls back to legacy avatarUrl for an assignee that never had avatar set", async () => {
    mockFetch({
      usersResponse: jsonResponse([
        { id: "u1", name: "Alice", email: "alice@example.com", role: "admin", avatarUrl: "https://example.com/legacy.png" }
      ]),
      tasksResponse: jsonResponse([{ id: "t1", title: "Alpha", status: "todo", priority: "low", assigneeId: "u1" }])
    });
    renderTasks(["/tasks?tab=grid"]);

    const gridItem = await screen.findByTestId("task-grid-item-t1");
    const img = within(gridItem).getByTestId("user-avatar-image") as HTMLImageElement;
    expect(img.src).toBe("https://example.com/legacy.png");
  });
});

describe("Tasks view search widget", () => {
  function renderTasksWithDetailsRoute(initialEntries: string[] = ["/tasks"]) {
    return render(
      <AppErrorProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <LocationProbe />
          <Routes>
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/tasks/:id" element={<div>Task details page</div>} />
          </Routes>
        </MemoryRouter>
      </AppErrorProvider>
    );
  }

  function mockFetchWithSearch(results: Task[]) {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/tasks/search")) return jsonResponse(results);
      if (url.includes("/api/users")) return jsonResponse(users);
      if (url.includes("/api/tasks")) return jsonResponse(tasks);
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
  }

  async function searchFor(query: string) {
    const input = screen.getByTestId("task-search-input");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: query } });
    // Advanced inside act() so the debounced request's state updates are
    // flushed the way the component would flush them in the browser.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(NOW);
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("navigates to the task details page instead of opening the edit modal", async () => {
    mockFetchWithSearch([tasks[0]]);
    renderTasksWithDetailsRoute();
    await waitForActiveTabLoaded();

    await searchFor("alpha");
    fireEvent.mouseDown(await screen.findByTestId("search-result-t1"));

    await waitFor(() => expect(screen.getByText("Task details page")).toBeInTheDocument());
    expect(screen.queryByTestId("task-edit-modal")).not.toBeInTheDocument();
  });

  it("closes the search dropdown when a result is selected", async () => {
    mockFetchWithSearch([tasks[0]]);
    renderTasksWithDetailsRoute();
    await waitForActiveTabLoaded();

    await searchFor("alpha");
    expect(await screen.findByTestId("search-results-dropdown")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("search-result-t1"));

    await waitFor(() => expect(screen.queryByTestId("search-results-dropdown")).not.toBeInTheDocument());
  });

  it("does not write the search text into the /tasks URL", async () => {
    mockFetchWithSearch([tasks[0]]);
    renderTasksWithDetailsRoute(["/tasks?tab=grid"]);
    await waitFor(() => expect(screen.getByTestId("tab-grid")).toHaveAttribute("aria-selected", "true"));

    await searchFor("alpha");
    await screen.findByTestId("search-result-t1");

    // The widget is transient navigation, not list state: the URL still
    // describes only the tab/filters the list itself owns.
    expect(locationSearch()).toBe("?tab=grid");
  });

  it("leaves the list's own filtering untouched while searching", async () => {
    mockFetchWithSearch([tasks[0]]);
    renderTasksWithDetailsRoute(["/tasks?status=todo"]);
    await waitForActiveTabLoaded();

    const visibleBefore = activePanel().getAllByTestId(/^task-card-/).map((el) => el.dataset.testid);

    await searchFor("alpha");
    await screen.findByTestId("search-result-t1");

    expect(activePanel().getAllByTestId(/^task-card-/).map((el) => el.dataset.testid)).toEqual(visibleBefore);
    expect((screen.getByLabelText("Filter by status") as HTMLSelectElement).value).toBe("todo");
  });
});

describe("Tasks view load states", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("never shows the empty-state message while tasks are still loading", () => {
    mockFetch({ tasksResponse: new Promise(() => {}) }); // never resolves
    renderTasks();

    expect(activePanel().getByText("Loading tasks...")).toBeInTheDocument();
    expect(activePanel().queryByText("No tasks match your criteria")).not.toBeInTheDocument();
  });

  it("never shows the Grid tab's empty-state message while tasks are still loading", () => {
    mockFetch({ tasksResponse: new Promise(() => {}) });
    renderTasks(["/tasks?tab=grid"]);

    expect(within(screen.getByTestId("tab-content-grid")).getByText("Loading tasks...")).toBeInTheDocument();
    expect(screen.queryByText("No tasks to display")).not.toBeInTheDocument();
  });

  it("shows a genuine empty state on the Active tab only after a successful fetch of an empty list", async () => {
    mockFetch({ tasksResponse: jsonResponse([]) });
    renderTasks();

    await waitFor(() => expect(screen.getByText("No tasks match your criteria")).toBeInTheDocument());
    expect(screen.queryByText("Loading tasks...")).not.toBeInTheDocument();
  });

  it("shows a local error with Retry on the Active tab when GET /api/tasks fails, and recovers on retry", async () => {
    mockFetch({ tasksResponse: Promise.resolve(new Response("Server error", { status: 500 })) });
    renderTasks();

    const alert = await activePanel().findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load tasks");
    expect(activePanel().queryByText("No tasks match your criteria")).not.toBeInTheDocument();

    mockFetch();
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    await waitForActiveTabLoaded();
    expect(activePanel().queryByRole("alert")).not.toBeInTheDocument();
    expect(activePanel().getByTestId("task-card-t1")).toBeInTheDocument();
  });

  it("still renders the task list when tasks succeed but users fails, and shows a local assignee error with Retry", async () => {
    mockFetch({ usersResponse: Promise.resolve(new Response("Server error", { status: 500 })) });
    renderTasks();
    await waitForActiveTabLoaded();

    // The basic list still works without user data.
    expect(activePanel().getByTestId("task-card-t1")).toBeInTheDocument();

    const assigneeAlert = await activePanel().findByRole("alert");
    expect(assigneeAlert).toHaveTextContent("Assignee names unavailable");

    mockFetch();
    fireEvent.click(within(assigneeAlert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(activePanel().queryByRole("alert")).not.toBeInTheDocument());
  });

  it("shows a local error with Retry on the Table tab's task list independent of the Active tab", async () => {
    mockFetch({ tasksResponse: Promise.resolve(new Response("Server error", { status: 500 })) });
    renderTasks(["/tasks?tab=table"]);

    const panel = within(screen.getByTestId("tab-content-table"));
    const alert = await panel.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load tasks");

    mockFetch();
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(panel.queryAllByTestId(/^task-row-/).length).toBeGreaterThan(0));
  });

  it("does not update state after unmount when a slow tasks fetch resolves late", async () => {
    let resolveTasks!: (value: Response) => void;
    mockFetch({ tasksResponse: new Promise<Response>((resolve) => (resolveTasks = resolve)) });
    const { unmount } = renderTasks();
    unmount();

    expect(() => resolveTasks(new Response(JSON.stringify(tasks)))).not.toThrow();
  });
});
