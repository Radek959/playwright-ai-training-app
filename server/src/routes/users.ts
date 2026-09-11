import { randomUUID } from "node:crypto";
import { Router } from "express";
import { users, User, tasks } from "../data.js";
import { validateUserFields } from "../validation.js";

export const usersRouter = Router();

usersRouter.get("/", (_req, res) => {
  res.json(users);
});

usersRouter.post("/", (req, res) => {
  const body = req.body as Partial<User>;
  const candidate: Partial<User> = {
    name: body.name,
    email: body.email,
    role: body.role ?? "viewer",
    avatar: body.avatar
  };

  const errors = validateUserFields(candidate, { users });
  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  const user: User = {
    id: randomUUID(),
    name: candidate.name!.trim(),
    email: candidate.email!.trim(),
    role: candidate.role!,
    avatar: candidate.avatar
  };
  users.push(user);
  res.status(201).json(user);
});

usersRouter.delete("/:id", (req, res) => {
  const userId = req.params.id;
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return res.status(404).json({ error: "User not found" });

  // Validation: cannot delete user with active tasks
  const activeTasks = tasks.filter((t) => t.assigneeId === userId && t.status !== "done");

  if (activeTasks.length > 0) {
    return res.status(409).json({
      error: "Cannot delete user with active tasks",
      conflictingTasks: activeTasks.map((t) => ({ id: t.id, title: t.title }))
    });
  }

  users.splice(idx, 1);
  res.status(204).end();
});
