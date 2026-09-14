import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { UserForm } from "../components/UserForm";
import { UserAvatar } from "../components/UserAvatar";
import { useAppError } from "../context/AppErrorContext";
import { effectiveAvatar } from "../utils/avatar";
import type { User } from "../types";

type LocationState = { deletedUserName?: string } | null;

// Distinguishes "still fetching" and "fetch failed" from a genuinely-empty
// list, so the page never shows a real-looking empty table for data it
// doesn't actually have yet.
type UsersState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: User[] };

export default function Users() {
  const { setError, clearError } = useAppError();
  const [usersState, setUsersState] = useState<UsersState>({ status: "loading" });
  const location = useLocation();
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  // Users created locally (via the form below) while a load/retry request is
  // still in flight. If that request's response lands after the creation, it
  // reflects a snapshot from before the creation and must not be allowed to
  // silently wipe the just-created user back out of the list - so any such
  // user is merged back in once the in-flight request resolves.
  const inFlightRef = useRef(false);
  const pendingCreatedRef = useRef<User[]>([]);

  // Captured once, on first render, from whatever navigation state this
  // page was entered with — a plain component-state copy that survives the
  // navigation-state cleanup below, so the message stays visible after it.
  const [successMessage] = useState<string | null>(() => {
    const deletedUserName = (location.state as LocationState)?.deletedUserName;
    return deletedUserName ? `${deletedUserName} deleted successfully` : null;
  });

  useEffect(() => {
    // Clear the one-time navigation state via the router itself (never by
    // poking browser history directly) so a back/forward visit or a plain
    // refresh can't resurface it. Replacing with the same location but
    // state: null produces a new location.state, which is why it's a
    // dependency here — this effect no-ops once cleared instead of looping.
    const deletedUserName = (location.state as LocationState)?.deletedUserName;
    if (deletedUserName) {
      navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true, state: null });
    }
  }, [location.pathname, location.search, location.hash, location.state, navigate]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersState({ status: "loading" });
    inFlightRef.current = true;
    pendingCreatedRef.current = [];
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Unexpected payload");
      if (mountedRef.current) {
        const created = pendingCreatedRef.current;
        const merged = created.length > 0 ? [...created.filter((u) => !data.some((d) => d.id === u.id)), ...data] : data;
        setUsersState({ status: "ready", data: merged });
        clearError();
      }
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : "Failed to load users";
        setUsersState({ status: "error", message });
        setError(message);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [setError, clearError]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleUserCreated = (user: User) => {
    setUsersState((prev) => ({ status: "ready", data: [user, ...(prev.status === "ready" ? prev.data : [])] }));
    if (inFlightRef.current) pendingCreatedRef.current.push(user);
  };

  const users = usersState.status === "ready" ? usersState.data : [];

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Users</h1>
        <p className="text-sm md:text-base text-gray-600">Manage team members and their roles</p>
      </div>

      {successMessage && (
        <div role="status" className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm">
          {successMessage}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
        <UserForm onCreated={handleUserCreated} />
      </div>

      {usersState.status === "loading" && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-12 text-center" aria-live="polite">
          <p className="text-gray-500">Loading users...</p>
        </div>
      )}

      {usersState.status === "error" && (
        <div
          role="alert"
          className="bg-red-50 border border-red-300 rounded-lg p-3 md:p-4 text-sm text-red-700 flex items-center justify-between gap-4"
        >
          <span>Failed to load users: {usersState.message}</span>
          <button
            type="button"
            onClick={loadUsers}
            className="bg-red-600 text-white rounded px-3 py-1.5 text-sm font-medium hover:bg-red-700 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {usersState.status === "ready" && users.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-12 text-center">
          <p className="text-gray-500 text-base md:text-lg">No users yet</p>
        </div>
      )}

      {/* Mobile: Card View */}
      {usersState.status === "ready" && users.length > 0 && (
      <div className="md:hidden space-y-3">
        {users.map((u) => (
          <div
            key={u.id}
            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <UserAvatar
                src={effectiveAvatar(u)}
                name={u.name}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate">{u.name}</div>
                <div className="text-sm text-gray-600 truncate">{u.email}</div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                u.role === "admin"
                  ? "bg-purple-100 text-purple-700"
                  : u.role === "editor"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-700"
              }`}>
                {u.role}
              </span>
              <Link
                to={`/users/${u.id}`}
                className="text-indigo-600 hover:underline text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                aria-label={`View details for ${u.name}`}
              >
                View details
              </Link>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Desktop: Table View */}
      {usersState.status === "ready" && users.length > 0 && (
      <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <tr>
                <th scope="col" className="text-left px-6 py-4 text-sm font-semibold text-gray-900">
                  User
                </th>
                <th scope="col" className="text-left px-6 py-4 text-sm font-semibold text-gray-900">
                  Email
                </th>
                <th scope="col" className="text-left px-6 py-4 text-sm font-semibold text-gray-900">
                  Role
                </th>
                <th scope="col" className="text-left px-6 py-4 text-sm font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        src={effectiveAvatar(u)}
                        name={u.name}
                        size="md"
                      />
                      <span className="font-semibold text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {u.email}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      u.role === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : u.role === "editor"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/users/${u.id}`}
                      className="text-indigo-600 hover:underline text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                      aria-label={`View details for ${u.name}`}
                    >
                      View details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
