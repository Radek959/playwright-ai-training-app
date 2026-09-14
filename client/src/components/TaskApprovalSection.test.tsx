import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskApprovalSection } from "./TaskApprovalSection";
import type { Task } from "../types";

const baseTask: Task = {
  id: "t1",
  title: "A task",
  status: "todo",
  priority: "medium",
  requiresApproval: true,
  approver: "manager-a",
  approvalStatus: "pending"
};

describe("TaskApprovalSection", () => {
  it("shows 'Approval not required' and no decision buttons when requiresApproval is false", () => {
    render(<TaskApprovalSection task={{ ...baseTask, requiresApproval: false, approvalStatus: undefined }} onDecide={vi.fn()} />);
    expect(screen.getByTestId("approval-not-required")).toHaveTextContent("Approval not required");
    expect(screen.queryByTestId("approve-task-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reject-task-btn")).not.toBeInTheDocument();
  });

  it("shows a pending badge, the approver, and decision controls", () => {
    render(<TaskApprovalSection task={baseTask} onDecide={vi.fn()} />);
    expect(screen.getByTestId("approval-status-badge")).toHaveTextContent("Pending approval");
    expect(screen.getByTestId("approve-task-btn")).toBeInTheDocument();
    expect(screen.getByTestId("reject-task-btn")).toBeInTheDocument();
    // Never implies the approver authenticated anything.
    expect(screen.getByTestId("approval-approver-note").textContent).not.toMatch(/authenticat/i);
  });

  it("shows an approved badge, decided-at time and comment, with no decision buttons", () => {
    const approved: Task = {
      ...baseTask,
      approvalStatus: "approved",
      approvalComment: "Looks good.",
      approvalDecidedAt: "2026-09-14T08:00:00.000Z"
    };
    render(<TaskApprovalSection task={approved} onDecide={vi.fn()} />);
    expect(screen.getByTestId("approval-status-badge")).toHaveTextContent("Approved");
    expect(screen.getByTestId("approval-comment")).toHaveTextContent("Looks good.");
    expect(screen.getByTestId("approval-decided-at")).toBeInTheDocument();
    expect(screen.queryByTestId("approve-task-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reject-task-btn")).not.toBeInTheDocument();
  });

  it("shows a rejected badge distinguishable from approved by text, not color alone", () => {
    const rejected: Task = { ...baseTask, approvalStatus: "rejected", approvalDecidedAt: "2026-09-14T08:00:00.000Z" };
    render(<TaskApprovalSection task={rejected} onDecide={vi.fn()} />);
    const badge = screen.getByTestId("approval-status-badge");
    expect(badge).toHaveTextContent("Rejected");
    expect(badge).toHaveAttribute("role", "status");
  });

  it("sends the decision and typed comment on Approve", async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<TaskApprovalSection task={baseTask} onDecide={onDecide} />);
    fireEvent.change(screen.getByTestId("approval-comment-input"), { target: { value: "Ship it" } });
    fireEvent.click(screen.getByTestId("approve-task-btn"));
    await waitFor(() => expect(onDecide).toHaveBeenCalledWith("approved", "Ship it"));
  });

  it("sends the decision on Reject", async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<TaskApprovalSection task={baseTask} onDecide={onDecide} />);
    fireEvent.click(screen.getByTestId("reject-task-btn"));
    await waitFor(() => expect(onDecide).toHaveBeenCalledWith("rejected", ""));
  });

  it("disables both buttons while saving and shows an in-flight label (double-click protection)", async () => {
    let resolveDecide: () => void = () => {};
    const onDecide = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDecide = resolve;
        })
    );
    render(<TaskApprovalSection task={baseTask} onDecide={onDecide} />);

    fireEvent.click(screen.getByTestId("approve-task-btn"));
    fireEvent.click(screen.getByTestId("approve-task-btn"));
    fireEvent.click(screen.getByTestId("reject-task-btn"));

    await waitFor(() => expect(screen.getByTestId("approve-task-btn")).toBeDisabled());
    expect(screen.getByTestId("reject-task-btn")).toBeDisabled();
    expect(screen.getByTestId("approve-task-btn")).toHaveTextContent("Approving…");
    expect(onDecide).toHaveBeenCalledTimes(1);

    resolveDecide();
    await waitFor(() => expect(onDecide).toHaveBeenCalledTimes(1));
  });

  it("keeps the typed comment and shows the error message when the decision fails", async () => {
    const onDecide = vi.fn().mockRejectedValue(new Error("Approval decision conflict: approved"));
    render(<TaskApprovalSection task={baseTask} onDecide={onDecide} />);

    fireEvent.change(screen.getByTestId("approval-comment-input"), { target: { value: "My note" } });
    fireEvent.click(screen.getByTestId("approve-task-btn"));

    await waitFor(() => expect(screen.getByTestId("approval-error")).toHaveTextContent("Approval decision conflict"));
    expect(screen.getByTestId("approval-comment-input")).toHaveValue("My note");
    // Buttons are usable again to retry.
    expect(screen.getByTestId("approve-task-btn")).not.toBeDisabled();
  });

  it("does not show the decision as saved before the promise resolves", async () => {
    let resolveDecide: () => void = () => {};
    const onDecide = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDecide = resolve;
        })
    );
    render(<TaskApprovalSection task={baseTask} onDecide={onDecide} />);
    fireEvent.click(screen.getByTestId("approve-task-btn"));

    await waitFor(() => expect(screen.getByTestId("approve-task-btn")).toBeDisabled());
    // Still pending in the UI — the caller hasn't updated `task` yet.
    expect(screen.getByTestId("approval-status-badge")).toHaveTextContent("Pending approval");

    resolveDecide();
    await waitFor(() => expect(screen.getByTestId("approve-task-btn")).not.toBeDisabled());
  });
});
