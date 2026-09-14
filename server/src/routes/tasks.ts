import { randomUUID } from "node:crypto";
import { Router } from "express";
import { tasks, users, Task } from "../data.js";
import {
  NULLABLE_TASK_FIELDS,
  TASK_UPDATE_FIELDS,
  ValidationError,
  buildTaskCreateCandidate,
  validateTaskFields
} from "../validation.js";
import {
  APPROVAL_COMMENT_MAX_LENGTH,
  applyAllowedUpdate,
  applyApprovalDecision,
  applyApprovalTransition,
  findApprovalBlocker,
  findBlockingDependencies,
  normalizeApprovalComment,
  resolveCompletedAt
} from "../taskLifecycle.js";

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
  const candidate = buildTaskCreateCandidate(body);

  const errors = validateTaskFields(candidate, { users, tasks });
  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  const status = candidate.status as Task["status"];

  if (status === "done") {
    const blockingDependencies = findBlockingDependencies(candidate.dependencies as string[] | undefined, tasks);
    if (blockingDependencies.length > 0) {
      return res.status(409).json({ error: "Cannot complete task with incomplete dependencies", blockingDependencies });
    }
  }

  const completedAt = resolveCompletedAt(status, candidate.completedAt as string | undefined);

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
  // A freshly created task never has a prior approval state, so this only
  // ever starts a "pending" process (requiresApproval true) or leaves the
  // task with none (requiresApproval false).
  applyApprovalTransition({}, task as unknown as Record<string, unknown>);

  if (status === "done") {
    const approvalBlocker = findApprovalBlocker(task);
    if (approvalBlocker) {
      return res.status(409).json({ error: "Cannot complete task without approval", approvalBlocker });
    }
  }

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

  const updateResult = applyAllowedUpdate(existing, patch, TASK_UPDATE_FIELDS, NULLABLE_TASK_FIELDS);
  if (!updateResult.ok) {
    return res.status(400).json({ error: "Validation failed", details: updateResult.errors });
  }
  const merged = updateResult.merged;

  const errors = validateTaskFields(merged, { users, tasks, taskId: existing.id });
  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  const resultStatus = merged.status as Task["status"];

  if (resultStatus === "done") {
    const blockingDependencies = findBlockingDependencies(merged.dependencies as string[] | undefined, tasks);
    if (blockingDependencies.length > 0) {
      return res.status(409).json({ error: "Cannot complete task with incomplete dependencies", blockingDependencies });
    }
  }

  // Starts/resets/clears the approval process based on how requiresApproval
  // and the other significant fields moved. Mutates `merged` in place;
  // approvalStatus/approvalComment/approvalDecidedAt are never accepted
  // directly from the request body (see TASK_UPDATE_FIELDS).
  applyApprovalTransition(existing as unknown as Record<string, unknown>, merged);

  if (resultStatus === "done") {
    const approvalBlocker = findApprovalBlocker(merged as unknown as Task);
    if (approvalBlocker) {
      return res.status(409).json({ error: "Cannot complete task without approval", approvalBlocker });
    }
  }

  const completedAt = resolveCompletedAt(resultStatus, merged.completedAt as string | undefined);

  const updated: Task = {
    ...(merged as Task),
    id: existing.id,
    title: (merged.title as string).trim(),
    completedAt
  };
  tasks[idx] = updated;
  res.json(updated);
});

tasksRouter.put("/:id/approval", (req, res) => {
  const idx = tasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  const existing = tasks[idx];

  if (!isPlainObject(req.body)) {
    return res.status(400).json(badBodyResponse());
  }
  const body = req.body;

  const errors: ValidationError[] = [];
  const decision = body.decision;
  if (decision !== "approved" && decision !== "rejected") {
    errors.push({ field: "decision", message: "decision must be 'approved' or 'rejected'" });
  }
  if (body.comment !== undefined && body.comment !== null && typeof body.comment !== "string") {
    errors.push({ field: "comment", message: "comment must be a string" });
  }
  if (typeof body.comment === "string" && body.comment.trim().length > APPROVAL_COMMENT_MAX_LENGTH) {
    errors.push({ field: "comment", message: `comment must be at most ${APPROVAL_COMMENT_MAX_LENGTH} characters` });
  }
  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  if (!existing.requiresApproval) {
    return res.status(409).json({ error: "Task does not require approval" });
  }

  const comment = normalizeApprovalComment(body.comment);
  const outcome = applyApprovalDecision(existing, decision as "approved" | "rejected", comment);
  if (!outcome.ok) {
    return res.status(409).json({ error: "Approval decision conflict", currentApproval: outcome.currentApproval });
  }

  tasks[idx] = outcome.task;
  res.json(outcome.task);
});

tasksRouter.delete("/:id", (req, res) => {
  const taskId = req.params.id;
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  
  tasks.splice(idx, 1);
  
  // Remove deleted task ID from dependencies of all other tasks
  for (const t of tasks) {
    if (t.dependencies) {
      t.dependencies = t.dependencies.filter((depId) => depId !== taskId);
    }
  }
  
  res.status(204).end();
});
