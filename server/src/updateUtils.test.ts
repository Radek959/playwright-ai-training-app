import { describe, expect, it } from "vitest";
import { applyAllowedUpdate } from "./updateUtils.js";
import { TASK_UPDATE_FIELDS, NULLABLE_TASK_FIELDS } from "./validation.js";

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

    it("rejects null on completedAt, which is derived from status rather than clearable", () => {
      const result = applyAllowedUpdate(existing, { completedAt: null }, TASK_UPDATE_FIELDS, NULLABLE_TASK_FIELDS);
      expect(result).toEqual({ ok: false, errors: [{ field: "completedAt", message: "completedAt cannot be null" }] });
    });
  });
});
