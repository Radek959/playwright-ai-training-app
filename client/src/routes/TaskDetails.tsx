import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAppError } from "../context/AppErrorContext";
import type { Task, User } from "../types";

export function TaskDetails() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [dependencies, setDependencies] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { setError, clearError } = useAppError();

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        clearError();
        setNotFound(false);

        const [taskRes, usersRes] = await Promise.all([
          fetch(`/api/tasks/${id}`),
          fetch("/api/users")
        ]);

        if (taskRes.status === 404) {
          setNotFound(true);
          return;
        }

        if (!taskRes.ok) {
          throw new Error(`Failed to load task: ${taskRes.statusText}`);
        }
        if (!usersRes.ok) {
          throw new Error(`Failed to load users: ${usersRes.statusText}`);
        }

        const taskData = await taskRes.json() as Task;
        const usersData = await usersRes.json() as User[];

        setTask(taskData);
        setUsers(usersData);

        if (taskData.dependencies && taskData.dependencies.length > 0) {
          const depsPromises = taskData.dependencies.map(depId =>
            fetch(`/api/tasks/${depId}`).then(r => r.ok ? r.json() : null)
          );
          const depsData = await Promise.all(depsPromises);
          setDependencies(depsData.filter(Boolean) as Task[]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading task details");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadData();
    }
  }, [id, clearError, setError]);

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

  if (!task) {
    return null;
  }

  const assignee = users.find(u => u.id === task.assigneeId);
  const approver = users.find(u => u.id === task.approver);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Not set";
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{task.title}</h1>
        <p className="text-sm text-gray-500 font-mono">ID: {task.id}</p>
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
              <dd className="mt-1 text-gray-900">{formatDate(task.dueDate)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Completed At</dt>
              <dd className="mt-1 text-gray-900">{formatDate(task.completedAt)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Estimated Hours</dt>
              <dd className="mt-1 text-gray-900">{renderValue(task.estimatedHours)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Assignee</dt>
              <dd className="mt-1 text-gray-900">
                {task.assigneeId ? (
                  <span>{assignee ? assignee.name : "Unknown User"} <span className="text-gray-500 text-sm font-mono">({task.assigneeId})</span></span>
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
                  <span>{approver ? approver.name : "Unknown User"} <span className="text-gray-500 text-sm font-mono">({task.approver})</span></span>
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
              return (
                <li key={depId} className="bg-gray-50 p-3 rounded border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-gray-900">{depTask ? depTask.title : "Unknown Task"}</span>
                    <span className="ml-2 text-gray-500 text-sm font-mono">({depId})</span>
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
    </div>
  );
}

