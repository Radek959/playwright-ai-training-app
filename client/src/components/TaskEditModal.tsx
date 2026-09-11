import { FormEvent, useEffect, useRef, useState } from "react";
import { Dialog } from "./Dialog";
import type { Task, TaskUpdateInput, User } from "../types";

type Props = {
  task: Task | null;
  open: boolean;
  users: User[];
  onClose: () => void;
  onSave: (updated: TaskUpdateInput) => Promise<void> | void;
};

const TITLE_ID = "task-edit-modal-title";
const ERROR_ID = "task-edit-modal-error";

export function TaskEditModal({ task, open, users, onClose, onSave }: Props) {
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Task["status"]>("todo");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [dueDate, setDueDate] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.dueDate ? task.dueDate.split("T")[0] : "");
      setAssigneeId(task.assigneeId ?? "");
      setSaveError(null);
    }
  }, [task]);

  if (!task) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({
        title,
        description,
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        assigneeId: assigneeId || null
      });
      // Entered data is intentionally left in place on failure so the
      // caller can decide whether to close (success) or keep it open.
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save the task");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      titleId={TITLE_ID}
      initialFocusRef={titleInputRef}
      testId="task-edit-modal"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex justify-between items-start gap-4">
          <h2 id={TITLE_ID} className="text-2xl font-bold text-gray-900">
            Edit task
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-gray-400 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded p-1 -mt-1 -mr-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {saveError && (
          <div id={ERROR_ID} role="alert" className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-700">
            {saveError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-task-title" className="text-sm font-semibold text-slate-700">
              Title
            </label>
            <input
              id="edit-task-title"
              ref={titleInputRef}
              className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              aria-describedby={saveError ? ERROR_ID : undefined}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-task-priority" className="text-sm font-semibold text-slate-700">
              Priority
            </label>
            <select
              id="edit-task-priority"
              className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task["priority"])}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="edit-task-description" className="text-sm font-semibold text-slate-700">
            Description
          </label>
          <textarea
            id="edit-task-description"
            className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-task-status" className="text-sm font-semibold text-slate-700">
              Status
            </label>
            <select
              id="edit-task-status"
              className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              value={status}
              onChange={(e) => setStatus(e.target.value as Task["status"])}
            >
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-task-due-date" className="text-sm font-semibold text-slate-700">
              Due date
            </label>
            <input
              id="edit-task-due-date"
              type="date"
              autoComplete="off"
              className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-task-assignee" className="text-sm font-semibold text-slate-700">
              Assignee
            </label>
            <select
              id="edit-task-assignee"
              className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
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
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
