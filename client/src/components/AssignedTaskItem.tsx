import { Link } from "react-router-dom";
import type { Task } from "../types";

export function AssignedTaskItem({ task }: { task: Task }) {
  return (
    <li className="p-3 rounded border border-gray-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="space-y-1">
        <span className="font-medium text-gray-900">{task.title}</span>
        <div className="flex flex-wrap gap-2 text-xs text-gray-600">
          <span className="capitalize">{task.status}</span>
          <span aria-hidden="true">&middot;</span>
          <span className="capitalize">Priority: {task.priority}</span>
          {task.dueDate && (
            <>
              <span aria-hidden="true">&middot;</span>
              <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
            </>
          )}
        </div>
      </div>
      <Link
        to={`/tasks/${task.id}`}
        className="text-indigo-600 hover:underline text-sm whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        aria-label={`View details for ${task.title}`}
      >
        View details
      </Link>
    </li>
  );
}
