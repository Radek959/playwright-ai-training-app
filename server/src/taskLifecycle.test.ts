import { describe, expect, it } from "vitest";
import {
  applyAllowedUpdate,
  applyApprovalDecision,
  applyApprovalTransition,
  findApprovalBlocker,
  findBlockingDependencies,
  normalizeApprovalComment,
  resolveCompletedAt,
  significantFieldsChanged
} from "./taskLifecycle.js";
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

    it("rejects null on completedAt, which is derived from status rather than clearable", () => {
      const result = applyAllowedUpdate(existing, { completedAt: null }, TASK_UPDATE_FIELDS, NULLABLE_TASK_FIELDS);
      expect(result).toEqual({ ok: false, errors: [{ field: "completedAt", message: "completedAt cannot be null" }] });
    });
  });
});

describe("findBlockingDependencies", () => {
  const allTasks = [
    { id: "d1", title: "Done dependency", status: "done" as const },
    { id: "d2", title: "In progress dependency", status: "in-progress" as const },
    { id: "d3", title: "Todo dependency", status: "todo" as const }
  ];

  it("returns an empty array when there are no dependencies", () => {
    expect(findBlockingDependencies(undefined, allTasks)).toEqual([]);
    expect(findBlockingDependencies([], allTasks)).toEqual([]);
  });

  it("returns an empty array when every dependency is done", () => {
    expect(findBlockingDependencies(["d1"], allTasks)).toEqual([]);
  });

  it("returns every non-done dependency and omits done ones", () => {
    const result = findBlockingDependencies(["d1", "d2", "d3"], allTasks);
    expect(result).toEqual([
      { id: "d2", title: "In progress dependency", status: "in-progress" },
      { id: "d3", title: "Todo dependency", status: "todo" }
    ]);
  });

  it("ignores dependency ids that no longer resolve to a task", () => {
    expect(findBlockingDependencies(["missing"], allTasks)).toEqual([]);
  });
});

describe("approval workflow domain logic", () => {
  describe("significantFieldsChanged", () => {
    it("is false when none of the reset-triggering fields changed", () => {
      const existing = { title: "T", status: "todo", priority: "low", tags: ["a"], dependencies: [] };
      const merged = { title: "T", status: "done", priority: "low", tags: ["a"], dependencies: [] };
      expect(significantFieldsChanged(existing, merged)).toBe(false);
    });

    it("is true when title changes", () => {
      const existing = { title: "T" };
      const merged = { title: "T2" };
      expect(significantFieldsChanged(existing, merged)).toBe(true);
    });

    it("compares array fields by value, not reference", () => {
      const existing = { tags: ["a", "b"] };
      const merged = { tags: ["a", "b"] };
      expect(significantFieldsChanged(existing, merged)).toBe(false);

      expect(significantFieldsChanged({ tags: ["a"] }, { tags: ["a", "b"] })).toBe(true);
    });

    it("is true when approver changes", () => {
      expect(significantFieldsChanged({ approver: "manager-a" }, { approver: "manager-b" })).toBe(true);
    });
  });

  describe("normalizeApprovalComment", () => {
    it("trims a comment", () => {
      expect(normalizeApprovalComment("  Looks good.  ")).toBe("Looks good.");
    });

    it("treats an empty or whitespace-only comment as no comment", () => {
      expect(normalizeApprovalComment("")).toBeUndefined();
      expect(normalizeApprovalComment("   ")).toBeUndefined();
    });

    it("treats a non-string as no comment", () => {
      expect(normalizeApprovalComment(undefined)).toBeUndefined();
      expect(normalizeApprovalComment(42)).toBeUndefined();
    });
  });

  describe("applyApprovalTransition", () => {
    it("does nothing when requiresApproval is false and was false", () => {
      const existing = { requiresApproval: false };
      const merged: Record<string, unknown> = { requiresApproval: false };
      applyApprovalTransition(existing, merged);
      expect(merged.approvalStatus).toBeUndefined();
    });

    it("starts a pending process when requiresApproval flips false -> true", () => {
      const existing = { requiresApproval: false };
      const merged: Record<string, unknown> = { requiresApproval: true, approver: "manager-a" };
      applyApprovalTransition(existing, merged);
      expect(merged.approvalStatus).toBe("pending");
      expect(merged.approvalComment).toBeUndefined();
      expect(merged.approvalDecidedAt).toBeUndefined();
    });

    it("clears the process when requiresApproval flips true -> false", () => {
      const existing = {
        requiresApproval: true,
        approvalStatus: "approved",
        approvalComment: "ok",
        approvalDecidedAt: "2026-01-01T00:00:00.000Z"
      };
      const merged: Record<string, unknown> = {
        requiresApproval: false,
        approvalStatus: "approved",
        approvalComment: "ok",
        approvalDecidedAt: "2026-01-01T00:00:00.000Z"
      };
      applyApprovalTransition(existing, merged);
      expect(merged.approvalStatus).toBeUndefined();
      expect(merged.approvalComment).toBeUndefined();
      expect(merged.approvalDecidedAt).toBeUndefined();
    });

    it("resets an approved task back to pending when a significant field changes", () => {
      const existing = {
        requiresApproval: true,
        title: "Old title",
        approvalStatus: "approved",
        approvalComment: "ok",
        approvalDecidedAt: "2026-01-01T00:00:00.000Z"
      };
      const merged: Record<string, unknown> = {
        requiresApproval: true,
        title: "New title",
        approvalStatus: "approved",
        approvalComment: "ok",
        approvalDecidedAt: "2026-01-01T00:00:00.000Z"
      };
      applyApprovalTransition(existing, merged);
      expect(merged.approvalStatus).toBe("pending");
      expect(merged.approvalComment).toBeUndefined();
      expect(merged.approvalDecidedAt).toBeUndefined();
    });

    it("does not reset when no significant field actually changed value (no-op patch)", () => {
      const existing = {
        requiresApproval: true,
        title: "Same title",
        approvalStatus: "rejected",
        approvalComment: "no",
        approvalDecidedAt: "2026-01-01T00:00:00.000Z"
      };
      const merged: Record<string, unknown> = {
        requiresApproval: true,
        title: "Same title",
        status: "in-progress",
        approvalStatus: "rejected",
        approvalComment: "no",
        approvalDecidedAt: "2026-01-01T00:00:00.000Z"
      };
      applyApprovalTransition(existing, merged);
      expect(merged.approvalStatus).toBe("rejected");
      expect(merged.approvalComment).toBe("no");
      expect(merged.approvalDecidedAt).toBe("2026-01-01T00:00:00.000Z");
    });

    it("does not reset a plain status-only change alone", () => {
      const existing = {
        requiresApproval: true,
        title: "Same",
        status: "todo",
        approvalStatus: "approved",
        approvalComment: "ok",
        approvalDecidedAt: "2026-01-01T00:00:00.000Z"
      };
      const merged: Record<string, unknown> = {
        requiresApproval: true,
        title: "Same",
        status: "in-progress",
        approvalStatus: "approved",
        approvalComment: "ok",
        approvalDecidedAt: "2026-01-01T00:00:00.000Z"
      };
      applyApprovalTransition(existing, merged);
      expect(merged.approvalStatus).toBe("approved");
    });

    it("leaves a still-pending process alone when a significant field changes", () => {
      const existing = { requiresApproval: true, title: "Old", approvalStatus: "pending" };
      const merged: Record<string, unknown> = { requiresApproval: true, title: "New", approvalStatus: "pending" };
      applyApprovalTransition(existing, merged);
      expect(merged.approvalStatus).toBe("pending");
      expect(merged.approvalComment).toBeUndefined();
    });
  });

  describe("applyApprovalDecision", () => {
    const pendingTask = (overrides: Partial<Task> = {}): Task => ({
      id: "t1",
      title: "Task",
      status: "todo",
      priority: "medium",
      requiresApproval: true,
      approver: "manager-a",
      approvalStatus: "pending",
      ...overrides
    });
    const fixedNow = () => "2026-09-14T08:00:00.000Z";

    it("moves pending -> approved and records decidedAt", () => {
      const outcome = applyApprovalDecision(pendingTask(), "approved", undefined, fixedNow);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.task.approvalStatus).toBe("approved");
        expect(outcome.task.approvalDecidedAt).toBe("2026-09-14T08:00:00.000Z");
        expect(outcome.task.approvalComment).toBeUndefined();
      }
    });

    it("moves pending -> rejected with a comment", () => {
      const outcome = applyApprovalDecision(pendingTask(), "rejected", "Needs more work", fixedNow);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.task.approvalStatus).toBe("rejected");
        expect(outcome.task.approvalComment).toBe("Needs more work");
      }
    });

    it("repeating the identical decision is idempotent and does not move decidedAt", () => {
      const decided = pendingTask({ approvalStatus: "approved", approvalComment: "ok", approvalDecidedAt: "2026-01-01T00:00:00.000Z" });
      const outcome = applyApprovalDecision(decided, "approved", "ok", fixedNow);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.task.approvalDecidedAt).toBe("2026-01-01T00:00:00.000Z");
        expect(outcome.task).toBe(decided);
      }
    });

    it("a different decision against a terminal state is a conflict and reports current approval", () => {
      const decided = pendingTask({ approvalStatus: "approved", approvalComment: "ok", approvalDecidedAt: "2026-01-01T00:00:00.000Z" });
      const outcome = applyApprovalDecision(decided, "rejected", "ok", fixedNow);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.currentApproval).toEqual({ status: "approved", comment: "ok", decidedAt: "2026-01-01T00:00:00.000Z" });
      }
    });

    it("a different comment against a terminal state is a conflict", () => {
      const decided = pendingTask({ approvalStatus: "approved", approvalComment: "ok", approvalDecidedAt: "2026-01-01T00:00:00.000Z" });
      const outcome = applyApprovalDecision(decided, "approved", "different comment", fixedNow);
      expect(outcome.ok).toBe(false);
    });
  });

  describe("findApprovalBlocker", () => {
    it("returns null when approval is not required", () => {
      expect(findApprovalBlocker({ requiresApproval: false })).toBeNull();
    });

    it("returns null when approved", () => {
      expect(findApprovalBlocker({ requiresApproval: true, approvalStatus: "approved" })).toBeNull();
    });

    it("blocks pending, rejected and missing status, naming the approver", () => {
      expect(findApprovalBlocker({ requiresApproval: true, approvalStatus: "pending", approver: "manager-a" })).toEqual({
        status: "pending",
        approver: "manager-a"
      });
      expect(findApprovalBlocker({ requiresApproval: true, approvalStatus: "rejected", approver: "manager-b" })).toEqual({
        status: "rejected",
        approver: "manager-b"
      });
      expect(findApprovalBlocker({ requiresApproval: true, approver: "manager-c" })).toEqual({
        status: "pending",
        approver: "manager-c"
      });
    });
  });
});
