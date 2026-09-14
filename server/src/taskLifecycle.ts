import { ApprovalStatus, Task, TaskStatus } from "./data.js";

/**
 * A task moving to "done" gets a completedAt timestamp (unless the caller
 * already supplied one); any other status clears it. Shared by both task
 * creation and task update so the rule can't drift between the two routes.
 */
export function resolveCompletedAt(
  status: TaskStatus,
  requestedCompletedAt: string | undefined,
  now: () => string = () => new Date().toISOString()
): string | undefined {
  if (status !== "done") return undefined;
  return requestedCompletedAt ?? now();
}

export type BlockingDependency = { id: string; title: string; status: TaskStatus };

/**
 * Returns the direct dependencies (from `dependencyIds`) that are not yet
 * "done", in the shape the 409 response reports them. A task can only be
 * completed once every dependency it directly lists is done; dependencies
 * of dependencies are not considered. Shared by both task creation and
 * task update so the rule can't drift between the two routes.
 */
export function findBlockingDependencies(
  dependencyIds: string[] | undefined,
  tasks: Pick<Task, "id" | "title" | "status">[]
): BlockingDependency[] {
  if (!dependencyIds || dependencyIds.length === 0) return [];

  const blocking: BlockingDependency[] = [];
  for (const depId of dependencyIds) {
    const dep = tasks.find((t) => t.id === depId);
    if (dep && dep.status !== "done") {
      blocking.push({ id: dep.id, title: dep.title, status: dep.status });
    }
  }
  return blocking;
}

/* ------------------------------------------------------------------------ *
 * Approval workflow
 *
 * There is still no login/auth in this app. `approver` only names who a
 * recorded decision is made *on behalf of* — nothing here authenticates
 * that person or restricts who can call the approval endpoint. The workflow
 * below only gives `requiresApproval`/`approver` a real state machine
 * (pending -> approved/rejected) instead of being inert data.
 * ------------------------------------------------------------------------ */

// Fields whose *value* changing on a significantly-edited task restarts an
// approved/rejected approval process back to "pending". Kept as its own list
// (rather than reusing TASK_UPDATE_FIELDS) because "status" and
// "requiresApproval" itself are deliberately excluded: a plain status change
// alone must not reset approval, and requiresApproval has its own dedicated
// transition handling below.
export const APPROVAL_RESET_FIELDS = [
  "title",
  "description",
  "priority",
  "dueDate",
  "assigneeId",
  "taskType",
  "severity",
  "estimatedHours",
  "tags",
  "dependencies",
  "approver"
] as const;

const sameValue = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
};

/**
 * Whether any of the reset-triggering fields actually changed value between
 * the existing record and the merged patch. "Actually changed" means the
 * payload didn't just resend the same value — a no-op patch never resets
 * approval.
 */
export function significantFieldsChanged(
  existing: Record<string, unknown>,
  merged: Record<string, unknown>
): boolean {
  return APPROVAL_RESET_FIELDS.some((field) => !sameValue(existing[field], merged[field]));
}

/**
 * An empty (or whitespace-only) comment is treated as no comment at all, and
 * comments are always trimmed before being stored or compared. Applies to
 * both the decision endpoint's request body and the idempotency comparison.
 */
export function normalizeApprovalComment(comment: unknown): string | undefined {
  if (typeof comment !== "string") return undefined;
  const trimmed = comment.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export const APPROVAL_COMMENT_MAX_LENGTH = 500;

/**
 * Sets up (or tears down) the approval-process fields on a task record in
 * place, based on how `requiresApproval` and the other significant fields
 * moved between `existing` and `merged`. Called after `applyAllowedUpdate`
 * has merged a PUT patch, and equivalently for a freshly created task (with
 * `existing` standing in for "no prior approval state").
 *
 * - requiresApproval false -> no approval fields at all.
 * - requiresApproval flips false -> true: starts a fresh "pending" process.
 * - requiresApproval stays true: an approved/rejected decision is reset back
 *   to "pending" (comment/decidedAt cleared) only if a significant field's
 *   *value* actually changed; a pending process, or a no-op patch, is left
 *   exactly as-is.
 */
export function applyApprovalTransition(
  existing: Record<string, unknown>,
  merged: Record<string, unknown>
): void {
  const wasRequired = existing.requiresApproval === true;
  const nowRequired = merged.requiresApproval === true;

  if (!nowRequired) {
    delete merged.approvalStatus;
    delete merged.approvalComment;
    delete merged.approvalDecidedAt;
    return;
  }

  if (!wasRequired) {
    merged.approvalStatus = "pending" satisfies ApprovalStatus;
    delete merged.approvalComment;
    delete merged.approvalDecidedAt;
    return;
  }

  const currentStatus = existing.approvalStatus as ApprovalStatus | undefined;
  if ((currentStatus === "approved" || currentStatus === "rejected") && significantFieldsChanged(existing, merged)) {
    merged.approvalStatus = "pending" satisfies ApprovalStatus;
    delete merged.approvalComment;
    delete merged.approvalDecidedAt;
  }
  // Otherwise (still pending, or a no-op patch): leave the approval fields
  // untouched — they were already carried over onto `merged` as a copy of
  // `existing`.
}

export type ApprovalDecisionOutcome =
  | { ok: true; task: Task }
  | {
      ok: false;
      conflict: true;
      currentApproval: { status: ApprovalStatus; comment?: string; decidedAt?: string };
    };

/**
 * Applies an approve/reject decision to a task that requires approval.
 * Idempotent: repeating the identical decision (same decision, same
 * normalized comment) against an already-decided task is a no-op success —
 * `approvalDecidedAt` does not move and nothing else changes. A *different*
 * decision or comment against an already-decided task is a conflict; the
 * caller is responsible for checking `task.requiresApproval` first (this
 * function assumes it is true).
 */
export function applyApprovalDecision(
  task: Task,
  decision: "approved" | "rejected",
  comment: string | undefined,
  now: () => string = () => new Date().toISOString()
): ApprovalDecisionOutcome {
  const currentStatus = task.approvalStatus;

  if (currentStatus === "approved" || currentStatus === "rejected") {
    const sameDecision = currentStatus === decision;
    const sameComment = (task.approvalComment ?? undefined) === (comment ?? undefined);
    if (sameDecision && sameComment) {
      return { ok: true, task };
    }
    return {
      ok: false,
      conflict: true,
      currentApproval: {
        status: currentStatus,
        comment: task.approvalComment,
        decidedAt: task.approvalDecidedAt
      }
    };
  }

  const updated: Task = { ...task, approvalStatus: decision, approvalDecidedAt: now() };
  if (comment !== undefined) {
    updated.approvalComment = comment;
  } else {
    delete updated.approvalComment;
  }
  return { ok: true, task: updated };
}

export type ApprovalBlocker = { status: ApprovalStatus | "pending"; approver?: string };

/**
 * Whether a task requiring approval is blocked from moving to "done". Only
 * an explicit "approved" status clears the gate — "pending", "rejected", or
 * a missing approvalStatus (which should not normally happen once the
 * workflow above is in place) all block completion. Returns null when the
 * task does not require approval at all.
 */
export function findApprovalBlocker(
  task: Pick<Task, "requiresApproval" | "approvalStatus" | "approver">
): ApprovalBlocker | null {
  if (task.requiresApproval !== true) return null;
  if (task.approvalStatus === "approved") return null;
  return { status: task.approvalStatus ?? "pending", approver: task.approver };
}
