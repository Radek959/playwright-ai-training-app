import type {
  Task,
  TaskPriority,
  TaskSeverity,
  TaskStatus,
  TaskType,
  TaskUpdateInput
} from "../types";
import { toUtcDayInputValue } from "./taskDueDate";

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
 *
 * The API accepts any string `new Date()` can parse (e.g. "May 1, 2026"), so
 * this cannot assume an ISO string and slice at the "T": that would feed the
 * date input a value it rejects, the field would render blank, and saving an
 * unrelated field would then look like the user had cleared the due date.
 *
 * The conversion reuses the app's single UTC-day convention
 * (toUtcDayInputValue, next to getTaskDueStatus/formatDueDateUtc), so the day
 * shown in the editor is exactly the day the Overdue/Due soon classification
 * and the details view use. An unparsable value yields "" rather than
 * throwing; buildTaskUpdatePayload treats that as "unchanged", never as a
 * clear.
 */
export function toDateInputValue(value: string | undefined): string {
  return toUtcDayInputValue(value);
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
 * The only UI-only rule is that the creation wizard asks for a task type
 * (it applies in "create" mode only, so editing can still clear the type).
 * `assigneeId` is deliberately NOT required anywhere: the API and Swagger
 * both treat it as optional, so a task may be created unassigned.
 */
export function validateTaskForm(values: TaskFormValues, options: ValidateTaskFormOptions): TaskFormErrors {
  const errors: TaskFormErrors = {};

  if (values.title.trim().length < 3) {
    errors.title = TASK_FORM_MESSAGES.title;
  }

  if (!values.priority) {
    errors.priority = TASK_FORM_MESSAGES.priority;
  }

  if (options.mode === "create" && !values.taskType) {
    errors.taskType = TASK_FORM_MESSAGES.taskType;
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
 * field can never overwrite — or silently drop — a value the user did not
 * touch; a field the user cleared is sent with the explicit clearing value
 * the API contract defines: `null` for the nullable scalars (description,
 * dueDate, assigneeId, taskType, estimatedHours, severity, approver) and `[]`
 * for the array fields (tags, dependencies), which do not accept null.
 *
 * Every comparison is made against the form value as the user sees it, never
 * against a normalized/canonicalized value: canonicalize() intentionally
 * drops values that the *creation* form cannot express (a whitespace-only
 * description, a severity on a non-bug task, an approver while approval is
 * off), and diffing those against the stored task would clear data the user
 * never edited.
 *
 * The two conditional fields follow what the user actually did:
 * - `severity: null` is sent only when the type moves away from "bug" (or the
 *   severity control, visible for bugs, is emptied). A severity stored on a
 *   non-bug task — which the API allows — is left alone.
 * - `approver: null` is sent only when an active approval requirement is
 *   switched off (or the approver control, visible while approval is on, is
 *   emptied). An approver stored alongside requiresApproval: false is left
 *   alone.
 */
export function buildTaskUpdatePayload(values: TaskFormValues, original: Task): TaskUpdateInput {
  const patch: TaskUpdateInput = {};

  const title = values.title.trim();
  if (title !== original.title) patch.title = title;
  if (values.status !== original.status) patch.status = values.status;

  const priority = (values.priority || "medium") as TaskPriority;
  if (priority !== original.priority) patch.priority = priority;

  const originalDescription = original.description ?? "";
  if (values.description !== originalDescription) {
    patch.description = values.description.trim() === "" ? null : values.description;
  }

  const originalDueDay = toDateInputValue(original.dueDate);
  if (values.dueDate !== originalDueDay) {
    patch.dueDate = values.dueDate === "" ? null : new Date(values.dueDate).toISOString();
  }

  if (values.assigneeId !== (original.assigneeId ?? "")) {
    patch.assigneeId = values.assigneeId || null;
  }

  const originalTaskType = original.taskType ?? "";
  if (values.taskType !== originalTaskType) {
    patch.taskType = values.taskType || null;
  }

  // The severity control only exists while the type is "bug".
  if (originalTaskType === "bug" && values.taskType !== "bug") {
    patch.severity = null;
  } else if (values.taskType === "bug" && values.severity !== (original.severity ?? "")) {
    patch.severity = values.severity || null;
  }

  const originalHours =
    original.estimatedHours === undefined || original.estimatedHours === null ? "" : String(original.estimatedHours);
  if (values.estimatedHours.trim() !== originalHours) {
    const hours = parseEstimatedHours(values.estimatedHours);
    patch.estimatedHours = hours === undefined ? null : hours;
  }

  if (!sameArray(values.tags, original.tags ?? [])) {
    patch.tags = [...values.tags];
  }
  if (!sameArray(values.dependencies, original.dependencies ?? [])) {
    patch.dependencies = [...values.dependencies];
  }

  const originalRequiresApproval = original.requiresApproval ?? false;
  if (values.requiresApproval !== originalRequiresApproval) {
    patch.requiresApproval = values.requiresApproval;
  }

  // The approver control only exists while approval is required.
  if (originalRequiresApproval && !values.requiresApproval) {
    patch.approver = null;
  } else if (values.requiresApproval && values.approver !== (original.approver ?? "")) {
    patch.approver = values.approver || null;
  }

  return patch;
}
