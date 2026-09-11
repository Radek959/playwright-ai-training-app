import { TaskStatus } from "./data.js";
import { ValidationError } from "./validation.js";

/**
 * A task moving to "done" gets a completedAt timestamp (unless the caller
 * already supplied one); any other status clears it. Shared by both task
 * creation and task update so the rule can't drift between the two routes.
 */
export function resolveCompletedAt(
  status: TaskStatus,
  requestedCompletedAt: string | undefined,
  now: () => string = () => new Date().toISOString()
): string | undefined {
  if (status !== "done") return undefined;
  return requestedCompletedAt ?? now();
}

export type AllowedUpdateResult =
  | { ok: true; merged: Record<string, unknown> }
  | { ok: false; errors: ValidationError[] };

/**
 * Applies a PUT patch onto a copy of the existing record, restricted to an
 * explicit allow-list. "id" always gets its own rejection message; any other
 * key outside the allow-list is rejected too, so a stray/unknown field never
 * silently mutates the stored record. An explicit `null` on a nullable field
 * clears it (deletes the key); `null` on any other field is a validation
 * error rather than a silent no-op.
 */
export function applyAllowedUpdate(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
  allowedFields: readonly string[],
  nullableFields: ReadonlySet<string>
): AllowedUpdateResult {
  const errors: ValidationError[] = [];

  for (const key of Object.keys(patch)) {
    if (key === "id") {
      errors.push({ field: "id", message: "id cannot be updated" });
    } else if (!allowedFields.includes(key)) {
      errors.push({ field: key, message: `${key} is not an updatable field` });
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const merged: Record<string, unknown> = { ...existing };
  for (const key of allowedFields) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value === null) {
      if (!nullableFields.has(key)) {
        errors.push({ field: key, message: `${key} cannot be null` });
        continue;
      }
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  return { ok: true, merged };
}
