import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useState } from "react";
import Tasks from "./routes/Tasks";
import Users from "./routes/Users";
import Dashboard from "./routes/Dashboard";
import { useLab } from "./context/LabContext";

const navLinkClass = (isActive: boolean) =>
  `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 min-h-[44px] ${
    isActive 
      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg" 
      : "text-gray-700 hover:bg-gray-100"
  }`;

export default function App() {
  const { lastError, refreshToken } = useLab();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navigationItems = [
    { 
      to: "/", 
      label: "Dashboard", 
      icon: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      end: true
    },
    { 
      to: "/tasks", 
      label: "Tasks", 
      icon: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      )
    },
    { 
      to: "/users", 
      label: "Users", 
      icon: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    }
  ];

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          data-testid="mobile-overlay"
        />
      )}

      {/* Sidebar / Mobile Drawer */}
      <aside 
        className={`
          fixed md:static inset-y-0 left-0 z-50
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          ${sidebarCollapsed ? "md:w-20" : "md:w-64"}
          w-64 bg-white shadow-2xl transition-all duration-300 flex flex-col border-r border-gray-200
        `}
        data-testid="sidebar"
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg">
              P
            </div>
            {!sidebarCollapsed && (
              <div>
                <h1 className="font-bold text-lg text-gray-900">Playwright</h1>
                <p className="text-xs text-gray-500">Training App</p>
              </div>
            )}
          </Link>
          
          {/* Close button for mobile */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
            data-testid="close-mobile-menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navigationItems.map((item) => (
            <NavLink 
              key={item.to}
              to={item.to}
              end={item.end}
              className={navLinkClass(item.end ? location.pathname === item.to : location.pathname.startsWith(item.to))}
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.icon}
              {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse Button (Desktop only) */}
        <div className="p-4 border-t border-gray-200 hidden md:block">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px]"
            data-testid="sidebar-toggle"
          >
            <svg 
              className={`w-5 h-5 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            {!sidebarCollapsed && <span className="text-sm font-medium">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile Header with Hamburger */}
        <header className="md:hidden bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              data-testid="open-mobile-menu"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">
                P
              </div>
              <span className="font-bold text-gray-900">Playwright</span>
            </div>
            
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
        </header>

        {/* Error Banner */}
        {lastError && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 shadow-sm">
            <div className="px-4 md:px-6 py-3 flex items-center gap-3">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm font-medium text-amber-900">{lastError}</span>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <Routes key={refreshToken}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/users" element={<Users />} />
            </Routes>
          </div>
        </main>

        {/* Bottom Navigation for Mobile */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-30">
          <div className="grid grid-cols-3 gap-1 p-2">
            {navigationItems.map((item) => {
              const isActive = item.end 
                ? location.pathname === item.to 
                : location.pathname.startsWith(item.to);
              
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all min-h-[56px] ${
                    isActive
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                  data-testid={`bottom-nav-${item.label.toLowerCase()}`}
                >
                  {item.icon}
                  <span className="text-xs font-medium mt-1">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
