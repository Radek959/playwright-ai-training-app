import { randomUUID } from "node:crypto";
import { Router } from "express";
import { tasks, users, Task } from "../data.js";
import { NULLABLE_TASK_FIELDS, TASK_UPDATE_FIELDS, ValidationError, validateTaskFields } from "../validation.js";

export const tasksRouter = Router();

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const badBodyResponse = () => ({
  error: "Validation failed",
  details: [{ field: "body", message: "request body must be a JSON object" }] as ValidationError[]
});

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
  if (!isPlainObject(req.body)) {
    return res.status(400).json(badBodyResponse());
  }
  const body = req.body;
  const candidate: Record<string, unknown> = {
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

  const status = candidate.status as Task["status"];
  const completedAt = status === "done" ? (body.completedAt as string | undefined) ?? new Date().toISOString() : undefined;

  const task: Task = {
    id: randomUUID(),
    title: (candidate.title as string).trim(),
    description: candidate.description as string | undefined,
    status,
    priority: candidate.priority as Task["priority"],
    dueDate: (candidate.dueDate as string | undefined) || undefined,
    completedAt,
    assigneeId: (candidate.assigneeId as string | undefined) || undefined,
    taskType: candidate.taskType as Task["taskType"],
    estimatedHours: candidate.estimatedHours as number | undefined,
    tags: candidate.tags as string[] | undefined,
    dependencies: candidate.dependencies as string[] | undefined,
    severity: candidate.severity as Task["severity"],
    requiresApproval: candidate.requiresApproval as boolean | undefined,
    approver: candidate.approver as string | undefined
  };
  tasks.push(task);
  res.status(201).json(task);
});

tasksRouter.put("/:id", (req, res) => {
  const idx = tasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  const existing = tasks[idx];

  if (!isPlainObject(req.body)) {
    return res.status(400).json(badBodyResponse());
  }
  const patch = req.body;

  // Only an explicit allow-list of fields may be updated. "id" always gets
  // its own message; anything else outside TaskUpdateInput is rejected too,
  // so a stray/unknown key never silently mutates the stored task.
  const fieldErrors: ValidationError[] = [];
  for (const key of Object.keys(patch)) {
    if (key === "id") {
      fieldErrors.push({ field: "id", message: "id cannot be updated" });
    } else if (!TASK_UPDATE_FIELDS.includes(key)) {
      fieldErrors.push({ field: key, message: `${key} is not an updatable field` });
    }
  }
  if (fieldErrors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: fieldErrors });
  }

  // Merge onto a copy of the existing task. An explicit `null` on a
  // nullable field clears it (deletes the key); any other field with
  // `null` is a validation error, not a silent no-op.
  const merged: Record<string, unknown> = { ...existing };
  for (const key of TASK_UPDATE_FIELDS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value === null) {
      if (!NULLABLE_TASK_FIELDS.has(key)) {
        fieldErrors.push({ field: key, message: `${key} cannot be null` });
        continue;
      }
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  if (fieldErrors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: fieldErrors });
  }

  const errors = validateTaskFields(merged, { users, tasks, taskId: existing.id });
  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  let completedAt = merged.completedAt as string | undefined;
  if (merged.status === "done" && !completedAt) {
    completedAt = new Date().toISOString();
  } else if (merged.status !== "done") {
    completedAt = undefined;
  }

  const updated: Task = {
    ...(merged as Task),
    id: existing.id,
    title: (merged.title as string).trim(),
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
