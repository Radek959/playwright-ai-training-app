import { describe, expect, it } from "vitest";
import {
  TASK_SEARCH_RESULT_LIMIT,
  searchTasks,
  type SearchableTask,
  type SearchableUser
} from "./taskSearch.js";

const task = (id: string, overrides: Partial<SearchableTask> = {}): SearchableTask => ({
  id,
  title: `Task ${id}`,
  ...overrides
});

const users: SearchableUser[] = [
  { id: "u1", name: "Alice Johnson" },
  { id: "u2", name: "Bob Smith" }
];

const idsOf = (results: SearchableTask[]) => results.map((t) => t.id);

describe("searchTasks matching", () => {
  it("matches on the title", () => {
    const tasks = [task("a", { title: "Fix the login bug" }), task("b", { title: "Write docs" })];
    expect(idsOf(searchTasks(tasks, "login"))).toEqual(["a"]);
  });

  it("matches on the description", () => {
    const tasks = [task("a", { title: "Unrelated", description: "Caused by a stale cache entry" }), task("b")];
    expect(idsOf(searchTasks(tasks, "stale cache"))).toEqual(["a"]);
  });

  it("matches on a tag", () => {
    const tasks = [task("a", { title: "Unrelated", tags: ["backend", "urgent"] }), task("b")];
    expect(idsOf(searchTasks(tasks, "urgent"))).toEqual(["a"]);
  });

  it("matches on the assigned user's name", () => {
    const tasks = [task("a", { title: "Unrelated", assigneeId: "u1" }), task("b", { assigneeId: "u2" })];
    expect(idsOf(searchTasks(tasks, "johnson", users))).toEqual(["a"]);
  });

  it("does not match an assignee name when no users are supplied", () => {
    const tasks = [task("a", { title: "Unrelated", assigneeId: "u1" })];
    expect(searchTasks(tasks, "johnson")).toEqual([]);
  });

  it("ignores an assigneeId that does not resolve to a user", () => {
    const tasks = [task("a", { title: "Unrelated", assigneeId: "ghost" })];
    expect(searchTasks(tasks, "johnson", users)).toEqual([]);
  });

  it("is case-insensitive across every searched field", () => {
    const tasks = [
      task("title", { title: "LOGIN screen" }),
      task("desc", { title: "Unrelated one", description: "The LOGIN flow" }),
      task("tag", { title: "Unrelated two", tags: ["LOGIN"] }),
      task("assignee", { title: "Unrelated three", assigneeId: "u1" })
    ];
    expect(idsOf(searchTasks(tasks, "LoGiN", users))).toEqual(["title", "desc", "tag"]);
    expect(idsOf(searchTasks(tasks, "ALICE", users))).toEqual(["assignee"]);
  });

  it("ignores leading and trailing whitespace in the query", () => {
    const tasks = [task("a", { title: "Fix the login bug" })];
    expect(idsOf(searchTasks(tasks, "   login   "))).toEqual(["a"]);
    expect(searchTasks(tasks, "   login   ")).toEqual(searchTasks(tasks, "login"));
  });

  it("still matches an inner space, which is not trimmed away", () => {
    const tasks = [task("a", { title: "Fix the login bug" }), task("b", { title: "loginbug" })];
    expect(idsOf(searchTasks(tasks, "login bug"))).toEqual(["a"]);
  });

  it("returns nothing for an empty or whitespace-only query", () => {
    const tasks = [task("a", { title: "Anything" })];
    expect(searchTasks(tasks, "")).toEqual([]);
    expect(searchTasks(tasks, "    ")).toEqual([]);
  });

  it("returns nothing for a query shorter than two characters after trimming", () => {
    const tasks = [task("a", { title: "Anything" })];
    expect(searchTasks(tasks, "a")).toEqual([]);
    expect(searchTasks(tasks, "  a  ")).toEqual([]);
  });

  it("searches tasks of every status, including done ones", () => {
    const tasks = [task("a", { title: "Archived login work" }), task("b", { title: "Active login work" })];
    expect(idsOf(searchTasks(tasks, "login"))).toEqual(["a", "b"]);
  });

  it("returns an empty array rather than throwing when there are no tasks", () => {
    expect(searchTasks([], "login")).toEqual([]);
  });
});

describe("searchTasks deduplication", () => {
  it("returns a task matching several fields at once only once", () => {
    const tasks = [
      task("a", { title: "login", description: "login again", tags: ["login"], assigneeId: "u1" }),
      task("b", { title: "Other" })
    ];
    const results = searchTasks(tasks, "login", [{ id: "u1", name: "login person" }]);
    expect(idsOf(results)).toEqual(["a"]);
  });
});

describe("searchTasks ordering", () => {
  it("ranks exact title, title prefix, other title match, then other fields", () => {
    const tasks = [
      task("otherField", { title: "Nothing here", description: "mentions bug" }),
      task("titleOther", { title: "Fix the bug today" }),
      task("titlePrefix", { title: "bug in the parser" }),
      task("exact", { title: "bug" })
    ];
    expect(idsOf(searchTasks(tasks, "bug"))).toEqual(["exact", "titlePrefix", "titleOther", "otherField"]);
  });

  it("treats an exact title match as exact regardless of case or query padding", () => {
    const tasks = [task("prefix", { title: "BUGGY behaviour" }), task("exact", { title: "BUG" })];
    expect(idsOf(searchTasks(tasks, "  bug  "))).toEqual(["exact", "prefix"]);
  });

  it("breaks ties by the task's position in the input, keeping the order stable", () => {
    const tasks = [task("first", { title: "bug one" }), task("second", { title: "bug two" })];
    expect(idsOf(searchTasks(tasks, "bug"))).toEqual(["first", "second"]);
  });

  it("returns the same result for the same input every time", () => {
    const tasks = [
      task("a", { title: "bug report", description: "bug" }),
      task("b", { title: "Nothing", tags: ["bug"] }),
      task("c", { title: "bug" })
    ];
    const first = idsOf(searchTasks(tasks, "bug"));
    expect(idsOf(searchTasks(tasks, "bug"))).toEqual(first);
    expect(first).toEqual(["c", "a", "b"]);
  });

  it("does not mutate or reorder the array it is given", () => {
    const tasks = [task("a", { title: "zzz bug" }), task("b", { title: "bug" })];
    const snapshot = [...tasks];
    searchTasks(tasks, "bug");
    expect(tasks).toEqual(snapshot);
    expect(tasks[0].id).toBe("a");
  });
});

describe("searchTasks result cap", () => {
  it(`returns at most ${TASK_SEARCH_RESULT_LIMIT} results`, () => {
    const tasks = Array.from({ length: 25 }, (_, i) => task(`t${i}`, { title: `bug number ${i}` }));
    expect(searchTasks(tasks, "bug")).toHaveLength(TASK_SEARCH_RESULT_LIMIT);
  });

  it("caps after ranking, so the best matches survive the cut", () => {
    const lowRanked = Array.from({ length: 15 }, (_, i) =>
      task(`low${i}`, { title: `Nothing ${i}`, description: "bug" })
    );
    const exact = task("exact", { title: "bug" });
    const results = searchTasks([...lowRanked, exact], "bug");

    expect(results).toHaveLength(TASK_SEARCH_RESULT_LIMIT);
    expect(results[0].id).toBe("exact");
  });
});
