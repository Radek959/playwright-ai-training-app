export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type TaskType = "bug" | "feature" | "research";
export type TaskSeverity = "critical" | "major" | "minor";

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
   * The state of the approval process started when requiresApproval is/was
   * true. Absent whenever requiresApproval is false — there is no active
   * process to have a state. Set and moved only by taskLifecycle.ts's
   * approval helpers (POST/PUT /api/tasks, and PUT /api/tasks/:id/approval);
   * never accepted directly from a plain task PUT body. No login exists in
   * this app: a decision is recorded on behalf of `approver`, not made by an
   * authenticated person.
   */
  approvalStatus?: ApprovalStatus;
  /** Optional, max 500 chars after trim. Only ever set alongside a terminal (approved/rejected) approvalStatus. */
  approvalComment?: string;
  /** ISO timestamp. Only ever set alongside a terminal (approved/rejected) approvalStatus. */
  approvalDecidedAt?: string;
};

export type UserRole = "admin" | "editor" | "viewer";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  avatarUrl?: string;
};

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";

const coverImages = [
  `${BASE_URL}/images/cover-tech.jpg`,
  `${BASE_URL}/images/cover-office.jpg`,
  `${BASE_URL}/images/cover-abstract.jpg`,
  `${BASE_URL}/images/cover-workspace.jpg`,
];

const daysAgo = (days: number) => new Date(Date.now() - 86400000 * days).toISOString();
const daysFromNow = (days: number) => new Date(Date.now() + 86400000 * days).toISOString();

export const tasks: Task[] = [
  {
    id: "t1",
    title: "Implement user authentication",
    description: "Add OAuth2 authentication with Google and GitHub providers",
    status: "in-progress",
    priority: "high",
    dueDate: daysFromNow(3),
    assigneeId: "u1",
    coverImage: coverImages[0],
    taskType: "feature",
    estimatedHours: 16,
    tags: ["backend", "security"],
    dependencies: [],
    requiresApproval: false
  },
  {
    id: "t2",
    title: "Design new landing page",
    description: "Create modern, responsive landing page with hero section",
    status: "todo",
    priority: "medium",
    dueDate: daysFromNow(7),
    assigneeId: "u2",
    coverImage: coverImages[1],
    taskType: "feature",
    estimatedHours: 8,
    tags: ["frontend", "design"],
    dependencies: [],
    requiresApproval: true,
    approver: "manager-a",
    approvalStatus: "pending"
  },
  {
    id: "t3",
    title: "Fix mobile navigation bug",
    description: "Navigation menu doesn't close on mobile devices",
    status: "todo",
    priority: "high",
    dueDate: daysFromNow(2),
    assigneeId: "u3",
    coverImage: coverImages[2],
    taskType: "bug",
    severity: "major",
    estimatedHours: 4,
    tags: ["frontend", "mobile"],
    dependencies: ["t2"],
    requiresApproval: false
  },
  {
    id: "t4",
    title: "Update documentation",
    description: "Add API documentation and code examples",
    status: "done",
    priority: "low",
    dueDate: daysAgo(40),
    completedAt: daysAgo(38),
    assigneeId: "u1",
    coverImage: coverImages[3],
    taskType: "feature",
    estimatedHours: 3,
    tags: ["docs"],
    dependencies: [],
    requiresApproval: false
  },
  {
    id: "t5",
    title: "Investigate flaky checkout tests",
    description: "Research root cause of intermittent checkout test failures",
    status: "done",
    priority: "medium",
    dueDate: daysAgo(2),
    completedAt: daysAgo(2),
    assigneeId: "u3",
    taskType: "research",
    estimatedHours: 6,
    tags: ["qa", "research"],
    dependencies: [],
    requiresApproval: false
  },
  {
    id: "t6",
    title: "Add CSV export for reports",
    description: "Allow exporting the monthly report table as a CSV file",
    status: "todo",
    priority: "low",
    dueDate: daysFromNow(14),
    coverImage: coverImages[0],
    taskType: "feature",
    estimatedHours: 5,
    tags: ["backend", "reports"],
    dependencies: [],
    requiresApproval: false
  },
  {
    id: "t7",
    title: "Fix duplicate confirmation emails on signup",
    description: "New users sometimes receive the welcome email twice",
    status: "in-progress",
    priority: "medium",
    dueDate: daysFromNow(5),
    assigneeId: "u2",
    taskType: "bug",
    severity: "minor",
    estimatedHours: 2,
    tags: ["backend", "email"],
    dependencies: [],
    requiresApproval: false
  },
  {
    id: "t8",
    title: "Resolve memory leak in background worker",
    description: "Worker process memory grows steadily under sustained load",
    status: "done",
    priority: "high",
    dueDate: daysAgo(50),
    completedAt: daysAgo(45),
    assigneeId: "u4",
    coverImage: coverImages[1],
    taskType: "bug",
    severity: "critical",
    estimatedHours: 20,
    tags: ["backend", "performance"],
    dependencies: [],
    requiresApproval: false
  },
  {
    id: "t9",
    title: "Evaluate GraphQL migration for public API",
    description: "Assess effort and risk of moving the public API from REST to GraphQL",
    status: "in-progress",
    priority: "high",
    dueDate: daysFromNow(21),
    assigneeId: "u1",
    taskType: "research",
    estimatedHours: 12,
    tags: ["api", "research"],
    dependencies: [],
    requiresApproval: false
  },
  {
    id: "t10",
    title: "Redesign checkout flow",
    description: "Simplify the checkout steps to reduce cart abandonment",
    status: "todo",
    priority: "high",
    dueDate: daysFromNow(10),
    assigneeId: "u3",
    coverImage: coverImages[2],
    taskType: "feature",
    estimatedHours: 10,
    tags: ["frontend", "ux"],
    dependencies: [],
    requiresApproval: true,
    approver: "manager-b",
    approvalStatus: "pending"
  },
  {
    id: "t11",
    title: "Add dark mode toggle to settings",
    description: "Let users switch between light and dark themes",
    status: "done",
    priority: "medium",
    dueDate: daysAgo(12),
    completedAt: daysAgo(10),
    assigneeId: "u2",
    coverImage: coverImages[3],
    taskType: "feature",
    estimatedHours: 4,
    tags: ["frontend", "ui"],
    dependencies: [],
    requiresApproval: false
  },
  {
    id: "t12",
    title: "Investigate slow report generation",
    description: "Monthly reports take several minutes to generate for large accounts",
    status: "todo",
    priority: "medium",
    dueDate: daysAgo(1),
    taskType: "bug",
    severity: "major",
    tags: ["backend", "performance"],
    dependencies: [],
    requiresApproval: false
  },
  {
    id: "t13",
    title: "Prototype offline mode for mobile app",
    description: "Explore caching strategies so the app remains usable without a connection",
    status: "in-progress",
    priority: "low",
    dueDate: daysFromNow(30),
    assigneeId: "u4",
    taskType: "research",
    estimatedHours: 3,
    tags: ["mobile", "research"],
    dependencies: [],
    requiresApproval: false
  },
  {
    id: "t14",
    title: "Summarize Q1 support ticket trends",
    description: "Compile recurring themes from last quarter's support tickets",
    status: "done",
    priority: "low",
    dueDate: daysAgo(65),
    completedAt: daysAgo(60),
    assigneeId: "u3",
    taskType: "research",
    estimatedHours: 2,
    tags: ["support", "research"],
    dependencies: [],
    requiresApproval: false
  },
  {
    id: "t15",
    title: "Add keyboard shortcuts to editor",
    description: "Support common keyboard shortcuts for formatting and saving",
    status: "todo",
    priority: "high",
    dueDate: daysFromNow(1),
    assigneeId: "u4",
    taskType: "feature",
    estimatedHours: 6,
    tags: ["frontend"],
    dependencies: ["t1"],
    requiresApproval: false
  },
  {
    id: "t16",
    title: "Migrate billing service to new payment provider",
    description: "Cut over recurring billing to the new provider once contracts are signed",
    status: "in-progress",
    priority: "high",
    dueDate: daysFromNow(15),
    assigneeId: "u1",
    taskType: "feature",
    estimatedHours: 18,
    tags: ["backend", "billing"],
    dependencies: [],
    requiresApproval: true,
    approver: "manager-c",
    approvalStatus: "approved",
    approvalComment: "Budget confirmed, go ahead.",
    approvalDecidedAt: daysAgo(3)
  },
  {
    id: "t17",
    title: "Enable public signups without invite codes",
    description: "Remove the invite-code gate so anyone can self-register",
    status: "todo",
    priority: "medium",
    dueDate: daysFromNow(20),
    assigneeId: "u2",
    taskType: "feature",
    estimatedHours: 6,
    tags: ["backend", "growth"],
    dependencies: [],
    requiresApproval: true,
    approver: "manager-a",
    approvalStatus: "rejected",
    approvalComment: "Needs abuse-prevention measures first.",
    approvalDecidedAt: daysAgo(1)
  }
];

export const users: User[] = [
  {
    id: "u1",
    name: "Alice Johnson",
    email: "alice@example.com",
    role: "admin",
    avatarUrl: `${BASE_URL}/images/avatar-1.jpg`
  },
  {
    id: "u2",
    name: "Bob Smith",
    email: "bob@example.com",
    role: "editor",
    avatarUrl: `${BASE_URL}/images/avatar-2.jpg`
  },
  {
    id: "u3",
    name: "Charlie Davis",
    email: "charlie@example.com",
    role: "editor"
  },
  {
    id: "u4",
    name: "Diana Martinez",
    email: "diana@example.com",
    role: "viewer",
    avatarUrl: `${BASE_URL}/images/avatar-4.jpg`
  }
];
