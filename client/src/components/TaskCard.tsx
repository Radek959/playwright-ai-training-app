import { useMemo } from "react";
import { useAppError } from "../context/AppErrorContext";
import type { TaskWithAssignee } from "../types";

type Task = TaskWithAssignee;

export function TaskCard({
  task,
  onDelete,
  onEdit
}: {
  task: Task;
  onDelete: (id: string) => void | Promise<void>;
  onEdit: (task: Task) => void;
}) {
  const { setError, clearError } = useAppError();

  const ids = useMemo(
    () => ({
      container: `task-${task.id}`,
      deleteBtn: `delete-${task.id}`,
      editBtn: `edit-${task.id}`,
      dataTest: `task-card-${task.id}`
    }),
    [task.id]
  );

  const handleDelete = async () => {
    try {
      await onDelete(task.id);
      clearError();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <article
      id={ids.container}
      data-testid={ids.dataTest}
      className="border rounded p-4 flex justify-between items-start bg-white"
    >
      <div className="space-y-1 flex-1">
        <h3 className="font-semibold text-lg">{task.title}</h3>
        <p className="text-sm text-slate-700">{task.description ?? "Brak opisu"}</p>
        <div className="flex gap-2 flex-wrap text-xs text-slate-600">
          <Badge label={task.status} tone={task.status === "done" ? "green" : task.status === "in-progress" ? "blue" : "gray"} />
          <Badge label={`P: ${task.priority}`} tone={task.priority === "high" ? "red" : task.priority === "medium" ? "yellow" : "gray"} />
          {task.dueDate && <Badge label={`Due: ${new Date(task.dueDate).toLocaleDateString()}`} tone="slate" />}
          {task.assigneeName && <Badge label={`Owner: ${task.assigneeName}`} tone="indigo" />}
          {task.taskType && <Badge label={task.taskType} tone="slate" />}
          {task.severity && <Badge label={`Severity: ${task.severity}`} tone={task.severity === "critical" ? "red" : task.severity === "major" ? "yellow" : "gray"} />}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          id={ids.editBtn}
          type="button"
          className="bg-slate-100 px-3 py-1 rounded"
          onClick={() => onEdit(task)}
          aria-label="Edytuj zadanie"
        >
          Edit
        </button>

        <button
          id={ids.deleteBtn}
          className="bg-red-500 text-white px-3 py-1 rounded"
          type="button"
          onClick={handleDelete}
          aria-label="Usuń zadanie"
        >
          Usuń
        </button>
      </div>
    </article>
  );
}

function Badge({ label, tone }: { label: string; tone: "green" | "blue" | "gray" | "red" | "yellow" | "indigo" | "slate" }) {
  const toneMap: Record<typeof tone, string> = {
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
    gray: "bg-slate-100 text-slate-700",
    red: "bg-red-100 text-red-700",
    yellow: "bg-amber-100 text-amber-700",
    indigo: "bg-indigo-100 text-indigo-700",
    slate: "bg-slate-100 text-slate-700"
  } as const;
  return <span className={`px-2 py-0.5 rounded text-[11px] ${toneMap[tone]}`}>{label}</span>;
}
