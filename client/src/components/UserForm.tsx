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
        <label className="flex flex-col gap-1" htmlFor="user-name">
          <span className="text-sm font-semibold">Name</span>
          <input
            id="user-name"
            className="border rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </label>
        <label className="flex flex-col gap-1" htmlFor="user-email">
          <span className="text-sm font-semibold">Email</span>
          <input
            id="user-email"
            type="email"
            className="border rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1" htmlFor="user-role">
          <span className="text-sm font-semibold">Role</span>
          <select
            id="user-role"
            className="border rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>
        <label className="flex flex-col gap-1" htmlFor="user-avatar">
          <span className="text-sm font-semibold">Avatar URL</span>
          <input
            id="user-avatar"
            type="url"
            className="border rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            autoComplete="photo"
          />
        </label>
      </div>
      <button
        type="submit"
        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
      >
        Add user
      </button>
    </form>
  );
}
