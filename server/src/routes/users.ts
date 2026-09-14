import { randomUUID } from "node:crypto";
import { Router } from "express";
import { users, User, tasks, comments } from "../data.js";
import {
  NULLABLE_USER_FIELDS,
  USER_UPDATE_FIELDS,
  buildUserCreateCandidate,
  validateUserFields
} from "../validation.js";
// applyAllowedUpdate is a generic "merge a PUT patch onto a record, restricted
// to an allow-list" helper with no task-specific behaviour, so the user
// update below reuses it rather than re-implementing the same allow-list/null
// semantics.
import { applyAllowedUpdate } from "../updateUtils.js";
import { clearCommentAuthor } from "../commentLifecycle.js";
import { activities } from "../data.js";
import { recordTaskUpdated } from "../taskActivityLifecycle.js";

export const usersRouter = Router();

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

usersRouter.get("/", (_req, res) => {
  res.json(users);
});

usersRouter.get("/:id", (req, res) => {
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
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

/**
 * Partial update. Only the fields present in the body are touched; anything
 * omitted keeps its stored value. `avatar: null` clears the avatar, while
 * omitting `avatar` leaves it exactly as it was. Nothing is written until
 * every check has passed, so a rejected request never leaves a partial
 * mutation behind.
 *
 * `id` is not editable, so task assignments (which reference `userId`) and
 * comment authorship stay intact by construction — no task is touched here,
 * and therefore no task activity entry is created either. Previously stored
 * comment `authorName` values are historical snapshots and are deliberately
 * never rewritten when a user is renamed.
 *
 * `avatar` is the canonical, client-editable avatar field; `avatarUrl` is
 * legacy seed data and is never accepted from a client (see
 * USER_UPDATE_FIELDS). Once a request explicitly touches `avatar` — setting
 * it to a new value, or clearing it with `null` — the legacy `avatarUrl` is
 * retired for that user (removed from the stored record) so it can never
 * shadow the edited value, whichever way the client renders "effective
 * avatar". A request that omits `avatar` entirely leaves both fields exactly
 * as they were.
 */
usersRouter.put("/:id", (req, res) => {
  const idx = users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "User not found" });
  const existing = users[idx];

  if (!isPlainObject(req.body)) {
    return res.status(400).json({
      error: "Validation failed",
      details: [{ field: "body", message: "request body must be a JSON object" }]
    });
  }

  const avatarTouched = Object.prototype.hasOwnProperty.call(req.body, "avatar");

  const updateResult = applyAllowedUpdate(
    existing as unknown as Record<string, unknown>,
    req.body,
    USER_UPDATE_FIELDS,
    NULLABLE_USER_FIELDS
  );
  if (!updateResult.ok) {
    return res.status(400).json({ error: "Validation failed", details: updateResult.errors });
  }
  const merged = updateResult.merged;

  // The exact same rules user creation applies, with this user excluded from
  // the email-uniqueness check so resending an unchanged email is not a
  // conflict with itself.
  const errors = validateUserFields(merged, { users, userId: existing.id });
  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  const updated: User = {
    ...(merged as User),
    id: existing.id,
    name: (merged.name as string).trim(),
    email: (merged.email as string).trim()
  };
  if (avatarTouched) {
    delete updated.avatarUrl;
  }
  users[idx] = updated;

  res.json(updated);
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
      conflictingTasks: activeTasks.map((t) => ({ id: t.id, title: t.title, status: t.status }))
    });
  }

  users.splice(idx, 1);

  // Clear assigneeId in remaining tasks (completed ones, as active ones block deletion)
  for (const t of tasks) {
    if (t.assigneeId === userId) {
      const existing = { ...t };
      t.assigneeId = undefined;
      const activity = recordTaskUpdated(t.id, existing as unknown as Record<string, unknown>, t as unknown as Record<string, unknown>);
      if (activity) activities.push(activity);
    }
  }

  // Comments this user authored are kept (authorName stays as the snapshot
  // taken at creation time); only the now-dangling authorId is cleared.
  clearCommentAuthor(comments, userId);

  res.status(204).end();
});
