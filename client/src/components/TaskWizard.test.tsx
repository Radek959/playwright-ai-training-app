import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskWizard } from "./TaskWizard";
import type { User } from "../types";

const users: User[] = [
  { id: "u1", name: "Alice", email: "alice@example.com", role: "editor" }
];

function fillStep1({ taskType }: { taskType?: "feature" | "bug" | "research" } = {}) {
  if (taskType) {
    fireEvent.change(screen.getByTestId("task-type-select"), { target: { value: taskType } });
  }
  fireEvent.change(screen.getByTestId("task-title-input"), { target: { value: "A valid title" } });
  fireEvent.change(screen.getByTestId("task-priority-select"), { target: { value: "medium" } });
}

function goNext() {
  fireEvent.click(screen.getByTestId("wizard-next-btn"));
}

function goBack() {
  fireEvent.click(screen.getByTestId("wizard-prev-btn"));
}

function fillStep2Assignee() {
  fireEvent.change(screen.getByTestId("task-assignee-select"), { target: { value: "u1" } });
}

function submit() {
  fireEvent.click(screen.getByTestId("wizard-submit-btn"));
}

function renderWizard(onComplete = vi.fn().mockResolvedValue(undefined)) {
  render(<TaskWizard users={users} existingTasks={[]} onComplete={onComplete} onClose={vi.fn()} />);
  return onComplete;
}

describe("TaskWizard payload sent to onComplete", () => {
  it("omits estimatedHours after typing a value and then clearing it", async () => {
    const onComplete = renderWizard();
    fillStep1();
    goNext();
    fillStep2Assignee();
    fireEvent.change(screen.getByTestId("task-hours-input"), { target: { value: "5" } });
    fireEvent.change(screen.getByTestId("task-hours-input"), { target: { value: "" } });
    goNext();
    submit();

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const payload = onComplete.mock.calls[0][0];
    expect(payload.estimatedHours).toBeUndefined();
    expect("estimatedHours" in JSON.parse(JSON.stringify(payload))).toBe(false);
  });

  it("omits dueDate after typing a date and then clearing it", async () => {
    const onComplete = renderWizard();
    fillStep1();
    goNext();
    fillStep2Assignee();
    fireEvent.change(screen.getByTestId("task-due-date-input"), { target: { value: "2026-05-01" } });
    fireEvent.change(screen.getByTestId("task-due-date-input"), { target: { value: "" } });
    goNext();
    submit();

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const payload = onComplete.mock.calls[0][0];
    expect(payload.dueDate).toBeUndefined();
    expect("dueDate" in JSON.parse(JSON.stringify(payload))).toBe(false);
  });

  it("sends empty arrays after typing tags and then clearing them, with no dependencies picked", async () => {
    const onComplete = renderWizard();
    fillStep1();
    goNext();
    fillStep2Assignee();
    fireEvent.change(screen.getByTestId("task-tags-input"), { target: { value: "backend, urgent" } });
    fireEvent.change(screen.getByTestId("task-tags-input"), { target: { value: "" } });
    goNext();
    submit();

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const payload = onComplete.mock.calls[0][0];
    expect(payload.tags).toEqual([]);
    expect(payload.dependencies).toEqual([]);
  });

  it("drops the approver once requiresApproval is unchecked again", async () => {
    const onComplete = renderWizard();
    fillStep1();
    goNext();
    fillStep2Assignee();
    fireEvent.click(screen.getByTestId("requires-approval-checkbox"));
    fireEvent.change(screen.getByTestId("task-approver-select"), { target: { value: "manager-a" } });
    fireEvent.click(screen.getByTestId("requires-approval-checkbox"));
    goNext();
    submit();

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const payload = onComplete.mock.calls[0][0];
    expect(payload.approver).toBeUndefined();
    expect("approver" in JSON.parse(JSON.stringify(payload))).toBe(false);
  });

  it("drops severity once the task type changes away from bug", async () => {
    const onComplete = renderWizard();
    fillStep1({ taskType: "bug" });
    goNext();
    fillStep2Assignee();
    fireEvent.change(screen.getByTestId("task-severity-select"), { target: { value: "critical" } });
    goBack();
    fireEvent.change(screen.getByTestId("task-type-select"), { target: { value: "feature" } });
    goNext();
    goNext();
    submit();

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const payload = onComplete.mock.calls[0][0];
    expect(payload.severity).toBeUndefined();
    expect("severity" in JSON.parse(JSON.stringify(payload))).toBe(false);
  });

  it("keeps correctly provided values and calls onComplete after completing the wizard", async () => {
    const onComplete = renderWizard();
    fillStep1({ taskType: "bug" });
    goNext();
    fillStep2Assignee();
    fireEvent.change(screen.getByTestId("task-severity-select"), { target: { value: "critical" } });
    fireEvent.change(screen.getByTestId("task-hours-input"), { target: { value: "8" } });
    fireEvent.change(screen.getByTestId("task-due-date-input"), { target: { value: "2026-05-01" } });
    fireEvent.click(screen.getByTestId("requires-approval-checkbox"));
    fireEvent.change(screen.getByTestId("task-approver-select"), { target: { value: "manager-b" } });
    fireEvent.change(screen.getByTestId("task-tags-input"), { target: { value: "frontend" } });
    goNext();
    submit();

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const payload = onComplete.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: "A valid title",
      priority: "medium",
      taskType: "bug",
      severity: "critical",
      estimatedHours: 8,
      dueDate: "2026-05-01",
      requiresApproval: true,
      approver: "manager-b",
      tags: ["frontend"]
    });
  });
});

describe("TaskWizard step 2 validation", () => {
  it("rejects an estimatedHours of 0 as not a positive number and does not submit", () => {
    const onComplete = renderWizard();
    fillStep1();
    goNext();
    fillStep2Assignee();
    fireEvent.change(screen.getByTestId("task-hours-input"), { target: { value: "0" } });

    goNext();

    // Matches the API rule (estimatedHours must be a positive number) rather
    // than the old, stricter client-only "minimum 1 hour" wording.
    expect(screen.getByText("Estimated hours must be a positive number")).toBeInTheDocument();
    // Still on step 2 — the wizard summary (step 3) never rendered.
    expect(screen.queryByTestId("wizard-summary")).not.toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("accepts a fractional positive estimate, which the API allows", async () => {
    const onComplete = renderWizard();
    fillStep1();
    goNext();
    fillStep2Assignee();
    fireEvent.change(screen.getByTestId("task-hours-input"), { target: { value: "0.5" } });
    goNext();
    submit();

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete.mock.calls[0][0].estimatedHours).toBe(0.5);
  });

  it("requires a severity for bugs and an estimate for research tasks", () => {
    renderWizard();
    fillStep1({ taskType: "bug" });
    goNext();
    fillStep2Assignee();
    goNext();
    expect(screen.getByText("Bugs require a severity level")).toBeInTheDocument();

    goBack();
    fireEvent.change(screen.getByTestId("task-type-select"), { target: { value: "research" } });
    goNext();
    goNext();
    expect(screen.getByText("Research tasks require a time estimate of at least 1 hour")).toBeInTheDocument();
  });

  it("rejects more than 24 estimated hours on a high priority task", () => {
    renderWizard();
    fillStep1();
    fireEvent.change(screen.getByTestId("task-priority-select"), { target: { value: "high" } });
    goNext();
    fillStep2Assignee();
    fireEvent.change(screen.getByTestId("task-hours-input"), { target: { value: "25" } });
    goNext();

    expect(screen.getByText("High priority tasks cannot exceed 24h")).toBeInTheDocument();
    expect(screen.queryByTestId("wizard-summary")).not.toBeInTheDocument();
  });

  it("rejects a title that is only long enough before trimming, matching the API rule", () => {
    renderWizard();
    fireEvent.change(screen.getByTestId("task-title-input"), { target: { value: " ab " } });
    fireEvent.change(screen.getByTestId("task-priority-select"), { target: { value: "medium" } });
    goNext();

    expect(screen.getByText("Title must be at least 3 characters")).toBeInTheDocument();
    expect(screen.queryByTestId("task-assignee-select")).not.toBeInTheDocument();
  });

  it("requires an approver once approval is required", () => {
    renderWizard();
    fillStep1();
    goNext();
    fillStep2Assignee();
    fireEvent.click(screen.getByTestId("requires-approval-checkbox"));
    goNext();

    expect(screen.getByText("Select an approver")).toBeInTheDocument();
  });
});

describe("TaskWizard dependency picker", () => {
  const existingTasks = [
    { id: "task-1", title: "First task", status: "todo", priority: "medium" },
    { id: "task-2", title: "Second task", status: "done", priority: "low" }
  ] as const;

  function renderWithTasks(onComplete = vi.fn().mockResolvedValue(undefined)) {
    render(
      <TaskWizard
        users={users}
        existingTasks={existingTasks.map((t) => ({ ...t }))}
        onComplete={onComplete}
        onClose={vi.fn()}
      />
    );
    return onComplete;
  }

  it("picks dependencies from the existing task list and sends their ids", async () => {
    const onComplete = renderWithTasks();
    fillStep1();
    goNext();
    fillStep2Assignee();

    const select = screen.getByLabelText("Add dependency") as HTMLSelectElement;
    // Each option shows the task's title and its id.
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      "Choose a task...",
      "First task (task-1)",
      "Second task (task-2)"
    ]);

    fireEvent.change(select, { target: { value: "task-1" } });
    fireEvent.click(screen.getByTestId("wizard-dependency-add"));

    expect(screen.getByTestId("wizard-dependency-task-1")).toBeInTheDocument();
    // An already-selected task cannot be picked a second time.
    expect(Array.from((screen.getByLabelText("Add dependency") as HTMLSelectElement).options).map((o) => o.value)).toEqual([
      "",
      "task-2"
    ]);

    goNext();
    submit();

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete.mock.calls[0][0].dependencies).toEqual(["task-1"]);
  });

  it("removes a picked dependency again", async () => {
    const onComplete = renderWithTasks();
    fillStep1();
    goNext();
    fillStep2Assignee();

    fireEvent.change(screen.getByLabelText("Add dependency"), { target: { value: "task-2" } });
    fireEvent.click(screen.getByTestId("wizard-dependency-add"));
    expect(screen.getByTestId("wizard-dependency-task-2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove dependency Second task" }));
    expect(screen.queryByTestId("wizard-dependency-task-2")).not.toBeInTheDocument();

    goNext();
    submit();

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete.mock.calls[0][0].dependencies).toEqual([]);
  });
});
