import { Link } from "react-router-dom";
import { UserAvatar } from "./UserAvatar";
import { DueDateLabel } from "./DueDateLabel";
import type { TaskWithAssignee } from "../types";

type Task = TaskWithAssignee;

type Props = {
  task: Task;
  onClick?: () => void;
};

const priorityColors = {
  low: "bg-green-100 text-green-700 border-green-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  high: "bg-red-100 text-red-700 border-red-200"
};

const statusLabels = {
  todo: "To Do",
  "in-progress": "In Progress",
  done: "Done"
};

export function TaskGridItem({ task, onClick }: Props) {
  const className =
    "w-full text-left bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group border border-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 flex flex-col";
  const testId = `task-grid-item-${task.id}`;

  return (
    <div className={className} data-testid={testId}>
      {/* Cover Image */}
      <div className="relative h-40 bg-gradient-to-br from-indigo-100 to-purple-100 overflow-hidden">
        {task.coverImage ? (
          <img
            src={task.coverImage}
            alt={task.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            data-testid="task-cover-image"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        )}

        {/* Priority Badge */}
        <div className="absolute top-3 right-3">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${priorityColors[task.priority]}`}>
            {task.priority.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="font-semibold text-gray-900 text-lg mb-2 line-clamp-2 transition-colors">
          {task.title}
        </h3>

        {task.description && <p className="text-sm text-gray-600 mb-4 line-clamp-2">{task.description}</p>}

        <DueDateLabel task={task} className="inline-block px-2 py-0.5 rounded text-xs mb-3 self-start" />

        <div className="mt-auto">
          {/* Status & Assignee */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 mb-3">
            <span className="text-xs font-medium text-gray-500">
              {statusLabels[task.status]}
              {task.taskType && ` • ${task.taskType}`}
            </span>

            {task.assigneeName && (
              <div className="flex items-center gap-2">
                <UserAvatar src={task.assigneeAvatarUrl} name={task.assigneeName} size="sm" />
                <span className="text-xs font-medium text-gray-700">{task.assigneeName}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            {onClick && (
              <button
                type="button"
                onClick={onClick}
                className="text-sm px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 transition-colors"
                aria-label={`Edit task: ${task.title}`}
              >
                Edit
              </button>
            )}
            <Link
              to={`/tasks/${task.id}`}
              className="text-sm px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 transition-colors"
              aria-label={`View details for ${task.title}`}
            >
              View details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
