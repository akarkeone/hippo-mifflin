import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const navItems = [
  { to: '/overview', label: 'Overview' },
  { to: '/projects', label: 'Projects' },
  { to: '/resourcing', label: 'Resourcing' },
  { to: '/partners', label: 'Partners' },
];

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Top nav bar */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 h-12"
        style={{
          backgroundColor: 'var(--card)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-6">
          <span
            className="font-medium text-sm tracking-tight"
            style={{ color: 'var(--text)', fontSize: '15px' }}
          >
            Hippo-Mifflin
          </span>
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                    isActive ? '' : ''
                  }`
                }
                style={({ isActive }) => ({
                  color: isActive ? 'var(--accent)' : 'var(--text2)',
                  backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
                })}
              >
                {item.label}
              </NavLink>
            ))}
            {user?.role === 'EP' && (
              <NavLink
                to="/settings"
                className="px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--accent)' : 'var(--text2)',
                  backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
                })}
              >
                Settings
              </NavLink>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px]" style={{ color: 'var(--text2)' }}>
            {user?.name}
          </span>
          <button
            onClick={handleLogout}
            className="text-[13px] px-3 py-1 rounded-md transition-colors cursor-pointer"
            style={{ color: 'var(--text3)' }}
          >
            Log out
          </button>
        </div>
      </nav>
      {/* Page content */}
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
