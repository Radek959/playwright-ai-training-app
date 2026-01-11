import { UserAvatar } from "./UserAvatar";
import { getTestId } from "../utils/testIds";

type Task = {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  coverImage?: string;
  assigneeName?: string;
  assigneeAvatarUrl?: string;
};

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
  return (
    <div
      className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer group border border-gray-200"
      onClick={onClick}
      data-testid={getTestId(`task-grid-item-${task.id}`)}
    >
      {/* Cover Image */}
      <div className="relative h-40 bg-gradient-to-br from-indigo-100 to-purple-100 overflow-hidden">
        {task.coverImage ? (
          <img
            src={task.coverImage}
            alt={task.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            data-testid={getTestId("task-cover-image")}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <div className="p-5">
        <h3 className="font-semibold text-gray-900 text-lg mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">
          {task.title}
        </h3>
        
        {task.description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-500">
            {statusLabels[task.status]}
          </span>
          
          {task.assigneeName && (
            <div className="flex items-center gap-2">
              <UserAvatar 
                src={task.assigneeAvatarUrl}
                name={task.assigneeName}
                size="sm"
              />
              <span className="text-xs font-medium text-gray-700">{task.assigneeName}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
