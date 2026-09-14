import { randomUUID } from "node:crypto";
import { Task, TaskActivity, TaskActivityChange, ActivityValue } from "./data.js";

function isActivityValue(val: unknown): val is ActivityValue {
  if (val === null || typeof val === "string" || typeof val === "number" || typeof val === "boolean") return true;
  if (Array.isArray(val)) return val.every(v => typeof v === "string");
  return false;
}

const sameValue = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
};

const normalizeValue = (val: unknown): ActivityValue => {
  if (val === undefined) return null;
  if (isActivityValue(val)) return val;
  return null; // fallback
};

export function diffTaskChanges(
  existing: Record<string, unknown>,
  merged: Record<string, unknown>
): TaskActivityChange[] {
  const changes: TaskActivityChange[] = [];
  const allKeys = new Set([...Object.keys(existing), ...Object.keys(merged)]);
  allKeys.delete("id");

  for (const key of allKeys) {
    const beforeRaw = existing[key];
    const afterRaw = merged[key];

    if (!sameValue(beforeRaw, afterRaw)) {
      changes.push({
        field: key,
        before: normalizeValue(beforeRaw),
        after: normalizeValue(afterRaw)
      });
    }
  }

  // Sort changes to make tests deterministic
  return changes.sort((a, b) => a.field.localeCompare(b.field));
}

export function recordTaskCreated(
  task: Task,
  generateId: () => string = () => randomUUID(),
  now: () => string = () => new Date().toISOString()
): TaskActivity {
  return {
    id: generateId(),
    taskId: task.id,
    type: "task_created",
    changes: [],
    createdAt: now()
  };
}

export function recordTaskUpdated(
  taskId: string,
  existing: Record<string, unknown>,
  merged: Record<string, unknown>,
  generateId: () => string = () => randomUUID(),
  now: () => string = () => new Date().toISOString()
): TaskActivity | null {
  const changes = diffTaskChanges(existing, merged);
  if (changes.length === 0) return null;

  return {
    id: generateId(),
    taskId,
    type: "task_updated",
    changes,
    createdAt: now()
  };
}

export function recordApprovalDecided(
  taskId: string,
  existing: Record<string, unknown>,
  merged: Record<string, unknown>,
  generateId: () => string = () => randomUUID(),
  now: () => string = () => new Date().toISOString()
): TaskActivity | null {
  const changes = diffTaskChanges(existing, merged);
  if (changes.length === 0) return null;
  
  return {
    id: generateId(),
    taskId,
    type: "approval_decided",
    changes,
    createdAt: now()
  };
}

export function removeActivitiesForTask(
  activities: TaskActivity[],
  taskId: string
) {
  for (let i = activities.length - 1; i >= 0; i--) {
    if (activities[i].taskId === taskId) {
      activities.splice(i, 1);
    }
  }
}
