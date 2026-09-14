import type { Comment } from "../types";

/**
 * Orders comments the same way the server does (see server/src/commentLifecycle.ts
 * sortComments): oldest to newest by `createdAt`, then by `id` to break ties
 * on an identical `createdAt` deterministically. Used both for the initial
 * GET response and after a successful POST, so a freshly added comment is
 * always merged into its correct position instead of being appended blindly
 * — the two must never drift into different orderings for the same data.
 */
export function sortComments(comments: Comment[]): Comment[] {
  return [...comments].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  });
}
