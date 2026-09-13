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

  it("sends empty arrays after typing tags/dependencies and then clearing them", async () => {
    const onComplete = renderWizard();
    fillStep1();
    goNext();
    fillStep2Assignee();
    fireEvent.change(screen.getByTestId("task-tags-input"), { target: { value: "backend, urgent" } });
    fireEvent.change(screen.getByTestId("task-tags-input"), { target: { value: "" } });
    fireEvent.change(screen.getByTestId("task-dependencies-input"), { target: { value: "task-1" } });
    fireEvent.change(screen.getByTestId("task-dependencies-input"), { target: { value: "" } });
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
