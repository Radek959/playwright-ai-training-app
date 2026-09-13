import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "./Dialog";
import { ApiError, toApiError, type ConflictingTask } from "../utils/apiError";
import type { User } from "../types";

type Props = {
  user: User;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
};

const TITLE_ID = "delete-user-dialog-title";
const ERROR_ID = "delete-user-dialog-error";

export function DeleteUserDialog({ user, open, onClose, onDeleted }: Props) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictingTasks, setConflictingTasks] = useState<ConflictingTask[]>([]);
  const [notFound, setNotFound] = useState(false);

  // Old errors from a previous attempt must not survive a close/reopen cycle.
  useEffect(() => {
    if (open) {
      setError(null);
      setConflictingTasks([]);
      setNotFound(false);
      setIsDeleting(false);
    }
  }, [open]);

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setError(null);
    setConflictingTasks([]);
    setNotFound(false);
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (res.status === 204) {
        onDeleted();
        return;
      }
      if (res.status === 409) {
        const apiErr = await toApiError(res, "Cannot delete user with active tasks");
        setError(apiErr.message);
        setConflictingTasks(apiErr.conflictingTasks);
        return;
      }
      if (res.status === 404) {
        setNotFound(true);
        setError("This user no longer exists.");
        return;
      }
      const apiErr = await toApiError(res, `Delete failed: ${res.status}`);
      throw apiErr;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Network error while deleting the user. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} titleId={TITLE_ID} initialFocusRef={cancelButtonRef} testId="delete-user-dialog">
      <div className="flex flex-col gap-4">
        <h2 id={TITLE_ID} className="text-xl font-bold text-gray-900">
          Delete {user.name}?
        </h2>
        <p className="text-sm text-gray-700">
          This action cannot be undone. {user.name} can only be deleted if they have no active (to-do or in-progress)
          tasks assigned.
        </p>

        {error && (
          <div id={ERROR_ID} role="alert" className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-700 space-y-2">
            <p className="font-medium">{error}</p>
            {notFound && (
              <Link to="/users" className="text-indigo-600 hover:underline">
                Back to users list
              </Link>
            )}
            {conflictingTasks.length > 0 && (
              <ul className="list-disc pl-5 space-y-1">
                {conflictingTasks.map((task) => (
                  <li key={task.id}>
                    <span>{task.title}</span>{" "}
                    <span className="capitalize text-red-600">({task.status})</span>{" "}
                    <Link to={`/tasks/${task.id}`} className="text-indigo-600 hover:underline">
                      View details
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-2">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onClose}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-describedby={error ? ERROR_ID : undefined}
            className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
          >
            {isDeleting ? "Deleting…" : "Delete user"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
