import { useState } from "react";
import { useLab } from "../context/LabContext";
import { getTestId } from "../utils/testIds";

type Task = {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate?: string;
  assignedTo?: string;
};

type User = { id: string; name: string };

type SortKey = "title" | "priority" | "dueDate" | "assignedTo" | "status";
type SortDir = "asc" | "desc";

type Props = {
  tasks: Task[];
  users: User[];
  onUpdate: (id: string, field: string, value: any) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
};

export function TaskTable({ tasks, users, onUpdate, onDelete, onBulkDelete }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const { refactorLayout } = useLab();

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = [...tasks].sort((a, b) => {
    let aVal: any = a[sortKey];
    let bVal: any = b[sortKey];

    // Handle undefined values
    if (aVal === undefined) aVal = "";
    if (bVal === undefined) bVal = "";

    // For assignedTo, sort by user name
    if (sortKey === "assignedTo") {
      const aUser = users.find(u => u.id === aVal);
      const bUser = users.find(u => u.id === bVal);
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

  const handleBulkDelete = () => {
    onBulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const cellId = (taskId: string, field: string) =>
    refactorLayout ? `cell-${taskId}-${field}-v2` : `cell-${taskId}-${field}`;

  const allSelected = tasks.length > 0 && selectedIds.size === tasks.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < tasks.length;

  return (
    <div className="space-y-3">
      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-300 rounded p-3 flex items-center justify-between" data-testid={getTestId("bulk-actions-bar")}>
          <span className="text-sm font-semibold">
            Zaznaczono: <span data-testid={getTestId("selected-count")}>{selectedIds.size}</span>
          </span>
          <div className="flex gap-2">
            <button
              data-testid={getTestId("bulk-delete-btn")}
              onClick={handleBulkDelete}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Usuń zaznaczone
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1 border rounded text-sm hover:bg-gray-100"
              data-testid={getTestId("bulk-cancel-btn")}
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border rounded overflow-hidden">
        <table className="w-full border-collapse" data-testid={getTestId("task-table")}>
          <thead className="bg-gray-100">
            <tr>
              <th className="border-b p-3 w-12">
                <input
                  type="checkbox"
                  data-testid={getTestId("select-all-checkbox")}
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                />
              </th>
              {(["title", "status", "priority", "dueDate", "assignedTo"] as SortKey[]).map((key) => (
                <th
                  key={key}
                  className="border-b p-3 cursor-pointer hover:bg-gray-200 text-left"
                  onClick={() => toggleSort(key)}
                  data-testid={getTestId(`sort-header-${key}`)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {key === "title" && "Tytuł"}
                      {key === "status" && "Status"}
                      {key === "priority" && "Priorytet"}
                      {key === "dueDate" && "Termin"}
                      {key === "assignedTo" && "Przypisany"}
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
                  data-testid={getTestId(`task-row-${task.id}`)}
                >
                  <td className="border-b p-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(task.id)}
                      onChange={() => toggleSelect(task.id)}
                      data-testid={getTestId(`select-${task.id}`)}
                    />
                  </td>
                  
                  {/* Title - Editable */}
                  <td
                    id={cellId(task.id, "title")}
                    className="border-b p-3 cursor-pointer"
                    onClick={() => setEditingCell(`${task.id}-title`)}
                    data-testid={getTestId(`cell-${task.id}-title`)}
                  >
                    {editingCell === `${task.id}-title` ? (
                      <input
                        autoFocus
                        className="w-full border rounded px-2 py-1"
                        defaultValue={task.title}
                        onBlur={(e) => {
                          onUpdate(task.id, "title", e.target.value);
                          setEditingCell(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onUpdate(task.id, "title", e.currentTarget.value);
                            setEditingCell(null);
                          }
                          if (e.key === "Escape") {
                            setEditingCell(null);
                          }
                        }}
                        data-testid={getTestId(`edit-title-${task.id}`)}
                      />
                    ) : (
                      <span className="hover:text-blue-600">{task.title}</span>
                    )}
                  </td>

                  {/* Status - Editable */}
                  <td
                    className="border-b p-3"
                    data-testid={getTestId(`cell-${task.id}-status`)}
                  >
                    <select
                      value={task.status}
                      onChange={(e) => onUpdate(task.id, "status", e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                      data-testid={getTestId(`edit-status-${task.id}`)}
                    >
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  </td>

                  {/* Priority - Editable */}
                  <td
                    className="border-b p-3"
                    data-testid={getTestId(`cell-${task.id}-priority`)}
                  >
                    <select
                      value={task.priority}
                      onChange={(e) => onUpdate(task.id, "priority", e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                      data-testid={getTestId(`edit-priority-${task.id}`)}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </td>

                  {/* Due Date - Editable */}
                  <td
                    className="border-b p-3"
                    data-testid={getTestId(`cell-${task.id}-dueDate`)}
                  >
                    <input
                      type="date"
                      value={task.dueDate ? task.dueDate.split("T")[0] : ""}
                      onChange={(e) => onUpdate(task.id, "dueDate", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                      className="border rounded px-2 py-1 text-sm"
                      data-testid={getTestId(`edit-dueDate-${task.id}`)}
                    />
                  </td>

                  {/* Assignee - Editable */}
                  <td
                    className="border-b p-3"
                    data-testid={getTestId(`cell-${task.id}-assignedTo`)}
                  >
                    <select
                      value={task.assignedTo || ""}
                      onChange={(e) => onUpdate(task.id, "assignedTo", e.target.value || undefined)}
                      className="border rounded px-2 py-1 text-sm"
                      data-testid={getTestId(`edit-assignedTo-${task.id}`)}
                    >
                      <option value="">-- Brak --</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Actions */}
                  <td className="border-b p-3">
                    <button
                      onClick={() => onDelete(task.id)}
                      data-testid={getTestId(`delete-${task.id}`)}
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

      <div className="text-sm text-gray-600" data-testid={getTestId("table-info")}>
        Wyświetlono {sorted.length} {sorted.length === 1 ? "zadanie" : "zadań"}
        {sortKey && ` • Sortowanie: ${sortKey} ${sortDir === "asc" ? "rosnąco" : "malejąco"}`}
      </div>
    </div>
  );
}
