import { describe, expect, it } from "vitest";
import { ApiError, toApiError } from "./apiError";

function jsonResponse(body: unknown, status = 400): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("toApiError", () => {
  it("parses a validation error with field-level details", async () => {
    const res = jsonResponse({
      error: "Validation failed",
      details: [
        { field: "title", message: "title must be at least 3 characters" },
        { field: "email", message: "email must be unique" }
      ]
    });

    const err = await toApiError(res, "fallback");

    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("title must be at least 3 characters; email must be unique");
    expect(err.details).toEqual([
      { field: "title", message: "title must be at least 3 characters" },
      { field: "email", message: "email must be unique" }
    ]);
    expect(err.blockingDependencies).toEqual([]);
    expect(err.conflictingTasks).toEqual([]);
  });

  it("parses a task-completion conflict with blockingDependencies", async () => {
    const res = jsonResponse(
      {
        error: "Cannot complete task with incomplete dependencies",
        blockingDependencies: [{ id: "t1", title: "Dep 1", status: "todo" }]
      },
      409
    );

    const err = await toApiError(res, "fallback");

    expect(err.message).toBe("Cannot complete task with incomplete dependencies: Dep 1 (todo)");
    expect(err.blockingDependencies).toEqual([{ id: "t1", title: "Dep 1", status: "todo" }]);
    expect(err.details).toEqual([]);
    expect(err.conflictingTasks).toEqual([]);
  });

  it("parses a user-deletion conflict with conflictingTasks, without appending the list to the message", async () => {
    const res = jsonResponse(
      {
        error: "Cannot delete user with active tasks",
        conflictingTasks: [
          { id: "task-1", title: "Task title", status: "in-progress" },
          { id: "task-2", title: "Another task", status: "todo" }
        ]
      },
      409
    );

    const err = await toApiError(res, "fallback");

    expect(err.message).toBe("Cannot delete user with active tasks");
    expect(err.conflictingTasks).toEqual([
      { id: "task-1", title: "Task title", status: "in-progress" },
      { id: "task-2", title: "Another task", status: "todo" }
    ]);
    expect(err.blockingDependencies).toEqual([]);
    expect(err.details).toEqual([]);
  });

  it("ignores malformed or incomplete entries instead of using them", async () => {
    const res = jsonResponse(
      {
        error: "Cannot delete user with active tasks",
        conflictingTasks: [
          { id: "task-1", title: "Valid task", status: "todo" },
          { id: "task-2", title: "Missing status" },
          "not-an-object",
          { title: "Missing id", status: "todo" },
          null
        ]
      },
      409
    );

    const err = await toApiError(res, "fallback");

    expect(err.conflictingTasks).toEqual([{ id: "task-1", title: "Valid task", status: "todo" }]);
  });

  it("rejects conflictingTasks entries with a disallowed or missing status (e.g. 'done')", async () => {
    const res = jsonResponse(
      {
        error: "Cannot delete user with active tasks",
        conflictingTasks: [
          { id: "task-1", title: "Still active", status: "todo" },
          { id: "task-2", title: "Already finished", status: "done" },
          { id: "task-3", title: "Made up status", status: "blocked" },
          { id: "task-4", title: "Empty status", status: "" }
        ]
      },
      409
    );

    const err = await toApiError(res, "fallback");

    expect(err.conflictingTasks).toEqual([{ id: "task-1", title: "Still active", status: "todo" }]);
  });

  it("falls back to the fallback message when the body has no usable error field", async () => {
    const res = jsonResponse({ somethingElse: true }, 500);

    const err = await toApiError(res, "fallback message");

    expect(err.message).toBe("fallback message");
    expect(err.details).toEqual([]);
    expect(err.blockingDependencies).toEqual([]);
    expect(err.conflictingTasks).toEqual([]);
  });

  it("falls back to the fallback message when the response body is not valid JSON", async () => {
    const res = new Response("not json at all", { status: 500 });

    const err = await toApiError(res, "fallback for unparseable body");

    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("fallback for unparseable body");
    expect(err.details).toEqual([]);
    expect(err.blockingDependencies).toEqual([]);
    expect(err.conflictingTasks).toEqual([]);
  });
});
