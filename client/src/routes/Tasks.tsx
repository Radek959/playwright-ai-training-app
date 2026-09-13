import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TaskCard } from "../components/TaskCard";
import { TaskForm } from "../components/TaskForm";
import { TaskEditModal } from "../components/TaskEditModal";
import { TaskWizard } from "../components/TaskWizard";
import type { TaskCreatePayload } from "../utils/taskFormModel";
import { TaskTable } from "../components/TaskTable";
import { TaskSearch } from "../components/TaskSearch";
import { TaskGridItem } from "../components/TaskGridItem";
import { useAppError } from "../context/AppErrorContext";
import { isArchived } from "../utils/taskArchive";
import { toApiError } from "../utils/apiError";
import { getTaskDueStatus } from "../utils/taskDueDate";
import type { Task, TaskUpdateInput, TaskWithAssignee, User } from "../types";
import {
  TAB_ORDER,
  buildTasksSearchParams,
  isAssigneeFilterValid,
  parseAssigneeFilter,
  parseDueFilter,
  parsePage,
  parsePriorityFilter,
  parseSortDir,
  parseSortKey,
  parseStatusFilter,
  parseTab,
  type DueFilter,
  type SortKey,
  type TabView,
  type TasksUrlState
} from "./tasksUrlState";

// "success" is the only state in which fetched data may be used to validate
// or correct the URL (assignee vs. users, page vs. task count) — "loading"
// and "error" must leave whatever the URL already says alone.
type LoadState = "loading" | "success" | "error";

function normalizeTask(raw: Partial<Task>): Task {
  return {
    id: raw.id!,
    title: raw.title ?? "",
    description: raw.description ?? "",
    status: raw.status ?? "todo",
    priority: raw.priority ?? "medium",
    dueDate: raw.dueDate,
    completedAt: raw.completedAt,
    assigneeId: raw.assigneeId,
    coverImage: raw.coverImage,
    taskType: raw.taskType,
    estimatedHours: raw.estimatedHours,
    tags: raw.tags,
    dependencies: raw.dependencies,
    severity: raw.severity,
    requiresApproval: raw.requiresApproval,
    approver: raw.approver
  };
}

const TAB_LABELS: Record<TabView, string> = {
  active: "Active",
  grid: "Grid View",
  table: "Table",
  archived: "Archive",
  analytics: "Analytics"
};

export default function Tasks() {
  const { setError, clearError } = useAppError();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  // Distinct from a boolean "loaded" flag: URL validation that depends on
  // the fetched data (assignee vs. the user list, page vs. the task count)
  // must only run once a request has actually *succeeded* — a failed
  // request or bad payload must not be treated as "there is no data", which
  // would otherwise strip a perfectly valid URL parameter.
  const [tasksLoadState, setTasksLoadState] = useState<LoadState>("loading");
  const [usersLoadState, setUsersLoadState] = useState<LoadState>("loading");
  const [search, _setSearch] = useState<string>("");
  const pageSize = 5;
  const [editing, setEditing] = useState<Task | null>(null);
  const primaryCtaLabel = "New Task";
  const primaryCtaShortLabel = "New";

  const [showWizard, setShowWizard] = useState(false);
  const [showQuickForm, setShowQuickForm] = useState(false);
  const tabRefs = useRef<Record<TabView, HTMLButtonElement | null>>({
    active: null,
    grid: null,
    table: null,
    archived: null,
    analytics: null
  });

  // The URL is the single source of truth for the reproducible part of this
  // view's state (tab, filters, page, table sort). Everything below is
  // derived from it on every render instead of being tracked separately, so
  // it can never drift out of sync with the address bar.
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = parseTab(searchParams.get("tab"));
  const statusFilter = activeTab === "active" ? parseStatusFilter(searchParams.get("status")) : "all";
  const priorityFilter = activeTab === "active" ? parsePriorityFilter(searchParams.get("priority")) : "all";
  const assigneeRaw = activeTab === "active" ? parseAssigneeFilter(searchParams.get("assignee")) : "all";
  const assigneeFilter = isAssigneeFilterValid(assigneeRaw, users, usersLoadState === "success") ? assigneeRaw : "all";
  const dueFilter = activeTab === "active" ? parseDueFilter(searchParams.get("due")) : "all";
  const pageRaw = activeTab === "active" ? parsePage(searchParams.get("page")) : 1;
  const sortKey = activeTab === "table" ? parseSortKey(searchParams.get("sort")) : "title";
  const sortDir = activeTab === "table" ? parseSortDir(searchParams.get("order")) : "asc";

  const updateTasksUrl = (overrides: Partial<TasksUrlState>) => {
    const next: TasksUrlState = {
      tab: activeTab,
      status: statusFilter,
      priority: priorityFilter,
      assignee: assigneeFilter,
      due: dueFilter,
      page: pageRaw,
      sortKey,
      sortDir,
      ...overrides
    };
    setSearchParams(buildTasksSearchParams(next));
  };

  const handleTabChange = (tab: TabView) => {
    updateTasksUrl({ tab, page: 1 });
  };

  const handleStatusFilterChange = (value: string) => {
    updateTasksUrl({ status: value, page: 1 });
  };

  const handlePriorityFilterChange = (value: string) => {
    updateTasksUrl({ priority: value, page: 1 });
  };

  const handleAssigneeFilterChange = (value: string) => {
    updateTasksUrl({ assignee: value, page: 1 });
  };

  const handleDueFilterChange = (value: DueFilter) => {
    updateTasksUrl({ due: value, page: 1 });
  };

  const handlePageChange = (nextPage: number) => {
    updateTasksUrl({ page: nextPage });
  };

  const handleSortToggle = (key: SortKey) => {
    if (key === sortKey) {
      updateTasksUrl({ sortDir: sortDir === "asc" ? "desc" : "asc" });
    } else {
      updateTasksUrl({ sortKey: key, sortDir: "asc" });
    }
  };

  const focusTab = (tab: TabView) => {
    tabRefs.current[tab]?.focus();
  };

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") {
      nextIndex = (index + 1) % TAB_ORDER.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (index - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = TAB_ORDER.length - 1;
    }
    if (nextIndex !== null) {
      e.preventDefault();
      const nextTab = TAB_ORDER[nextIndex];
      handleTabChange(nextTab);
      focusTab(nextTab);
    }
  };

  const endpoint = "/api/tasks";

  // Tasks and users are fetched independently (not joined behind a single
  // Promise.all) so the assignee filter's validation against the user list
  // (see isAssigneeFilterValid) can genuinely observe "users not loaded yet"
  // as a distinct, real state rather than something that always resolves in
  // lockstep with the task list.
  useEffect(() => {
    let cancelled = false;
    let tasksOk = false;
    let usersOk = false;
    const clearErrorIfBothOk = () => {
      if (tasksOk && usersOk) clearError();
    };

    const loadTasks = async () => {
      try {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Unexpected payload");
        if (!cancelled) {
          setTasks(data.map(normalizeTask));
          setTasksLoadState("success");
          tasksOk = true;
          clearErrorIfBothOk();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Fetch error");
          setTasksLoadState("error");
        }
      }
    };

    const loadUsers = async () => {
      try {
        const res = await fetch("/api/users");
        if (!res.ok) throw new Error(`Users HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Unexpected payload");
        if (!cancelled) {
          setUsers(data);
          setUsersLoadState("success");
          usersOk = true;
          clearErrorIfBothOk();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Fetch error");
          setUsersLoadState("error");
        }
      }
    };

    loadTasks();
    loadUsers();
    return () => {
      cancelled = true;
    };
  }, [setError, clearError]);

  const enriched: TaskWithAssignee[] = useMemo(() => {
    const byUser = new Map(users.map((u) => [u.id, { name: u.name, avatarUrl: u.avatarUrl }] as const));
    return tasks.map((t) => {
      const userInfo = t.assigneeId ? byUser.get(t.assigneeId) : undefined;
      return {
        ...t,
        assigneeName: userInfo?.name,
        assigneeAvatarUrl: userInfo?.avatarUrl
      };
    });
  }, [tasks, users]);

  const filtered = useMemo(() => {
    let result = enriched;

    if (activeTab === "archived") {
      result = result.filter(isArchived);
    } else if (activeTab === "active") {
      result = result.filter((t) => t.status !== "done");

      if (assigneeFilter === "unassigned") {
        result = result.filter((t) => !t.assigneeId);
      } else if (assigneeFilter !== "all") {
        result = result.filter((t) => t.assigneeId === assigneeFilter);
      }

      if (statusFilter !== "all") result = result.filter((t) => t.status === statusFilter);
      if (priorityFilter !== "all") result = result.filter((t) => t.priority === priorityFilter);
      if (dueFilter !== "all") result = result.filter((t) => getTaskDueStatus(t) === dueFilter);
    }
    // Grid View, Table and Analytics show every task on that dimension:
    // Status/Priority/Assignee/Due-date filtering has no visible control
    // outside the Active tab, so it must not silently narrow their results either.

    if (search) result = result.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));

    return result;
  }, [enriched, activeTab, assigneeFilter, statusFilter, priorityFilter, dueFilter, search]);

  // Pagination only exists on the Active tab. Only clamp the requested page
  // into range once the task list has been *successfully* fetched — while
  // it's still loading, or if the fetch failed, `filtered` is an empty
  // placeholder and clamping against it would wrongly "correct" a valid
  // page number down to 1.
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageClamped = tasksLoadState === "success" ? Math.min(Math.max(pageRaw, 1), totalPages) : pageRaw;
  const paginated = filtered.slice((pageClamped - 1) * pageSize, pageClamped * pageSize);

  // Single source of normalization: whenever the parsed-and-corrected state
  // above doesn't match what's actually in the URL (unknown tab/status/
  // priority/sort value, an out-of-range page, an assignee id that isn't a
  // real user, or params left over from a different tab), rewrite the URL to
  // match what's on screen via `replace` so Back/Forward don't get an extra
  // entry for a correction the user didn't ask for.
  useEffect(() => {
    const canonical = buildTasksSearchParams({
      tab: activeTab,
      status: statusFilter,
      priority: priorityFilter,
      assignee: assigneeFilter,
      due: dueFilter,
      page: pageClamped,
      sortKey,
      sortDir
    });
    if (canonical.toString() !== searchParams.toString()) {
      setSearchParams(canonical, { replace: true });
    }
  }, [searchParams, activeTab, statusFilter, priorityFilter, assigneeFilter, dueFilter, pageClamped, sortKey, sortDir, setSearchParams]);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "DELETE"
    });
    if (!res.ok) throw await toApiError(res, `Delete failed: ${res.status}`);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    clearError();
  };

  const handleSave = async (patch: TaskUpdateInput) => {
    if (!editing) return;
    const res = await fetch(`/api/tasks/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw await toApiError(res, `Update failed: ${res.status}`);
    const updated = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === editing.id ? normalizeTask(updated) : t)));
    setEditing(null);
  };

  const handleCreate = async (draft: TaskCreatePayload): Promise<void> => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
    });
    if (!res.ok) throw await toApiError(res, `Create failed: ${res.status}`);
    const created = await res.json();
    setTasks((prev) => [normalizeTask(created), ...prev]);
  };

  const handleUpdate = async (id: string, field: string, value: unknown) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value })
    });
    if (!res.ok) throw await toApiError(res, `Update failed: ${res.status}`);
    const updated = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === id ? normalizeTask(updated) : t)));
    clearError();
  };

  const handleBulkDelete = async (ids: string[]): Promise<string[]> => {
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
          return { id, ok: res.ok };
        } catch {
          return { id, ok: false };
        }
      })
    );
    const deletedIds = results.filter((r) => r.ok).map((r) => r.id);
    const failedIds = results.filter((r) => !r.ok).map((r) => r.id);

    if (deletedIds.length > 0) {
      setTasks((prev) => prev.filter((t) => !deletedIds.includes(t.id)));
    }
    if (failedIds.length > 0) {
      setError(`Failed to delete ${failedIds.length} of ${ids.length} tasks`);
    } else {
      clearError();
    }
    return deletedIds;
  };

  const handleSearchSelect = (task: Task) => {
    setEditing(task);
  };

  const assigneeFilterOptions = useMemo(
    () => [
      { key: "all" as const, label: "All assignees" },
      { key: "unassigned" as const, label: "Unassigned" },
      ...users.map((u) => ({ key: u.id, label: u.name }))
    ],
    [users]
  );

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      {/* Header with Search */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Tasks</h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">Manage and track your team&apos;s work</p>
          </div>

          <button
            onClick={() => setShowWizard(true)}
            data-testid="open-wizard-btn"
            className="flex items-center gap-2 px-4 md:px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 font-medium min-h-[44px] whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">{primaryCtaLabel}</span>
            <span className="sm:hidden">{primaryCtaShortLabel}</span>
          </button>
        </div>

        <div className="w-full md:max-w-md">
          <TaskSearch onSelect={handleSearchSelect} />
        </div>
      </div>

      {/* Main Tabs */}
      <div className="border-b border-gray-200 flex gap-1 overflow-x-auto" role="tablist" aria-label="Task views">
        {TAB_ORDER.map((tab, index) => (
          <button
            key={tab}
            ref={(el) => {
              tabRefs.current[tab] = el;
            }}
            id={`tab-${tab}`}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`tabpanel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            data-testid={`tab-${tab}`}
            onClick={() => handleTabChange(tab)}
            onKeyDown={(e) => handleTabKeyDown(e, index)}
            className={`px-4 md:px-6 py-3 border-b-2 transition-all font-medium whitespace-nowrap min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-600 ${
              activeTab === tab
                ? "border-indigo-600 text-indigo-600 bg-indigo-50"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {/* Active Tab */}
      <div
        id="tabpanel-active"
        role="tabpanel"
        aria-labelledby="tab-active"
        tabIndex={0}
        data-testid="tab-content-active"
        hidden={activeTab !== "active"}
      >
        <div className="space-y-4 md:space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4">
              <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700 w-full md:w-auto">Assignee:</span>
                  {assigneeFilterOptions.map((opt) => (
                    <button
                      key={opt.key}
                      data-testid={`filter-assignee-${opt.key}`}
                      aria-pressed={assigneeFilter === opt.key}
                      onClick={() => handleAssigneeFilterChange(opt.key)}
                      className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                        assigneeFilter === opt.key
                          ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 md:gap-3 md:ml-auto">
                  <label className="sr-only" htmlFor="status-filter-select">
                    Filter by status
                  </label>
                  <select
                    id="status-filter-select"
                    aria-label="Filter by status"
                    className="flex-1 md:flex-none border border-gray-300 rounded-lg px-3 md:px-4 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[44px]"
                    value={statusFilter}
                    onChange={(e) => handleStatusFilterChange(e.target.value)}
                  >
                    <option value="all">Status: All</option>
                    <option value="todo">To Do</option>
                    <option value="in-progress">In Progress</option>
                  </select>
                  <label className="sr-only" htmlFor="priority-filter-select">
                    Filter by priority
                  </label>
                  <select
                    id="priority-filter-select"
                    aria-label="Filter by priority"
                    className="flex-1 md:flex-none border border-gray-300 rounded-lg px-3 md:px-4 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[44px]"
                    value={priorityFilter}
                    onChange={(e) => handlePriorityFilterChange(e.target.value)}
                  >
                    <option value="all">Priority: All</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <label className="sr-only" htmlFor="due-filter-select">
                    Filter by due date
                  </label>
                  <select
                    id="due-filter-select"
                    aria-label="Filter by due date"
                    className="flex-1 md:flex-none border border-gray-300 rounded-lg px-3 md:px-4 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[44px]"
                    value={dueFilter}
                    onChange={(e) => handleDueFilterChange(e.target.value as DueFilter)}
                  >
                    <option value="all">All deadlines</option>
                    <option value="overdue">Overdue</option>
                    <option value="soon">Due soon</option>
                  </select>

                  <button
                    onClick={() => setShowQuickForm(!showQuickForm)}
                    data-testid="toggle-quick-form-btn"
                    aria-expanded={showQuickForm}
                    aria-controls="quick-add-form"
                    className="flex items-center px-3 md:px-4 py-2 bg-gray-100 text-xs md:text-sm rounded-lg hover:bg-gray-200 transition-colors font-medium text-gray-700 min-h-[44px] whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                  >
                    {showQuickForm ? "Hide Add" : "Quick Add"}
                  </button>
                </div>
              </div>
            </div>

            {showQuickForm && (
              <div id="quick-add-form" className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                <TaskForm onCreated={(task) => setTasks((prev) => [task, ...prev])} />
              </div>
            )}

            <div className="space-y-3 md:space-y-4">
              {paginated.map((t) => (
                <TaskCard key={t.id} task={t} onDelete={handleDelete} onEdit={setEditing} />
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-12 text-center">
                <svg className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 text-base md:text-lg">No tasks match your criteria</p>
              </div>
            )}

            {/* Pagination */}
            {filtered.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4 gap-3">
                <span className="text-xs md:text-sm text-gray-600">
                  Page {pageClamped} of {totalPages} ({filtered.length} tasks)
                </span>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors text-sm font-medium min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                    onClick={() => handlePageChange(Math.max(1, pageClamped - 1))}
                    disabled={pageClamped === 1}
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  <button
                    className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors text-sm font-medium min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                    onClick={() => handlePageChange(Math.min(totalPages, pageClamped + 1))}
                    disabled={pageClamped === totalPages}
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
      </div>

      {/* Grid View Tab */}
      <div
        id="tabpanel-grid"
        role="tabpanel"
        aria-labelledby="tab-grid"
        tabIndex={0}
        data-testid="tab-content-grid"
        hidden={activeTab !== "grid"}
      >
        <div className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {filtered.map((t) => (
                <TaskGridItem
                  key={t.id}
                  task={t}
                  onClick={() => setEditing(t)}
                />
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-12 text-center">
                <p className="text-gray-500 text-base md:text-lg">No tasks to display</p>
              </div>
            )}
          </div>
      </div>

      {/* Table Tab */}
      <div
        id="tabpanel-table"
        role="tabpanel"
        aria-labelledby="tab-table"
        tabIndex={0}
        data-testid="tab-content-table"
        hidden={activeTab !== "table"}
      >
        <TaskTable
          tasks={filtered}
          users={users}
          sortKey={sortKey}
          sortDir={sortDir}
          onSortChange={handleSortToggle}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
        />
      </div>

      {/* Archived Tab */}
      <div
        id="tabpanel-archived"
        role="tabpanel"
        aria-labelledby="tab-archived"
        tabIndex={0}
        data-testid="tab-content-archived"
        hidden={activeTab !== "archived"}
      >
        <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <p className="text-xl font-semibold text-gray-900 mb-2">Archive is Empty</p>
                <p className="text-gray-600">Completed tasks are automatically archived after 30 days.</p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {filtered.map((t) => (
                  <TaskCard key={t.id} task={t} onDelete={handleDelete} onEdit={setEditing} />
                ))}
              </div>
            )}
          </div>
      </div>

      {/* Analytics Tab */}
      <div
        id="tabpanel-analytics"
        role="tabpanel"
        aria-labelledby="tab-analytics"
        tabIndex={0}
        data-testid="tab-content-analytics"
        hidden={activeTab !== "analytics"}
      >
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Task Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold mb-2 text-sm text-blue-900">All Tasks</h3>
                <p className="text-4xl font-bold text-blue-600">{tasks.length}</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold mb-2 text-sm text-green-900">Completed</h3>
                <p className="text-4xl font-bold text-green-600">
                  {tasks.filter(t => t.status === "done").length}
                </p>
              </div>
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold mb-2 text-sm text-yellow-900">In Progress</h3>
                <p className="text-4xl font-bold text-yellow-600">
                  {tasks.filter(t => t.status === "in-progress").length}
                </p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold mb-2 text-sm text-red-900">High Priority</h3>
                <p className="text-4xl font-bold text-red-600">
                  {tasks.filter(t => t.priority === "high").length}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Tasks by Team Member</h3>
              <div className="space-y-3">
                {users.map(user => {
                  const userTasks = tasks.filter(t => t.assigneeId === user.id);
                  const percentage = tasks.length > 0 ? Math.round((userTasks.length / tasks.length) * 100) : 0;
                  return (
                    <div key={user.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900">{user.name}</span>
                        <span className="font-bold text-indigo-600">{userTasks.length} tasks</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-indigo-600 to-purple-600 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-600">Unassigned</span>
                    <span className="font-bold text-gray-600">{tasks.filter(t => !t.assigneeId).length} tasks</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </div>

      {/* Modals */}
      <TaskEditModal
        task={editing}
        open={Boolean(editing)}
        users={users}
        existingTasks={tasks}
        onClose={() => setEditing(null)}
        onSave={async (patch) => {
          try {
            await handleSave(patch);
            clearError();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Update error");
            throw err;
          }
        }}
      />

      {showWizard && (
        <TaskWizard
          users={users}
          existingTasks={tasks}
          onComplete={async (draft) => {
            try {
              await handleCreate(draft);
              clearError();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Create error");
              throw err;
            }
          }}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}
