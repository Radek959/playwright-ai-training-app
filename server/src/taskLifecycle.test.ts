import { describe, expect, it } from "vitest";
import { applyAllowedUpdate, isTaskArchived, resolveCompletedAt } from "./taskLifecycle.js";
import { TASK_UPDATE_FIELDS, NULLABLE_TASK_FIELDS } from "./validation.js";
import { Task } from "./data.js";

describe("resolveCompletedAt", () => {
  it("sets completedAt to now when moving to done without one supplied", () => {
    const result = resolveCompletedAt("done", undefined, () => "2026-01-01T00:00:00.000Z");
    expect(result).toBe("2026-01-01T00:00:00.000Z");
  });

  it("keeps a caller-supplied completedAt when moving to done", () => {
    const result = resolveCompletedAt("done", "2025-06-01T00:00:00.000Z", () => "2026-01-01T00:00:00.000Z");
    expect(result).toBe("2025-06-01T00:00:00.000Z");
  });

  it("clears completedAt when status is not done", () => {
    expect(resolveCompletedAt("todo", "2025-06-01T00:00:00.000Z")).toBeUndefined();
    expect(resolveCompletedAt("in-progress", "2025-06-01T00:00:00.000Z")).toBeUndefined();
  });
});

describe("applyAllowedUpdate", () => {
  const existing: Record<string, unknown> = {
    id: "t1",
    title: "Existing",
    status: "todo",
    priority: "low",
    description: "Original description",
    dueDate: "2026-01-01T00:00:00.000Z"
  };

  it("blocks updating id", () => {
    const result = applyAllowedUpdate(existing, { id: "t2" }, TASK_UPDATE_FIELDS, NULLABLE_TASK_FIELDS);
    expect(result).toEqual({ ok: false, errors: [{ field: "id", message: "id cannot be updated" }] });
  });

  it("rejects a field outside the allow-list", () => {
    const result = applyAllowedUpdate(existing, { coverImage: "x.jpg" }, TASK_UPDATE_FIELDS, NULLABLE_TASK_FIELDS);
    expect(result).toEqual({
      ok: false,
      errors: [{ field: "coverImage", message: "coverImage is not an updatable field" }]
    });
  });

  it("merges an allowed field onto a copy of the existing record", () => {
    const result = applyAllowedUpdate(existing, { title: "Updated" }, TASK_UPDATE_FIELDS, NULLABLE_TASK_FIELDS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.merged.title).toBe("Updated");
      expect(result.merged.status).toBe("todo");
      expect(existing.title).toBe("Existing");
    }
  });

  describe("clearing optional values with null", () => {
    it("deletes a nullable field when patched with null", () => {
      const result = applyAllowedUpdate(existing, { description: null }, TASK_UPDATE_FIELDS, NULLABLE_TASK_FIELDS);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect("description" in result.merged).toBe(false);
      }
    });

    it("rejects null on a field that is not nullable", () => {
      const result = applyAllowedUpdate(existing, { title: null }, TASK_UPDATE_FIELDS, NULLABLE_TASK_FIELDS);
      expect(result).toEqual({ ok: false, errors: [{ field: "title", message: "title cannot be null" }] });
    });

    it("rejects null on status, which is required and non-nullable", () => {
      const result = applyAllowedUpdate(existing, { status: null }, TASK_UPDATE_FIELDS, NULLABLE_TASK_FIELDS);
      expect(result).toEqual({ ok: false, errors: [{ field: "status", message: "status cannot be null" }] });
    });
  });
});

const archivedTask = (overrides: Partial<Pick<Task, "status" | "completedAt" | "dueDate">>) => ({
  status: "done" as const,
  completedAt: undefined,
  dueDate: undefined,
  ...overrides
});

describe("isTaskArchived", () => {
  const now = new Date("2026-02-01T00:00:00.000Z").getTime();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  it("is never archived when the task is not done", () => {
    const task = archivedTask({ status: "todo" as const, completedAt: new Date(now - THIRTY_DAYS_MS * 2).toISOString() });
    expect(isTaskArchived(task, now)).toBe(false);
  });

  it("is not archived when completed less than 30 days ago", () => {
    const completedAt = new Date(now - (THIRTY_DAYS_MS - 1000)).toISOString();
    expect(isTaskArchived(archivedTask({ completedAt }), now)).toBe(false);
  });

  it("is not archived exactly at the 30 day boundary", () => {
    const completedAt = new Date(now - THIRTY_DAYS_MS).toISOString();
    expect(isTaskArchived(archivedTask({ completedAt }), now)).toBe(false);
  });

  it("is archived just past the 30 day boundary", () => {
    const completedAt = new Date(now - THIRTY_DAYS_MS - 1000).toISOString();
    expect(isTaskArchived(archivedTask({ completedAt }), now)).toBe(true);
  });

  it("falls back to dueDate when completedAt is missing", () => {
    const dueDate = new Date(now - THIRTY_DAYS_MS - 1000).toISOString();
    expect(isTaskArchived(archivedTask({ completedAt: undefined, dueDate }), now)).toBe(true);
  });

  it("is not archived when neither completedAt nor dueDate is set", () => {
    expect(isTaskArchived(archivedTask({ completedAt: undefined, dueDate: undefined }), now)).toBe(false);
  });

  it("is not archived when the reference date is unparseable", () => {
    expect(isTaskArchived(archivedTask({ completedAt: "not-a-date" }), now)).toBe(false);
  });
});
