import type {
  Task,
  TaskPriority,
  TaskSeverity,
  TaskStatus,
  TaskType,
  TaskUpdateInput
} from "../types";

/**
 * The single form model shared by the task creation wizard and the task edit
 * modal. Every value is kept in the shape an HTML control produces (strings,
 * arrays, booleans) so both forms can bind directly to it, and so validation
 * and payload building can be written once instead of once per form.
 */
export type TaskFormValues = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority | "";
  /** Calendar day as rendered by <input type="date">, e.g. "2026-05-01". */
  dueDate: string;
  assigneeId: string;
  taskType: TaskType | "";
  severity: TaskSeverity | "";
  /** Raw <input type="number"> value; "" means "not provided". */
  estimatedHours: string;
  tags: string[];
  dependencies: string[];
  requiresApproval: boolean;
  approver: string;
};

export type TaskFormField = keyof TaskFormValues;

export type TaskFormErrors = Partial<Record<TaskFormField, string>>;

export type TaskFormMode = "create" | "edit";

export type ValidateTaskFormOptions = {
  mode: TaskFormMode;
  /**
   * Ids of the tasks that may be referenced as dependencies. Omit to skip
   * the reference check (e.g. while the task list is still loading).
   */
  availableTaskIds?: readonly string[];
  /** The task being edited — it can never be its own dependency. */
  currentTaskId?: string;
};

/** Payload for POST /api/tasks. Only fields with a real value are present. */
export type TaskCreatePayload = {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  assigneeId?: string;
  taskType?: TaskType;
  severity?: TaskSeverity;
  estimatedHours?: number;
  tags: string[];
  dependencies: string[];
  requiresApproval: boolean;
  approver?: string;
};

export const TASK_FORM_MESSAGES = {
  title: "Title must be at least 3 characters",
  priority: "Choose a priority",
  taskType: "Choose a task type",
  assigneeId: "You must assign this task",
  estimatedHoursPositive: "Estimated hours must be a positive number",
  estimatedHoursResearch: "Research tasks require a time estimate of at least 1 hour",
  estimatedHoursHighPriority: "High priority tasks cannot exceed 24h",
  severityBug: "Bugs require a severity level",
  approver: "Select an approver"
} as const;

export function emptyTaskFormValues(): TaskFormValues {
  return {
    title: "",
    description: "",
    status: "todo",
    priority: "",
    dueDate: "",
    assigneeId: "",
    taskType: "feature",
    severity: "",
    estimatedHours: "",
    tags: [],
    dependencies: [],
    requiresApproval: false,
    approver: ""
  };
}

/**
 * The calendar day an <input type="date"> should show for a stored dueDate.
 * Deliberately a plain string slice rather than a Date round-trip: the stored
 * value is a UTC instant and re-formatting it in the viewer's local timezone
 * could shift the day by one.
 */
export function toDateInputValue(value: string | undefined): string {
  if (!value) return "";
  return value.split("T")[0];
}

/** Builds the form state for an existing task (used when opening the edit modal). */
export function taskToFormValues(task: Task): TaskFormValues {
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    dueDate: toDateInputValue(task.dueDate),
    assigneeId: task.assigneeId ?? "",
    taskType: task.taskType ?? "",
    severity: task.severity ?? "",
    estimatedHours: task.estimatedHours === undefined ? "" : String(task.estimatedHours),
    tags: task.tags ? [...task.tags] : [],
    dependencies: task.dependencies ? [...task.dependencies] : [],
    requiresApproval: task.requiresApproval ?? false,
    approver: task.approver ?? ""
  };
}

/** Parses the raw hours input; `undefined` for a blank field, NaN for junk. */
export function parseEstimatedHours(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  return Number(trimmed);
}

export function parseTagsInput(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Client-side validation. Mirrors the server rules in
 * `server/src/validation.ts` exactly, so a form that passes here is never
 * rejected by the API for a rule the UI could have caught:
 * - title must be at least 3 characters after trimming;
 * - estimatedHours, when provided, must be a positive number;
 * - research tasks require estimatedHours of at least 1;
 * - bug tasks require a severity;
 * - high priority tasks cannot exceed 24 estimated hours;
 * - requiresApproval requires an approver;
 * - dependencies must reference existing tasks (never the task itself).
 *
 * The only rules that are UI-only are the ones the creation wizard has always
 * enforced on top of the API (a task type and an assignee must be chosen);
 * they apply in "create" mode only, so editing can still clear an assignee.
 */
export function validateTaskForm(values: TaskFormValues, options: ValidateTaskFormOptions): TaskFormErrors {
  const errors: TaskFormErrors = {};

  if (values.title.trim().length < 3) {
    errors.title = TASK_FORM_MESSAGES.title;
  }

  if (!values.priority) {
    errors.priority = TASK_FORM_MESSAGES.priority;
  }

  if (options.mode === "create") {
    if (!values.taskType) errors.taskType = TASK_FORM_MESSAGES.taskType;
    if (!values.assigneeId) errors.assigneeId = TASK_FORM_MESSAGES.assigneeId;
  }

  const hours = parseEstimatedHours(values.estimatedHours);
  const hoursProvided = hours !== undefined;
  const hoursValid = hoursProvided && Number.isFinite(hours) && (hours as number) > 0;

  if (hoursProvided && !hoursValid) {
    errors.estimatedHours = TASK_FORM_MESSAGES.estimatedHoursPositive;
  } else if (values.taskType === "research" && !(hoursValid && (hours as number) >= 1)) {
    errors.estimatedHours = TASK_FORM_MESSAGES.estimatedHoursResearch;
  } else if (values.priority === "high" && hoursValid && (hours as number) > 24) {
    errors.estimatedHours = TASK_FORM_MESSAGES.estimatedHoursHighPriority;
  }

  if (values.taskType === "bug" && !values.severity) {
    errors.severity = TASK_FORM_MESSAGES.severityBug;
  }

  if (values.requiresApproval && !values.approver) {
    errors.approver = TASK_FORM_MESSAGES.approver;
  }

  if (options.availableTaskIds) {
    const available = new Set(options.availableTaskIds);
    const invalid = values.dependencies.filter((id) => id === options.currentTaskId || !available.has(id));
    if (invalid.length > 0) {
      errors.dependencies = `Unknown dependency ids: ${invalid.join(", ")}`;
    }
  }

  return errors;
}

type CanonicalTaskFields = {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  assigneeId?: string;
  taskType?: TaskType;
  severity?: TaskSeverity;
  estimatedHours?: number;
  tags: string[];
  dependencies: string[];
  requiresApproval: boolean;
  approver?: string;
};

/**
 * Resolves the form state into the values a task should actually have,
 * dropping anything the conditional fields make meaningless: a `severity`
 * left over from a previous `taskType: "bug"` selection, and an `approver`
 * left over from a `requiresApproval` checkbox that is now unchecked.
 */
function canonicalize(values: TaskFormValues): CanonicalTaskFields {
  const hours = parseEstimatedHours(values.estimatedHours);
  const estimatedHours = hours !== undefined && Number.isFinite(hours) && hours > 0 ? hours : undefined;
  const description = values.description.trim() === "" ? undefined : values.description;

  return {
    title: values.title.trim(),
    description,
    status: values.status,
    priority: (values.priority || "medium") as TaskPriority,
    dueDate: values.dueDate || undefined,
    assigneeId: values.assigneeId || undefined,
    taskType: values.taskType || undefined,
    severity: values.taskType === "bug" ? values.severity || undefined : undefined,
    estimatedHours,
    tags: [...values.tags],
    dependencies: [...values.dependencies],
    requiresApproval: values.requiresApproval,
    approver: values.requiresApproval ? values.approver || undefined : undefined
  };
}

/**
 * Builds the POST /api/tasks body. Fields with no value are omitted rather
 * than sent as "" / 0 / null: the create contract has no "clear this" notion,
 * and an empty string would be rejected as an invalid date/reference.
 */
export function buildTaskCreatePayload(values: TaskFormValues): TaskCreatePayload {
  const c = canonicalize(values);
  const payload: TaskCreatePayload = {
    title: c.title,
    status: c.status,
    priority: c.priority,
    tags: c.tags,
    dependencies: c.dependencies,
    requiresApproval: c.requiresApproval
  };
  if (c.description !== undefined) payload.description = c.description;
  if (c.dueDate !== undefined) payload.dueDate = c.dueDate;
  if (c.assigneeId !== undefined) payload.assigneeId = c.assigneeId;
  if (c.taskType !== undefined) payload.taskType = c.taskType;
  if (c.severity !== undefined) payload.severity = c.severity;
  if (c.estimatedHours !== undefined) payload.estimatedHours = c.estimatedHours;
  if (c.approver !== undefined) payload.approver = c.approver;
  return payload;
}

const sameArray = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

/**
 * Builds the PUT /api/tasks/:id body by diffing the edited form against the
 * task as it was loaded. Only what actually changed is sent, so editing one
 * field can never overwrite a value the form does not know about; and a field
 * the user cleared is sent with the explicit clearing value the API contract
 * defines — `null` for nullable scalars (description, dueDate, assigneeId,
 * taskType, estimatedHours, severity, approver) and `[]` for the array fields
 * (tags, dependencies), which do not accept null.
 *
 * Two conditional pairs are always sent together rather than relying on the
 * diff, because the API re-validates the *merged* task and would otherwise
 * keep a value the form no longer shows:
 * - moving `taskType` away from "bug" also sends `severity: null`;
 * - unchecking `requiresApproval` also sends `approver: null`.
 */
export function buildTaskUpdatePayload(values: TaskFormValues, original: Task): TaskUpdateInput {
  const c = canonicalize(values);
  const patch: TaskUpdateInput = {};

  if (c.title !== original.title) patch.title = c.title;
  if (c.status !== original.status) patch.status = c.status;
  if (c.priority !== original.priority) patch.priority = c.priority;

  const originalDescription = original.description ?? "";
  const nextDescription = c.description ?? "";
  if (nextDescription !== originalDescription) {
    patch.description = nextDescription === "" ? null : nextDescription;
  }

  const originalDueDay = toDateInputValue(original.dueDate);
  const nextDueDay = c.dueDate ?? "";
  if (nextDueDay !== originalDueDay) {
    patch.dueDate = nextDueDay === "" ? null : new Date(nextDueDay).toISOString();
  }

  if ((c.assigneeId ?? "") !== (original.assigneeId ?? "")) {
    patch.assigneeId = c.assigneeId ?? null;
  }
  if ((c.taskType ?? "") !== (original.taskType ?? "")) {
    patch.taskType = c.taskType ?? null;
  }
  if ((c.severity ?? "") !== (original.severity ?? "")) {
    patch.severity = c.severity ?? null;
  }
  if ((c.approver ?? "") !== (original.approver ?? "")) {
    patch.approver = c.approver ?? null;
  }
  if (c.estimatedHours !== original.estimatedHours) {
    patch.estimatedHours = c.estimatedHours ?? null;
  }
  if (!sameArray(c.tags, original.tags ?? [])) {
    patch.tags = c.tags;
  }
  if (!sameArray(c.dependencies, original.dependencies ?? [])) {
    patch.dependencies = c.dependencies;
  }
  if (c.requiresApproval !== (original.requiresApproval ?? false)) {
    patch.requiresApproval = c.requiresApproval;
  }

  if (original.taskType === "bug" && c.taskType !== "bug") {
    patch.severity = null;
  }
  if ((original.requiresApproval ?? false) && !c.requiresApproval) {
    patch.requiresApproval = false;
    patch.approver = null;
  }

  return patch;
}
