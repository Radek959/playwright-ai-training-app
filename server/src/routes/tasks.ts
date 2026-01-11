import { randomUUID } from "node:crypto";
import { Router, RequestHandler } from "express";
import { tasks, Task, TaskStatus, TaskPriority, labState } from "../data.js";

export const tasksRouter = Router();

const maybeFlaky: RequestHandler = async (req, res, next) => {
  const flakyQuery = req.query.flaky || req.query.lab_api_flaky === "true";
  if (!flakyQuery && !labState.apiFlaky) return next();
  const roll = Math.random();
  if (roll < 0.25) return res.status(500).json({ error: "Random failure" });
  if (roll < 0.5) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    return next();
  }
  if (roll < 0.75) return res.json({ bogus: true });
  return next();
};

tasksRouter.use(maybeFlaky);

tasksRouter.get("/", (_req, res) => {
  res.json(tasks);
});

tasksRouter.get("/search", (req, res) => {
  const query = (req.query.q as string || "").toLowerCase();
  
  if (query.length < 2) {
    return res.json([]);
  }
  
  const results = tasks.filter((t) =>
    t.title.toLowerCase().includes(query) ||
    t.description?.toLowerCase().includes(query)
  );
  
  // Simulate network delay for async testing
  const delay = Math.random() * 500 + 200;
  setTimeout(() => {
    res.json(results.slice(0, 10));
  }, delay);
});

tasksRouter.post("/", (req, res) => {
  const { title, description, status, priority, dueDate, assigneeId, dependencies = [], tags = [] } = req.body as Partial<Task & { dependencies: string[]; tags: string[] }>;
  if (!title) return res.status(400).json({ error: "title is required" });
  const statusOk = (value: any): value is TaskStatus =>
    value === "todo" || value === "in-progress" || value === "done";
  const priorityOk = (value: any): value is TaskPriority =>
    value === "low" || value === "medium" || value === "high";
  if (status && !statusOk(status)) return res.status(400).json({ error: "invalid status" });
  if (priority && !priorityOk(priority)) return res.status(400).json({ error: "invalid priority" });

  // Validate dependencies exist
  if (dependencies && Array.isArray(dependencies)) {
    const invalidDeps = dependencies.filter((id: string) => !tasks.find((t) => t.id === id));
    if (invalidDeps.length > 0) {
      return res.status(400).json({
        error: "Invalid dependencies",
        invalidIds: invalidDeps
      });
    }
  }

  const task: Task = {
    id: randomUUID(),
    title,
    description,
    status: status ?? "todo",
    priority: priority ?? "medium",
    dueDate,
    assigneeId
  };
  tasks.push(task);
  res.status(201).json(task);
});

tasksRouter.put("/:id", (req, res) => {
  const idx = tasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  const existing = tasks[idx];
  const { title, description, status, priority, dueDate, assigneeId } = req.body as Partial<Task>;
  if (status && !["todo", "in-progress", "done"].includes(status)) {
    return res.status(400).json({ error: "invalid status" });
  }
  if (priority && !["low", "medium", "high"].includes(priority)) {
    return res.status(400).json({ error: "invalid priority" });
  }
  const updated: Task = {
    ...existing,
    title: title ?? existing.title,
    description: description ?? existing.description,
    status: (status as TaskStatus | undefined) ?? existing.status,
    priority: (priority as TaskPriority | undefined) ?? existing.priority,
    dueDate: dueDate ?? existing.dueDate,
    assigneeId: assigneeId ?? existing.assigneeId
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
