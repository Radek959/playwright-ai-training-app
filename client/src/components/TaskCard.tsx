import { useMemo } from "react";
import { useLab } from "../context/LabContext";

type Task = {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate?: string;
  assigneeId?: string;
  assigneeName?: string;
};

const randomToken = () => Math.random().toString(36).slice(2, 8);

export function TaskCard({
  task,
  onDelete,
  onEdit,
  layoutRefactor
}: {
  task: Task;
  onDelete: (id: string) => void | Promise<void>;
  onEdit: (task: Task) => void;
  layoutRefactor?: boolean;
}) {
  const { a11y, setLastError } = useLab();
  const refactorSelectors = import.meta.env.VITE_REFACTOR_SELECTORS === "true";

  const ids = useMemo(
    () => ({
      container: refactorSelectors ? `task-${task.id}-${randomToken()}` : `task-${task.id}`,
      deleteBtn: refactorSelectors ? `del-${task.id}-${randomToken()}` : `delete-${task.id}`,
      editBtn: refactorSelectors ? `edit-${task.id}-${randomToken()}` : `edit-${task.id}`,
      dataTest: refactorSelectors ? `task-card-${randomToken()}` : `task-card-${task.id}`
    }),
    [refactorSelectors, task.id]
  );

  const handleDelete = async () => {
    try {
      await onDelete(task.id);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const DeleteElement: any = a11y ? "span" : "button";
  const EditElement: any = a11y ? "span" : "button";

  return (
    <article
      id={ids.container}
      data-testid={ids.dataTest}
      className={
        layoutRefactor
          ? "border rounded p-4 bg-white flex flex-col gap-3"
          : "border rounded p-4 flex justify-between items-start bg-white"
      }
    >
      <div className="space-y-1 flex-1">
        <h3 className="font-semibold text-lg">{task.title}</h3>
        <p className="text-sm text-slate-700">{task.description ?? "Brak opisu"}</p>
        <div className="flex gap-2 flex-wrap text-xs text-slate-600">
          <Badge label={task.status} tone={task.status === "done" ? "green" : task.status === "in-progress" ? "blue" : "gray"} />
          <Badge label={`P: ${task.priority}`} tone={task.priority === "high" ? "red" : task.priority === "medium" ? "yellow" : "gray"} />
          {task.dueDate && <Badge label={`Due: ${new Date(task.dueDate).toLocaleDateString()}`} tone="slate" />}
          {task.assigneeName && <Badge label={`Owner: ${task.assigneeName}`} tone="indigo" />}
        </div>
      </div>

      {layoutRefactor ? (
        <DropdownActions
          editId={ids.editBtn}
          deleteId={ids.deleteBtn}
          onEdit={() => onEdit(task)}
          onDelete={handleDelete}
          a11y={a11y}
        />
      ) : (
        <div className="flex gap-2">
          <EditElement
            id={ids.editBtn}
            role={a11y ? "button" : undefined}
            type={a11y ? undefined : "button"}
            className={a11y ? "text-sm underline cursor-pointer" : "bg-slate-100 px-3 py-1 rounded"}
            onClick={() => onEdit(task)}
            aria-label={a11y ? undefined : "Edytuj zadanie"}
          >
            Edit
          </EditElement>

          <DeleteElement
            id={ids.deleteBtn}
            role={a11y ? "button" : undefined}
            className={
              a11y ? "text-sm underline cursor-pointer" : "bg-red-500 text-white px-3 py-1 rounded"
            }
            type={a11y ? undefined : "button"}
            onClick={handleDelete}
            aria-label={a11y ? undefined : "Usuń zadanie"}
          >
            Usuń
          </DeleteElement>
        </div>
      )}
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

function DropdownActions({
  editId,
  deleteId,
  onEdit,
  onDelete,
  a11y
}: {
  editId: string;
  deleteId: string;
  onEdit: () => void;
  onDelete: () => void;
  a11y: boolean;
}) {
  const ButtonTag: any = a11y ? "span" : "button";
  return (
    <div className="relative">
      <details className="border rounded px-3 py-1 bg-slate-50 cursor-pointer select-none">
        <summary className="font-semibold text-sm">Actions</summary>
        <div className="mt-2 flex flex-col gap-2">
          <ButtonTag
            id={editId}
            role={a11y ? "button" : undefined}
            className={a11y ? "text-sm underline" : "text-sm text-slate-700 text-left"}
            type={a11y ? undefined : "button"}
            onClick={(e: any) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit();
            }}
          >
            Edit
          </ButtonTag>
          <ButtonTag
            id={deleteId}
            role={a11y ? "button" : undefined}
            className={a11y ? "text-sm underline" : "text-sm text-red-600 text-left"}
            type={a11y ? undefined : "button"}
            onClick={(e: any) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
          >
            Delete
          </ButtonTag>
        </div>
      </details>
    </div>
  );
}
