import { randomUUID } from "node:crypto";
import { Router } from "express";
import { tasks, users, Task } from "../data.js";
import { validateTaskFields } from "../validation.js";

export const tasksRouter = Router();

tasksRouter.get("/", (_req, res) => {
  res.json(tasks);
});

tasksRouter.get("/search", (req, res) => {
  const query = ((req.query.q as string) || "").toLowerCase();

  if (query.length < 2) {
    return res.json([]);
  }

  const results = tasks.filter(
    (t) => t.title.toLowerCase().includes(query) || t.description?.toLowerCase().includes(query)
  );

  res.json(results.slice(0, 10));
});

tasksRouter.get("/:id", (req, res) => {
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "not found" });
  res.json(task);
});

tasksRouter.post("/", (req, res) => {
  const body = req.body as Partial<Task>;
  const candidate: Partial<Task> = {
    title: body.title,
    description: body.description,
    status: body.status ?? "todo",
    priority: body.priority ?? "medium",
    dueDate: body.dueDate,
    assigneeId: body.assigneeId,
    taskType: body.taskType,
    estimatedHours: body.estimatedHours,
    tags: body.tags ?? [],
    dependencies: body.dependencies ?? [],
    severity: body.severity,
    requiresApproval: body.requiresApproval ?? false,
    approver: body.approver
  };

  const errors = validateTaskFields(candidate, { users, tasks });
  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  const completedAt = candidate.status === "done" ? body.completedAt ?? new Date().toISOString() : undefined;

  const task: Task = {
    id: randomUUID(),
    title: candidate.title!.trim(),
    description: candidate.description,
    status: candidate.status!,
    priority: candidate.priority!,
    dueDate: candidate.dueDate || undefined,
    completedAt,
    assigneeId: candidate.assigneeId || undefined,
    taskType: candidate.taskType,
    estimatedHours: candidate.estimatedHours,
    tags: candidate.tags,
    dependencies: candidate.dependencies,
    severity: candidate.severity,
    requiresApproval: candidate.requiresApproval,
    approver: candidate.approver
  };
  tasks.push(task);
  res.status(201).json(task);
});

tasksRouter.put("/:id", (req, res) => {
  const idx = tasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  const existing = tasks[idx];
  const patch = req.body as Partial<Task>;

  const merged: Partial<Task> = {
    ...existing,
    ...patch
  };

  const errors = validateTaskFields(merged, { users, tasks, taskId: existing.id });
  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  let completedAt = merged.completedAt ?? existing.completedAt;
  if (merged.status === "done" && !completedAt) {
    completedAt = new Date().toISOString();
  } else if (merged.status !== "done") {
    completedAt = undefined;
  }

  const updated: Task = {
    ...existing,
    ...merged,
    title: merged.title!.trim(),
    completedAt
  };
  tasks[idx] = updated;
  res.json(updated);
});

tasksRouter.delete("/:id", (req, res) => {
  const idx = tasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  tasks.splice(idx, 1);
  res.status(204).end();
});
