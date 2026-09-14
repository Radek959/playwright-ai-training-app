import { FormEvent, useCallback, useEffect, useState } from "react";
import { toApiError } from "../utils/apiError";
import type { Comment, User } from "../types";

type FetchState = "loading" | "success" | "error";

type Props = {
  taskId: string;
};

const renderDate = (dateStr: string) => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return <time dateTime={d.toISOString()}>{d.toLocaleString()}</time>;
};

/**
 * The "Comments" section of the task details view. There is no login in
 * this app: the author is picked explicitly from the user list, and adding
 * a comment records it on that user's behalf without confirming their
 * identity in any way. Comments and the author list are each fetched and
 * retried independently, so a failure in one never breaks the other or the
 * rest of the task details view.
 */
export function CommentsSection({ taskId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsState, setCommentsState] = useState<FetchState>("loading");
  const [users, setUsers] = useState<User[]>([]);
  const [usersState, setUsersState] = useState<FetchState>("loading");

  const [authorId, setAuthorId] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setCommentsState("loading");
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Unexpected payload");
      setComments(data as Comment[]);
      setCommentsState("success");
    } catch (err) {
      console.warn("Failed to fetch comments", err);
      setCommentsState("error");
    }
  }, [taskId]);

  const loadUsers = useCallback(async () => {
    setUsersState("loading");
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Unexpected payload");
      setUsers(data as User[]);
      setUsersState("success");
    } catch (err) {
      console.warn("Failed to fetch users", err);
      setUsersState("error");
    }
  }, []);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!authorId) {
      setFormError("Select an author before adding a comment.");
      return;
    }
    if (content.trim().length === 0) {
      setFormError("Comment cannot be empty.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorId, content })
      });
      if (!res.ok) {
        throw await toApiError(res, `Failed to add comment: ${res.status}`);
      }
      const created = (await res.json()) as Comment;
      setComments((prev) => [...prev, created]);
      setContent("");
      // authorId is intentionally kept selected for the next comment.
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  const formDisabled = usersState !== "success";

  return (
    <section className="mt-8" data-testid="comments-section">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Comments</h2>

      {commentsState === "loading" && (
        <p className="text-gray-500" aria-live="polite" data-testid="comments-loading">
          Loading comments...
        </p>
      )}

      {commentsState === "error" && (
        <div
          role="alert"
          className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-700 flex items-center justify-between gap-3 mb-4"
          data-testid="comments-error"
        >
          <span>Failed to load comments.</span>
          <button
            type="button"
            onClick={loadComments}
            data-testid="comments-retry-btn"
            className="border border-red-400 text-red-800 rounded px-3 py-1 text-sm font-medium hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {commentsState === "success" && (
        comments.length === 0 ? (
          <p className="text-gray-900 mb-4" data-testid="comments-empty">No comments yet</p>
        ) : (
          <ul className="space-y-3 mb-6" data-testid="comments-list">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className="p-3 rounded border border-gray-100 bg-gray-50"
                data-testid={`comment-${comment.id}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                  <span className="font-medium text-gray-900">
                    {comment.authorName}
                    {!comment.authorId && (
                      <span
                        className="ml-2 inline-block bg-gray-200 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded align-middle"
                        data-testid={`comment-deleted-user-${comment.id}`}
                      >
                        Deleted user
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-gray-500">{renderDate(comment.createdAt)}</span>
                </div>
                <p className="text-gray-900 whitespace-pre-wrap">{comment.content}</p>
              </li>
            ))}
          </ul>
        )
      )}

      {usersState === "error" ? (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-300 rounded p-3 text-sm text-amber-800 flex items-center justify-between gap-3"
          data-testid="comments-authors-error"
        >
          <span>Unable to load the list of authors, so a new comment cannot be added right now.</span>
          <button
            type="button"
            onClick={loadUsers}
            data-testid="comments-authors-retry-btn"
            className="border border-amber-400 text-amber-900 rounded px-3 py-1 text-sm font-medium hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800"
          >
            Retry
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" data-testid="add-comment-form">
          {formError && (
            <div role="alert" className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-700" data-testid="comment-form-error">
              {formError}
            </div>
          )}

          <div>
            <label htmlFor="comment-author-select" className="text-sm font-semibold text-slate-700 block mb-1">
              Author
            </label>
            <select
              id="comment-author-select"
              value={authorId}
              disabled={formDisabled || submitting}
              onChange={(e) => setAuthorId(e.target.value)}
              data-testid="comment-author-select"
              className="border rounded px-3 py-2 w-full max-w-xs disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <option value="">Select author</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="comment-content-input" className="text-sm font-semibold text-slate-700 block mb-1">
              Comment
            </label>
            <textarea
              id="comment-content-input"
              rows={3}
              maxLength={1000}
              value={content}
              disabled={formDisabled || submitting}
              onChange={(e) => setContent(e.target.value)}
              data-testid="comment-content-input"
              className="border rounded px-3 py-2 w-full disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            />
          </div>

          <p className="text-xs text-gray-500" data-testid="comment-on-behalf-note">
            The comment will be saved on behalf of the selected author. This app has no login, so this does not confirm their identity.
          </p>

          <div>
            <button
              type="submit"
              disabled={formDisabled || submitting}
              data-testid="add-comment-btn"
              className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-800"
            >
              {submitting ? "Adding…" : "Add comment"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
