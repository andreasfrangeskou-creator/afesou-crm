import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

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
  const [open, setOpen] = useState(false)

  return (
    <div className="layout">
      {/* Mobile header */}
      <header className="mobile-header">
        <button className="hamburger" onClick={() => setOpen(true)}>☰</button>
        <span className="mobile-title">Afesou <span>CRM</span></span>
        <span style={{ width: 40 }} />
      </header>

      {/* Sidebar overlay */}
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Afesou <span>CRM</span></h2>
            <button className="sidebar-close" onClick={() => setOpen(false)}>✕</button>
          </div>
          <p>Beauty Studio</p>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink key={item.path} to={`/${item.path}`} onClick={() => setOpen(false)}>
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
