import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { path: 'dashboard', label: 'Dashboard', icon: '📊' },
  { path: 'customers', label: 'Customers', icon: '👤' },
  { path: 'calendar', label: 'Calendar', icon: '📅' },
  { path: 'services', label: 'Services', icon: '✂️' },
  { path: 'commission', label: 'Commission', icon: '💰' },
  { path: 'expenses', label: 'Expenses', icon: '💸' },
  { path: 'reports', label: 'Reports', icon: '📈' },
]

export default function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>Afesou <span>CRM</span></h2>
          <p>Beauty Studio</p>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink key={item.path} to={`/${item.path}`}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
