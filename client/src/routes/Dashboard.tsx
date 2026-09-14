import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppError } from "../context/useAppError";
import { StatCard } from "../components/StatCard";
import { UserAvatar } from "../components/UserAvatar";
import { isTaskOverdue } from "../utils/taskDueDate";
import { effectiveAvatar } from "../utils/avatar";
import { isAbortError, useLatestRequest } from "../hooks/useLatestRequest";
import type { Task, User } from "../types";

// Stable empty-array references so a "not ready yet" fallback never causes
// downstream useMemo hooks to see a new array (and thus a changed
// dependency) on every render.
const EMPTY_TASKS: Task[] = [];
const EMPTY_USERS: User[] = [];

function normalizeTask(raw: Partial<Task>): Task {
  return {
    id: raw.id!,
    title: raw.title ?? "",
    description: raw.description ?? "",
    status: raw.status ?? "todo",
    priority: raw.priority ?? "medium",
    dueDate: raw.dueDate,
    assigneeId: raw.assigneeId
  };
}

// Distinguishes "still fetching" and "fetch failed" from an actually-empty
// array, so the dashboard never shows a real-looking 0/0%/empty chart (or
// "0 Active Members") for data it doesn't actually have yet, and one
// section's failure never hides the other's successfully-loaded data.
type FetchState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export default function Dashboard() {
  const { setError, clearError } = useAppError();
  const [tasksState, setTasksState] = useState<FetchState<Task[]>>({ status: "loading" });
  const [usersState, setUsersState] = useState<FetchState<User[]>>({ status: "loading" });
  // Guards against an older in-flight request's response overwriting a newer
  // one's result (React.StrictMode's double effect invocation in dev, a fast
  // Retry click, etc.) - see useLatestRequest for details. A separate tracked
  // request per section so tasks and users can race independently.
  const beginTasksRequest = useLatestRequest();
  const beginUsersRequest = useLatestRequest();

  const loadTasks = useCallback(async () => {
    setTasksState({ status: "loading" });
    const { signal, isCurrent } = beginTasksRequest();
    try {
      const res = await fetch("/api/tasks", { signal });
      if (!res.ok) throw new Error(`Tasks HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Unexpected tasks payload");
      if (!isCurrent()) return;
      setTasksState({ status: "ready", data: data.map(normalizeTask) });
    } catch (err) {
      if (isAbortError(err) || !isCurrent()) return;
      setTasksState({ status: "error", message: err instanceof Error ? err.message : "Failed to load tasks" });
    }
  }, [beginTasksRequest]);

  const loadUsers = useCallback(async () => {
    setUsersState({ status: "loading" });
    const { signal, isCurrent } = beginUsersRequest();
    try {
      const res = await fetch("/api/users", { signal });
      if (!res.ok) throw new Error(`Users HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Unexpected users payload");
      if (!isCurrent()) return;
      setUsersState({ status: "ready", data });
    } catch (err) {
      if (isAbortError(err) || !isCurrent()) return;
      setUsersState({ status: "error", message: err instanceof Error ? err.message : "Failed to load users" });
    }
  }, [beginUsersRequest]);

  useEffect(() => {
    loadTasks();
    loadUsers();
  }, [loadTasks, loadUsers]);

  // The global banner is derived from both sections' current state on every
  // render, rather than one section's load callback calling setError/
  // clearError on its own - that would let a success on one request wipe out
  // an error still standing from the other. A message here is a summary
  // only; each section below also shows its own local error and Retry.
  useEffect(() => {
    const messages: string[] = [];
    if (tasksState.status === "error") messages.push(`Tasks: ${tasksState.message}`);
    if (usersState.status === "error") messages.push(`Users: ${usersState.message}`);
    if (messages.length > 0) {
      setError(messages.join(" | "));
    } else {
      clearError();
    }
  }, [tasksState, usersState, setError, clearError]);

  const tasks = tasksState.status === "ready" ? tasksState.data : EMPTY_TASKS;
  const users = usersState.status === "ready" ? usersState.data : EMPTY_USERS;

  const totals = useMemo(() => {
    const statusCount = { todo: 0, "in-progress": 0, done: 0 } as Record<string, number>;
    const priorityCount = { low: 0, medium: 0, high: 0 } as Record<string, number>;
    tasks.forEach((t) => {
      statusCount[t.status] = (statusCount[t.status] ?? 0) + 1;
      priorityCount[t.priority] = (priorityCount[t.priority] ?? 0) + 1;
    });
    return { statusCount, priorityCount };
  }, [tasks]);

  const totalTasks = tasks.length;
  const inProgressTasks = totals.statusCount["in-progress"] || 0;
  const highPriorityTasks = totals.priorityCount["high"] || 0;
  const completionRate = totalTasks > 0 ? Math.round(((totals.statusCount["done"] || 0) / totalTasks) * 100) : 0;
  const overdueTasks = useMemo(() => tasks.filter((t) => isTaskOverdue(t)).length, [tasks]);

  // While tasks are loading or failed, the stat tiles show a neutral
  // placeholder instead of a fake 0/0% derived from an empty array.
  const statValue = (value: string | number): string | number => {
    if (tasksState.status === "loading") return "…";
    if (tasksState.status === "error") return "—";
    return value;
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-sm md:text-base text-gray-600">Welcome back! Here&apos;s what&apos;s happening today.</p>
        </div>
      </div>

      {tasksState.status === "error" && (
        <div
          role="alert"
          className="bg-red-50 border border-red-300 rounded-lg p-3 md:p-4 text-sm text-red-700 flex items-center justify-between gap-4"
        >
          <span>Failed to load task statistics: {tasksState.message}</span>
          <button
            type="button"
            onClick={loadTasks}
            className="bg-red-600 text-white rounded px-3 py-1.5 text-sm font-medium hover:bg-red-700 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
        <StatCard
          title="Total Tasks"
          value={statValue(totalTasks)}
          href="/tasks?tab=table"
          ariaLabel="View all tasks"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />

        <StatCard
          title="In Progress"
          value={statValue(inProgressTasks)}
          href="/tasks?tab=table&status=in-progress"
          ariaLabel="View in-progress tasks"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />

        <StatCard
          title="High Priority"
          value={statValue(highPriorityTasks)}
          href="/tasks?tab=table&priority=high"
          ariaLabel="View high-priority tasks"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />

        <StatCard
          title="Completion"
          value={statValue(`${completionRate}%`)}
          href="/tasks?tab=table&status=done"
          ariaLabel="View completed tasks"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatCard
          title="Overdue"
          value={statValue(overdueTasks)}
          href="/tasks?due=overdue"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Charts Section */}
      {tasksState.status === "ready" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Status Distribution */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6">Task Status Distribution</h2>
            <div className="space-y-4">
              {[
                { label: "To Do", status: "todo", value: totals.statusCount["todo"] || 0, color: "bg-gray-400", percentage: totalTasks > 0 ? Math.round(((totals.statusCount["todo"] || 0) / totalTasks) * 100) : 0 },
                { label: "In Progress", status: "in-progress", value: totals.statusCount["in-progress"] || 0, color: "bg-blue-500", percentage: totalTasks > 0 ? Math.round(((totals.statusCount["in-progress"] || 0) / totalTasks) * 100) : 0 },
                { label: "Done", status: "done", value: totals.statusCount["done"] || 0, color: "bg-green-500", percentage: totalTasks > 0 ? Math.round(((totals.statusCount["done"] || 0) / totalTasks) * 100) : 0 }
              ].map((item) => (
                <Link
                  key={item.label}
                  to={`/tasks?tab=table&status=${item.status}`}
                  aria-label={`View ${item.label} tasks (${item.value})`}
                  data-testid={`status-breakdown-${item.status}`}
                  className="block rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                    <span className="text-sm font-bold text-gray-900">{item.value} ({item.percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-500 shadow-sm`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Priority Breakdown */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6">Priority Breakdown</h2>
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              {[
                { label: "Low", priority: "low", value: totals.priorityCount["low"] || 0, color: "from-green-400 to-green-600", icon: "↓" },
                { label: "Medium", priority: "medium", value: totals.priorityCount["medium"] || 0, color: "from-yellow-400 to-yellow-600", icon: "→" },
                { label: "High", priority: "high", value: totals.priorityCount["high"] || 0, color: "from-red-400 to-red-600", icon: "↑" }
              ].map((item) => (
                <Link
                  key={item.label}
                  to={`/tasks?tab=table&priority=${item.priority}`}
                  aria-label={`View ${item.label} priority tasks (${item.value})`}
                  data-testid={`priority-breakdown-${item.priority}`}
                  className="block bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  <div className={`w-10 h-10 bg-gradient-to-br ${item.color} rounded-lg flex items-center justify-center text-white text-xl font-bold mb-3 shadow-md`}>
                    {item.icon}
                  </div>
                  <div className="text-2xl font-bold text-gray-900 mb-1">{item.value}</div>
                  <div className="text-xs font-medium text-gray-600 uppercase">{item.label}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Team Overview */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
          <h2 className="text-lg md:text-xl font-bold text-gray-900">Team Overview</h2>
          {usersState.status === "ready" && (
            <span className="text-xs md:text-sm font-medium text-gray-600">{users.length} Active Members</span>
          )}
        </div>

        {usersState.status === "loading" && (
          <p className="text-gray-500 text-sm" aria-live="polite">
            Loading team members...
          </p>
        )}

        {usersState.status === "error" && (
          <div
            role="alert"
            className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-700 flex items-center justify-between gap-4"
          >
            <span>Failed to load team members: {usersState.message}</span>
            <button
              type="button"
              onClick={loadUsers}
              className="bg-red-600 text-white rounded px-3 py-1.5 text-sm font-medium hover:bg-red-700 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
            >
              Retry
            </button>
          </div>
        )}

        {usersState.status === "ready" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
            {users.slice(0, 4).map((user) => (
              <Link
                key={user.id}
                to={`/users/${user.id}`}
                aria-label={`View profile: ${user.name}`}
                data-testid={`team-overview-user-${user.id}`}
                className="block bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100 text-center hover:shadow-md transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <div className="flex justify-center mb-2">
                  <UserAvatar
                    src={effectiveAvatar(user)}
                    name={user.name}
                    size="lg"
                    className="shadow-lg"
                  />
                </div>
                <p className="text-sm font-semibold text-gray-900">{user.name}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
