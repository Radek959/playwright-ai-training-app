import { Router } from "express";
import { users, User, UserRole, tasks } from "../data.js";

export const usersRouter = Router();

usersRouter.get("/", (_req, res) => {
  res.json(users);
});

usersRouter.post("/", (req, res) => {
  const { name, email, role, avatar } = req.body as Partial<User>;
  if (!name) return res.status(400).json({ error: "name is required" });
  if (!email) return res.status(400).json({ error: "email is required" });
  const roleOk = (value: any): value is UserRole =>
    value === "admin" || value === "editor" || value === "viewer";
  const safeRole = role && roleOk(role) ? role : "viewer";
  const user: User = {
    id: `u-${users.length + 1}`,
    name,
    email,
    role: safeRole,
    avatar
  };
  users.push(user);
  res.status(201).json(user);
});

usersRouter.delete("/:id", (req, res) => {
  const userId = req.params.id;
  
  // Validation: cannot delete user with active tasks
  const activeTasks = tasks.filter(
    t => t.assigneeId === userId && t.status !== "done"
  );
  
  if (activeTasks.length > 0) {
    return res.status(409).json({
      error: "Cannot delete user with active tasks",
      conflictingTasks: activeTasks.map(t => ({ id: t.id, title: t.title }))
    });
  }
  
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return res.status(404).json({ error: "User not found" });
  
  users.splice(idx, 1);
  res.status(204).end();
});
