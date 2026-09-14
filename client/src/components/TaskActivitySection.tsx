import React, { useEffect, useState, useCallback } from "react";
import { TaskActivity, ActivityValue, User, Task } from "../types";

interface TaskActivitySectionProps {
  taskId: string;
  refreshKey: number;
  users: User[];
  allTasks: Task[];
}

const formatValue = (
  value: ActivityValue,
  field: string,
  users: User[],
  allTasks: Task[]
): string => {
  if (value === null) return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  
  if (Array.isArray(value)) {
    if (value.length === 0) return "Empty";
    if (field === "dependencies") {
      return value.map(id => {
        const t = allTasks.find(t => t.id === id);
        return t ? t.title : id;
      }).join(", ");
    }
    return value.join(", ");
  }

  if (field === "assigneeId" && typeof value === "string") {
    const u = users.find(u => u.id === value);
    return u ? u.name : value;
  }

  return String(value);
};

const formatActivityName = (type: string) => {
  switch (type) {
    case "task_created": return "Task created";
    case "task_updated": return "Task updated";
    case "approval_decided": return "Approval decided"; // Could be more specific if we check changes, but requirements say "Approval decided" is okay, wait, requirements: "Przykładowe etykiety: Task created, Task updated, Approval approved, Approval rejected."
    default: return type;
  }
};

export function TaskActivitySection({ taskId, refreshKey, users, allTasks }: TaskActivitySectionProps) {
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/tasks/${taskId}/activity`);
      if (!res.ok) {
        throw new Error(`Failed to load activity: ${res.statusText}`);
      }
      const data = await res.json();
      setActivities(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading activity");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities, refreshKey]);

  if (loading && activities.length === 0) {
    return (
      <section className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Activity</h3>
        <p className="text-sm text-gray-500">Loading activity...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Activity</h3>
        <div className="bg-red-50 p-4 rounded-md">
          <p className="text-sm text-red-700 mb-2">{error}</p>
          <button 
            onClick={fetchActivities}
            className="text-sm font-medium text-red-700 hover:text-red-600 underline"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Activity</h3>
      </div>
      
      <p className="text-xs text-gray-500 mb-4">
        Activity records operations performed in this local app. It does not identify an authenticated user.
      </p>

      {activities.length === 0 ? (
        <p className="text-sm text-gray-500">No activity yet</p>
      ) : (
        <div className="space-y-6">
          {activities.map((activity) => {
            let title = formatActivityName(activity.type);
            
            if (activity.type === "approval_decided") {
              const statusChange = activity.changes.find(c => c.field === "approvalStatus");
              if (statusChange && statusChange.after === "approved") title = "Approval approved";
              else if (statusChange && statusChange.after === "rejected") title = "Approval rejected";
            }

            return (
              <div key={activity.id} className="bg-white shadow sm:rounded-lg border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                  <span className="font-medium text-sm text-gray-900">{title}</span>
                  <span className="text-xs text-gray-500">{new Date(activity.createdAt).toLocaleString()}</span>
                </div>
                {activity.changes.length > 0 && (
                  <div className="px-4 py-3">
                    <ul className="space-y-2">
                      {activity.changes.map((change, idx) => (
                        <li key={idx} className="text-sm">
                          <span className="font-medium text-gray-700">{change.field}:</span>{" "}
                          <span className="text-gray-500 line-through mr-1">
                            {formatValue(change.before, change.field, users, allTasks)}
                          </span>
                          <span className="text-gray-900">
                            → {formatValue(change.after, change.field, users, allTasks)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
