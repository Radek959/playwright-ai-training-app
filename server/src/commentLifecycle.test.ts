import { describe, expect, it } from "vitest";
import { buildComment, clearCommentAuthor, removeCommentsForTask, sortComments } from "./commentLifecycle.js";
import { Comment } from "./data.js";

describe("buildComment", () => {
  it("uses the injected clock and id generator instead of the real ones", () => {
    const comment = buildComment(
      { taskId: "t1", authorId: "u1", authorName: "Alice Johnson", content: "hi" },
      () => "2026-01-01T00:00:00.000Z",
      () => "fixed-id"
    );
    expect(comment).toEqual({
      id: "fixed-id",
      taskId: "t1",
      content: "hi",
      authorId: "u1",
      authorName: "Alice Johnson",
      createdAt: "2026-01-01T00:00:00.000Z"
    });
  });
});

describe("sortComments", () => {
  const comment = (id: string, createdAt: string): Comment => ({
    id,
    taskId: "t1",
    content: "content",
    authorId: "u1",
    authorName: "Alice Johnson",
    createdAt
  });

  it("orders oldest to newest", () => {
    const input = [comment("b", "2026-01-02T00:00:00.000Z"), comment("a", "2026-01-01T00:00:00.000Z")];
    expect(sortComments(input).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("breaks ties on identical createdAt by id, deterministically regardless of input order", () => {
    const tied = "2026-01-01T00:00:00.000Z";
    const forward = [comment("a", tied), comment("b", tied)];
    const backward = [comment("b", tied), comment("a", tied)];
    expect(sortComments(forward).map((c) => c.id)).toEqual(["a", "b"]);
    expect(sortComments(backward).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the input array", () => {
    const input = [comment("b", "2026-01-02T00:00:00.000Z"), comment("a", "2026-01-01T00:00:00.000Z")];
    const originalOrder = input.map((c) => c.id);
    sortComments(input);
    expect(input.map((c) => c.id)).toEqual(originalOrder);
  });
});

describe("removeCommentsForTask", () => {
  it("removes only the comments belonging to the given task, in place", () => {
    const comments: Comment[] = [
      { id: "c1", taskId: "t1", content: "a", authorId: "u1", authorName: "Alice", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "c2", taskId: "t2", content: "b", authorId: "u1", authorName: "Alice", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "c3", taskId: "t1", content: "c", authorId: "u2", authorName: "Bob", createdAt: "2026-01-01T00:00:00.000Z" }
    ];
    removeCommentsForTask(comments, "t1");
    expect(comments.map((c) => c.id)).toEqual(["c2"]);
  });

  it("is a no-op when the task has no comments", () => {
    const comments: Comment[] = [
      { id: "c1", taskId: "t2", content: "a", authorId: "u1", authorName: "Alice", createdAt: "2026-01-01T00:00:00.000Z" }
    ];
    removeCommentsForTask(comments, "t1");
    expect(comments).toHaveLength(1);
  });
});

describe("clearCommentAuthor", () => {
  it("clears authorId on comments by the given user while keeping authorName and everything else", () => {
    const comments: Comment[] = [
      { id: "c1", taskId: "t1", content: "a", authorId: "u1", authorName: "Alice Johnson", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "c2", taskId: "t1", content: "b", authorId: "u2", authorName: "Bob Smith", createdAt: "2026-01-01T00:00:00.000Z" }
    ];
    clearCommentAuthor(comments, "u1");
    expect(comments[0].authorId).toBeUndefined();
    expect(comments[0].authorName).toBe("Alice Johnson");
    expect(comments[0].content).toBe("a");
    expect(comments[1].authorId).toBe("u2");
  });

  it("is a no-op for comments already without an author, or by a different user", () => {
    const comments: Comment[] = [
      { id: "c1", taskId: "t1", content: "a", authorName: "Former Team Member", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "c2", taskId: "t1", content: "b", authorId: "u2", authorName: "Bob Smith", createdAt: "2026-01-01T00:00:00.000Z" }
    ];
    clearCommentAuthor(comments, "u1");
    expect(comments[0].authorId).toBeUndefined();
    expect(comments[1].authorId).toBe("u2");
  });
});
