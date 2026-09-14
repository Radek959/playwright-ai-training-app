import { describe, expect, it } from "vitest";
import {
  buildTasksSearchParams,
  isAssigneeFilterValid,
  parseAssigneeFilter,
  parseDueFilter,
  parsePage,
  parsePriorityFilter,
  parseSortDir,
  parseSortKey,
  parseStatusFilter,
  parseTab
} from "./tasksUrlState";
import type { User } from "../types";

const users: User[] = [
  { id: "u1", name: "Alice", email: "alice@example.com", role: "admin" },
  { id: "u2", name: "Bob", email: "bob@example.com", role: "editor" }
];

describe("parseTab", () => {
  it("accepts every known tab", () => {
    expect(parseTab("active")).toBe("active");
    expect(parseTab("grid")).toBe("grid");
    expect(parseTab("table")).toBe("table");
    expect(parseTab("archived")).toBe("archived");
    expect(parseTab("analytics")).toBe("analytics");
  });

  it("falls back to active for null, empty or unknown values", () => {
    expect(parseTab(null)).toBe("active");
    expect(parseTab("")).toBe("active");
    expect(parseTab("bogus")).toBe("active");
  });
});

describe("parseStatusFilter / parsePriorityFilter", () => {
  it("accepts known values", () => {
    expect(parseStatusFilter("todo")).toBe("todo");
    expect(parseStatusFilter("in-progress")).toBe("in-progress");
    expect(parsePriorityFilter("low")).toBe("low");
    expect(parsePriorityFilter("high")).toBe("high");
  });

  it("falls back to 'all' for null or unknown values", () => {
    expect(parseStatusFilter(null)).toBe("all");
    expect(parseStatusFilter("done")).toBe("all");
    expect(parsePriorityFilter(null)).toBe("all");
    expect(parsePriorityFilter("urgent")).toBe("all");
  });

  it("still does not accept status=done by default (the Active tab's rule)", () => {
    expect(parseStatusFilter("done")).toBe("all");
    expect(parseStatusFilter("done", false)).toBe("all");
  });

  it("accepts status=done when allowDone is set (the Table tab's rule)", () => {
    expect(parseStatusFilter("done", true)).toBe("done");
    expect(parseStatusFilter("todo", true)).toBe("todo");
    expect(parseStatusFilter("in-progress", true)).toBe("in-progress");
  });

  it("normalizes an unknown value to 'all' even with allowDone set", () => {
    expect(parseStatusFilter("bogus", true)).toBe("all");
  });
});

describe("parseAssigneeFilter", () => {
  it("passes through any non-empty value (validated separately)", () => {
    expect(parseAssigneeFilter("unassigned")).toBe("unassigned");
    expect(parseAssigneeFilter("u1")).toBe("u1");
  });

  it("falls back to 'all' for null or empty", () => {
    expect(parseAssigneeFilter(null)).toBe("all");
    expect(parseAssigneeFilter("")).toBe("all");
  });
});

describe("parseDueFilter", () => {
  it("accepts known values", () => {
    expect(parseDueFilter("overdue")).toBe("overdue");
    expect(parseDueFilter("soon")).toBe("soon");
  });

  it("falls back to 'all' for null or unknown values", () => {
    expect(parseDueFilter(null)).toBe("all");
    expect(parseDueFilter("")).toBe("all");
    expect(parseDueFilter("later")).toBe("all");
    expect(parseDueFilter("all")).toBe("all");
  });
});

describe("parsePage", () => {
  it("parses positive integers", () => {
    expect(parsePage("1")).toBe(1);
    expect(parsePage("42")).toBe(42);
  });

  it("falls back to 1 for missing, non-numeric, zero, negative or fractional values", () => {
    expect(parsePage(null)).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-3")).toBe(1);
    expect(parsePage("2.5")).toBe(1);
    expect(parsePage("")).toBe(1);
  });
});

describe("parseSortKey / parseSortDir", () => {
  it("accepts known sort keys and directions", () => {
    expect(parseSortKey("dueDate")).toBe("dueDate");
    expect(parseSortKey("assigneeId")).toBe("assigneeId");
    expect(parseSortDir("desc")).toBe("desc");
  });

  it("falls back to title/asc for null or unsupported values", () => {
    expect(parseSortKey(null)).toBe("title");
    expect(parseSortKey("bogus")).toBe("title");
    expect(parseSortDir(null)).toBe("asc");
    expect(parseSortDir("sideways")).toBe("asc");
  });
});

describe("isAssigneeFilterValid", () => {
  it("treats 'all' and 'unassigned' as always valid", () => {
    expect(isAssigneeFilterValid("all", [], true)).toBe(true);
    expect(isAssigneeFilterValid("unassigned", [], true)).toBe(true);
  });

  it("treats any id as valid while the user list has not finished loading", () => {
    expect(isAssigneeFilterValid("does-not-exist", [], false)).toBe(true);
  });

  it("validates a specific id against the loaded user list", () => {
    expect(isAssigneeFilterValid("u1", users, true)).toBe(true);
    expect(isAssigneeFilterValid("does-not-exist", users, true)).toBe(false);
  });
});

describe("buildTasksSearchParams", () => {
  it("omits every parameter at its default value for the active tab", () => {
    const params = buildTasksSearchParams({
      tab: "active",
      status: "all",
      priority: "all",
      assignee: "all",
      due: "all",
      page: 1,
      sortKey: "title",
      sortDir: "asc"
    });
    expect(params.toString()).toBe("");
  });

  it("serializes active-tab params in a fixed, deterministic order", () => {
    const params = buildTasksSearchParams({
      tab: "active",
      status: "in-progress",
      priority: "high",
      assignee: "u1",
      due: "overdue",
      page: 2,
      sortKey: "title",
      sortDir: "asc"
    });
    expect(params.toString()).toBe("status=in-progress&priority=high&assignee=u1&due=overdue&page=2");
  });

  it("includes the due filter alone when other active-tab params are default", () => {
    const params = buildTasksSearchParams({
      tab: "active",
      status: "all",
      priority: "all",
      assignee: "all",
      due: "soon",
      page: 1,
      sortKey: "title",
      sortDir: "asc"
    });
    expect(params.toString()).toBe("due=soon");
  });

  it("includes tab, status/priority/assignee, sort and order for the table tab, and drops due/page", () => {
    const params = buildTasksSearchParams({
      tab: "table",
      status: "todo",
      priority: "low",
      assignee: "u1",
      due: "overdue",
      page: 3,
      sortKey: "dueDate",
      sortDir: "desc"
    });
    expect(params.toString()).toBe("tab=table&status=todo&priority=low&assignee=u1&sort=dueDate&order=desc");
  });

  it("accepts status=done for the table tab", () => {
    const params = buildTasksSearchParams({
      tab: "table",
      status: "done",
      priority: "all",
      assignee: "all",
      due: "all",
      page: 1,
      sortKey: "title",
      sortDir: "asc"
    });
    expect(params.toString()).toBe("tab=table&status=done");
  });

  it("omits table-tab status/priority/assignee when all are at their default", () => {
    const params = buildTasksSearchParams({
      tab: "table",
      status: "all",
      priority: "all",
      assignee: "all",
      due: "all",
      page: 1,
      sortKey: "title",
      sortDir: "asc"
    });
    expect(params.toString()).toBe("tab=table");
  });

  it("includes only tab for grid/archived/analytics", () => {
    expect(
      buildTasksSearchParams({
        tab: "grid",
        status: "todo",
        priority: "low",
        assignee: "u1",
        due: "soon",
        page: 3,
        sortKey: "dueDate",
        sortDir: "desc"
      }).toString()
    ).toBe("tab=grid");

    expect(
      buildTasksSearchParams({
        tab: "archived",
        status: "all",
        priority: "all",
        assignee: "all",
        due: "all",
        page: 1,
        sortKey: "title",
        sortDir: "asc"
      }).toString()
    ).toBe("tab=archived");

    expect(
      buildTasksSearchParams({
        tab: "analytics",
        status: "all",
        priority: "all",
        assignee: "all",
        due: "all",
        page: 1,
        sortKey: "title",
        sortDir: "asc"
      }).toString()
    ).toBe("tab=analytics");
  });
});
