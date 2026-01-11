import { useEffect, useState } from "react";
import { UserForm } from "../components/UserForm";
import { UserAvatar } from "../components/UserAvatar";
import { useLab } from "../context/LabContext";

type User = { 
  id: string; 
  name: string; 
  email: string; 
  role: string; 
  avatar?: string;
  avatarUrl?: string;
};

export default function Users() {
  const { apiFlaky, setLastError } = useLab();
  const hiddenOnMobile = import.meta.env.VITE_HIDDEN_ON_MOBILE === "true";
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(apiFlaky ? "/api/users?lab_api_flaky=true" : "/api/users");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Unexpected payload");
        if (!cancelled) setUsers(data);
      } catch (err) {
        setLastError(err instanceof Error ? err.message : "Fetch error");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [apiFlaky, setLastError]);

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Users</h1>
        <p className="text-sm md:text-base text-gray-600">Manage team members and their roles</p>
      </div>
      
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
                src={u.avatarUrl || u.avatar}
                name={u.name}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate">{u.name}</div>
                <div className="text-sm text-gray-600 truncate">{u.email}</div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-xs font-medium text-gray-500 uppercase">Role</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                u.role === "admin" 
                  ? "bg-purple-100 text-purple-700" 
                  : u.role === "editor"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-700"
              }`}>
                {u.role}
              </span>
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
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">User</th>
                <th className={`text-left px-6 py-4 text-sm font-semibold text-gray-900 ${hiddenOnMobile ? "hidden lg:table-cell" : ""}`}>
                  Email
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Role</th>
                <th className={`text-left px-6 py-4 text-sm font-semibold text-gray-900 ${hiddenOnMobile ? "hidden xl:table-cell" : ""}`}>
                  Status
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
                        src={u.avatarUrl || u.avatar}
                        name={u.name}
                        size="md"
                      />
                      <span className="font-semibold text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-sm text-gray-600 ${hiddenOnMobile ? "hidden lg:table-cell" : ""}`}>
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
                  <td className={`px-6 py-4 ${hiddenOnMobile ? "hidden xl:table-cell" : ""}`}>
                    <span className="inline-flex items-center gap-1 text-sm text-green-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Active
                    </span>
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
