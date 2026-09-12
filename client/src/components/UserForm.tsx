import { FormEvent, useState } from "react";
import { useAppError } from "../context/AppErrorContext";
import { mapFieldErrors, toApiError } from "../utils/apiError";
import type { User, UserRole } from "../types";

type Props = {
  onCreated: (user: User) => void;
};

const KNOWN_FIELDS = new Set(["name", "email", "role", "avatar"]);

const FIELD_ERROR_ID: Record<string, string> = {
  name: "user-name-error",
  email: "user-email-error",
  role: "user-role-error",
  avatar: "user-avatar-error"
};

export function UserForm({ onCreated }: Props) {
  const { setError, clearError } = useAppError();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [avatar, setAvatar] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, avatar })
      });
      if (!res.ok) {
        const apiError = await toApiError(res, `Create failed: ${res.status}`);
        const { mapped } = mapFieldErrors(apiError.details, KNOWN_FIELDS);
        setFieldErrors(mapped);
        setError(apiError.message);
        return;
      }
      const data = await res.json();
      onCreated(data as User);
      setName("");
      setEmail("");
      setRole("viewer");
      setAvatar("");
      setFieldErrors({});
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
            onChange={(e) => {
              setName(e.target.value);
              clearFieldError("name");
            }}
            autoComplete="name"
            required
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? FIELD_ERROR_ID.name : undefined}
          />
          {fieldErrors.name && (
            <span id={FIELD_ERROR_ID.name} role="alert" className="text-red-600 text-xs font-normal">
              {fieldErrors.name}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1" htmlFor="user-email">
          <span className="text-sm font-semibold">Email</span>
          <input
            id="user-email"
            type="email"
            className="border rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearFieldError("email");
            }}
            autoComplete="email"
            required
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? FIELD_ERROR_ID.email : undefined}
          />
          {fieldErrors.email && (
            <span id={FIELD_ERROR_ID.email} role="alert" className="text-red-600 text-xs font-normal">
              {fieldErrors.email}
            </span>
          )}
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1" htmlFor="user-role">
          <span className="text-sm font-semibold">Role</span>
          <select
            id="user-role"
            className="border rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as UserRole);
              clearFieldError("role");
            }}
            aria-invalid={Boolean(fieldErrors.role)}
            aria-describedby={fieldErrors.role ? FIELD_ERROR_ID.role : undefined}
          >
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          {fieldErrors.role && (
            <span id={FIELD_ERROR_ID.role} role="alert" className="text-red-600 text-xs font-normal">
              {fieldErrors.role}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1" htmlFor="user-avatar">
          <span className="text-sm font-semibold">Avatar URL</span>
          <input
            id="user-avatar"
            type="url"
            className="border rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            value={avatar}
            onChange={(e) => {
              setAvatar(e.target.value);
              clearFieldError("avatar");
            }}
            aria-invalid={Boolean(fieldErrors.avatar)}
            aria-describedby={fieldErrors.avatar ? FIELD_ERROR_ID.avatar : undefined}
            autoComplete="photo"
          />
          {fieldErrors.avatar && (
            <span id={FIELD_ERROR_ID.avatar} role="alert" className="text-red-600 text-xs font-normal">
              {fieldErrors.avatar}
            </span>
          )}
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
