import type { Task } from "../types";

export type TaskDueStatus = "overdue" | "soon" | "scheduled" | "none";

const DAY_MS = 24 * 60 * 60 * 1000;
const SOON_WINDOW_DAYS = 3;

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Classifies a task's dueDate relative to `now` (defaults to Date.now()),
 * comparing whole UTC calendar days so the time-of-day recorded in dueDate
 * (or the local timezone of whoever runs this) never changes the outcome.
 *
 * - "overdue": not done, and the due day is strictly before today.
 * - "soon": not done, and the due day is within [today, today + 3 days].
 * - "scheduled": a valid dueDate that is neither overdue nor soon (includes
 *   done tasks, and due dates further than 3 days out).
 * - "none": no dueDate, or a dueDate that doesn't parse as a valid date.
 */
export function getTaskDueStatus(task: Pick<Task, "dueDate" | "status">, now: number = Date.now()): TaskDueStatus {
  if (!task.dueDate) return "none";
  const dueMs = new Date(task.dueDate).getTime();
  if (Number.isNaN(dueMs)) return "none";

  const dueDay = startOfUtcDay(dueMs);
  const today = startOfUtcDay(now);

  if (task.status !== "done" && dueDay < today) return "overdue";
  if (task.status !== "done" && dueDay <= today + SOON_WINDOW_DAYS * DAY_MS) return "soon";
  return "scheduled";
}

export function isTaskOverdue(task: Pick<Task, "dueDate" | "status">, now: number = Date.now()): boolean {
  return getTaskDueStatus(task, now) === "overdue";
}

export function isTaskDueSoon(task: Pick<Task, "dueDate" | "status">, now: number = Date.now()): boolean {
  return getTaskDueStatus(task, now) === "soon";
}

export type FormattedDueDate = {
  /** Calendar date formatted in UTC, independent of the local timezone (e.g. "6/15/2026"). */
  display: string;
  /** Full ISO timestamp, suitable for a <time dateTime="..."> attribute. */
  iso: string;
};

/**
 * Formats a dueDate's UTC calendar day, matching the day getTaskDueStatus
 * classifies against. Deliberately does not use toLocaleDateString()/
 * toLocaleString() (which format in the local timezone) so the displayed
 * date never shifts by a day relative to the classification in a timezone
 * west or east of UTC. Returns null for a missing or unparsable dueDate.
 */
export function formatDueDateUtc(dateStr: string | undefined): FormattedDueDate | null {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime();
  if (Number.isNaN(ms)) return null;

  return {
    display: new Intl.DateTimeFormat(undefined, { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" }).format(
      ms
    ),
    iso: new Date(ms).toISOString()
  };
}
