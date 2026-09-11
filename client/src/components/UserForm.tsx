import { FormEvent, useState } from "react";
import { useAppError } from "../context/AppErrorContext";
import type { User, UserRole } from "../types";

type Props = {
  onCreated: (user: User) => void;
};

export function UserForm({ onCreated }: Props) {
  const { setError, clearError } = useAppError();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [avatar, setAvatar] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, avatar })
      });
      const data = await res.json();
      if (!res.ok) {
        const detailMessage = Array.isArray(data?.details) && data.details.length > 0 ? data.details[0].message : undefined;
        throw new Error(detailMessage ?? data?.error ?? `Create failed: ${res.status}`);
      }
      onCreated(data as User);
      setName("");
      setEmail("");
      setRole("viewer");
      setAvatar("");
      clearError();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create error");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 p-3 border rounded bg-white">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Nazwa</span>
          <input
            className="border rounded px-2 py-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Email</span>
          <input
            type="email"
            className="border rounded px-2 py-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Rola</span>
          <select
            className="border rounded px-2 py-1"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Avatar URL</span>
          <input
            className="border rounded px-2 py-1"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
          />
        </label>
      </div>
      <button
        type="submit"
        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
      >
        Dodaj użytkownika
      </button>
    </form>
  );
}
