import { useEffect, useRef, useState } from "react";
import { useAppError } from "../context/AppErrorContext";
import type { Task, TaskPriority, TaskStatus, User } from "../types";

type SortKey = "title" | "priority" | "dueDate" | "assigneeId" | "status";
type SortDir = "asc" | "desc";

type Props = {
  tasks: Task[];
  users: User[];
  onUpdate: (id: string, field: string, value: unknown) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<string[]>;
};

const COLUMN_LABELS: Record<SortKey, string> = {
  title: "Title",
  status: "Status",
  priority: "Priority",
  dueDate: "Due date",
  assigneeId: "Assignee"
};

export function TaskTable({ tasks, users, onUpdate, onDelete, onBulkDelete }: Props) {
  const { setError, clearError } = useAppError();
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
  const [bulkDeleteMessage, setBulkDeleteMessage] = useState<string>("");
  const titleTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const titleEditInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFocusRestoreId = useRef<string | null>(null);

  useEffect(() => {
    if (editingCell) {
      titleEditInputRef.current?.focus();
      titleEditInputRef.current?.select();
    } else if (pendingFocusRestoreId.current) {
      // The trigger button only exists in the DOM once editingCell clears and
      // this effect runs after that re-render commits, so focus it here
      // instead of synchronously in the event handler.
      titleTriggerRefs.current[pendingFocusRestoreId.current]?.focus();
      pendingFocusRestoreId.current = null;
    }
  }, [editingCell]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = [...tasks].sort((a, b) => {
    let aVal: string = (a[sortKey] as string | undefined) ?? "";
    let bVal: string = (b[sortKey] as string | undefined) ?? "";

    if (sortKey === "assigneeId") {
      const aUser = users.find((u) => u.id === a.assigneeId);
      const bUser = users.find((u) => u.id === b.assigneeId);
      aVal = aUser?.name || "";
      bVal = bUser?.name || "";
    }

    const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(tasks.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const deletedIds = await onBulkDelete(ids);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of deletedIds) next.delete(id);
      return next;
    });
    if (deletedIds.length === ids.length) {
      setBulkDeleteMessage(`Deleted ${deletedIds.length} ${deletedIds.length === 1 ? "task" : "tasks"}.`);
    } else {
      setBulkDeleteMessage(
        `Deleted ${deletedIds.length} of ${ids.length} tasks. ${ids.length - deletedIds.length} could not be deleted.`
      );
    }
  };

  const commitUpdate = async (taskId: string, field: string, value: unknown) => {
    const key = `${taskId}-${field}`;
    if (savingCell === key) return;
    setSavingCell(key);
    setCellErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    try {
      await onUpdate(taskId, field, value);
    } catch (err) {
      setCellErrors((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : "Update failed"
      }));
    } finally {
      setSavingCell(null);
    }
  };

  const handleRowDelete = async (taskId: string, title: string) => {
    try {
      await onDelete(taskId);
      clearError();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to delete task: ${title}`);
    }
  };

  const cellId = (taskId: string, field: string) => `cell-${taskId}-${field}`;

  const stopEditingTitle = (taskId: string) => {
    pendingFocusRestoreId.current = taskId;
    setEditingCell(null);
  };

  const allSelected = tasks.length > 0 && selectedIds.size === tasks.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < tasks.length;

  const ariaSortFor = (key: SortKey): "ascending" | "descending" | "none" => {
    if (sortKey !== key) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  };

  return (
    <div className="space-y-3">
      {/* Live region announcing bulk delete outcome */}
      <div role="status" aria-live="polite" className="sr-only">
        {bulkDeleteMessage}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-300 rounded p-3 flex items-center justify-between" data-testid="bulk-actions-bar">
          <span className="text-sm font-semibold">
            Selected: <span data-testid="selected-count">{selectedIds.size}</span>
          </span>
          <div className="flex gap-2">
            <button
              data-testid="bulk-delete-btn"
              onClick={handleBulkDelete}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
            >
              Delete selected
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1 border rounded text-sm hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              data-testid="bulk-cancel-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border rounded overflow-x-auto">
        <table className="w-full border-collapse" data-testid="task-table">
          <caption className="sr-only">Tasks. Column headers with a sort button can be activated to sort the table.</caption>
          <thead className="bg-gray-100">
            <tr>
              <th className="border-b p-3 w-12" scope="col">
                <input
                  type="checkbox"
                  data-testid="select-all-checkbox"
                  aria-label="Select all tasks"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                />
              </th>
              {(["title", "status", "priority", "dueDate", "assigneeId"] as SortKey[]).map((key) => (
                <th key={key} className="border-b p-3 text-left" scope="col" aria-sort={ariaSortFor(key)}>
                  <button
                    type="button"
                    onClick={() => toggleSort(key)}
                    className="flex items-center justify-between gap-2 w-full font-semibold hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
                    data-testid={`sort-header-${key}`}
                  >
                    <span>{COLUMN_LABELS[key]}</span>
                    {sortKey === key && (
                      <span className="text-xs ml-2" aria-hidden="true">
                        {sortDir === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </button>
                </th>
              ))}
              <th className="border-b p-3 text-left font-semibold" scope="col">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No tasks to display
                </td>
              </tr>
            ) : (
              sorted.map((task) => {
                const isEditingTitle = editingCell === `${task.id}-title`;
                const titleErrorKey = `${task.id}-title`;
                const statusErrorKey = `${task.id}-status`;
                const priorityErrorKey = `${task.id}-priority`;
                const dueDateErrorKey = `${task.id}-dueDate`;
                const assigneeErrorKey = `${task.id}-assigneeId`;

                return (
                  <tr
                    key={task.id}
                    className={`hover:bg-gray-50 ${selectedIds.has(task.id) ? "bg-blue-50" : ""}`}
                    data-testid={`task-row-${task.id}`}
                  >
                    <td className="border-b p-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(task.id)}
                        onChange={() => toggleSelect(task.id)}
                        data-testid={`select-${task.id}`}
                        aria-label={`Select task: ${task.title}`}
                      />
                    </td>

                    {/* Title - Editable */}
                    <td id={cellId(task.id, "title")} className="border-b p-3" data-testid={`cell-${task.id}-title`}>
                      {isEditingTitle ? (
                        <input
                          ref={titleEditInputRef}
                          className="w-full border rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                          defaultValue={task.title}
                          aria-label={`Title for ${task.title}`}
                          aria-invalid={Boolean(cellErrors[titleErrorKey])}
                          aria-describedby={cellErrors[titleErrorKey] ? `error-${task.id}-title` : undefined}
                          onBlur={(e) => {
                            if (editingCell !== `${task.id}-title`) return;
                            const value = e.target.value;
                            stopEditingTitle(task.id);
                            commitUpdate(task.id, "title", value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const value = e.currentTarget.value;
                              stopEditingTitle(task.id);
                              commitUpdate(task.id, "title", value);
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              stopEditingTitle(task.id);
                            }
                          }}
                          data-testid={`edit-title-${task.id}`}
                        />
                      ) : (
                        <button
                          type="button"
                          ref={(el) => {
                            titleTriggerRefs.current[task.id] = el;
                          }}
                          onClick={() => setEditingCell(`${task.id}-title`)}
                          className="text-left hover:text-blue-600 w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
                          aria-label={`Edit title: ${task.title}`}
                        >
                          {task.title}
                        </button>
                      )}
                      {cellErrors[titleErrorKey] && (
                        <p className="text-red-600 text-xs mt-1" data-testid={`error-${task.id}-title`} id={`error-${task.id}-title`} role="alert">
                          {cellErrors[titleErrorKey]}
                        </p>
                      )}
                    </td>

                    {/* Status - Editable */}
                    <td className="border-b p-3" data-testid={`cell-${task.id}-status`}>
                      <select
                        value={task.status}
                        onChange={(e) => commitUpdate(task.id, "status", e.target.value as TaskStatus)}
                        className="border rounded px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                        data-testid={`edit-status-${task.id}`}
                        disabled={savingCell === `${task.id}-status`}
                        aria-label={`Status for ${task.title}`}
                        aria-invalid={Boolean(cellErrors[statusErrorKey])}
                        aria-describedby={cellErrors[statusErrorKey] ? `error-${task.id}-status` : undefined}
                      >
                        <option value="todo">To Do</option>
                        <option value="in-progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                      {cellErrors[statusErrorKey] && (
                        <p className="text-red-600 text-xs mt-1" data-testid={`error-${task.id}-status`} id={`error-${task.id}-status`} role="alert">
                          {cellErrors[statusErrorKey]}
                        </p>
                      )}
                    </td>

                    {/* Priority - Editable */}
                    <td className="border-b p-3" data-testid={`cell-${task.id}-priority`}>
                      <select
                        value={task.priority}
                        onChange={(e) => commitUpdate(task.id, "priority", e.target.value as TaskPriority)}
                        className="border rounded px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                        data-testid={`edit-priority-${task.id}`}
                        disabled={savingCell === `${task.id}-priority`}
                        aria-label={`Priority for ${task.title}`}
                        aria-invalid={Boolean(cellErrors[priorityErrorKey])}
                        aria-describedby={cellErrors[priorityErrorKey] ? `error-${task.id}-priority` : undefined}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                      {cellErrors[priorityErrorKey] && (
                        <p className="text-red-600 text-xs mt-1" data-testid={`error-${task.id}-priority`} id={`error-${task.id}-priority`} role="alert">
                          {cellErrors[priorityErrorKey]}
                        </p>
                      )}
                    </td>

                    {/* Due Date - Editable */}
                    <td className="border-b p-3" data-testid={`cell-${task.id}-dueDate`}>
                      <input
                        type="date"
                        value={task.dueDate ? task.dueDate.split("T")[0] : ""}
                        onChange={(e) => commitUpdate(task.id, "dueDate", e.target.value ? new Date(e.target.value).toISOString() : null)}
                        className="border rounded px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                        data-testid={`edit-dueDate-${task.id}`}
                        disabled={savingCell === `${task.id}-dueDate`}
                        aria-label={`Due date for ${task.title}`}
                        aria-invalid={Boolean(cellErrors[dueDateErrorKey])}
                        aria-describedby={cellErrors[dueDateErrorKey] ? `error-${task.id}-dueDate` : undefined}
                      />
                      {cellErrors[dueDateErrorKey] && (
                        <p className="text-red-600 text-xs mt-1" data-testid={`error-${task.id}-dueDate`} id={`error-${task.id}-dueDate`} role="alert">
                          {cellErrors[dueDateErrorKey]}
                        </p>
                      )}
                    </td>

                    {/* Assignee - Editable */}
                    <td className="border-b p-3" data-testid={`cell-${task.id}-assigneeId`}>
                      <select
                        value={task.assigneeId || ""}
                        onChange={(e) => commitUpdate(task.id, "assigneeId", e.target.value || null)}
                        className="border rounded px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                        data-testid={`edit-assigneeId-${task.id}`}
                        disabled={savingCell === `${task.id}-assigneeId`}
                        aria-label={`Assignee for ${task.title}`}
                        aria-invalid={Boolean(cellErrors[assigneeErrorKey])}
                        aria-describedby={cellErrors[assigneeErrorKey] ? `error-${task.id}-assigneeId` : undefined}
                      >
                        <option value="">-- None --</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      {cellErrors[assigneeErrorKey] && (
                        <p className="text-red-600 text-xs mt-1" data-testid={`error-${task.id}-assigneeId`} id={`error-${task.id}-assigneeId`} role="alert">
                          {cellErrors[assigneeErrorKey]}
                        </p>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="border-b p-3">
                      <button
                        onClick={() => handleRowDelete(task.id, task.title)}
                        data-testid={`delete-${task.id}`}
                        className="text-red-600 hover:underline text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600 rounded"
                        aria-label={`Delete task: ${task.title}`}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-gray-600" data-testid="table-info">
        Showing {sorted.length} {sorted.length === 1 ? "task" : "tasks"}
        {sortKey && ` • Sorted by: ${COLUMN_LABELS[sortKey]} ${sortDir === "asc" ? "ascending" : "descending"}`}
      </div>
    </div>
  );
}
