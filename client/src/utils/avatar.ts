import type { User } from "../types";

/**
 * A user's "effective avatar": the image URL that should actually be shown
 * for them, wherever a user is displayed (lists, detail views, dashboards,
 * task assignees, edit forms).
 *
 * `avatar` is the canonical, client-editable field and always wins when set.
 * `avatarUrl` is legacy seed data kept only for backward compatibility, and
 * is used strictly as a fallback for users that predate the `avatar` field
 * and have never had it set. Once a user's `avatar` has been explicitly
 * edited (including cleared), the server retires `avatarUrl` for that user
 * (see PUT /api/users/:id), so this fallback never resurfaces a stale image
 * after an edit.
 */
export function effectiveAvatar(user: Pick<User, "avatar" | "avatarUrl"> | null | undefined): string | undefined {
  if (!user) return undefined;
  if (user.avatar) return user.avatar;
  if (user.avatarUrl) return user.avatarUrl;
  return undefined;
}
