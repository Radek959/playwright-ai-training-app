import type { Task } from "../types";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * A "done" task is archived once it's been 30 days past completion; tasks
 * completed without a recorded completedAt fall back to dueDate.
 */
export function isArchived(task: Pick<Task, "status" | "completedAt" | "dueDate">, now: number = Date.now()): boolean {
  if (task.status !== "done") return false;
  const referenceDate = task.completedAt ?? task.dueDate;
  if (!referenceDate) return false;
  const time = new Date(referenceDate).getTime();
  if (Number.isNaN(time)) return false;
  return now - time > THIRTY_DAYS_MS;
}
