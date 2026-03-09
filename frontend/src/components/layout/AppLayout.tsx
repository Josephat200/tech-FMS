import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { AiAssistantWidget } from '../widgets/AiAssistantWidget';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/ledger', label: 'Ledger' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/payroll', label: 'Payroll' },
  { to: '/budgets', label: 'Budgets' },
  { to: '/reports', label: 'Reports' },
  { to: '/settings', label: 'Settings', adminOnly: true },
];

export function AppLayout() {
  const { user, logout, hasRole } = useAuth();

  const visibleNavItems = navItems.filter((item) => !item.adminOnly || hasRole(['ADMIN']));

  return (
    <div className="app-shell">
      <aside className="app-sidebar no-print">
        <div>
          <h2 style={{ margin: 0, color: 'var(--primary)' }}>FLORANTE TECH</h2>
          <small style={{ color: 'var(--text-muted)' }}>Financial Management System</small>
        </div>

        <nav style={{ display: 'grid', gap: '0.4rem' }}>
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                padding: '0.65rem 0.75rem',
                borderRadius: '10px',
                background: isActive ? 'var(--primary-soft)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text)',
                fontWeight: 600,
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="card" style={{ boxShadow: 'none' }}>
          <div style={{ marginBottom: '0.7rem' }}>
            <div style={{ fontWeight: 700 }}>{user?.email}</div>
            <small style={{ color: 'var(--text-muted)' }}>{user?.roles.join(', ')}</small>
          </div>
          <button className="btn ghost" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="app-main">
        <Outlet />

        <div className="floating-tools">
          <AiAssistantWidget />
        </div>
      </main>
    </div>
  );
}
