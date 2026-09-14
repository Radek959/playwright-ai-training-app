import { describe, expect, it } from "vitest";
import {
  buildTaskCreatePayload,
  buildTaskUpdatePayload,
  emptyTaskFormValues,
  taskToFormValues,
  toDateInputValue,
  validateTaskForm,
  type TaskFormValues
} from "./taskFormModel";
import type { Task } from "../types";

const createValues = (overrides: Partial<TaskFormValues> = {}): TaskFormValues => ({
  ...emptyTaskFormValues(),
  title: "New task",
  priority: "medium",
  taskType: "feature",
  assigneeId: "u1",
  ...overrides
});

const fullTask: Task = {
  id: "t1",
  title: "Existing task",
  description: "Existing description",
  status: "in-progress",
  priority: "high",
  dueDate: "2026-05-01T00:00:00.000Z",
  assigneeId: "u1",
  taskType: "bug",
  estimatedHours: 8,
  tags: ["backend", "urgent"],
  dependencies: ["t2"],
  severity: "critical",
  requiresApproval: true,
  approver: "manager-a"
};

describe("taskToFormValues", () => {
  it("pre-fills every editable field, including the extended ones", () => {
    expect(taskToFormValues(fullTask)).toEqual({
      title: "Existing task",
      description: "Existing description",
      status: "in-progress",
      priority: "high",
      dueDate: "2026-05-01",
      assigneeId: "u1",
      taskType: "bug",
      severity: "critical",
      estimatedHours: "8",
      tags: ["backend", "urgent"],
      dependencies: ["t2"],
      requiresApproval: true,
      approver: "manager-a"
    });
  });

  it("renders unset optional fields as empty form values", () => {
    const values = taskToFormValues({ id: "t9", title: "Bare", status: "todo", priority: "low" });
    expect(values).toMatchObject({
      description: "",
      dueDate: "",
      assigneeId: "",
      taskType: "",
      severity: "",
      estimatedHours: "",
      tags: [],
      dependencies: [],
      requiresApproval: false,
      approver: ""
    });
  });
});

describe("toDateInputValue", () => {
  it("keeps the UTC calendar day of an ISO timestamp", () => {
    expect(toDateInputValue("2026-05-01T00:00:00.000Z")).toBe("2026-05-01");
    expect(toDateInputValue("2026-05-01")).toBe("2026-05-01");
  });

  it("uses the UTC day for an offset date, matching the due-date classification", () => {
    // 2026-05-01T23:30-05:00 is 2026-05-02T04:30Z — the UTC day is the 2nd.
    expect(toDateInputValue("2026-05-01T23:30:00-05:00")).toBe("2026-05-02");
    // 2026-05-02T01:00+05:00 is 2026-05-01T20:00Z — the UTC day is the 1st.
    expect(toDateInputValue("2026-05-02T01:00:00+05:00")).toBe("2026-05-01");
  });

  it("converts a valid date that contains no 'T' instead of showing it raw", () => {
    expect(toDateInputValue("May 1, 2026 00:00:00 GMT")).toBe("2026-05-01");
    expect(toDateInputValue("Fri, 01 May 2026 12:00:00 GMT")).toBe("2026-05-01");
    // A date with no timezone at all is resolved against the local zone and
    // then reduced to its UTC day (the app-wide convention), so only the
    // shape is asserted here — never the raw, unusable input string.
    expect(toDateInputValue("May 1, 2026")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns an empty string for an unparsable or missing value without throwing", () => {
    expect(toDateInputValue("not a date")).toBe("");
    expect(toDateInputValue("")).toBe("");
    expect(toDateInputValue(undefined)).toBe("");
  });
});

describe("validateTaskForm", () => {
  it("requires at least 3 characters after trimming the title, exactly like the API", () => {
    expect(validateTaskForm(createValues({ title: " ab " }), { mode: "create" }).title).toBe(
      "Title must be at least 3 characters"
    );
    expect(validateTaskForm(createValues({ title: " abc " }), { mode: "create" }).title).toBeUndefined();
  });

  it("rejects a non-positive estimate and accepts a fractional one (the API rule)", () => {
    expect(validateTaskForm(createValues({ estimatedHours: "0" }), { mode: "create" }).estimatedHours).toBe(
      "Estimated hours must be a positive number"
    );
    expect(validateTaskForm(createValues({ estimatedHours: "-2" }), { mode: "create" }).estimatedHours).toBe(
      "Estimated hours must be a positive number"
    );
    expect(validateTaskForm(createValues({ estimatedHours: "0.5" }), { mode: "create" }).estimatedHours).toBeUndefined();
  });

  it("requires an estimate of at least 1 hour for research tasks", () => {
    expect(validateTaskForm(createValues({ taskType: "research" }), { mode: "create" }).estimatedHours).toBe(
      "Research tasks require a time estimate of at least 1 hour"
    );
    expect(
      validateTaskForm(createValues({ taskType: "research", estimatedHours: "0.5" }), { mode: "create" }).estimatedHours
    ).toBe("Research tasks require a time estimate of at least 1 hour");
    expect(
      validateTaskForm(createValues({ taskType: "research", estimatedHours: "2" }), { mode: "create" }).estimatedHours
    ).toBeUndefined();
  });

  it("requires a severity for bugs", () => {
    expect(validateTaskForm(createValues({ taskType: "bug" }), { mode: "create" }).severity).toBe(
      "Bugs require a severity level"
    );
    expect(
      validateTaskForm(createValues({ taskType: "bug", severity: "minor" }), { mode: "create" }).severity
    ).toBeUndefined();
  });

  it("caps high priority tasks at 24 estimated hours", () => {
    expect(
      validateTaskForm(createValues({ priority: "high", estimatedHours: "25" }), { mode: "create" }).estimatedHours
    ).toBe("High priority tasks cannot exceed 24h");
    expect(
      validateTaskForm(createValues({ priority: "high", estimatedHours: "24" }), { mode: "create" }).estimatedHours
    ).toBeUndefined();
  });

  it("requires an approver when approval is required", () => {
    expect(validateTaskForm(createValues({ requiresApproval: true }), { mode: "create" }).approver).toBe(
      "Select an approver"
    );
    expect(
      validateTaskForm(createValues({ requiresApproval: true, approver: "manager-b" }), { mode: "create" }).approver
    ).toBeUndefined();
  });

  it("rejects dependencies that do not exist or point at the task itself", () => {
    const options = { mode: "edit" as const, availableTaskIds: ["t1", "t2"], currentTaskId: "t1" };
    expect(validateTaskForm(createValues({ dependencies: ["t2"] }), options).dependencies).toBeUndefined();
    expect(validateTaskForm(createValues({ dependencies: ["t1"] }), options).dependencies).toBe(
      "Unknown dependency ids: t1"
    );
    expect(validateTaskForm(createValues({ dependencies: ["nope"] }), options).dependencies).toBe(
      "Unknown dependency ids: nope"
    );
  });

  it("only requires a task type when creating, not when editing", () => {
    const bare = createValues({ taskType: "", assigneeId: "" });
    expect(validateTaskForm(bare, { mode: "create" }).taskType).toBe("Choose a task type");
    expect(validateTaskForm(bare, { mode: "edit" }).taskType).toBeUndefined();
  });

  it("never requires an assignee — the API allows creating an unassigned task", () => {
    const unassigned = createValues({ assigneeId: "" });
    expect(validateTaskForm(unassigned, { mode: "create" }).assigneeId).toBeUndefined();
    expect(validateTaskForm(unassigned, { mode: "edit" }).assigneeId).toBeUndefined();
  });

  it("skips the dependency reference check when no task list was fetched", () => {
    const values = createValues({ dependencies: ["t2"] });
    expect(validateTaskForm(values, { mode: "edit", currentTaskId: "t1" }).dependencies).toBeUndefined();
  });
});

describe("buildTaskCreatePayload", () => {
  it("omits cleared optional fields instead of sending empty/zero values", () => {
    const payload = buildTaskCreatePayload(createValues({ dueDate: "", estimatedHours: "", description: "" }));
    const serialized = JSON.parse(JSON.stringify(payload));
    expect("dueDate" in serialized).toBe(false);
    expect("estimatedHours" in serialized).toBe(false);
    expect("description" in serialized).toBe(false);
    expect(payload.tags).toEqual([]);
    expect(payload.dependencies).toEqual([]);
  });

  it("drops a leftover approver and severity that the conditional fields no longer show", () => {
    const unapproved = buildTaskCreatePayload(
      createValues({ requiresApproval: false, approver: "manager-a", taskType: "feature", severity: "critical" })
    );
    expect("approver" in JSON.parse(JSON.stringify(unapproved))).toBe(false);
    expect("severity" in JSON.parse(JSON.stringify(unapproved))).toBe(false);
  });

  it("keeps correctly provided values", () => {
    const payload = buildTaskCreatePayload(
      createValues({
        taskType: "bug",
        severity: "major",
        dueDate: "2026-06-15",
        estimatedHours: "8",
        requiresApproval: true,
        approver: "manager-b",
        tags: ["frontend"],
        dependencies: ["t2"]
      })
    );
    expect(payload).toMatchObject({
      title: "New task",
      status: "todo",
      priority: "medium",
      taskType: "bug",
      severity: "major",
      dueDate: "2026-06-15",
      estimatedHours: 8,
      requiresApproval: true,
      approver: "manager-b",
      tags: ["frontend"],
      dependencies: ["t2"]
    });
  });
});

describe("buildTaskUpdatePayload", () => {
  it("sends nothing when nothing changed", () => {
    expect(buildTaskUpdatePayload(taskToFormValues(fullTask), fullTask)).toEqual({});
  });

  it("sends only the field that changed, leaving every other value untouched", () => {
    const values = { ...taskToFormValues(fullTask), title: "Renamed" };
    expect(buildTaskUpdatePayload(values, fullTask)).toEqual({ title: "Renamed" });
  });

  it("clears nullable scalars with an explicit null", () => {
    const values: TaskFormValues = {
      ...taskToFormValues(fullTask),
      description: "",
      dueDate: "",
      assigneeId: "",
      estimatedHours: ""
    };
    const patch = buildTaskUpdatePayload(values, fullTask);
    expect(patch.description).toBeNull();
    expect(patch.dueDate).toBeNull();
    expect(patch.assigneeId).toBeNull();
    expect(patch.estimatedHours).toBeNull();
  });

  it("clears tags and dependencies with an empty array, never null", () => {
    const values: TaskFormValues = { ...taskToFormValues(fullTask), tags: [], dependencies: [] };
    const patch = buildTaskUpdatePayload(values, fullTask);
    expect(patch.tags).toEqual([]);
    expect(patch.dependencies).toEqual([]);
  });

  it("sends severity: null when the task type moves away from bug", () => {
    const values: TaskFormValues = { ...taskToFormValues(fullTask), taskType: "feature" };
    const patch = buildTaskUpdatePayload(values, fullTask);
    expect(patch.taskType).toBe("feature");
    expect(patch.severity).toBeNull();
  });

  it("sends requiresApproval: false together with approver: null", () => {
    const values: TaskFormValues = { ...taskToFormValues(fullTask), requiresApproval: false };
    const patch = buildTaskUpdatePayload(values, fullTask);
    expect(patch).toMatchObject({ requiresApproval: false, approver: null });
  });

  it("clears severity on its own when the type stays bug but the severity is unset", () => {
    const values: TaskFormValues = { ...taskToFormValues(fullTask), severity: "" };
    expect(buildTaskUpdatePayload(values, fullTask)).toEqual({ severity: null });
  });

  it("sends a changed due date as an ISO timestamp and ignores a same-day no-op", () => {
    const sameDay = buildTaskUpdatePayload(taskToFormValues(fullTask), fullTask);
    expect("dueDate" in sameDay).toBe(false);

    const changed = buildTaskUpdatePayload({ ...taskToFormValues(fullTask), dueDate: "2026-07-04" }, fullTask);
    expect(changed.dueDate).toBe("2026-07-04T00:00:00.000Z");
  });

  it("sends the new dependency list when dependencies are added", () => {
    const values: TaskFormValues = { ...taskToFormValues(fullTask), dependencies: ["t2", "t3"] };
    expect(buildTaskUpdatePayload(values, fullTask)).toEqual({ dependencies: ["t2", "t3"] });
  });

  it("trims the title before comparing and sending it", () => {
    const values: TaskFormValues = { ...taskToFormValues(fullTask), title: "  Existing task  " };
    expect(buildTaskUpdatePayload(values, fullTask)).toEqual({});
  });

  describe("never touches a field the user did not change", () => {
    const renameOnly = (task: Task) => buildTaskUpdatePayload({ ...taskToFormValues(task), title: "Renamed" }, task);

    it("keeps a severity saved on a non-bug task", () => {
      const featureWithSeverity: Task = { ...fullTask, taskType: "feature", severity: "major" };
      expect(renameOnly(featureWithSeverity)).toEqual({ title: "Renamed" });
    });

    it("keeps an approver saved while approval is not required", () => {
      const unapprovedWithApprover: Task = { ...fullTask, requiresApproval: false, approver: "manager-a" };
      expect(renameOnly(unapprovedWithApprover)).toEqual({ title: "Renamed" });
    });

    it("keeps a whitespace-only description exactly as stored", () => {
      const whitespaceDescription: Task = { ...fullTask, description: "   " };
      expect(renameOnly(whitespaceDescription)).toEqual({ title: "Renamed" });
    });

    it("keeps a dueDate stored in a non-YYYY-MM-DD format the API accepts", () => {
      const textDueDate: Task = { ...fullTask, dueDate: "May 1, 2026 00:00:00 GMT" };
      expect(renameOnly(textDueDate)).toEqual({ title: "Renamed" });
    });

    it("keeps an unparsable dueDate rather than clearing it", () => {
      const brokenDueDate: Task = { ...fullTask, dueDate: "whenever" };
      expect(renameOnly(brokenDueDate)).toEqual({ title: "Renamed" });
    });
  });

  it("clears a description the user actually emptied", () => {
    const whitespaceDescription: Task = { ...fullTask, description: "   " };
    const values: TaskFormValues = { ...taskToFormValues(whitespaceDescription), description: "" };
    expect(buildTaskUpdatePayload(values, whitespaceDescription)).toEqual({ description: null });
  });

  it("does not send severity: null when the type changes between two non-bug types", () => {
    const featureWithSeverity: Task = { ...fullTask, taskType: "feature", severity: "major" };
    const values: TaskFormValues = { ...taskToFormValues(featureWithSeverity), taskType: "research", estimatedHours: "8" };
    expect(buildTaskUpdatePayload(values, featureWithSeverity)).toEqual({ taskType: "research" });
  });

  it("sends approver only when approval is switched on and an approver is picked", () => {
    const unapprovedWithApprover: Task = { ...fullTask, requiresApproval: false, approver: "manager-a" };
    const values: TaskFormValues = { ...taskToFormValues(unapprovedWithApprover), requiresApproval: true };
    // The stored approver is pre-filled and unchanged, so only the checkbox
    // change is sent.
    expect(buildTaskUpdatePayload(values, unapprovedWithApprover)).toEqual({ requiresApproval: true });

    const reassigned: TaskFormValues = { ...values, approver: "manager-b" };
    expect(buildTaskUpdatePayload(reassigned, unapprovedWithApprover)).toEqual({
      requiresApproval: true,
      approver: "manager-b"
    });
  });
});
