import type { Task } from "../types";
import { formatDueDateUtc, getTaskDueStatus } from "../utils/taskDueDate";

type Props = {
  task: Pick<Task, "dueDate" | "status">;
  now?: number;
  className?: string;
  /**
   * Set to false when the exact dueDate is already shown right next to this
   * label (e.g. an editable date input, or a separate "Due Date" field) —
   * then only the Overdue/Due soon status is rendered, and a "scheduled"
   * task (no warning, but a valid date) renders nothing at all instead of
   * repeating the same date a second time. Defaults to true.
   */
  showDate?: boolean;
};

const STATUS_CLASSES: Record<"overdue" | "soon" | "scheduled", string> = {
  overdue: "bg-red-100 text-red-700 font-semibold",
  soon: "bg-amber-100 text-amber-700 font-semibold",
  scheduled: "bg-slate-100 text-slate-700"
};

/**
 * Renders the due-date presentation for a task: "Overdue · Due: <date>",
 * "Due soon · Due: <date>", or a plain "Due: <date>" for other valid dates.
 * Classification rules live in taskDueDate.ts (getTaskDueStatus) and date
 * formatting in formatDueDateUtc — this component only turns those results
 * into text and color, and renders nothing when there's no usable dueDate.
 */
export function DueDateLabel({ task, now, className = "", showDate = true }: Props) {
  const status = getTaskDueStatus(task, now);
  if (status === "none") return null;
  if (status === "scheduled" && !showDate) return null;

  // getTaskDueStatus only returns "overdue"/"soon"/"scheduled" once dueDate
  // has already parsed successfully, so this is never null here.
  const dateInfo = formatDueDateUtc(task.dueDate)!;
  const dateNode = <time dateTime={dateInfo.iso}>{`Due: ${dateInfo.display}`}</time>;

  const content =
    status === "scheduled" ? (
      dateNode
    ) : showDate ? (
      <>
        {status === "overdue" ? "Overdue" : "Due soon"} · {dateNode}
      </>
    ) : status === "overdue" ? (
      "Overdue"
    ) : (
      "Due soon"
    );

  return (
    <span data-testid="due-date-label" data-due-status={status} className={`${STATUS_CLASSES[status]} ${className}`}>
      {content}
    </span>
  );
}
