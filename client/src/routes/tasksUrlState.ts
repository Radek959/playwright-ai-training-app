import type { User } from "../types";

export type TabView = "active" | "archived" | "analytics" | "table" | "grid";
export type SortKey = "title" | "priority" | "dueDate" | "assigneeId" | "status";
export type SortDir = "asc" | "desc";
export type DueFilter = "all" | "overdue" | "soon";

export const TAB_ORDER: TabView[] = ["active", "grid", "table", "archived", "analytics"];

const TAB_VALUES = new Set<string>(TAB_ORDER);
// The Active tab never accepts "done" (its whole purpose is unfinished
// work); the Table tab shows every task, so it also accepts "done".
const ACTIVE_STATUS_VALUES = new Set(["todo", "in-progress"]);
const TABLE_STATUS_VALUES = new Set(["todo", "in-progress", "done"]);
const PRIORITY_VALUES = new Set(["low", "medium", "high"]);
const SORT_KEY_VALUES = new Set<string>(["title", "status", "priority", "dueDate", "assigneeId"]);
const SORT_DIR_VALUES = new Set<string>(["asc", "desc"]);
const DUE_FILTER_VALUES = new Set<string>(["overdue", "soon"]);

export function parseTab(raw: string | null): TabView {
  return raw !== null && TAB_VALUES.has(raw) ? (raw as TabView) : "active";
}

/**
 * `allowDone` distinguishes the Table tab (every status, including "done")
 * from the Active tab (which never accepts "done" - see ACTIVE_STATUS_VALUES
 * above). Defaults to the Active tab's stricter rule so existing callers are
 * unaffected.
 */
export function parseStatusFilter(raw: string | null, allowDone = false): string {
  const values = allowDone ? TABLE_STATUS_VALUES : ACTIVE_STATUS_VALUES;
  return raw !== null && values.has(raw) ? raw : "all";
}

export function parsePriorityFilter(raw: string | null): string {
  return raw !== null && PRIORITY_VALUES.has(raw) ? raw : "all";
}

export function parseAssigneeFilter(raw: string | null): string {
  return raw !== null && raw.length > 0 ? raw : "all";
}

export function parseDueFilter(raw: string | null): DueFilter {
  return raw !== null && DUE_FILTER_VALUES.has(raw) ? (raw as DueFilter) : "all";
}

// A page number is only ever a positive integer; anything else (text, "0",
// negative numbers, decimals) falls back to page 1 rather than surfacing an
// error to the user.
export function parsePage(raw: string | null): number {
  if (raw === null) return 1;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

export function parseSortKey(raw: string | null): SortKey {
  return raw !== null && SORT_KEY_VALUES.has(raw) ? (raw as SortKey) : "title";
}

export function parseSortDir(raw: string | null): SortDir {
  return raw !== null && SORT_DIR_VALUES.has(raw) ? (raw as SortDir) : "asc";
}

// The assignee filter can't be validated against the user list until that
// list has finished loading; treat it as valid until then so a correct id in
// a shared/reloaded URL is never dropped just because /api/users hasn't
// resolved yet.
export function isAssigneeFilterValid(value: string, users: User[], usersLoaded: boolean): boolean {
  if (value === "all" || value === "unassigned") return true;
  if (!usersLoaded) return true;
  return users.some((u) => u.id === value);
}

export type TasksUrlState = {
  tab: TabView;
  status: string;
  priority: string;
  assignee: string;
  due: DueFilter;
  page: number;
  sortKey: SortKey;
  sortDir: SortDir;
};

// Serializes only the parameters that are actually meaningful for the given
// tab, in a fixed order, and omits anything at its default value so the URL
// stays as short and stable as possible.
export function buildTasksSearchParams(state: TasksUrlState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.tab !== "active") {
    params.set("tab", state.tab);
  }

  if (state.tab === "active") {
    if (state.status !== "all") params.set("status", state.status);
    if (state.priority !== "all") params.set("priority", state.priority);
    if (state.assignee !== "all") params.set("assignee", state.assignee);
    if (state.due !== "all") params.set("due", state.due);
    if (state.page !== 1) params.set("page", String(state.page));
  }

  // The Table tab reuses the same status/priority/assignee param names as
  // Active (see PARAM shapes above) so a stat link built for one never needs
  // special-casing, but keeps its own sort/order - Active has neither.
  if (state.tab === "table") {
    if (state.status !== "all") params.set("status", state.status);
    if (state.priority !== "all") params.set("priority", state.priority);
    if (state.assignee !== "all") params.set("assignee", state.assignee);
    if (state.sortKey !== "title") params.set("sort", state.sortKey);
    if (state.sortDir !== "asc") params.set("order", state.sortDir);
  }

  return params;
}
