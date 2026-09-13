import { describe, expect, it } from "vitest";
import {
  buildTaskCreatePayload,
  buildTaskUpdatePayload,
  emptyTaskFormValues,
  taskToFormValues,
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

  it("only requires a task type and an assignee when creating, not when editing", () => {
    const bare = createValues({ taskType: "", assigneeId: "" });
    expect(validateTaskForm(bare, { mode: "create" })).toMatchObject({
      taskType: "Choose a task type",
      assigneeId: "You must assign this task"
    });
    const edited = validateTaskForm(bare, { mode: "edit" });
    expect(edited.taskType).toBeUndefined();
    expect(edited.assigneeId).toBeUndefined();
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
});
