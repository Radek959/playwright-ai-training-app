import { randomUUID } from "node:crypto";
import { Router } from "express";
import { users, User, tasks } from "../data.js";
import { buildUserCreateCandidate, validateUserFields } from "../validation.js";

export const usersRouter = Router();

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

usersRouter.get("/", (_req, res) => {
  res.json(users);
});

usersRouter.post("/", (req, res) => {
  if (!isPlainObject(req.body)) {
    return res.status(400).json({
      error: "Validation failed",
      details: [{ field: "body", message: "request body must be a JSON object" }]
    });
  }
  const body = req.body;
  const candidate = buildUserCreateCandidate(body);

  const errors = validateUserFields(candidate, { users });
  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  const user: User = {
    id: randomUUID(),
    name: (candidate.name as string).trim(),
    email: (candidate.email as string).trim(),
    role: candidate.role as User["role"],
    avatar: candidate.avatar as string | undefined
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

  // Clear assigneeId in remaining tasks (completed ones, as active ones block deletion)
  for (const t of tasks) {
    if (t.assigneeId === userId) {
      t.assigneeId = undefined;
    }
  }

  res.status(204).end();
});
