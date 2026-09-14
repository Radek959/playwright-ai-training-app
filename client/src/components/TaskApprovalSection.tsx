import { useEffect, useState } from "react";
import { getApproverLabel } from "../utils/approvers";
import type { ApprovalStatus, Task } from "../types";

type Props = {
  task: Task;
  /**
   * Sends the decision to the API. Left to the caller so the request/error
   * handling stays consistent with the rest of the details view (same
   * ApiError parsing, same "refresh from the response" rule, same URL).
   */
  onDecide: (decision: "approved" | "rejected", comment?: string) => Promise<void>;
};

const renderDate = (dateStr?: string) => {
  if (!dateStr) return "Not set";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return <time dateTime={d.toISOString()}>{d.toLocaleString()}</time>;
};

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending: "Pending approval",
  approved: "Approved",
  rejected: "Rejected"
};

/**
 * The "Approval" section of the task details view. Gives requiresApproval /
 * approver real meaning without ever implying `approver` authenticated
 * anything — there is no login in this app, so a recorded decision is only
 * ever made *on behalf of* the named approver, not *by* them as a verified
 * identity.
 */
export function TaskApprovalSection({ task, onDecide }: Props) {
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A fresh pending process (e.g. after a significant edit reset it) should
  // never carry a stale error or half-typed comment from a previous, now
  // irrelevant, decision attempt.
  useEffect(() => {
    setError(null);
    setComment("");
  }, [task.id, task.approvalStatus, task.approvalDecidedAt]);

  if (!task.requiresApproval) {
    return (
      <section className="mt-8" data-testid="approval-section">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Approval</h2>
        <p className="text-gray-900" data-testid="approval-not-required">
          Approval not required
        </p>
      </section>
    );
  }

  const status: ApprovalStatus = task.approvalStatus ?? "pending";
  const approverLabel = task.approver ? getApproverLabel(task.approver) : "Not set";

  const handleDecide = async (decision: "approved" | "rejected") => {
    if (saving) return;
    setSaving(decision);
    setError(null);
    try {
      await onDecide(decision, comment);
      // On success the task prop will update (driven by the caller's state),
      // which re-runs the effect above and clears the comment for us.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record the decision");
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="mt-8" data-testid="approval-section">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Approval</h2>

      <div className="flex items-center gap-2 mb-3">
        <span
          role="status"
          data-testid="approval-status-badge"
          data-approval-status={status}
          className={`inline-block text-xs font-semibold px-2 py-1 rounded border ${
            status === "approved"
              ? "bg-green-50 text-green-800 border-green-300"
              : status === "rejected"
              ? "bg-red-50 text-red-800 border-red-300"
              : "bg-amber-50 text-amber-800 border-amber-300"
          }`}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      <p className="text-sm text-gray-700 mb-3" data-testid="approval-approver-note">
        {`Approver on record: ${approverLabel}. `}
        {status === "pending" ? (
          <>Approving or rejecting will record the decision on their behalf — this app has no login, so it is not proof they made it themselves.</>
        ) : (
          <>The decision above was recorded on their behalf, not authenticated as made by them.</>
        )}
      </p>

      {(status === "approved" || status === "rejected") && (
        <dl className="space-y-2 mb-3" data-testid="approval-decision-details">
          <div>
            <dt className="text-sm font-medium text-gray-500">Decided at</dt>
            <dd className="mt-1 text-gray-900" data-testid="approval-decided-at">
              {renderDate(task.approvalDecidedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Comment</dt>
            <dd className="mt-1 text-gray-900 whitespace-pre-wrap" data-testid="approval-comment">
              {task.approvalComment || "Not set"}
            </dd>
          </div>
        </dl>
      )}

      {status === "pending" && (
        <div className="flex flex-col gap-2">
          {error && (
            <div role="alert" className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-700" data-testid="approval-error">
              {error}
            </div>
          )}
          <label htmlFor="approval-comment-input" className="text-sm font-semibold text-slate-700">
            Comment (optional)
          </label>
          <textarea
            id="approval-comment-input"
            className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            rows={2}
            maxLength={500}
            value={comment}
            disabled={saving !== null}
            onChange={(e) => setComment(e.target.value)}
            data-testid="approval-comment-input"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleDecide("approved")}
              disabled={saving !== null}
              data-testid="approve-task-btn"
              className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-800"
            >
              {saving === "approved" ? "Approving…" : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => handleDecide("rejected")}
              disabled={saving !== null}
              data-testid="reject-task-btn"
              className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
            >
              {saving === "rejected" ? "Rejecting…" : "Reject"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
