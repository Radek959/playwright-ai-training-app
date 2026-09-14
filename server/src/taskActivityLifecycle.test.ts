import { describe, it, expect } from "vitest";
import {
  diffTaskChanges,
  recordTaskCreated,
  recordTaskUpdated,
  recordApprovalDecided,
  sortActivitiesForTask
} from "./taskActivityLifecycle.js";
import { Task, TaskActivity } from "./data.js";

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

  describe("sortActivitiesForTask", () => {
    const activityOf = (id: string, createdAt: string, taskId = "t1"): TaskActivity => ({
      id,
      taskId,
      type: "task_updated",
      changes: [],
      createdAt
    });

    it("sorts by createdAt descending when timestamps differ", () => {
      const activities = [
        activityOf("a1", "2020-01-01T00:00:00Z"),
        activityOf("a2", "2020-01-03T00:00:00Z"),
        activityOf("a3", "2020-01-02T00:00:00Z")
      ];
      expect(sortActivitiesForTask(activities, "t1").map((a) => a.id)).toEqual(["a2", "a3", "a1"]);
    });

    it("only returns activities for the requested task", () => {
      const activities = [
        activityOf("a1", "2020-01-01T00:00:00Z", "t1"),
        activityOf("a2", "2020-01-02T00:00:00Z", "t2"),
        activityOf("a3", "2020-01-03T00:00:00Z", "t1")
      ];
      expect(sortActivitiesForTask(activities, "t1").map((a) => a.id)).toEqual(["a3", "a1"]);
    });

    it("breaks createdAt ties by insertion order, not by id, and is deterministic across repeated calls", () => {
      // Ids are deliberately chosen so that id-based ordering (lexical or
      // otherwise) would disagree with insertion order — this catches a
      // regression to comparing ids (e.g. random UUIDs) as the tiebreaker.
      const tied = "2020-05-05T00:00:00Z";
      const activities = [
        activityOf("zzz-first-inserted", tied),
        activityOf("aaa-second-inserted", tied),
        activityOf("mmm-third-inserted", tied)
      ];

      const expected = ["mmm-third-inserted", "aaa-second-inserted", "zzz-first-inserted"];

      // Run multiple times against the same input to prove the result is
      // stable rather than coincidentally correct once.
      for (let i = 0; i < 10; i++) {
        expect(sortActivitiesForTask(activities, "t1").map((a) => a.id)).toEqual(expected);
      }
    });

    it("interleaves createdAt ordering and tie-break correctly across many activities", () => {
      const activities = [
        activityOf("older-1", "2020-01-01T00:00:00Z"),
        activityOf("tied-1", "2020-01-02T00:00:00Z"),
        activityOf("tied-2", "2020-01-02T00:00:00Z"),
        activityOf("older-2", "2020-01-01T00:00:00Z"),
        activityOf("tied-3", "2020-01-02T00:00:00Z"),
        activityOf("newest", "2020-01-03T00:00:00Z")
      ];

      expect(sortActivitiesForTask(activities, "t1").map((a) => a.id)).toEqual([
        "newest",
        "tied-3",
        "tied-2",
        "tied-1",
        "older-2",
        "older-1"
      ]);
    });
  });
});
