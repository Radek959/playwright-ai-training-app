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

/**
 * Body for PUT /api/users/:id. Partial: only the fields actually being
 * changed are sent, and anything omitted keeps its stored value. `avatar` is
 * the one clearable field — an explicit `null` removes it, while omitting it
 * leaves it alone. `id` and `avatarUrl` are not editable and are rejected by
 * the API if sent.
 */
export type UserUpdateInput = {
  name?: string;
  email?: string;
  role?: UserRole;
  avatar?: string | null;
};

export type ApprovalStatus = "pending" | "approved" | "rejected";

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
  /**
   * Set only while requiresApproval is/was true. There is no login in this
   * app: a decision is recorded on behalf of `approver`, not made by an
   * authenticated person. Only PUT /api/tasks/:id/approval can change these
   * fields (or the significant-edit reset back to "pending"); a plain
   * PUT /api/tasks/:id cannot set them.
   */
  approvalStatus?: ApprovalStatus;
  approvalComment?: string;
  approvalDecidedAt?: string;
};

export type ActivityType = "task_created" | "task_updated" | "approval_decided";
export type ActivityValue = string | number | boolean | string[] | null;

export type TaskActivityChange = {
  field: string;
  before: ActivityValue;
  after: ActivityValue;
};

export type TaskActivity = {
  id: string;
  taskId: string;
  type: ActivityType;
  changes: TaskActivityChange[];
  createdAt: string;
};

export type TaskWithAssignee = Task & {
  assigneeName?: string;
  assigneeAvatarUrl?: string;
};

// Approval-process fields are server-controlled: they can never be sent on
// POST /api/tasks or plain PUT /api/tasks/:id (see PUT /api/tasks/:id/approval
// and the ApprovalDecisionInput type below).
type ApprovalProcessFields = "approvalStatus" | "approvalComment" | "approvalDecidedAt";

export type TaskCreateInput = Omit<Task, "id" | "coverImage" | ApprovalProcessFields>;

/** Body for PUT /api/tasks/:id/approval. */
export type ApprovalDecisionInput = {
  decision: "approved" | "rejected";
  /** Optional, max 500 chars after trim; a whitespace-only comment is treated as no comment. */
  comment?: string;
};

// Fields the backend accepts `null` for, meaning "clear this value".
// Required fields (title/status/priority) and array fields (send [] to
// clear those) intentionally do not accept null.
type ClearableTaskFields = "description" | "dueDate" | "completedAt" | "assigneeId" | "taskType" | "estimatedHours" | "severity" | "approver";

export type TaskUpdateInput = Partial<Omit<TaskCreateInput, ClearableTaskFields>> & {
  [K in ClearableTaskFields]?: TaskCreateInput[K] | null;
};

/**
 * A comment on a task. There is no login in this app: `authorId` is picked
 * explicitly from the existing user list by whoever adds the comment, and
 * the comment is recorded on that user's behalf rather than as a verified
 * identity. `authorName` is a snapshot taken at creation time, so it still
 * identifies the author after their user record is deleted — at which point
 * `authorId` is absent (see DELETE /api/users/:id).
 */
export type Comment = {
  id: string;
  taskId: string;
  content: string;
  authorId?: string;
  authorName: string;
  createdAt: string;
};

/** Body for POST /api/tasks/:id/comments. id, taskId, authorName and createdAt are always server-controlled. */
export type CommentCreateInput = {
  authorId: string;
  content: string;
};
