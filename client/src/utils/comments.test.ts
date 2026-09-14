import { describe, expect, it } from "vitest";
import { sortComments } from "./comments";
import type { Comment } from "../types";

const comment = (id: string, createdAt: string): Comment => ({
  id,
  taskId: "t1",
  content: "content",
  authorId: "u1",
  authorName: "Alice Johnson",
  createdAt
});

describe("sortComments", () => {
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
