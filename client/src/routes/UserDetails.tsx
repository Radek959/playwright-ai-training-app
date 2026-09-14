import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { UserAvatar } from "../components/UserAvatar";
import { AssignedTaskItem } from "../components/AssignedTaskItem";
import { DeleteUserDialog } from "../components/DeleteUserDialog";
import { EditUserDialog } from "../components/EditUserDialog";
import { toApiError } from "../utils/apiError";
import { effectiveAvatar } from "../utils/avatar";
import { isAbortError, useLatestRequest } from "../hooks/useLatestRequest";
import type { Task, User, UserUpdateInput } from "../types";

// Distinguishes "still fetching" and "fetch failed" from an actually-empty
// array, so the UI never shows a real-looking 0 (or "no tasks" empty state)
// for data it doesn't actually have yet.
type TasksState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; tasks: Task[] };

export function UserDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userFetchError, setUserFetchError] = useState<string | null>(null);

  const [tasksState, setTasksState] = useState<TasksState>({ status: "loading" });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Guards against an older in-flight request's response overwriting a newer
  // one's result (e.g. React.StrictMode's double effect invocation in dev, a
  // fast Retry click, or navigating from one user's page to another's before
  // the first user's fetch has settled) - see useLatestRequest for details.
  const beginUserRequest = useLatestRequest();
  const beginTasksRequest = useLatestRequest();

  const loadUser = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    setUserFetchError(null);
    const { signal, isCurrent } = beginUserRequest();
    try {
      const res = await fetch(`/api/users/${id}`, { signal });
      if (res.status === 404) {
        if (!isCurrent()) return;
        setNotFound(true);
        setUser(null);
        return;
      }
      if (!res.ok) throw new Error(`Failed to load user: ${res.status}`);
      const data = (await res.json()) as User;
      if (!isCurrent()) return;
      setUser(data);
    } catch (err) {
      if (isAbortError(err) || !isCurrent()) return;
      setUser(null);
      setUserFetchError(err instanceof Error ? err.message : "Failed to load user");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [id, beginUserRequest]);

  const loadTasks = useCallback(async () => {
    setTasksState({ status: "loading" });
    const { signal, isCurrent } = beginTasksRequest();
    try {
      const res = await fetch("/api/tasks", { signal });
      if (!res.ok) throw new Error(`Failed to load tasks: ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Unexpected tasks payload");
      if (!isCurrent()) return;
      setTasksState({ status: "ready", tasks: data as Task[] });
    } catch (err) {
      if (isAbortError(err) || !isCurrent()) return;
      setTasksState({ status: "error", message: err instanceof Error ? err.message : "Failed to load tasks" });
    }
  }, [beginTasksRequest]);

  useEffect(() => {
    loadUser();
    loadTasks();
  }, [loadUser, loadTasks]);

  /**
   * Saves the edit dialog's patch. The view is refreshed in place from the
   * API's response — never from optimistically guessed local state — and the
   * dialog is only closed once the request actually succeeded, so a rejected
   * save never shows unsaved values as stored. The URL never changes either
   * way: editing stays on /users/:id.
   *
   * An empty patch (nothing was edited) is still sent, so the server remains
   * the single source of truth for what the saved user looks like.
   */
  const handleSave = async (patch: UserUpdateInput) => {
    if (!user) return;
    let res: Response;
    try {
      res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update error";
      throw err instanceof Error ? err : new Error(message);
    }
    if (!res.ok) {
      throw await toApiError(res, `Update failed: ${res.status}`);
    }
    const updated = (await res.json()) as User;
    setUser(updated);
    setEditDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="p-8 text-center" aria-live="polite">
        <p className="text-gray-500">Loading user details...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">User not found</h2>
        <p className="text-gray-600 mb-6">The user you are looking for does not exist or has been removed.</p>
        <Link to="/users" className="text-indigo-600 hover:underline">
          Back to users list
        </Link>
      </div>
    );
  }

  if (userFetchError || !user) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-red-900 mb-4">Failed to load user</h2>
        <p className="text-gray-600 mb-6">{userFetchError || "Unknown error"}</p>
        <div className="flex justify-center gap-4">
          <Link to="/users" className="text-indigo-600 hover:underline px-4 py-2 border border-indigo-600 rounded">
            Back to users list
          </Link>
          <button
            onClick={loadUser}
            className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const assignedTasks = tasksState.status === "ready" ? tasksState.tasks.filter((t) => t.assigneeId === user.id) : [];
  const activeTasks = assignedTasks.filter((t) => t.status !== "done");
  const completedTasks = assignedTasks.filter((t) => t.status === "done");

  // Never show a real-looking number for data that isn't actually in yet —
  // "…" while the fetch is in flight, "Unavailable" once it has failed, and
  // only ever a genuine count once the array is actually in hand.
  const formatStat = (count: number) => {
    if (tasksState.status === "loading") return "…";
    if (tasksState.status === "error") return "Unavailable";
    return String(count);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link to="/users" className="text-indigo-600 hover:underline inline-flex items-center gap-2">
          &larr; Back to users list
        </Link>
      </div>

      <header className="mb-8 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-4">
          <UserAvatar src={effectiveAvatar(user)} name={user.name} size="xl" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{user.name}</h1>
            <p className="text-sm text-gray-500 font-mono">ID: {user.id}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setEditDialogOpen(true)}
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 whitespace-nowrap min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-800"
            aria-label={`Edit user: ${user.name}`}
          >
            Edit user
          </button>
          <button
            type="button"
            onClick={() => setDeleteDialogOpen(true)}
            className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 whitespace-nowrap min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
            aria-label={`Delete user: ${user.name}`}
          >
            Delete user
          </button>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">User information</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Email</dt>
            <dd className="mt-1 text-gray-900">{user.email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Role</dt>
            <dd className="mt-1 text-gray-900 capitalize">{user.role}</dd>
          </div>
        </dl>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Task summary</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-live="polite">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <dt className="text-sm font-medium text-gray-500">Total assigned</dt>
            <dd className="mt-1 text-2xl font-bold text-gray-900">{formatStat(assignedTasks.length)}</dd>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <dt className="text-sm font-medium text-gray-500">Active</dt>
            <dd className="mt-1 text-2xl font-bold text-indigo-600">{formatStat(activeTasks.length)}</dd>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <dt className="text-sm font-medium text-gray-500">Completed</dt>
            <dd className="mt-1 text-2xl font-bold text-green-600">{formatStat(completedTasks.length)}</dd>
          </div>
        </dl>
      </section>

      {tasksState.status === "loading" && (
        <p className="text-gray-500 mb-6" aria-live="polite">
          Loading assigned tasks...
        </p>
      )}

      {tasksState.status === "error" && (
        <div role="alert" className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-700 mb-6 flex items-center justify-between gap-4">
          <span>Failed to load assigned tasks: {tasksState.message}</span>
          <button
            type="button"
            onClick={loadTasks}
            className="bg-red-600 text-white rounded px-3 py-1.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {tasksState.status === "ready" && (
        <>
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Active tasks</h2>
            {activeTasks.length > 0 ? (
              <ul className="space-y-2">
                {activeTasks.map((task) => (
                  <AssignedTaskItem key={task.id} task={task} />
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No active tasks assigned.</p>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Completed tasks</h2>
            {completedTasks.length > 0 ? (
              <ul className="space-y-2">
                {completedTasks.map((task) => (
                  <AssignedTaskItem key={task.id} task={task} />
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No completed tasks assigned.</p>
            )}
          </section>
        </>
      )}

      {editDialogOpen && (
        <EditUserDialog user={user} open onClose={() => setEditDialogOpen(false)} onSave={handleSave} />
      )}

      <DeleteUserDialog
        user={user}
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onDeleted={() => {
          navigate("/users", { state: { deletedUserName: user.name } });
        }}
      />
    </div>
  );
}
