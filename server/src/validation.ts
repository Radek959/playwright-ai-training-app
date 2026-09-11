import { Task, TaskPriority, TaskSeverity, TaskStatus, TaskType, User, UserRole } from "./data.js";

export type ValidationError = { field: string; message: string };

const STATUSES: TaskStatus[] = ["todo", "in-progress", "done"];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high"];
const TASK_TYPES: TaskType[] = ["bug", "feature", "research"];
const SEVERITIES: TaskSeverity[] = ["critical", "major", "minor"];
const ROLES: UserRole[] = ["admin", "editor", "viewer"];

const isValidDate = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  return !Number.isNaN(new Date(value).getTime());
};

export function validateTaskFields(
  candidate: Partial<Task>,
  context: { users: User[]; tasks: Task[]; taskId?: string }
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!candidate.title || candidate.title.trim().length === 0) {
    errors.push({ field: "title", message: "title is required" });
  } else if (candidate.title.trim().length < 3) {
    errors.push({ field: "title", message: "title must be at least 3 characters" });
  }

  if (candidate.status !== undefined && !STATUSES.includes(candidate.status)) {
    errors.push({ field: "status", message: "invalid status" });
  }
  if (candidate.priority !== undefined && !PRIORITIES.includes(candidate.priority)) {
    errors.push({ field: "priority", message: "invalid priority" });
  }
  if (candidate.taskType !== undefined && !TASK_TYPES.includes(candidate.taskType)) {
    errors.push({ field: "taskType", message: "invalid taskType" });
  }
  if (candidate.severity !== undefined && !SEVERITIES.includes(candidate.severity)) {
    errors.push({ field: "severity", message: "invalid severity" });
  }

  if (candidate.assigneeId) {
    const exists = context.users.some((u) => u.id === candidate.assigneeId);
    if (!exists) {
      errors.push({ field: "assigneeId", message: "assigneeId does not reference an existing user" });
    }
  }

  if (candidate.dependencies !== undefined) {
    if (!Array.isArray(candidate.dependencies)) {
      errors.push({ field: "dependencies", message: "dependencies must be an array of task ids" });
    } else {
      const invalidIds = candidate.dependencies.filter(
        (id) => id === context.taskId || !context.tasks.some((t) => t.id === id)
      );
      if (invalidIds.length > 0) {
        errors.push({ field: "dependencies", message: `unknown dependency ids: ${invalidIds.join(", ")}` });
      }
    }
  }

  if (candidate.estimatedHours !== undefined && candidate.estimatedHours !== null) {
    if (
      typeof candidate.estimatedHours !== "number" ||
      Number.isNaN(candidate.estimatedHours) ||
      candidate.estimatedHours <= 0
    ) {
      errors.push({ field: "estimatedHours", message: "estimatedHours must be a positive number" });
    }
  }

  if (candidate.dueDate !== undefined && candidate.dueDate !== null && candidate.dueDate !== "") {
    if (!isValidDate(candidate.dueDate)) {
      errors.push({ field: "dueDate", message: "invalid dueDate" });
    }
  }

  if (candidate.completedAt !== undefined && candidate.completedAt !== null && candidate.completedAt !== "") {
    if (!isValidDate(candidate.completedAt)) {
      errors.push({ field: "completedAt", message: "invalid completedAt" });
    }
  }

  if (candidate.tags !== undefined && !Array.isArray(candidate.tags)) {
    errors.push({ field: "tags", message: "tags must be an array of strings" });
  }

  // Business rules mirrored from the task creation wizard.
  if (candidate.taskType === "bug" && !candidate.severity) {
    errors.push({ field: "severity", message: "bug tasks require a severity" });
  }
  if (
    candidate.taskType === "research" &&
    !(typeof candidate.estimatedHours === "number" && candidate.estimatedHours >= 1)
  ) {
    errors.push({ field: "estimatedHours", message: "research tasks require estimatedHours >= 1" });
  }
  if (
    candidate.priority === "high" &&
    typeof candidate.estimatedHours === "number" &&
    candidate.estimatedHours > 24
  ) {
    errors.push({ field: "estimatedHours", message: "high priority tasks cannot exceed 24 estimated hours" });
  }
  if (candidate.requiresApproval && !candidate.approver) {
    errors.push({ field: "approver", message: "requiresApproval requires an approver" });
  }

  return errors;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateUserFields(
  candidate: Partial<User>,
  context: { users: User[]; userId?: string }
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!candidate.name || candidate.name.trim().length === 0) {
    errors.push({ field: "name", message: "name is required" });
  }

  if (!candidate.email || candidate.email.trim().length === 0) {
    errors.push({ field: "email", message: "email is required" });
  } else if (!EMAIL_RE.test(candidate.email.trim())) {
    errors.push({ field: "email", message: "email must be a valid email address" });
  } else {
    const duplicate = context.users.some(
      (u) => u.id !== context.userId && u.email.toLowerCase() === candidate.email!.trim().toLowerCase()
    );
    if (duplicate) {
      errors.push({ field: "email", message: "email is already in use" });
    }
  }

  if (candidate.role !== undefined && !ROLES.includes(candidate.role)) {
    errors.push({ field: "role", message: "invalid role" });
  }

  return errors;
}
