import { Task, TaskPriority, TaskSeverity, TaskStatus, TaskType, User, UserRole } from "./data.js";
import { defaultIfUndefined } from "./requestUtils.js";
import { COMMENT_CONTENT_MAX_LENGTH } from "./commentLifecycle.js";

export type ValidationError = { field: string; message: string };

const STATUSES: TaskStatus[] = ["todo", "in-progress", "done"];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high"];
const TASK_TYPES: TaskType[] = ["bug", "feature", "research"];
const SEVERITIES: TaskSeverity[] = ["critical", "major", "minor"];
const ROLES: UserRole[] = ["admin", "editor", "viewer"];

// Fields a client is allowed to send on PUT /api/tasks/:id. "id" is
// intentionally excluded: identity is not editable through this contract.
export const TASK_UPDATE_FIELDS: readonly string[] = [
  "title",
  "description",
  "status",
  "priority",
  "dueDate",
  "completedAt",
  "assigneeId",
  "taskType",
  "estimatedHours",
  "tags",
  "dependencies",
  "severity",
  "requiresApproval",
  "approver"
];

// Fields where an explicit `null` means "clear this value" rather than
// "invalid input". Required fields (title/status/priority) are deliberately
// excluded, as are array fields (send [] to clear those instead). completedAt
// is also excluded: it is derived from status (see resolveCompletedAt), so
// `null` there is invalid input rather than a value to clear.
export const NULLABLE_TASK_FIELDS: ReadonlySet<string> = new Set([
  "description",
  "dueDate",
  "assigneeId",
  "taskType",
  "estimatedHours",
  "severity",
  "approver"
]);

const isString = (value: unknown): value is string => typeof value === "string";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);

const isValidDate = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  return !Number.isNaN(new Date(value).getTime());
};

/**
 * Builds the candidate object for POST /api/tasks from a raw request body.
 * Defaults are applied only when a field is `undefined`; an explicit `null`
 * is passed through so validateTaskFields rejects it instead of it silently
 * becoming the default.
 */
export function buildTaskCreateCandidate(body: Record<string, unknown>): Record<string, unknown> {
  return {
    title: body.title,
    description: body.description,
    status: defaultIfUndefined(body.status, "todo" satisfies TaskStatus),
    priority: defaultIfUndefined(body.priority, "medium" satisfies TaskPriority),
    dueDate: body.dueDate,
    completedAt: body.completedAt,
    assigneeId: body.assigneeId,
    taskType: body.taskType,
    estimatedHours: body.estimatedHours,
    tags: defaultIfUndefined(body.tags, [] as string[]),
    dependencies: defaultIfUndefined(body.dependencies, [] as string[]),
    severity: body.severity,
    requiresApproval: defaultIfUndefined(body.requiresApproval, false),
    approver: body.approver
  };
}

/**
 * Validates a task candidate coming straight from request JSON. `candidate`
 * is intentionally typed as Record<string, unknown> (not Partial<Task>):
 * request bodies are runtime data and may contain any JSON shape, and every
 * check here must be able to report a 400 instead of throwing.
 */
export function validateTaskFields(
  candidate: Record<string, unknown>,
  context: { users: User[]; tasks: Task[]; taskId?: string }
): ValidationError[] {
  const errors: ValidationError[] = [];

  const title = candidate.title;
  if (title === undefined || title === null) {
    errors.push({ field: "title", message: "title is required" });
  } else if (!isString(title)) {
    errors.push({ field: "title", message: "title must be a string" });
  } else if (title.trim().length === 0) {
    errors.push({ field: "title", message: "title is required" });
  } else if (title.trim().length < 3) {
    errors.push({ field: "title", message: "title must be at least 3 characters" });
  }

  if (candidate.description !== undefined && candidate.description !== null && !isString(candidate.description)) {
    errors.push({ field: "description", message: "description must be a string" });
  }

  if (candidate.status !== undefined && !STATUSES.includes(candidate.status as TaskStatus)) {
    errors.push({ field: "status", message: "invalid status" });
  }
  if (candidate.priority !== undefined && !PRIORITIES.includes(candidate.priority as TaskPriority)) {
    errors.push({ field: "priority", message: "invalid priority" });
  }
  if (candidate.taskType !== undefined && candidate.taskType !== null && !TASK_TYPES.includes(candidate.taskType as TaskType)) {
    errors.push({ field: "taskType", message: "invalid taskType" });
  }
  if (candidate.severity !== undefined && candidate.severity !== null && !SEVERITIES.includes(candidate.severity as TaskSeverity)) {
    errors.push({ field: "severity", message: "invalid severity" });
  }

  if (candidate.assigneeId !== undefined && candidate.assigneeId !== null) {
    if (!isString(candidate.assigneeId)) {
      errors.push({ field: "assigneeId", message: "assigneeId must be a string" });
    } else if (candidate.assigneeId.length > 0) {
      const exists = context.users.some((u) => u.id === candidate.assigneeId);
      if (!exists) {
        errors.push({ field: "assigneeId", message: "assigneeId does not reference an existing user" });
      }
    }
  }

  if (candidate.dependencies !== undefined) {
    if (!isStringArray(candidate.dependencies)) {
      errors.push({ field: "dependencies", message: "dependencies must be an array of strings" });
    } else {
      const invalidIds = candidate.dependencies.filter(
        (id) => id === context.taskId || !context.tasks.some((t) => t.id === id)
      );
      if (invalidIds.length > 0) {
        errors.push({ field: "dependencies", message: `unknown dependency ids: ${invalidIds.join(", ")}` });
      }
    }
  }

  if (candidate.tags !== undefined && !isStringArray(candidate.tags)) {
    errors.push({ field: "tags", message: "tags must be an array of strings" });
  }

  if (candidate.estimatedHours !== undefined && candidate.estimatedHours !== null) {
    if (!isFiniteNumber(candidate.estimatedHours) || candidate.estimatedHours <= 0) {
      errors.push({ field: "estimatedHours", message: "estimatedHours must be a positive number" });
    }
  }

  if (candidate.requiresApproval !== undefined && !isBoolean(candidate.requiresApproval)) {
    errors.push({ field: "requiresApproval", message: "requiresApproval must be a boolean" });
  }

  if (candidate.approver !== undefined && candidate.approver !== null && !isString(candidate.approver)) {
    errors.push({ field: "approver", message: "approver must be a string" });
  }

  if (candidate.dueDate !== undefined && candidate.dueDate !== null) {
    if (!isValidDate(candidate.dueDate)) {
      errors.push({ field: "dueDate", message: "invalid dueDate" });
    }
  }

  if (candidate.completedAt !== undefined) {
    if (candidate.completedAt === null) {
      errors.push({ field: "completedAt", message: "completedAt cannot be null" });
    } else if (!isValidDate(candidate.completedAt)) {
      errors.push({ field: "completedAt", message: "invalid completedAt" });
    }
  }

  // Business rules mirrored from the task creation wizard. Only evaluated
  // against values that already passed their own type check above, so a
  // wrong-typed field never cascades into a second, confusing error.
  const taskType = isString(candidate.taskType) ? candidate.taskType : undefined;
  const priority = isString(candidate.priority) ? candidate.priority : undefined;
  const severity = candidate.severity !== undefined && candidate.severity !== null ? candidate.severity : undefined;
  const estimatedHours = isFiniteNumber(candidate.estimatedHours) ? candidate.estimatedHours : undefined;
  const requiresApproval = candidate.requiresApproval === true;
  const approver = isString(candidate.approver) && candidate.approver.trim().length > 0 ? candidate.approver : undefined;

  if (taskType === "bug" && !severity) {
    errors.push({ field: "severity", message: "bug tasks require a severity" });
  }
  if (taskType === "research" && !(estimatedHours !== undefined && estimatedHours >= 1)) {
    errors.push({ field: "estimatedHours", message: "research tasks require estimatedHours >= 1" });
  }
  if (priority === "high" && estimatedHours !== undefined && estimatedHours > 24) {
    errors.push({ field: "estimatedHours", message: "high priority tasks cannot exceed 24 estimated hours" });
  }
  if (requiresApproval && !approver) {
    errors.push({ field: "approver", message: "requiresApproval requires an approver" });
  }

  return errors;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Builds the candidate object for POST /api/users from a raw request body.
 * Defaults are applied only when a field is `undefined`; an explicit `null`
 * is passed through so validateUserFields rejects it instead of it silently
 * becoming the default.
 */
export function buildUserCreateCandidate(body: Record<string, unknown>): Record<string, unknown> {
  return {
    name: body.name,
    email: body.email,
    role: defaultIfUndefined(body.role, "viewer" satisfies UserRole),
    avatar: body.avatar
  };
}

export function validateUserFields(
  candidate: Record<string, unknown>,
  context: { users: User[]; userId?: string }
): ValidationError[] {
  const errors: ValidationError[] = [];

  const name = candidate.name;
  if (name === undefined || name === null) {
    errors.push({ field: "name", message: "name is required" });
  } else if (!isString(name)) {
    errors.push({ field: "name", message: "name must be a string" });
  } else if (name.trim().length === 0) {
    errors.push({ field: "name", message: "name is required" });
  }

  const email = candidate.email;
  if (email === undefined || email === null) {
    errors.push({ field: "email", message: "email is required" });
  } else if (!isString(email)) {
    errors.push({ field: "email", message: "email must be a string" });
  } else if (email.trim().length === 0) {
    errors.push({ field: "email", message: "email is required" });
  } else if (!EMAIL_RE.test(email.trim())) {
    errors.push({ field: "email", message: "email must be a valid email address" });
  } else {
    const duplicate = context.users.some(
      (u) => u.id !== context.userId && u.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (duplicate) {
      errors.push({ field: "email", message: "email is already in use" });
    }
  }

  if (candidate.role !== undefined && !ROLES.includes(candidate.role as UserRole)) {
    errors.push({ field: "role", message: "invalid role" });
  }

  if (candidate.avatar !== undefined && candidate.avatar !== null && !isString(candidate.avatar)) {
    errors.push({ field: "avatar", message: "avatar must be a string" });
  }

  return errors;
}

// The only fields a client may send on POST /api/tasks/:id/comments. "id",
// "taskId", "authorName" and "createdAt" are always server-controlled and
// are rejected the same as any other unknown field.
export const COMMENT_CREATE_FIELDS: readonly string[] = ["authorId", "content"];

/**
 * Validates a comment-creation body coming straight from request JSON.
 * Unknown/server-controlled fields are checked first and, if any are
 * present, reported on their own without evaluating authorId/content — the
 * request is invalid regardless of whether the fields it was allowed to
 * send happen to be valid too.
 */
export function validateCommentCreateFields(
  body: Record<string, unknown>,
  context: { users: User[] }
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const key of Object.keys(body)) {
    if (!COMMENT_CREATE_FIELDS.includes(key)) {
      errors.push({ field: key, message: `${key} is not a creatable field` });
    }
  }
  if (errors.length > 0) return errors;

  const authorId = body.authorId;
  if (authorId === undefined || authorId === null) {
    errors.push({ field: "authorId", message: "authorId is required" });
  } else if (!isString(authorId) || authorId.trim().length === 0) {
    errors.push({ field: "authorId", message: "authorId is required" });
  } else if (!context.users.some((u) => u.id === authorId)) {
    errors.push({ field: "authorId", message: "authorId does not reference an existing user" });
  }

  const content = body.content;
  if (content === undefined || content === null) {
    errors.push({ field: "content", message: "content is required" });
  } else if (!isString(content)) {
    errors.push({ field: "content", message: "content must be a string" });
  } else if (content.trim().length === 0) {
    errors.push({ field: "content", message: "content is required" });
  } else if (content.trim().length > COMMENT_CONTENT_MAX_LENGTH) {
    errors.push({ field: "content", message: `content must be at most ${COMMENT_CONTENT_MAX_LENGTH} characters` });
  }

  return errors;
}
