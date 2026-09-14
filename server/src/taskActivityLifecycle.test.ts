import { describe, it, expect } from "vitest";
import { diffTaskChanges, recordTaskCreated, recordTaskUpdated, recordApprovalDecided } from "./taskActivityLifecycle.js";
import { Task } from "./data.js";

describe("taskActivityLifecycle", () => {
  describe("diffTaskChanges", () => {
    it("returns empty array for identical objects", () => {
      const a = { title: "A", tags: ["1"] };
      const b = { title: "A", tags: ["1"] };
      expect(diffTaskChanges(a, b)).toEqual([]);
    });

    it("ignores id", () => {
      const a = { id: "1", title: "A" };
      const b = { id: "1", title: "A" };
      expect(diffTaskChanges(a, b)).toEqual([]);
    });

    it("records real changes", () => {
      const a = { title: "A", status: "todo", priority: "low" };
      const b = { title: "B", status: "in-progress", priority: "low" };
      const diff = diffTaskChanges(a, b);
      expect(diff).toEqual([
        { field: "status", before: "todo", after: "in-progress" },
        { field: "title", before: "A", after: "B" }
      ]);
    });

    it("compares arrays by content", () => {
      const a = { tags: ["a", "b"] };
      const b = { tags: ["a", "b"] };
      expect(diffTaskChanges(a, b)).toEqual([]);

      const c = { tags: ["a"] };
      expect(diffTaskChanges(a, c)).toEqual([
        { field: "tags", before: ["a", "b"], after: ["a"] }
      ]);
    });

    it("converts optional values to null", () => {
      const a = { title: "A", description: "desc" };
      const b = { title: "A" };
      expect(diffTaskChanges(a, b)).toEqual([
        { field: "description", before: "desc", after: null }
      ]);

      const c = { title: "A", description: null };
      expect(diffTaskChanges(a, c)).toEqual([
        { field: "description", before: "desc", after: null }
      ]);
    });
  });

  describe("recordTaskCreated", () => {
    it("creates a task_created event", () => {
      const task = { id: "t1" } as Task;
      const activity = recordTaskCreated(task, () => "a1", () => "2020-01-01T00:00:00Z");
      expect(activity).toEqual({
        id: "a1",
        taskId: "t1",
        type: "task_created",
        changes: [],
        createdAt: "2020-01-01T00:00:00Z"
      });
    });
  });

  describe("recordTaskUpdated", () => {
    it("returns null if no changes", () => {
      const a = { id: "t1", title: "A" };
      const b = { id: "t1", title: "A" };
      expect(recordTaskUpdated("t1", a, b)).toBeNull();
    });

    it("returns task_updated with changes", () => {
      const a = { id: "t1", title: "A" };
      const b = { id: "t1", title: "B" };
      const activity = recordTaskUpdated("t1", a, b, () => "a1", () => "2020-01-01T00:00:00Z");
      expect(activity).toEqual({
        id: "a1",
        taskId: "t1",
        type: "task_updated",
        changes: [{ field: "title", before: "A", after: "B" }],
        createdAt: "2020-01-01T00:00:00Z"
      });
    });
  });

  describe("recordApprovalDecided", () => {
    it("returns null if no changes", () => {
      const a = { id: "t1", approvalStatus: "pending" };
      const b = { id: "t1", approvalStatus: "pending" };
      expect(recordApprovalDecided("t1", a, b)).toBeNull();
    });

    it("returns approval_decided with changes", () => {
      const a = { id: "t1", approvalStatus: "pending" };
      const b = { id: "t1", approvalStatus: "approved" };
      const activity = recordApprovalDecided("t1", a, b, () => "a1", () => "2020-01-01T00:00:00Z");
      expect(activity).toEqual({
        id: "a1",
        taskId: "t1",
        type: "approval_decided",
        changes: [{ field: "approvalStatus", before: "pending", after: "approved" }],
        createdAt: "2020-01-01T00:00:00Z"
      });
    });
  });
});
