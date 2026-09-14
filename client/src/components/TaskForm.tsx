import { FormEvent, useEffect, useState } from "react";
import { useAppError } from "../context/useAppError";
import { mapFieldErrors, toApiError } from "../utils/apiError";
import { buildQuickTaskPayload } from "../utils/taskFormPayload";
import type { Task, TaskPriority, TaskStatus, User } from "../types";

type Props = {
  onCreated: (task: Task) => void;
};

const KNOWN_FIELDS = new Set(["title", "description", "status", "priority", "dueDate", "assigneeId"]);

const FIELD_ERROR_ID: Record<string, string> = {
  title: "quick-task-title-error",
  description: "quick-task-description-error",
  status: "quick-task-status-error",
  priority: "quick-task-priority-error",
  dueDate: "quick-task-due-date-error",
  assigneeId: "quick-task-assignee-error"
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const submitLabel = "Add task";

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

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
        body: JSON.stringify(buildQuickTaskPayload({ title, description, status, priority, dueDate, assigneeId }))
      });
      if (!res.ok) {
        const apiError = await toApiError(res, `Create failed: ${res.status}`);
        const { mapped } = mapFieldErrors(apiError.details, KNOWN_FIELDS);
        setFieldErrors(mapped);
        setError(apiError.message);
        return;
      }
      const data = await res.json();
      onCreated(data as Task);
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("medium");
      setDueDate("");
      setAssigneeId("");
      setFieldErrors({});
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
          onChange={(e) => {
            setTitle(e.target.value);
            clearFieldError("title");
          }}
          required
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={fieldErrors.title ? FIELD_ERROR_ID.title : undefined}
        />
        {fieldErrors.title && (
          <p id={FIELD_ERROR_ID.title} role="alert" className="text-red-600 text-xs">
            {fieldErrors.title}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="quick-task-description" className="text-sm font-semibold">
          Description
        </label>
        <textarea
          id="quick-task-description"
          className="border rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            clearFieldError("description");
          }}
          aria-invalid={Boolean(fieldErrors.description)}
          aria-describedby={fieldErrors.description ? FIELD_ERROR_ID.description : undefined}
        />
        {fieldErrors.description && (
          <p id={FIELD_ERROR_ID.description} role="alert" className="text-red-600 text-xs">
            {fieldErrors.description}
          </p>
        )}
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
            onChange={(e) => {
              setStatus(e.target.value as TaskStatus);
              clearFieldError("status");
            }}
            aria-invalid={Boolean(fieldErrors.status)}
            aria-describedby={fieldErrors.status ? FIELD_ERROR_ID.status : undefined}
          >
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="done">Done</option>
          </select>
          {fieldErrors.status && (
            <p id={FIELD_ERROR_ID.status} role="alert" className="text-red-600 text-xs">
              {fieldErrors.status}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="quick-task-priority" className="text-sm font-semibold">
            Priority
          </label>
          <select
            id="quick-task-priority"
            className="border rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value as TaskPriority);
              clearFieldError("priority");
            }}
            aria-invalid={Boolean(fieldErrors.priority)}
            aria-describedby={fieldErrors.priority ? FIELD_ERROR_ID.priority : undefined}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          {fieldErrors.priority && (
            <p id={FIELD_ERROR_ID.priority} role="alert" className="text-red-600 text-xs">
              {fieldErrors.priority}
            </p>
          )}
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
            onChange={(e) => {
              setDueDate(e.target.value ? new Date(e.target.value).toISOString() : "");
              clearFieldError("dueDate");
            }}
            aria-invalid={Boolean(fieldErrors.dueDate)}
            aria-describedby={fieldErrors.dueDate ? FIELD_ERROR_ID.dueDate : undefined}
          />
          {fieldErrors.dueDate && (
            <p id={FIELD_ERROR_ID.dueDate} role="alert" className="text-red-600 text-xs">
              {fieldErrors.dueDate}
            </p>
          )}
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
          onChange={(e) => {
            setAssigneeId(e.target.value);
            clearFieldError("assigneeId");
          }}
          aria-invalid={Boolean(fieldErrors.assigneeId)}
          aria-describedby={fieldErrors.assigneeId ? FIELD_ERROR_ID.assigneeId : undefined}
        >
          <option value="">-- none --</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        {fieldErrors.assigneeId && (
          <p id={FIELD_ERROR_ID.assigneeId} role="alert" className="text-red-600 text-xs">
            {fieldErrors.assigneeId}
          </p>
        )}
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
