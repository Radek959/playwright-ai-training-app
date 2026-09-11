export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type TaskType = "bug" | "feature" | "research";
export type TaskSeverity = "critical" | "major" | "minor";
export type UserRole = "admin" | "editor" | "viewer";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  avatarUrl?: string;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  completedAt?: string;
  assigneeId?: string;
  coverImage?: string;
  taskType?: TaskType;
  estimatedHours?: number;
  tags?: string[];
  dependencies?: string[];
  severity?: TaskSeverity;
  requiresApproval?: boolean;
  approver?: string;
};

export type TaskWithAssignee = Task & {
  assigneeName?: string;
  assigneeAvatarUrl?: string;
};

export type TaskCreateInput = Omit<Task, "id" | "coverImage">;

// Fields the backend accepts `null` for, meaning "clear this value".
// Required fields (title/status/priority) and array fields (send [] to
// clear those) intentionally do not accept null.
type ClearableTaskFields = "description" | "dueDate" | "completedAt" | "assigneeId" | "taskType" | "estimatedHours" | "severity" | "approver";

export type TaskUpdateInput = Partial<Omit<TaskCreateInput, ClearableTaskFields>> & {
  [K in ClearableTaskFields]?: TaskCreateInput[K] | null;
};
