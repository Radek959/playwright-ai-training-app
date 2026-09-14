import { FormEvent, useEffect, useRef, useState } from "react";
import { Dialog } from "./Dialog";
import { TaskDependencyPicker, type DependencyOptionsState } from "./TaskDependencyPicker";
import { ApiError, mapFieldErrors } from "../utils/apiError";
import { APPROVERS } from "../utils/approvers";
import {
  buildTaskUpdatePayload,
  parseTagsInput,
  taskToFormValues,
  validateTaskForm,
  type TaskFormErrors,
  type TaskFormValues
} from "../utils/taskFormModel";
import type { Task, TaskPriority, TaskSeverity, TaskStatus, TaskType, TaskUpdateInput, User } from "../types";

type Props = {
  task: Task | null;
  open: boolean;
  users: User[];
  /** Tasks that may be picked as dependencies (the edited task is excluded). */
  existingTasks?: Task[];
  /**
   * Whether `existingTasks` is a successfully fetched list. Defaults to
   * "success"; "loading"/"error" mean the list is unknown, in which case the
   * saved dependencies are never validated against it (an empty array after a
   * failed request is not evidence that a dependency no longer exists).
   */
  existingTasksState?: DependencyOptionsState;
  /** Retries the task-list fetch from inside the dependency picker. */
  onRetryExistingTasks?: () => void;
  onClose: () => void;
  onSave: (updated: TaskUpdateInput) => Promise<void> | void;
};

const TITLE_ID = "task-edit-modal-title";
const ERROR_ID = "task-edit-modal-error";

// Every field this form can edit; an API error on any other field falls back
// to the generic banner instead of being pinned to an unrelated control.
const KNOWN_FIELDS = new Set([
  "title",
  "description",
  "status",
  "priority",
  "dueDate",
  "assigneeId",
  "taskType",
  "severity",
  "estimatedHours",
  "tags",
  "dependencies",
  "requiresApproval",
  "approver"
]);

const FIELD_ERROR_ID: Record<string, string> = {
  title: "edit-task-title-error",
  description: "edit-task-description-error",
  status: "edit-task-status-error",
  priority: "edit-task-priority-error",
  dueDate: "edit-task-due-date-error",
  assigneeId: "edit-task-assignee-error",
  taskType: "edit-task-type-error",
  severity: "edit-task-severity-error",
  estimatedHours: "edit-task-hours-error",
  tags: "edit-task-tags-error",
  requiresApproval: "edit-task-requires-approval-error",
  approver: "edit-task-approver-error"
};

export function TaskEditModal({
  task,
  open,
  users,
  existingTasks = [],
  existingTasksState = "success",
  onRetryExistingTasks,
  onClose,
  onSave
}: Props) {
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<TaskFormValues>(() =>
    task ? taskToFormValues(task) : taskToFormValues({ id: "", title: "", status: "todo", priority: "medium" })
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (task) {
      setValues(taskToFormValues(task));
      setSaveError(null);
      setFieldErrors({});
    }
  }, [task]);

  const setValue = <K extends keyof TaskFormValues>(field: K, value: TaskFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    clearFieldError(field);
  };

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  if (!task) return null;

  const describedBy = (field: string, includeBanner = false) =>
    [fieldErrors[field] ? FIELD_ERROR_ID[field] : null, includeBanner && saveError ? ERROR_ID : null]
      .filter(Boolean)
      .join(" ") || undefined;

  const fieldError = (field: string) =>
    fieldErrors[field] ? (
      <p id={FIELD_ERROR_ID[field]} role="alert" className="text-red-600 text-xs">
        {fieldErrors[field]}
      </p>
    ) : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    // The same rules the API enforces, checked up front so an avoidable
    // round-trip never happens (see validateTaskForm).
    // The dependency reference check runs only against a list that was
    // actually fetched: an empty array left behind by a failed (or still
    // pending) GET /api/tasks would otherwise make every saved dependency
    // look like it no longer exists and block an unrelated edit.
    const clientErrors: TaskFormErrors = validateTaskForm(values, {
      mode: "edit",
      availableTaskIds: existingTasksState === "success" ? existingTasks.map((t) => t.id) : undefined,
      currentTaskId: task.id
    });
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors as Record<string, string>);
      setSaveError(null);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setFieldErrors({});
    try {
      await onSave(buildTaskUpdatePayload(values, task));
      // Entered data is intentionally left in place on failure so the
      // caller can decide whether to close (success) or keep it open.
    } catch (err) {
      if (err instanceof ApiError) {
        const { mapped } = mapFieldErrors(err.details, KNOWN_FIELDS);
        setFieldErrors(mapped);
        // The API rejected the status change because of incomplete
        // dependencies, so the task's real status is still whatever it was
        // before this submit. Revert just the status field to match —
        // leaving it on "done" would show a value that was never saved.
        if (err.blockingDependencies.length > 0) {
          setValues((prev) => ({ ...prev, status: task.status }));
        }
      }
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
              value={values.title}
              onChange={(e) => setValue("title", e.target.value)}
              required
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={describedBy("title", true)}
            />
            {fieldError("title")}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-task-priority" className="text-sm font-semibold text-slate-700">
              Priority
            </label>
            <select
              id="edit-task-priority"
              className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              value={values.priority}
              onChange={(e) => setValue("priority", e.target.value as TaskPriority)}
              aria-invalid={Boolean(fieldErrors.priority)}
              aria-describedby={describedBy("priority")}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            {fieldError("priority")}
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
            value={values.description}
            onChange={(e) => setValue("description", e.target.value)}
            aria-invalid={Boolean(fieldErrors.description)}
            aria-describedby={describedBy("description")}
          />
          {fieldError("description")}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-task-status" className="text-sm font-semibold text-slate-700">
              Status
            </label>
            <select
              id="edit-task-status"
              className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              value={values.status}
              onChange={(e) => setValue("status", e.target.value as TaskStatus)}
              aria-invalid={Boolean(fieldErrors.status)}
              aria-describedby={describedBy("status")}
            >
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
            {fieldError("status")}
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
              value={values.dueDate}
              onChange={(e) => setValue("dueDate", e.target.value)}
              aria-invalid={Boolean(fieldErrors.dueDate)}
              aria-describedby={describedBy("dueDate")}
            />
            {fieldError("dueDate")}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-task-assignee" className="text-sm font-semibold text-slate-700">
              Assignee
            </label>
            <select
              id="edit-task-assignee"
              className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              value={values.assigneeId}
              onChange={(e) => setValue("assigneeId", e.target.value)}
              aria-invalid={Boolean(fieldErrors.assigneeId)}
              aria-describedby={describedBy("assigneeId")}
            >
              <option value="">-- none --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            {fieldError("assigneeId")}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-task-type" className="text-sm font-semibold text-slate-700">
              Task type
            </label>
            <select
              id="edit-task-type"
              className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              value={values.taskType}
              onChange={(e) => setValue("taskType", e.target.value as TaskType | "")}
              aria-invalid={Boolean(fieldErrors.taskType)}
              aria-describedby={describedBy("taskType")}
            >
              <option value="">-- none --</option>
              <option value="feature">Feature</option>
              <option value="bug">Bug</option>
              <option value="research">Research</option>
            </select>
            {fieldError("taskType")}
          </div>

          {/* Severity only exists for bugs; the payload builder clears a
              leftover value when the type moves away from "bug". */}
          {values.taskType === "bug" && (
            <div className="flex flex-col gap-1" data-testid="edit-task-severity-field">
              <label htmlFor="edit-task-severity" className="text-sm font-semibold text-slate-700">
                Severity
              </label>
              <select
                id="edit-task-severity"
                className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                value={values.severity}
                onChange={(e) => setValue("severity", e.target.value as TaskSeverity | "")}
                aria-invalid={Boolean(fieldErrors.severity)}
                aria-describedby={describedBy("severity")}
              >
                <option value="">-- none --</option>
                <option value="critical">Critical</option>
                <option value="major">Major</option>
                <option value="minor">Minor</option>
              </select>
              {fieldError("severity")}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="edit-task-hours" className="text-sm font-semibold text-slate-700">
              Estimated hours
            </label>
            <input
              id="edit-task-hours"
              type="number"
              min="0"
              step="any"
              className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              value={values.estimatedHours}
              onChange={(e) => setValue("estimatedHours", e.target.value)}
              aria-invalid={Boolean(fieldErrors.estimatedHours)}
              aria-describedby={describedBy("estimatedHours")}
            />
            {fieldError("estimatedHours")}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="edit-task-tags" className="text-sm font-semibold text-slate-700">
            Tags (comma separated)
          </label>
          <input
            id="edit-task-tags"
            className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            placeholder="backend, urgent, api"
            value={values.tags.join(", ")}
            onChange={(e) => setValue("tags", parseTagsInput(e.target.value))}
            aria-invalid={Boolean(fieldErrors.tags)}
            aria-describedby={describedBy("tags")}
          />
          {fieldError("tags")}
        </div>

        <TaskDependencyPicker
          idPrefix="edit-task"
          tasks={existingTasks}
          value={values.dependencies}
          onChange={(next) => setValue("dependencies", next)}
          excludeTaskId={task.id}
          error={fieldErrors.dependencies}
          state={existingTasksState}
          onRetry={onRetryExistingTasks}
        />

        <div className="flex flex-col gap-2">
          <label htmlFor="edit-task-requires-approval" className="flex items-center gap-2">
            <input
              id="edit-task-requires-approval"
              type="checkbox"
              checked={values.requiresApproval}
              onChange={(e) => setValue("requiresApproval", e.target.checked)}
              aria-describedby={describedBy("requiresApproval")}
            />
            <span className="text-sm font-semibold text-slate-700">Requires manager approval</span>
          </label>
          {fieldError("requiresApproval")}

          {/* Approver only exists while approval is required; the payload
              builder sends approver: null when the box is unchecked. */}
          {values.requiresApproval && (
            <div className="flex flex-col gap-1" data-testid="edit-task-approver-field">
              <label htmlFor="edit-task-approver" className="text-sm font-semibold text-slate-700">
                Approver
              </label>
              <select
                id="edit-task-approver"
                className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                value={values.approver}
                onChange={(e) => setValue("approver", e.target.value)}
                aria-invalid={Boolean(fieldErrors.approver)}
                aria-describedby={describedBy("approver")}
              >
                <option value="">-- none --</option>
                {Object.entries(APPROVERS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              {fieldError("approver")}
            </div>
          )}
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
