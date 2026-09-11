import { useState } from "react";
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

export function TaskTable({ tasks, users, onUpdate, onDelete, onBulkDelete }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});

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

  const cellId = (taskId: string, field: string) => `cell-${taskId}-${field}`;

  const allSelected = tasks.length > 0 && selectedIds.size === tasks.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < tasks.length;

  return (
    <div className="space-y-3">
      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-300 rounded p-3 flex items-center justify-between" data-testid="bulk-actions-bar">
          <span className="text-sm font-semibold">
            Zaznaczono: <span data-testid="selected-count">{selectedIds.size}</span>
          </span>
          <div className="flex gap-2">
            <button
              data-testid="bulk-delete-btn"
              onClick={handleBulkDelete}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Usuń zaznaczone
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1 border rounded text-sm hover:bg-gray-100"
              data-testid="bulk-cancel-btn"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border rounded overflow-hidden">
        <table className="w-full border-collapse" data-testid="task-table">
          <thead className="bg-gray-100">
            <tr>
              <th className="border-b p-3 w-12">
                <input
                  type="checkbox"
                  data-testid="select-all-checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                />
              </th>
              {(["title", "status", "priority", "dueDate", "assigneeId"] as SortKey[]).map((key) => (
                <th
                  key={key}
                  className="border-b p-3 cursor-pointer hover:bg-gray-200 text-left"
                  onClick={() => toggleSort(key)}
                  data-testid={`sort-header-${key}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {key === "title" && "Tytuł"}
                      {key === "status" && "Status"}
                      {key === "priority" && "Priorytet"}
                      {key === "dueDate" && "Termin"}
                      {key === "assigneeId" && "Przypisany"}
                    </span>
                    {sortKey === key && (
                      <span className="text-xs ml-2">
                        {sortDir === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              <th className="border-b p-3 text-left font-semibold">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  Brak zadań do wyświetlenia
                </td>
              </tr>
            ) : (
              sorted.map((task) => (
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
                    />
                  </td>

                  {/* Title - Editable */}
                  <td
                    id={cellId(task.id, "title")}
                    className="border-b p-3 cursor-pointer"
                    onClick={() => setEditingCell(`${task.id}-title`)}
                    data-testid={`cell-${task.id}-title`}
                  >
                    {editingCell === `${task.id}-title` ? (
                      <input
                        autoFocus
                        className="w-full border rounded px-2 py-1"
                        defaultValue={task.title}
                        onBlur={(e) => {
                          if (editingCell !== `${task.id}-title`) return;
                          setEditingCell(null);
                          commitUpdate(task.id, "title", e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const value = e.currentTarget.value;
                            setEditingCell(null);
                            commitUpdate(task.id, "title", value);
                          }
                          if (e.key === "Escape") {
                            setEditingCell(null);
                          }
                        }}
                        data-testid={`edit-title-${task.id}`}
                      />
                    ) : (
                      <span className="hover:text-blue-600">{task.title}</span>
                    )}
                    {cellErrors[`${task.id}-title`] && (
                      <p className="text-red-600 text-xs mt-1" data-testid={`error-${task.id}-title`}>
                        {cellErrors[`${task.id}-title`]}
                      </p>
                    )}
                  </td>

                  {/* Status - Editable */}
                  <td
                    className="border-b p-3"
                    data-testid={`cell-${task.id}-status`}
                  >
                    <select
                      value={task.status}
                      onChange={(e) => commitUpdate(task.id, "status", e.target.value as TaskStatus)}
                      className="border rounded px-2 py-1 text-sm"
                      data-testid={`edit-status-${task.id}`}
                      disabled={savingCell === `${task.id}-status`}
                    >
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                    {cellErrors[`${task.id}-status`] && (
                      <p className="text-red-600 text-xs mt-1" data-testid={`error-${task.id}-status`}>
                        {cellErrors[`${task.id}-status`]}
                      </p>
                    )}
                  </td>

                  {/* Priority - Editable */}
                  <td
                    className="border-b p-3"
                    data-testid={`cell-${task.id}-priority`}
                  >
                    <select
                      value={task.priority}
                      onChange={(e) => commitUpdate(task.id, "priority", e.target.value as TaskPriority)}
                      className="border rounded px-2 py-1 text-sm"
                      data-testid={`edit-priority-${task.id}`}
                      disabled={savingCell === `${task.id}-priority`}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    {cellErrors[`${task.id}-priority`] && (
                      <p className="text-red-600 text-xs mt-1" data-testid={`error-${task.id}-priority`}>
                        {cellErrors[`${task.id}-priority`]}
                      </p>
                    )}
                  </td>

                  {/* Due Date - Editable */}
                  <td
                    className="border-b p-3"
                    data-testid={`cell-${task.id}-dueDate`}
                  >
                    <input
                      type="date"
                      value={task.dueDate ? task.dueDate.split("T")[0] : ""}
                      onChange={(e) =>
                        commitUpdate(task.id, "dueDate", e.target.value ? new Date(e.target.value).toISOString() : undefined)
                      }
                      className="border rounded px-2 py-1 text-sm"
                      data-testid={`edit-dueDate-${task.id}`}
                      disabled={savingCell === `${task.id}-dueDate`}
                    />
                    {cellErrors[`${task.id}-dueDate`] && (
                      <p className="text-red-600 text-xs mt-1" data-testid={`error-${task.id}-dueDate`}>
                        {cellErrors[`${task.id}-dueDate`]}
                      </p>
                    )}
                  </td>

                  {/* Assignee - Editable */}
                  <td
                    className="border-b p-3"
                    data-testid={`cell-${task.id}-assigneeId`}
                  >
                    <select
                      value={task.assigneeId || ""}
                      onChange={(e) => commitUpdate(task.id, "assigneeId", e.target.value || undefined)}
                      className="border rounded px-2 py-1 text-sm"
                      data-testid={`edit-assigneeId-${task.id}`}
                      disabled={savingCell === `${task.id}-assigneeId`}
                    >
                      <option value="">-- Brak --</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                    {cellErrors[`${task.id}-assigneeId`] && (
                      <p className="text-red-600 text-xs mt-1" data-testid={`error-${task.id}-assigneeId`}>
                        {cellErrors[`${task.id}-assigneeId`]}
                      </p>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="border-b p-3">
                    <button
                      onClick={() => onDelete(task.id)}
                      data-testid={`delete-${task.id}`}
                      className="text-red-600 hover:underline text-sm"
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-gray-600" data-testid="table-info">
        Wyświetlono {sorted.length} {sorted.length === 1 ? "zadanie" : "zadań"}
        {sortKey && ` • Sortowanie: ${sortKey} ${sortDir === "asc" ? "rosnąco" : "malejąco"}`}
      </div>
    </div>
  );
}
