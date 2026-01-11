export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  assigneeId?: string;
  coverImage?: string;
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

export const tasks: Task[] = [
  {
    id: "t1",
    title: "Implement user authentication",
    description: "Add OAuth2 authentication with Google and GitHub providers",
    status: "in-progress",
    priority: "high",
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    assigneeId: "u1",
    coverImage: coverImages[0]
  },
  {
    id: "t2",
    title: "Design new landing page",
    description: "Create modern, responsive landing page with hero section",
    status: "todo",
    priority: "medium",
    dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
    assigneeId: "u2",
    coverImage: coverImages[1]
  },
  {
    id: "t3",
    title: "Fix mobile navigation bug",
    description: "Navigation menu doesn't close on mobile devices",
    status: "todo",
    priority: "high",
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    assigneeId: "u3",
    coverImage: coverImages[2]
  },
  {
    id: "t4",
    title: "Update documentation",
    description: "Add API documentation and code examples",
    status: "done",
    priority: "low",
    dueDate: new Date(Date.now() - 86400000 * 5).toISOString(),
    assigneeId: "u1",
    coverImage: coverImages[3]
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
    role: "editor",
    avatarUrl: `${BASE_URL}/images/broken-avatar.jpg` // Intentionally broken for testing
  },
  { 
    id: "u4", 
    name: "Diana Martinez", 
    email: "diana@example.com", 
    role: "viewer",
    avatarUrl: `${BASE_URL}/images/avatar-4.jpg`
  }
];

export type LabState = {
  chaos: boolean;
  a11y: boolean;
  apiFlaky: boolean;
};

export const labState: LabState = {
  chaos: false,
  a11y: false,
  apiFlaky: false
};
