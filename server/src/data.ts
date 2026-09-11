export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type TaskType = "bug" | "feature" | "research";
export type TaskSeverity = "critical" | "major" | "minor";

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
    approver: "manager-a"
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
