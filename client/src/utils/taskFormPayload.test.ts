import { describe, expect, it } from "vitest";
import { buildQuickTaskPayload } from "./taskFormPayload";

describe("buildQuickTaskPayload", () => {
  const baseValues = {
    title: "New task",
    description: "",
    status: "todo" as const,
    priority: "medium" as const,
    dueDate: "",
    assigneeId: ""
  };

  it("omits dueDate instead of sending an empty string when no date was picked", () => {
    const payload = buildQuickTaskPayload(baseValues);
    expect(payload.dueDate).toBeUndefined();
    expect("dueDate" in JSON.parse(JSON.stringify(payload))).toBe(false);
  });

  it("omits assigneeId instead of sending an empty string when no assignee was picked", () => {
    const payload = buildQuickTaskPayload(baseValues);
    expect(payload.assigneeId).toBeUndefined();
    expect("assigneeId" in JSON.parse(JSON.stringify(payload))).toBe(false);
  });

  it("passes through a populated dueDate and assigneeId unchanged", () => {
    const payload = buildQuickTaskPayload({
      ...baseValues,
      dueDate: "2026-01-01T00:00:00.000Z",
      assigneeId: "u1"
    });
    expect(payload.dueDate).toBe("2026-01-01T00:00:00.000Z");
    expect(payload.assigneeId).toBe("u1");
  });

  it("keeps title, description, status and priority as provided", () => {
    const payload = buildQuickTaskPayload({
      ...baseValues,
      title: "Fix bug",
      description: "Details",
      status: "in-progress",
      priority: "high"
    });
    expect(payload).toMatchObject({
      title: "Fix bug",
      description: "Details",
      status: "in-progress",
      priority: "high"
    });
  });
});
