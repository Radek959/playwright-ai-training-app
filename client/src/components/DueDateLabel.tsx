import type { Task } from "../types";
import { getTaskDueStatus } from "../utils/taskDueDate";

type Props = {
  task: Pick<Task, "dueDate" | "status">;
  now?: number;
  className?: string;
};

const STATUS_CLASSES: Record<"overdue" | "soon" | "scheduled", string> = {
  overdue: "bg-red-100 text-red-700 font-semibold",
  soon: "bg-amber-100 text-amber-700 font-semibold",
  scheduled: "bg-slate-100 text-slate-700"
};

/**
 * Renders the due-date presentation for a task: "Overdue", "Due soon", or a
 * plain "Due: <date>" for other valid dates. Classification rules live in
 * taskDueDate.ts — this component only turns that result into text and
 * color, and renders nothing when there's no usable dueDate.
 */
export function DueDateLabel({ task, now, className = "" }: Props) {
  const status = getTaskDueStatus(task, now);
  if (status === "none") return null;

  const label =
    status === "overdue" ? "Overdue" : status === "soon" ? "Due soon" : `Due: ${new Date(task.dueDate!).toLocaleDateString()}`;

  return (
    <span data-testid="due-date-label" data-due-status={status} className={`${STATUS_CLASSES[status]} ${className}`}>
      {label}
    </span>
  );
}
