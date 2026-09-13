import type { TaskPriority, TaskSeverity, TaskStatus, TaskType } from "../types";

export type TaskDraft = {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string;
  assigneeId?: string;
  estimatedHours?: number;
  tags?: string[];
  dependencies?: string[];
  taskType?: TaskType;
  severity?: TaskSeverity;
  requiresApproval?: boolean;
  approver?: string;
};

/**
 * Builds the POST /api/tasks body from the wizard's draft state. Step
 * navigation can leave fields in a stale or falsy-but-not-unset state that
 * the API's optional-field handling would otherwise reject or misinterpret:
 * - a cleared `dueDate` input holds "", not undefined — omitted rather than sent as an empty date.
 * - a cleared `estimatedHours` input must not fall back to 0 — omitted unless a real value was entered.
 * - `approver` left over from a previous `requiresApproval` toggle is dropped once approval is no longer required.
 * - `severity` left over from a previous `taskType: "bug"` selection is dropped once the type changes.
 */
export function buildTaskWizardPayload(draft: TaskDraft): TaskDraft {
  const payload: TaskDraft = { ...draft };

  if (!payload.dueDate) delete payload.dueDate;
  if (payload.estimatedHours === undefined || Number.isNaN(payload.estimatedHours)) delete payload.estimatedHours;
  if (!payload.requiresApproval) delete payload.approver;
  if (payload.taskType !== "bug") delete payload.severity;

  return payload;
}
