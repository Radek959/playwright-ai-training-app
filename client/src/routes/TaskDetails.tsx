import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAppError } from "../context/AppErrorContext";
import { getApproverLabel } from "../utils/approvers";
import { DueDateLabel } from "../components/DueDateLabel";
import { TaskApprovalSection } from "../components/TaskApprovalSection";
import { TaskEditModal } from "../components/TaskEditModal";
import type { DependencyOptionsState } from "../components/TaskDependencyPicker";
import { formatDueDateUtc } from "../utils/taskDueDate";
import { toApiError } from "../utils/apiError";
import type { Task, TaskUpdateInput, User } from "../types";

/**
 * Loads the tasks a dependency list refers to. Returns an empty list when the
 * task has no dependencies, so a cleared list never leaves stale entries on
 * screen after a save.
 */
async function fetchDependencyTasks(dependencyIds: string[] | undefined): Promise<Task[]> {
  if (!dependencyIds || dependencyIds.length === 0) return [];
  const results = await Promise.all(
    dependencyIds.map((depId) =>
      fetch(`/api/tasks/${depId}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    )
  );
  return results.filter(Boolean) as Task[];
}

export function TaskDetails() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  // "success" is the only state in which allTasks may be treated as the real
  // list of tasks. A failed GET /api/tasks leaves it empty, and an empty
  // array must not be read as "no task exists" — that would make the edit
  // modal reject this task's own saved dependencies.
  const [allTasksState, setAllTasksState] = useState<DependencyOptionsState>("loading");
  const [dependencies, setDependencies] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { setError, clearError } = useAppError();

  /**
   * The full task list only powers the edit modal's dependency picker, so a
   * failure here must not break the read-only details view — but it is
   * recorded as an error state (not as an empty list) and can be retried on
   * its own from inside the picker.
   */
  const loadAllTasks = useCallback(async () => {
    setAllTasksState("loading");
    try {
      const tasksRes = await fetch("/api/tasks");
      if (!tasksRes.ok) throw new Error(`HTTP ${tasksRes.status}`);
      const tasksData = await tasksRes.json();
      if (!Array.isArray(tasksData)) throw new Error("Unexpected payload");
      setAllTasks(tasksData as Task[]);
      setAllTasksState("success");
    } catch (err) {
      console.warn("Failed to fetch tasks", err);
      setAllTasks([]);
      setAllTasksState("error");
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setFetchError(null);
      setNotFound(false);
      clearError();

      const taskRes = await fetch(`/api/tasks/${id}`);

      if (taskRes.status === 404) {
        setNotFound(true);
        return;
      }

      if (!taskRes.ok) {
        throw new Error(`Failed to load task: ${taskRes.statusText}`);
      }

      const taskData = await taskRes.json() as Task;
      setTask(taskData);

      // Try fetching users, but don"t fail the whole page if it fails
      try {
        const usersRes = await fetch("/api/users");
        if (usersRes.ok) {
          const usersData = await usersRes.json() as User[];
          setUsers(usersData);
        }
      } catch (err) {
        console.warn("Failed to fetch users", err);
      }

      await loadAllTasks();

      setDependencies(await fetchDependencyTasks(taskData.dependencies));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error loading task details";
      setFetchError(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id, clearError, setError, loadAllTasks]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Saves the edit modal's patch. The view is refreshed from the API's
   * response (never from optimistically guessed local state), the dependency
   * list is re-resolved so it matches what was actually stored, and the modal
   * is only closed once the request succeeded — a rejected save leaves the
   * last successfully saved version on screen with the modal still open, and
   * the URL never changes either way.
   */
  const handleSave = async (patch: TaskUpdateInput) => {
    if (!task) return;
    let res: Response;
    try {
      res = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update error";
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    }
    if (!res.ok) {
      const apiError = await toApiError(res, `Update failed: ${res.status}`);
      setError(apiError.message);
      throw apiError;
    }
    const updated = (await res.json()) as Task;
    setTask(updated);
    setAllTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setDependencies(await fetchDependencyTasks(updated.dependencies));
    setIsEditing(false);
    clearError();
  };

  /**
   * Records an approve/reject decision via the dedicated endpoint. The view
   * is refreshed from the API's response only — never optimistically — so a
   * rejected (409 conflict) decision never shows as saved, and the URL never
   * changes either way.
   */
  const handleApprovalDecision = async (decision: "approved" | "rejected", comment?: string) => {
    if (!task) return;
    let res: Response;
    try {
      res = await fetch(`/api/tasks/${task.id}/approval`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment })
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Approval request error";
      throw err instanceof Error ? err : new Error(message);
    }
    if (!res.ok) {
      throw await toApiError(res, `Approval decision failed: ${res.status}`);
    }
    const updated = (await res.json()) as Task;
    setTask(updated);
    setAllTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  if (loading) {
    return (
      <div className="p-8 text-center" aria-live="polite">
        <p className="text-gray-500">Loading task details...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Task not found</h2>
        <p className="text-gray-600 mb-6">The task you are looking for does not exist or has been removed.</p>
        <Link to="/tasks" className="text-indigo-600 hover:underline">Back to tasks list</Link>
      </div>
    );
  }

  if (fetchError || !task) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-red-900 mb-4">Failed to load task</h2>
        <p className="text-gray-600 mb-6">{fetchError || "Unknown error"}</p>
        <div className="flex justify-center gap-4">
          <Link to="/tasks" className="text-indigo-600 hover:underline px-4 py-2 border border-indigo-600 rounded">Back to tasks list</Link>
          <button onClick={loadData} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const assignee = users.find(u => u.id === task.assigneeId);

  const renderDate = (dateStr?: string) => {
    if (!dateStr) return "Not set";
    try {
      const d = new Date(dateStr);
      // Validate date object
      if (isNaN(d.getTime())) return dateStr;
      return <time dateTime={d.toISOString()}>{d.toLocaleString()}</time>;
    } catch {
      return dateStr;
    }
  };

  // Due Date specifically is rendered via the UTC calendar day (matching
  // getTaskDueStatus's classification) rather than renderDate's local-
  // timezone toLocaleString(), so the date shown here can never disagree
  // with the Overdue/Due soon label next to it.
  const renderDueDate = (dateStr?: string) => {
    if (!dateStr) return "Not set";
    const formatted = formatDueDateUtc(dateStr);
    if (!formatted) return dateStr;
    return <time dateTime={formatted.iso}>{formatted.display}</time>;
  };

  const renderValue = (value: string | number | undefined | null) => {
    if (value === undefined || value === null || value === "") return "Not set";
    return String(value);
  };

  const renderBoolean = (value?: boolean) => {
    if (value === undefined || value === null) return "Not set";
    return value ? "Yes" : "No";
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link to="/tasks" className="text-indigo-600 hover:underline inline-flex items-center gap-2">
          &larr; Back to tasks list
        </Link>
      </div>

      <header className="mb-8">
        {task.coverImage && (
          <img src={task.coverImage} alt="" className="w-full h-48 object-cover rounded-lg mb-6" />
        )}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{task.title}</h1>
            <p className="text-sm text-gray-500 font-mono">ID: {task.id}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            data-testid="open-edit-task-btn"
            className="self-start bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-800"
          >
            Edit task
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Basic Information</h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Description</dt>
              <dd className="mt-1 text-gray-900 whitespace-pre-wrap">{renderValue(task.description)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1 text-gray-900 capitalize">{task.status}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Priority</dt>
              <dd className="mt-1 text-gray-900 capitalize">{task.priority}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Task Type</dt>
              <dd className="mt-1 text-gray-900 capitalize">{renderValue(task.taskType)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Severity</dt>
              <dd className="mt-1 text-gray-900 capitalize">{renderValue(task.severity)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Tags</dt>
              <dd className="mt-1">
                {task.tags && task.tags.length > 0 ? (
                  <ul className="flex flex-wrap gap-2 m-0 p-0 list-none">
                    {task.tags.map(tag => (
                      <li key={tag} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm">
                        {tag}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-gray-900">Not set</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Scheduling &amp; People</h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Due Date</dt>
              <dd className="mt-1 text-gray-900 flex flex-wrap items-center gap-2">
                <span>{renderDueDate(task.dueDate)}</span>
                <DueDateLabel task={task} showDate={false} className="px-2 py-0.5 rounded text-xs" />
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Completed At</dt>
              <dd className="mt-1 text-gray-900">{renderDate(task.completedAt)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Estimated Hours</dt>
              <dd className="mt-1 text-gray-900">{renderValue(task.estimatedHours)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Assignee</dt>
              <dd className="mt-1 text-gray-900">
                {task.assigneeId ? (
                  <span>{assignee ? assignee.name : task.assigneeId} {assignee && <span className="text-gray-500 text-sm font-mono">({task.assigneeId})</span>}</span>
                ) : (
                  "Not set"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Requires Approval</dt>
              <dd className="mt-1 text-gray-900">{renderBoolean(task.requiresApproval)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Approver</dt>
              <dd className="mt-1 text-gray-900">
                {task.approver ? (
                  <span>{getApproverLabel(task.approver)}</span>
                ) : (
                  "Not set"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Cover Image</dt>
              <dd className="mt-1 text-gray-900 break-all">
                {task.coverImage ? (
                  <a href={task.coverImage} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                    {task.coverImage}
                  </a>
                ) : (
                  "Not set"
                )}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Dependencies</h2>
        {task.dependencies && task.dependencies.length > 0 ? (
          <ul className="space-y-2">
            {task.dependencies.map(depId => {
              const depTask = dependencies.find(d => d.id === depId);
              const isBlocking = Boolean(depTask && depTask.status !== "done");
              return (
                <li
                  key={depId}
                  className={`p-3 rounded border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    isBlocking ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-100"
                  }`}
                  data-testid={`dependency-${depId}`}
                >
                  <div>
                    <span className="font-medium text-gray-900">{depTask ? depTask.title : depId}</span>
                    {depTask && <span className="ml-2 text-gray-500 text-sm font-mono">({depId})</span>}
                    {depTask && (
                      <span className="ml-2 text-sm text-gray-700 capitalize">— {depTask.status}</span>
                    )}
                    {isBlocking && (
                      <span
                        className="ml-2 inline-block bg-red-100 text-red-800 text-xs font-semibold px-2 py-0.5 rounded"
                        data-testid={`dependency-blocking-${depId}`}
                      >
                        Blocking completion
                      </span>
                    )}
                  </div>
                  <Link to={`/tasks/${depId}`} className="text-indigo-600 hover:underline text-sm whitespace-nowrap">
                    View details
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-gray-900">Not set</p>
        )}
      </section>

      <TaskApprovalSection task={task} onDecide={handleApprovalDecision} />

      {/* The very same modal the task list uses — the details view adds an
          entry point to it rather than a second, parallel edit form. */}
      <TaskEditModal
        task={isEditing ? task : null}
        open={isEditing}
        users={users}
        existingTasks={allTasks}
        existingTasksState={allTasksState}
        onRetryExistingTasks={loadAllTasks}
        onClose={() => setIsEditing(false)}
        onSave={handleSave}
      />
    </div>
  );
}

