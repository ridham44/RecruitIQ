import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';

export default function DashboardLayout({ navItems }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-5">
          <img src="/Logo.png" alt="RecruitIQ" className="h-9 w-9 object-contain" />
          <span className="text-lg font-semibold text-slate-900">RecruitIQ</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <div className="mb-2 truncate px-3 text-xs text-slate-500">{user?.email}</div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 md:hidden">
          <div className="flex items-center gap-2">
            <img src="/Logo.png" alt="RecruitIQ" className="h-8 w-8 object-contain" />
            <span className="text-lg font-semibold text-slate-900">RecruitIQ</span>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-slate-600">
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </header>

        {/* Bottom padding reserves space for the fixed mobile tab bar below */}
        <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar — the only navigation on small screens */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white md:hidden">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                isActive ? 'text-brand-600' : 'text-slate-500'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
