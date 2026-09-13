import { describe, expect, it } from "vitest";
import { buildTaskWizardPayload, TaskDraft } from "./taskWizardPayload";

describe("buildTaskWizardPayload", () => {
  const baseDraft: TaskDraft = {
    title: "New task",
    priority: "medium",
    status: "todo",
    taskType: "feature",
    assigneeId: "u1"
  };

  it("omits estimatedHours instead of sending 0 when the hours field was cleared", () => {
    const typed = buildTaskWizardPayload({ ...baseDraft, estimatedHours: 5 });
    expect(typed.estimatedHours).toBe(5);

    const cleared = buildTaskWizardPayload({ ...baseDraft, estimatedHours: undefined });
    expect(cleared.estimatedHours).toBeUndefined();
    expect("estimatedHours" in JSON.parse(JSON.stringify(cleared))).toBe(false);
  });

  it("omits dueDate instead of sending an empty string when the date field was cleared", () => {
    const typed = buildTaskWizardPayload({ ...baseDraft, dueDate: "2026-01-01" });
    expect(typed.dueDate).toBe("2026-01-01");

    const cleared = buildTaskWizardPayload({ ...baseDraft, dueDate: "" });
    expect(cleared.dueDate).toBeUndefined();
    expect("dueDate" in JSON.parse(JSON.stringify(cleared))).toBe(false);
  });

  it("passes through tags and dependencies typed by the user, and empty arrays once cleared", () => {
    const typed = buildTaskWizardPayload({ ...baseDraft, tags: ["backend", "urgent"], dependencies: ["task-1"] });
    expect(typed.tags).toEqual(["backend", "urgent"]);
    expect(typed.dependencies).toEqual(["task-1"]);

    const cleared = buildTaskWizardPayload({ ...baseDraft, tags: [], dependencies: [] });
    expect(cleared.tags).toEqual([]);
    expect(cleared.dependencies).toEqual([]);
  });

  it("drops a leftover approver once requiresApproval is turned back off", () => {
    const approved = buildTaskWizardPayload({ ...baseDraft, requiresApproval: true, approver: "manager-a" });
    expect(approved.requiresApproval).toBe(true);
    expect(approved.approver).toBe("manager-a");

    const unapproved = buildTaskWizardPayload({ ...baseDraft, requiresApproval: false, approver: "manager-a" });
    expect(unapproved.approver).toBeUndefined();
    expect("approver" in JSON.parse(JSON.stringify(unapproved))).toBe(false);
  });

  it("drops a leftover severity once the task type changes away from bug", () => {
    const bug = buildTaskWizardPayload({ ...baseDraft, taskType: "bug", severity: "critical" });
    expect(bug.severity).toBe("critical");

    const feature = buildTaskWizardPayload({ ...baseDraft, taskType: "feature", severity: "critical" });
    expect(feature.severity).toBeUndefined();
    expect("severity" in JSON.parse(JSON.stringify(feature))).toBe(false);
  });

  it("keeps correctly provided values unchanged", () => {
    const payload = buildTaskWizardPayload({
      ...baseDraft,
      taskType: "bug",
      severity: "major",
      dueDate: "2026-06-15",
      estimatedHours: 8,
      requiresApproval: true,
      approver: "manager-b",
      tags: ["frontend"],
      dependencies: ["task-2"]
    });

    expect(payload).toMatchObject({
      title: "New task",
      priority: "medium",
      status: "todo",
      taskType: "bug",
      severity: "major",
      dueDate: "2026-06-15",
      estimatedHours: 8,
      requiresApproval: true,
      approver: "manager-b",
      tags: ["frontend"],
      dependencies: ["task-2"]
    });
  });
});
