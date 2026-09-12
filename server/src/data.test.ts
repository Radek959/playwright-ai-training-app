import { describe, expect, it } from "vitest";
import { tasks, users } from "./data.js";
import { validateTaskFields, validateUserFields } from "./validation.js";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

describe("seed data", () => {
  it("has a reasonable, workshop-sized number of tasks", () => {
    expect(tasks.length).toBeGreaterThanOrEqual(12);
    expect(tasks.length).toBeLessThanOrEqual(15);
  });

  it("has unique task ids", () => {
    const ids = tasks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique user ids and emails", () => {
    const ids = users.map((u) => u.id);
    const emails = users.map((u) => u.email.toLowerCase());
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("passes the same field validation the API applies on create/update", () => {
    for (const task of tasks) {
      const { id: _id, coverImage: _coverImage, ...candidate } = task;
      const errors = validateTaskFields(candidate, { users, tasks, taskId: task.id });
      expect(errors, `task ${task.id} (${task.title}) failed validation: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it("passes the same field validation the API applies to users", () => {
    for (const user of users) {
      const { id: _id, avatarUrl: _avatarUrl, ...candidate } = user;
      const errors = validateUserFields(candidate, { users, userId: user.id });
      expect(errors, `user ${user.id} (${user.name}) failed validation: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it("only references assignees that exist among the seeded users", () => {
    for (const task of tasks) {
      if (!task.assigneeId) continue;
      expect(users.some((u) => u.id === task.assigneeId)).toBe(true);
    }
  });

  it("only references dependencies that exist among the seeded tasks, excluding self-references", () => {
    for (const task of tasks) {
      for (const depId of task.dependencies ?? []) {
        expect(depId).not.toBe(task.id);
        expect(tasks.some((t) => t.id === depId)).toBe(true);
      }
    }
  });

  it("covers every task status, priority and type at least once", () => {
    expect(new Set(tasks.map((t) => t.status))).toEqual(new Set(["todo", "in-progress", "done"]));
    expect(new Set(tasks.map((t) => t.priority))).toEqual(new Set(["low", "medium", "high"]));
    expect(new Set(tasks.map((t) => t.taskType))).toEqual(new Set(["feature", "bug", "research"]));
  });

  it("includes at least one unassigned task", () => {
    expect(tasks.some((t) => !t.assigneeId)).toBe(true);
  });

  describe("archive boundary (30 days since completion)", () => {
    const doneTasks = tasks.filter((t) => t.status === "done");

    it("has at least one completed task clearly before the 30 day threshold (not archived)", () => {
      const hasRecent = doneTasks.some((t) => {
        const time = new Date(t.completedAt as string).getTime();
        return Date.now() - time < THIRTY_DAYS_MS;
      });
      expect(hasRecent).toBe(true);
    });

    it("has at least one completed task clearly past the 30 day threshold (archived)", () => {
      const hasArchived = doneTasks.some((t) => {
        const time = new Date(t.completedAt as string).getTime();
        return Date.now() - time > THIRTY_DAYS_MS;
      });
      expect(hasArchived).toBe(true);
    });

    it("never places a completed task's age exactly on the 30 day boundary", () => {
      for (const task of doneTasks) {
        const time = new Date(task.completedAt as string).getTime();
        const age = Date.now() - time;
        expect(Math.abs(age - THIRTY_DAYS_MS)).toBeGreaterThan(60 * 60 * 1000);
      }
    });
  });
});
