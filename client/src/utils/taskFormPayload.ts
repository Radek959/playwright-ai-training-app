import type { TaskPriority, TaskStatus } from "../types";

export type QuickTaskFormValues = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  assigneeId: string;
};

/**
 * Builds the POST /api/tasks body for the quick-add form. An empty dueDate
 * or assigneeId (the unset state of those inputs) is omitted rather than
 * sent as "", which the API's date/reference validation would reject.
 */
export function buildQuickTaskPayload(values: QuickTaskFormValues): Record<string, unknown> {
  return {
    title: values.title,
    description: values.description,
    status: values.status,
    priority: values.priority,
    dueDate: values.dueDate || undefined,
    assigneeId: values.assigneeId || undefined
  };
}
