import { randomUUID } from "node:crypto";
import { Comment } from "./data.js";

export const COMMENT_CONTENT_MAX_LENGTH = 1000;

const compareStrings = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Returns a new array sorted oldest-to-newest by `createdAt`. Comments with
 * an identical `createdAt` (possible since the server clock has finite
 * resolution) are then ordered by `id`, so the response order is always
 * deterministic rather than depending on incidental array/insertion order.
 */
export function sortComments(comments: Comment[]): Comment[] {
  return [...comments].sort(
    (a, b) => compareStrings(a.createdAt, b.createdAt) || compareStrings(a.id, b.id)
  );
}

/**
 * Builds a new comment record. `id` and `createdAt` are always
 * server-generated — the caller only supplies the already-validated
 * `taskId`/`authorId`/`authorName`/`content`. `now`/`id` are injectable so
 * tests can assert on exact values instead of depending on the real clock or
 * on the shape of a real UUID.
 */
export function buildComment(
  params: { taskId: string; authorId: string; authorName: string; content: string },
  now: () => string = () => new Date().toISOString(),
  id: () => string = randomUUID
): Comment {
  return {
    id: id(),
    taskId: params.taskId,
    content: params.content,
    authorId: params.authorId,
    authorName: params.authorName,
    createdAt: now()
  };
}

/**
 * Removes every comment belonging to `taskId`, in place. Used when a task is
 * deleted so it never leaves orphaned comments behind.
 */
export function removeCommentsForTask(comments: Comment[], taskId: string): void {
  for (let i = comments.length - 1; i >= 0; i--) {
    if (comments[i].taskId === taskId) {
      comments.splice(i, 1);
    }
  }
}

/**
 * Clears `authorId` on every comment authored by `userId`, in place, while
 * leaving `authorName` (and everything else) untouched. Used when a user is
 * deleted: their past comments are kept, but no longer point at a user
 * record that no longer exists.
 */
export function clearCommentAuthor(comments: Comment[], userId: string): void {
  for (const comment of comments) {
    if (comment.authorId === userId) {
      comment.authorId = undefined;
    }
  }
}
