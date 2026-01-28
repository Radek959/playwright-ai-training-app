import { useEffect, useMemo, useState } from "react";
import { TaskCard } from "../components/TaskCard";
import { TaskForm } from "../components/TaskForm";
import { TaskEditModal } from "../components/TaskEditModal";
import { TaskWizard } from "../components/TaskWizard";
import { TaskTable } from "../components/TaskTable";
import { TaskSearch } from "../components/TaskSearch";
import { TaskGridItem } from "../components/TaskGridItem";
import { useLab } from "../context/LabContext";
import { getTestId } from "../utils/testIds";

type Task = {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate?: string;
  assigneeId?: string;
  coverImage?: string;
};

type User = { 
  id: string; 
  name: string;
  avatarUrl?: string;
};

type TaskWithName = Task & { 
  assigneeName?: string;
  assigneeAvatarUrl?: string;
};

const apiV2Enabled = import.meta.env.VITE_API_VERSION_2 === "true";

function normalizeTask(raw: any): Task {
  return {
    id: raw.id,
    title: raw.title ?? raw.name ?? "",
    description: raw.description ?? raw.content ?? "",
    status: raw.status ?? "todo",
    priority: raw.priority ?? "medium",
    dueDate: raw.dueDate,
    assigneeId: raw.assigneeId,
    coverImage: raw.coverImage
  };
}

type TabView = "active" | "archived" | "analytics" | "table" | "grid";
type FilterMode = "all" | "my-tasks" | "unassigned";

export default function Tasks() {
  const { apiFlaky, chaos, setLastError } = useLab();
  const layoutRefactor = import.meta.env.VITE_REFACTOR_LAYOUT === "true";
  const mobileBreakingChange = import.meta.env.VITE_MOBILE_BREAKING_CHANGE === "true";
  const hiddenOnMobile = import.meta.env.VITE_HIDDEN_ON_MOBILE === "true";
  const refactorSelectors = import.meta.env.VITE_REFACTOR_SELECTORS === "true";
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const pageSize = 5;
  const [editing, setEditing] = useState<Task | null>(null);
  const primaryCtaLabel = refactorSelectors ? "Create Work Item" : "New Task";
  const primaryCtaShortLabel = refactorSelectors ? "Create" : "New";
  
  // New state for advanced UI
  const [activeTab, setActiveTab] = useState<TabView>("active");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [showWizard, setShowWizard] = useState(false);
  const [showQuickForm, setShowQuickForm] = useState(false);

  const endpoint = useMemo(
    () => (apiFlaky ? "/api/tasks?lab_api_flaky=true" : "/api/tasks"),
    [apiFlaky]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [tRes, uRes] = await Promise.all([fetch(endpoint), fetch(apiFlaky ? "/api/users?lab_api_flaky=true" : "/api/users")]);
        if (!tRes.ok) throw new Error(`HTTP ${tRes.status}`);
        if (!uRes.ok) throw new Error(`Users HTTP ${uRes.status}`);
        const [tData, uData] = await Promise.all([tRes.json(), uRes.json()]);
        if (!Array.isArray(tData) || !Array.isArray(uData)) throw new Error("Unexpected payload");
        if (!cancelled) {
          setTasks(tData.map(normalizeTask));
          setUsers(uData);
        }
      } catch (err) {
        setLastError(err instanceof Error ? err.message : "Fetch error");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [endpoint, apiFlaky, setLastError]);

  const enriched: TaskWithName[] = useMemo(() => {
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
    
    // Tab filtering
    if (activeTab === "archived") {
      // Simulate archived tasks (done for >30 days)
      result = result.filter(t => t.status === "done");
    } else if (activeTab === "active") {
      result = result.filter(t => t.status !== "done");
    }
    
    // Filter mode (only for active tab)
    if (activeTab === "active") {
      if (filterMode === "my-tasks") {
        // For demo, filter tasks assigned to first user
        const currentUserId = users[0]?.id;
        result = result.filter(t => t.assigneeId === currentUserId);
      } else if (filterMode === "unassigned") {
        result = result.filter(t => !t.assigneeId);
      }
    }
    
    // Existing filters
    if (statusFilter !== "all") result = result.filter(t => t.status === statusFilter);
    if (priorityFilter !== "all") result = result.filter(t => t.priority === priorityFilter);
    if (search) result = result.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));
    
    return result;
  }, [enriched, activeTab, filterMode, statusFilter, priorityFilter, search, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const paginated = filtered.slice((pageClamped - 1) * pageSize, pageClamped * pageSize);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/tasks/${id}${apiFlaky ? "?lab_api_flaky=true" : ""}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSave = async (patch: Partial<Task>) => {
    if (!editing) return;
    const res = await fetch(`/api/tasks/${editing.id}${apiFlaky ? "?lab_api_flaky=true" : ""}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        apiV2Enabled
          ? {
              ...patch,
              name: patch.title ?? editing.title,
              content: patch.description ?? editing.description
            }
          : patch
      )
    });
    if (!res.ok) throw new Error(`Update failed: ${res.status}`);
    const updated = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === editing.id ? normalizeTask(updated) : t)));
    setEditing(null);
  };

  const handleCreate = async (draft: any) => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
    });
    if (!res.ok) throw new Error(`Create failed: ${res.status}`);
    const created = await res.json();
    setTasks((prev) => [normalizeTask(created), ...prev]);
  };

  const handleUpdate = async (id: string, field: string, value: any) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    const patch = { [field]: value };
    const res = await fetch(`/api/tasks/${id}${apiFlaky ? "?lab_api_flaky=true" : ""}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw new Error(`Update failed: ${res.status}`);
    const updated = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === id ? normalizeTask(updated) : t)));
  };

  const handleBulkDelete = async (ids: string[]) => {
    // For demo, delete one by one
    for (const id of ids) {
      await fetch(`/api/tasks/${id}${apiFlaky ? "?lab_api_flaky=true" : ""}`, {
        method: "DELETE"
      });
    }
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
  };

  const handleSearchSelect = (task: any) => {
    setEditing(task);
  };

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0" data-chaos={chaos ? "1" : "0"}>
      {/* Header with Search */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Tasks</h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">Manage and track your team's work</p>
          </div>
          
          {/* Desktop: Normal button */}
          {!mobileBreakingChange && (
            <button
              onClick={() => setShowWizard(true)}
              data-testid={getTestId("open-wizard-btn")}
              className="flex items-center gap-2 px-4 md:px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 font-medium min-h-[44px] whitespace-nowrap"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">{primaryCtaLabel}</span>
              <span className="sm:hidden">{primaryCtaShortLabel}</span>
            </button>
          )}
          
          {/* Mobile Breaking Change: Button hidden on desktop, FAB on mobile */}
          {mobileBreakingChange && (
            <button
              onClick={() => setShowWizard(true)}
              data-testid={getTestId("open-wizard-btn")}
              className="hidden md:flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 font-medium min-h-[44px]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {primaryCtaLabel}
            </button>
          )}
        </div>
        
        <div className="w-full md:max-w-md">
          <TaskSearch onSelect={handleSearchSelect} />
        </div>
      </div>

      {/* Main Tabs */}
      <div className="border-b border-gray-200 flex gap-1 overflow-x-auto">
        {(["active", "grid", "table", "archived", "analytics"] as TabView[]).map((tab) => (
          <button
            key={tab}
            id={`tab-${tab}`}
            data-testid={getTestId(`tab-${tab}`)}
            onClick={() => setActiveTab(tab)}
            className={`px-4 md:px-6 py-3 border-b-2 transition-all font-medium whitespace-nowrap min-h-[44px] ${
              activeTab === tab
                ? "border-indigo-600 text-indigo-600 bg-indigo-50"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            {tab === "active" && "Active"}
            {tab === "grid" && "Grid View"}
            {tab === "table" && "Table"}
            {tab === "archived" && "Archive"}
            {tab === "analytics" && "Analytics"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div data-testid={getTestId(`tab-content-${activeTab}`)}>
        {/* Active Tab */}
        {activeTab === "active" && (
          <div className="space-y-4 md:space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4">
              <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700 w-full md:w-auto">View:</span>
                  {(["all", "my-tasks", "unassigned"] as FilterMode[]).map((mode) => (
                    <button
                      key={mode}
                      data-testid={getTestId(`filter-${mode}`)}
                      onClick={() => {
                        setFilterMode(mode);
                        setPage(1);
                      }}
                      className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all min-h-[44px] ${
                        filterMode === mode
                          ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {mode === "all" && "All"}
                      {mode === "my-tasks" && <span className={hiddenOnMobile ? "hidden md:inline" : ""}>My Tasks</span>}
                      {mode === "my-tasks" && hiddenOnMobile && <span className="md:hidden">My</span>}
                      {mode === "unassigned" && <span className={hiddenOnMobile ? "hidden md:inline" : ""}>Unassigned</span>}
                      {mode === "unassigned" && hiddenOnMobile && <span className="md:hidden">Un...</span>}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 md:gap-3 md:ml-auto">
                  <select
                    className="flex-1 md:flex-none border border-gray-300 rounded-lg px-3 md:px-4 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[44px]"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="all">Status: All</option>
                    <option value="todo">To Do</option>
                    <option value="in-progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                  <select
                    className="flex-1 md:flex-none border border-gray-300 rounded-lg px-3 md:px-4 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[44px]"
                    value={priorityFilter}
                    onChange={(e) => {
                      setPriorityFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="all">Priority: All</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  
                  <button
                    onClick={() => setShowQuickForm(!showQuickForm)}
                    data-testid={getTestId("toggle-quick-form-btn")}
                    className={`${hiddenOnMobile ? "hidden md:flex" : "flex"} items-center px-3 md:px-4 py-2 bg-gray-100 text-xs md:text-sm rounded-lg hover:bg-gray-200 transition-colors font-medium text-gray-700 min-h-[44px] whitespace-nowrap`}
                  >
                    {refactorSelectors ? (showQuickForm ? "Close inline form" : "Inline add") : `${showQuickForm ? "Hide" : "Quick"} Add`}
                  </button>
                </div>
              </div>
            </div>

            {showQuickForm && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                <TaskForm onCreated={handleCreate} />
              </div>
            )}

            <div className={layoutRefactor ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4" : "space-y-3 md:space-y-4"}>
              {paginated.map((t) => (
                <TaskCard key={t.id} task={t} onDelete={handleDelete} onEdit={setEditing} layoutRefactor={layoutRefactor} />
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-12 text-center">
                <svg className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors text-sm font-medium min-h-[44px]"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pageClamped === 1}
                  >
                    Previous
                  </button>
                  <button
                    className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors text-sm font-medium min-h-[44px]"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={pageClamped === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Grid View Tab */}
        {activeTab === "grid" && (
          <div className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {filtered.map((t) => (
                <TaskGridItem 
                  key={t.id} 
                  task={t} 
                  onClick={() => setEditing(t as any)}
                />
              ))}
            </div>
            
            {filtered.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-12 text-center">
                <p className="text-gray-500 text-base md:text-lg">No tasks to display</p>
              </div>
            )}
          </div>
        )}

        {/* Table Tab */}
        {activeTab === "table" && (
          <TaskTable
            tasks={filtered}
            users={users}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
          />
        )}

        {/* Archived Tab */}
        {activeTab === "archived" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <p className="text-xl font-semibold text-gray-900 mb-2">Archive is Empty</p>
            <p className="text-gray-600">Completed tasks are automatically archived after 30 days.</p>
            {filtered.length > 0 && (
              <p className="text-sm text-indigo-600 mt-4 font-medium">Found {filtered.length} completed tasks</p>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
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
        )}
      </div>

      {/* Modals */}
      <TaskEditModal
        task={editing as any}
        open={Boolean(editing)}
        users={users}
        onClose={() => setEditing(null)}
        onSave={async (patch) => {
          try {
            await handleSave(patch);
          } catch (err) {
            setLastError(err instanceof Error ? err.message : "Update error");
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
            } catch (err) {
              setLastError(err instanceof Error ? err.message : "Create error");
            }
          }}
          onClose={() => setShowWizard(false)}
        />
      )}

      {/* Floating Action Button (FAB) - Mobile only when VITE_MOBILE_BREAKING_CHANGE=true */}
      {mobileBreakingChange && (
        <button
          onClick={() => setShowWizard(true)}
          data-testid={getTestId("open-wizard-btn")}
          className="md:hidden fixed bottom-20 right-4 w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-2xl hover:shadow-3xl transition-all duration-200 flex items-center justify-center z-40"
          aria-label="Add new task"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );
}
