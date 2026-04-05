import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const RATE_KEY = 'afesou_commission_rate'

export default function Dashboard() {
  const commissionRate = Number(localStorage.getItem(RATE_KEY) || 20)
  const [stats, setStats] = useState({ customers: 0, todayApts: 0, revenue: 0, expenses: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().split('T')[0]
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [
      { count: customers },
      { data: todayApts },
      { data: monthApts },
      { data: monthExp },
      { data: recentApts }
    ] = await Promise.all([
      supabase.from('customers').select('*', { count: 'exact', head: true }),
      supabase.from('appointments').select('id').eq('date', today),
      supabase.from('appointments').select('price').gte('date', monthStart).lte('date', monthEnd).eq('status', 'completed'),
      supabase.from('expenses').select('amount').gte('date', monthStart).lte('date', monthEnd),
      supabase.from('appointments')
        .select('id, date, time, status, price, customers(name), services(name)')
        .order('date', { ascending: false })
        .order('time', { ascending: false })
        .limit(8)
    ])

    const revenue = monthApts?.reduce((s, a) => s + (Number(a.price) || 0), 0) || 0
    const expenses = monthExp?.reduce((s, e) => s + (Number(e.amount) || 0), 0) || 0

    setStats({ customers: customers || 0, todayApts: todayApts?.length || 0, revenue, expenses })
    setRecent(recentApts || [])
    setLoading(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('appointments').update({ status }).eq('id', id)
    fetchData()
  }

  const dateLabel = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' })

  const commission = stats.revenue * commissionRate / 100
  const netProfit = stats.revenue - commission - stats.expenses

  const statusBadge = (s) => {
    if (s === 'completed') return <span className="badge badge-success">Completed</span>
    if (s === 'cancelled') return <span className="badge badge-danger">Cancelled</span>
    return <span className="badge badge-info">Scheduled</span>
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>{dateLabel}</p>
        </div>
      </div>

      {/* Row 1: activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-icon">👤</div>
          <div className="stat-label">Total Customers</div>
          <div className="stat-value">{stats.customers}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-label">Today's Appointments</div>
          <div className="stat-value">{stats.todayApts}</div>
        </div>
      </div>

      {/* Row 2: financials */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon">💶</div>
          <div className="stat-label">Revenue</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>€{stats.revenue.toFixed(2)}</div>
          <div className="stat-sub">{monthLabel}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏠</div>
          <div className="stat-label">Commission ({commissionRate}%)</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>€{commission.toFixed(2)}</div>
          <div className="stat-sub">To establishment</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💸</div>
          <div className="stat-label">Expenses</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>€{stats.expenses.toFixed(2)}</div>
          <div className="stat-sub">{monthLabel}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">{netProfit >= 0 ? '📈' : '📉'}</div>
          <div className="stat-label">Net Profit</div>
          <div className="stat-value" style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            €{netProfit.toFixed(2)}
          </div>
          <div className="stat-sub">After commission & expenses</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Recent Appointments</h3>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Service</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">📅</div><p>No appointments yet</p></div></td></tr>
              ) : recent.map(apt => (
                <tr key={apt.id}>
                  <td>{apt.customers?.name || '—'}</td>
                  <td>{apt.services?.name || '—'}</td>
                  <td>{apt.date}</td>
                  <td>{apt.time?.slice(0, 5)}</td>
                  <td>{statusBadge(apt.status)}</td>
                  <td>€{Number(apt.price || 0).toFixed(2)}</td>
                  <td>
                    {apt.status === 'scheduled' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-success btn-sm" onClick={() => updateStatus(apt.id, 'completed')}>✓ Done</button>
                        <button className="btn btn-danger btn-sm" onClick={() => updateStatus(apt.id, 'cancelled')}>✕</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
