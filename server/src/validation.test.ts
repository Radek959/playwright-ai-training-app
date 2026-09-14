import { describe, expect, it } from "vitest";
import { buildTaskCreateCandidate, buildUserCreateCandidate, validateTaskFields, validateUserFields } from "./validation.js";
import { Task, User } from "./data.js";

const baseUsers: User[] = [
  { id: "u1", name: "Alice", email: "alice@example.com", role: "admin" },
  { id: "u2", name: "Bob", email: "bob@example.com", role: "editor" }
];

const baseTasks: Task[] = [
  { id: "t1", title: "Existing task", status: "todo", priority: "low" },
  { id: "t2", title: "Another task", status: "todo", priority: "low" }
];

const validTask = (overrides: Record<string, unknown> = {}) => ({
  title: "A valid task title",
  status: "todo",
  priority: "medium",
  ...overrides
});

describe("validateTaskFields", () => {
  it("accepts a minimal valid task", () => {
    expect(validateTaskFields(validTask(), { users: baseUsers, tasks: baseTasks })).toEqual([]);
  });

  it("rejects a missing title", () => {
    const errors = validateTaskFields(validTask({ title: undefined }), { users: baseUsers, tasks: baseTasks });
    expect(errors).toContainEqual({ field: "title", message: "title is required" });
  });

  it("rejects a non-string title (runtime type check)", () => {
    const errors = validateTaskFields(validTask({ title: 123 }), { users: baseUsers, tasks: baseTasks });
    expect(errors).toContainEqual({ field: "title", message: "title must be a string" });
  });

  it("rejects a title shorter than 3 characters", () => {
    const errors = validateTaskFields(validTask({ title: "ab" }), { users: baseUsers, tasks: baseTasks });
    expect(errors).toContainEqual({ field: "title", message: "title must be at least 3 characters" });
  });

  it("rejects an invalid status enum value", () => {
    const errors = validateTaskFields(validTask({ status: "blocked" }), { users: baseUsers, tasks: baseTasks });
    expect(errors).toContainEqual({ field: "status", message: "invalid status" });
  });

  it("rejects an invalid priority enum value", () => {
    const errors = validateTaskFields(validTask({ priority: "urgent" }), { users: baseUsers, tasks: baseTasks });
    expect(errors).toContainEqual({ field: "priority", message: "invalid priority" });
  });

  it("rejects an invalid taskType enum value", () => {
    const errors = validateTaskFields(validTask({ taskType: "chore" }), { users: baseUsers, tasks: baseTasks });
    expect(errors).toContainEqual({ field: "taskType", message: "invalid taskType" });
  });

  it("rejects an invalid severity enum value", () => {
    const errors = validateTaskFields(validTask({ severity: "extreme" }), { users: baseUsers, tasks: baseTasks });
    expect(errors).toContainEqual({ field: "severity", message: "invalid severity" });
  });

  describe("assignee", () => {
    it("accepts an assigneeId referencing an existing user", () => {
      const errors = validateTaskFields(validTask({ assigneeId: "u1" }), { users: baseUsers, tasks: baseTasks });
      expect(errors).toEqual([]);
    });

    it("rejects an assigneeId that does not reference an existing user", () => {
      const errors = validateTaskFields(validTask({ assigneeId: "ghost" }), { users: baseUsers, tasks: baseTasks });
      expect(errors).toContainEqual({
        field: "assigneeId",
        message: "assigneeId does not reference an existing user"
      });
    });

    it("rejects a non-string assigneeId", () => {
      const errors = validateTaskFields(validTask({ assigneeId: 42 }), { users: baseUsers, tasks: baseTasks });
      expect(errors).toContainEqual({ field: "assigneeId", message: "assigneeId must be a string" });
    });

    it("accepts a null assigneeId", () => {
      const errors = validateTaskFields(validTask({ assigneeId: null }), { users: baseUsers, tasks: baseTasks });
      expect(errors).toEqual([]);
    });
  });

  describe("dependencies", () => {
    it("accepts dependencies referencing existing tasks", () => {
      const errors = validateTaskFields(validTask({ dependencies: ["t1"] }), { users: baseUsers, tasks: baseTasks });
      expect(errors).toEqual([]);
    });

    it("rejects a dependency id that does not reference an existing task", () => {
      const errors = validateTaskFields(validTask({ dependencies: ["ghost"] }), {
        users: baseUsers,
        tasks: baseTasks
      });
      expect(errors).toContainEqual({ field: "dependencies", message: "unknown dependency ids: ghost" });
    });

    it("rejects a task depending on itself", () => {
      const errors = validateTaskFields(validTask({ dependencies: ["t1"] }), {
        users: baseUsers,
        tasks: baseTasks,
        taskId: "t1"
      });
      expect(errors).toContainEqual({ field: "dependencies", message: "unknown dependency ids: t1" });
    });

    it("rejects a non-array-of-strings dependencies value", () => {
      const errors = validateTaskFields(validTask({ dependencies: [1, 2] }), { users: baseUsers, tasks: baseTasks });
      expect(errors).toContainEqual({ field: "dependencies", message: "dependencies must be an array of strings" });
    });
  });

  describe("business rules", () => {
    it("requires a severity on bug tasks", () => {
      const errors = validateTaskFields(validTask({ taskType: "bug" }), { users: baseUsers, tasks: baseTasks });
      expect(errors).toContainEqual({ field: "severity", message: "bug tasks require a severity" });
    });

    it("accepts a bug task with a severity", () => {
      const errors = validateTaskFields(validTask({ taskType: "bug", severity: "minor" }), {
        users: baseUsers,
        tasks: baseTasks
      });
      expect(errors).toEqual([]);
    });

    // The conditional rules only work in one direction. This is the actual
    // contract Swagger documents: clearing a leftover severity/approver is a
    // client-side convenience, never something the API demands.
    it("accepts a severity on a task whose type is not bug", () => {
      const errors = validateTaskFields(validTask({ taskType: "feature", severity: "major" }), {
        users: baseUsers,
        tasks: baseTasks
      });
      expect(errors).toEqual([]);
    });

    it("accepts a severity on a task with no taskType at all", () => {
      const errors = validateTaskFields(validTask({ severity: "critical" }), { users: baseUsers, tasks: baseTasks });
      expect(errors).toEqual([]);
    });

    it("accepts an approver while requiresApproval is false", () => {
      const errors = validateTaskFields(validTask({ requiresApproval: false, approver: "manager-a" }), {
        users: baseUsers,
        tasks: baseTasks
      });
      expect(errors).toEqual([]);
    });

    it("requires estimatedHours >= 1 on research tasks", () => {
      const errors = validateTaskFields(validTask({ taskType: "research" }), { users: baseUsers, tasks: baseTasks });
      expect(errors).toContainEqual({
        field: "estimatedHours",
        message: "research tasks require estimatedHours >= 1"
      });
    });

    it("rejects a research task with estimatedHours below 1", () => {
      const errors = validateTaskFields(validTask({ taskType: "research", estimatedHours: 0.5 }), {
        users: baseUsers,
        tasks: baseTasks
      });
      expect(errors).toContainEqual({
        field: "estimatedHours",
        message: "research tasks require estimatedHours >= 1"
      });
    });

    it("accepts a research task with estimatedHours >= 1", () => {
      const errors = validateTaskFields(validTask({ taskType: "research", estimatedHours: 1 }), {
        users: baseUsers,
        tasks: baseTasks
      });
      expect(errors).toEqual([]);
    });

    it("rejects a high priority task with estimatedHours over 24", () => {
      const errors = validateTaskFields(validTask({ priority: "high", estimatedHours: 25 }), {
        users: baseUsers,
        tasks: baseTasks
      });
      expect(errors).toContainEqual({
        field: "estimatedHours",
        message: "high priority tasks cannot exceed 24 estimated hours"
      });
    });

    it("accepts a high priority task with estimatedHours at the 24 hour boundary", () => {
      const errors = validateTaskFields(validTask({ priority: "high", estimatedHours: 24 }), {
        users: baseUsers,
        tasks: baseTasks
      });
      expect(errors).toEqual([]);
    });

    it("requires an approver when requiresApproval is true", () => {
      const errors = validateTaskFields(validTask({ requiresApproval: true }), {
        users: baseUsers,
        tasks: baseTasks
      });
      expect(errors).toContainEqual({ field: "approver", message: "requiresApproval requires an approver" });
    });

    it("accepts requiresApproval true with a non-empty approver", () => {
      const errors = validateTaskFields(validTask({ requiresApproval: true, approver: "manager-a" }), {
        users: baseUsers,
        tasks: baseTasks
      });
      expect(errors).toEqual([]);
    });

    it("still requires an approver when it is only whitespace", () => {
      const errors = validateTaskFields(validTask({ requiresApproval: true, approver: "   " }), {
        users: baseUsers,
        tasks: baseTasks
      });
      expect(errors).toContainEqual({ field: "approver", message: "requiresApproval requires an approver" });
    });
  });

  describe("completedAt", () => {
    it("accepts a valid completedAt date string", () => {
      const errors = validateTaskFields(validTask({ completedAt: "2026-01-01T00:00:00.000Z" }), {
        users: baseUsers,
        tasks: baseTasks
      });
      expect(errors).toEqual([]);
    });

    it("accepts a missing completedAt", () => {
      const errors = validateTaskFields(validTask(), { users: baseUsers, tasks: baseTasks });
      expect(errors).toEqual([]);
    });

    it("rejects a non-string completedAt, e.g. a number", () => {
      const errors = validateTaskFields(validTask({ completedAt: 123 }), { users: baseUsers, tasks: baseTasks });
      expect(errors).toContainEqual({ field: "completedAt", message: "invalid completedAt" });
    });

    it("rejects an explicit null completedAt", () => {
      const errors = validateTaskFields(validTask({ completedAt: null }), { users: baseUsers, tasks: baseTasks });
      expect(errors).toContainEqual({ field: "completedAt", message: "completedAt cannot be null" });
    });

    it("rejects an unparseable completedAt string", () => {
      const errors = validateTaskFields(validTask({ completedAt: "not-a-date" }), {
        users: baseUsers,
        tasks: baseTasks
      });
      expect(errors).toContainEqual({ field: "completedAt", message: "invalid completedAt" });
    });
  });
});

describe("buildTaskCreateCandidate", () => {
  it("defaults status, priority, tags, dependencies and requiresApproval when the field is missing", () => {
    const candidate = buildTaskCreateCandidate({ title: "A task" });
    expect(candidate.status).toBe("todo");
    expect(candidate.priority).toBe("medium");
    expect(candidate.tags).toEqual([]);
    expect(candidate.dependencies).toEqual([]);
    expect(candidate.requiresApproval).toBe(false);
  });

  it("does not default an explicit null; the field is left null for validation to reject", () => {
    const candidate = buildTaskCreateCandidate({
      title: "A task",
      status: null,
      tags: null,
      requiresApproval: null
    });
    expect(candidate.status).toBeNull();
    expect(candidate.tags).toBeNull();
    expect(candidate.requiresApproval).toBeNull();
  });

  it("rejects a request where defaultable fields were explicitly null", () => {
    const candidate = buildTaskCreateCandidate({
      title: "A task",
      status: null,
      tags: null,
      requiresApproval: null
    });
    const errors = validateTaskFields(candidate, { users: baseUsers, tasks: baseTasks });
    expect(errors).toContainEqual({ field: "status", message: "invalid status" });
    expect(errors).toContainEqual({ field: "tags", message: "tags must be an array of strings" });
    expect(errors).toContainEqual({ field: "requiresApproval", message: "requiresApproval must be a boolean" });
  });

  it("passes completedAt through unvalidated for validateTaskFields to check", () => {
    const candidate = buildTaskCreateCandidate({ title: "A task", completedAt: 123 });
    const errors = validateTaskFields(candidate, { users: baseUsers, tasks: baseTasks });
    expect(errors).toContainEqual({ field: "completedAt", message: "invalid completedAt" });
  });
});

const validUser = (overrides: Record<string, unknown> = {}) => ({
  name: "New User",
  email: "new.user@example.com",
  ...overrides
});

describe("validateUserFields", () => {
  it("accepts a minimal valid user", () => {
    expect(validateUserFields(validUser(), { users: baseUsers })).toEqual([]);
  });

  it("rejects a missing name", () => {
    const errors = validateUserFields(validUser({ name: undefined }), { users: baseUsers });
    expect(errors).toContainEqual({ field: "name", message: "name is required" });
  });

  it("rejects a non-string name (runtime type check)", () => {
    const errors = validateUserFields(validUser({ name: 123 }), { users: baseUsers });
    expect(errors).toContainEqual({ field: "name", message: "name must be a string" });
  });

  it("rejects a blank name", () => {
    const errors = validateUserFields(validUser({ name: "   " }), { users: baseUsers });
    expect(errors).toContainEqual({ field: "name", message: "name is required" });
  });

  it("rejects a missing email", () => {
    const errors = validateUserFields(validUser({ email: undefined }), { users: baseUsers });
    expect(errors).toContainEqual({ field: "email", message: "email is required" });
  });

  it("rejects a non-string email (runtime type check)", () => {
    const errors = validateUserFields(validUser({ email: 123 }), { users: baseUsers });
    expect(errors).toContainEqual({ field: "email", message: "email must be a string" });
  });

  it("rejects a malformed email", () => {
    const errors = validateUserFields(validUser({ email: "not-an-email" }), { users: baseUsers });
    expect(errors).toContainEqual({ field: "email", message: "email must be a valid email address" });
  });

  describe("uniqueness", () => {
    it("rejects an email already used by another user", () => {
      const errors = validateUserFields(validUser({ email: "alice@example.com" }), { users: baseUsers });
      expect(errors).toContainEqual({ field: "email", message: "email is already in use" });
    });

    it("is case-insensitive when checking for duplicate emails", () => {
      const errors = validateUserFields(validUser({ email: "ALICE@EXAMPLE.COM" }), { users: baseUsers });
      expect(errors).toContainEqual({ field: "email", message: "email is already in use" });
    });

    it("allows a user to keep their own email when updating", () => {
      const errors = validateUserFields(validUser({ email: "alice@example.com" }), {
        users: baseUsers,
        userId: "u1"
      });
      expect(errors).toEqual([]);
    });
  });

  describe("role", () => {
    it("accepts a valid role", () => {
      const errors = validateUserFields(validUser({ role: "viewer" }), { users: baseUsers });
      expect(errors).toEqual([]);
    });

    it("rejects an invalid role", () => {
      const errors = validateUserFields(validUser({ role: "superadmin" }), { users: baseUsers });
      expect(errors).toContainEqual({ field: "role", message: "invalid role" });
    });
  });
});

describe("buildUserCreateCandidate", () => {
  it("defaults role to viewer when the field is missing", () => {
    const candidate = buildUserCreateCandidate({ name: "New User", email: "new.user@example.com" });
    expect(candidate.role).toBe("viewer");
  });

  it("does not default an explicit null role", () => {
    const candidate = buildUserCreateCandidate({ name: "New User", email: "new.user@example.com", role: null });
    expect(candidate.role).toBeNull();
  });

  it("rejects a request where role was explicitly null instead of defaulting it", () => {
    const candidate = buildUserCreateCandidate({ name: "New User", email: "new.user@example.com", role: null });
    const errors = validateUserFields(candidate, { users: baseUsers });
    expect(errors).toContainEqual({ field: "role", message: "invalid role" });
  });
});
