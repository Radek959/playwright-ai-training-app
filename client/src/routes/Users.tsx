import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { UserForm } from "../components/UserForm";
import { UserAvatar } from "../components/UserAvatar";
import { useAppError } from "../context/AppErrorContext";
import { effectiveAvatar } from "../utils/avatar";
import type { User } from "../types";

type LocationState = { deletedUserName?: string } | null;

export default function Users() {
  const { setError, clearError } = useAppError();
  const [users, setUsers] = useState<User[]>([]);
  const location = useLocation();
  const navigate = useNavigate();

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
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/users");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Unexpected payload");
        if (!cancelled) {
          setUsers(data);
          clearError();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fetch error");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [setError, clearError]);

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
        <UserForm onCreated={(user) => setUsers((prev) => [user, ...prev])} />
      </div>

      {/* Mobile: Card View */}
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

      {/* Desktop: Table View */}
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
    </div>
  );
}
