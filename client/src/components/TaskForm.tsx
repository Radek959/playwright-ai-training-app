import { FormEvent, useEffect, useState } from "react";
import { useAppError } from "../context/AppErrorContext";
import type { Task, TaskPriority, TaskStatus, User } from "../types";

type Props = {
  onCreated: (task: Task) => void;
};

export function TaskForm({ onCreated }: Props) {
  const { setError, clearError } = useAppError();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const submitLabel = "Add task";

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch("/api/users");
        if (!res.ok) throw new Error(`Users HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setUsers(data);
          clearError();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Users fetch error");
      }
    };
    loadUsers();
  }, [setError, clearError]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, status, priority, dueDate, assigneeId })
      });
      const data = await res.json();
      if (!res.ok) {
        const detailMessage = Array.isArray(data?.details) && data.details.length > 0 ? data.details[0].message : undefined;
        throw new Error(detailMessage ?? data?.error ?? `Create failed: ${res.status}`);
      }
      onCreated(data as Task);
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("medium");
      setDueDate("");
      setAssigneeId("");
      clearError();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create error");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 p-3 border rounded bg-white">
      <div className="flex flex-col gap-1">
        <label htmlFor="quick-task-title" className="text-sm font-semibold">
          Title
        </label>
        <input
          id="quick-task-title"
          className="border rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="quick-task-description" className="text-sm font-semibold">
          Description
        </label>
        <textarea
          id="quick-task-description"
          className="border rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="quick-task-status" className="text-sm font-semibold">
            Status
          </label>
          <select
            id="quick-task-status"
            className="border rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
          >
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="quick-task-priority" className="text-sm font-semibold">
            Priority
          </label>
          <select
            id="quick-task-priority"
            className="border rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="quick-task-due-date" className="text-sm font-semibold">
            Due date
          </label>
          <input
            id="quick-task-due-date"
            type="date"
            autoComplete="off"
            className="border rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            value={dueDate ? dueDate.split("T")[0] : ""}
            onChange={(e) => setDueDate(e.target.value ? new Date(e.target.value).toISOString() : "")}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="quick-task-assignee" className="text-sm font-semibold">
          Assignee
        </label>
        <select
          id="quick-task-assignee"
          className="border rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
        >
          <option value="">-- none --</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        data-testid="add-task-button"
        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
        aria-label={submitLabel}
      >
        {submitLabel}
      </button>
    </form>
  );
}
