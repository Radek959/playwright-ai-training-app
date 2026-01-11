import { FormEvent, useEffect, useState } from "react";
import { useLab } from "../context/LabContext";

type User = { id: string; name: string };

type Props = {
  onCreated: (task: any) => void;
};

export function TaskForm({ onCreated }: Props) {
  const { apiFlaky, setLastError } = useLab();
  const refactorSelectors = import.meta.env.VITE_REFACTOR_SELECTORS === "true";
  const apiV2 = import.meta.env.VITE_API_VERSION_2 === "true";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch(apiFlaky ? "/api/users?lab_api_flaky=true" : "/api/users");
        if (!res.ok) throw new Error(`Users HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) setUsers(data);
      } catch (err) {
        setLastError(err instanceof Error ? err.message : "Users fetch error");
      }
    };
    loadUsers();
  }, [apiFlaky, setLastError]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(apiFlaky ? "/api/tasks?lab_api_flaky=true" : "/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          apiV2
            ? {
                name: title,
                content: description,
                status,
                priority,
                dueDate,
                assigneeId,
                title, // keep backward compat
                description
              }
            : { title, description, status, priority, dueDate, assigneeId }
        )
      });
      if (!res.ok) throw new Error(`Create failed: ${res.status}`);
      const data = await res.json();
      const normalized = {
        id: data.id,
        title: data.title ?? data.name,
        description: data.description ?? data.content,
        status: data.status ?? "todo",
        priority: data.priority ?? "medium",
        dueDate: data.dueDate,
        assigneeId: data.assigneeId
      };
      onCreated(normalized);
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("medium");
      setDueDate("");
      setAssigneeId("");
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Create error");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 p-3 border rounded bg-white">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold">Tytuł</label>
        <input
          className="border rounded px-2 py-1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold">Opis</label>
        <textarea
          className="border rounded px-2 py-1"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold">Status</label>
          <select
            className="border rounded px-2 py-1"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold">Priorytet</label>
          <select
            className="border rounded px-2 py-1"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold">Due date</label>
          <input
            type="date"
            className="border rounded px-2 py-1"
            value={dueDate ? dueDate.split("T")[0] : ""}
            onChange={(e) => setDueDate(e.target.value ? new Date(e.target.value).toISOString() : "")}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold">Przypisany użytkownik</label>
        <select
          className="border rounded px-2 py-1"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
        >
          <option value="">-- brak --</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        data-testid={refactorSelectors ? "submit-new-task" : "add-task-button"}
        className={
          refactorSelectors
            ? "bg-indigo-700 text-white px-3 py-1 rounded hover:bg-indigo-800"
            : "bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
        }
      >
        Dodaj zadanie
      </button>
    </form>
  );
}
