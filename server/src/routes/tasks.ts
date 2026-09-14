import { randomUUID } from "node:crypto";
import { Router } from "express";
import { tasks, users, comments, Comment, Task } from "../data.js";
import {
  NULLABLE_TASK_FIELDS,
  TASK_UPDATE_FIELDS,
  ValidationError,
  buildTaskCreateCandidate,
  validateCommentCreateFields,
  validateTaskFields
} from "../validation.js";
import {
  APPROVAL_COMMENT_MAX_LENGTH,
  applyApprovalDecision,
  applyApprovalTransition,
  findApprovalBlocker,
  findBlockingDependencies,
  normalizeApprovalComment,
  resolveCompletedAt,
  significantFieldsChanged
} from "../taskLifecycle.js";
import { applyAllowedUpdate } from "../updateUtils.js";
import { findDependencyCycle } from "../taskDependencyGraph.js";
import { searchTasks } from "../taskSearch.js";
import { buildComment, removeCommentsForTask, sortComments } from "../commentLifecycle.js";
import { activities } from "../data.js";
import {
  recordTaskCreated,
  recordTaskUpdated,
  recordApprovalDecided,
  sortActivitiesForTask,
  removeActivitiesForTask
} from "../taskActivityLifecycle.js";

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

// Matching, ranking and the result cap all live in searchTasks (see
// taskSearch.ts); this route only turns the request into its arguments. A
// repeated ?q= yields an array rather than a string, which is treated as no
// query at all instead of being coerced into a surprising one.
tasksRouter.get("/search", (req, res) => {
  const rawQuery = typeof req.query.q === "string" ? req.query.q : "";
  res.json(searchTasks(tasks, rawQuery, users));
});

tasksRouter.get("/:id", (req, res) => {
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "not found" });
  res.json(task);
});

tasksRouter.get("/:id/activity", (req, res) => {
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "not found" });

  // Newest first by createdAt; ties broken deterministically by insertion
  // order (see sortActivitiesForTask), not by the activity's random id.
  res.json(sortActivitiesForTask(activities, task.id));
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
  activities.push(recordTaskCreated(task));
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

  const errors = validateTaskFields(merged, { users, tasks });
  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  // Checked against the graph as it *would* be once this patch is saved: the
  // stored tasks with the edited one swapped for the merged result. Runs
  // before anything is written, so a rejected request leaves the task — and
  // the activity log — completely untouched.
  const cycle = findDependencyCycle(
    tasks.map((t) => (t.id === existing.id ? { id: t.id, dependencies: merged.dependencies as string[] | undefined } : t)),
    existing.id
  );
  if (cycle) {
    const titleOf = (id: string) =>
      id === existing.id ? (merged.title as string).trim() : (tasks.find((t) => t.id === id)?.title ?? id);
    return res.status(409).json({
      error: "Cannot save cyclic task dependencies",
      dependencyCycle: cycle.map((id) => ({ id, title: titleOf(id) }))
    });
  }

  let resultStatus = merged.status as Task["status"];

  // A significant edit to a completed, approved task is about to reset its
  // approval back to "pending" (see applyApprovalTransition below), which
  // would otherwise conflict with the task remaining "done" — a done task
  // must always be either approved or approval-exempt. Rather than reject
  // the whole update, reopen the task atomically as part of the same PUT:
  // move it back to "in-progress" and clear completedAt. This only fires on
  // a genuine value change (see significantFieldsChanged) — a no-op resend
  // or a status-only change never reopens the task.
  const wasDoneApproved =
    existing.status === "done" && existing.requiresApproval === true && existing.approvalStatus === "approved";
  if (
    wasDoneApproved &&
    resultStatus === "done" &&
    significantFieldsChanged(existing as unknown as Record<string, unknown>, merged)
  ) {
    merged.status = "in-progress" satisfies Task["status"];
    delete merged.completedAt;
    resultStatus = "in-progress";
  }

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

  const activity = recordTaskUpdated(existing.id, existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>);
  if (activity) {
    activities.push(activity);
  }

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
  // `comment` is optional per the contract, but an explicit `null` is not
  // part of it (unlike the nullable fields on plain task PUTs) — it is
  // rejected here just like any other wrong-typed value.
  if (body.comment !== undefined && typeof body.comment !== "string") {
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

  const activity = recordApprovalDecided(existing.id, existing as unknown as Record<string, unknown>, outcome.task as unknown as Record<string, unknown>);
  if (activity) {
    activities.push(activity);
  }

  res.json(outcome.task);
});

tasksRouter.delete("/:id", (req, res) => {
  const taskId = req.params.id;
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return res.status(404).json({ error: "not found" });

  tasks.splice(idx, 1);
  removeActivitiesForTask(activities, taskId);

  // Remove deleted task ID from dependencies of all other tasks
  for (const t of tasks) {
    if (t.dependencies && t.dependencies.includes(taskId)) {
      const existing = { ...t };
      t.dependencies = t.dependencies.filter((depId) => depId !== taskId);
      const activity = recordTaskUpdated(t.id, existing as unknown as Record<string, unknown>, t as unknown as Record<string, unknown>);
      if (activity) {
        activities.push(activity);
      }
    }
  }

  removeCommentsForTask(comments, taskId);

  res.status(204).end();
});

tasksRouter.get("/:id/comments", (req, res) => {
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "not found" });

  const taskComments = comments.filter((c) => c.taskId === task.id);
  res.json(sortComments(taskComments));
});

tasksRouter.post("/:id/comments", (req, res) => {
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "not found" });

  if (!isPlainObject(req.body)) {
    return res.status(400).json(badBodyResponse());
  }
  const body = req.body;

  const errors = validateCommentCreateFields(body, { users });
  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  const author = users.find((u) => u.id === body.authorId);
  const comment: Comment = buildComment({
    taskId: task.id,
    authorId: author!.id,
    authorName: author!.name,
    content: (body.content as string).trim()
  });

  comments.push(comment);
  res.status(201).json(comment);
});
