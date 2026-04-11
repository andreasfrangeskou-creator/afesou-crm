import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const RATE_KEY = 'afesou_commission_rate'

export default function Dashboard() {
  const commissionRate = Number(localStorage.getItem(RATE_KEY) || 20)
  const [stats, setStats] = useState({ customers: 0, todayApts: 0, revenue: 0, projected: 0, expenses: 0 })
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
      { data: completedApts },
      { data: scheduledApts },
      { data: monthExp },
      { data: recentApts }
    ] = await Promise.all([
      supabase.from('customers').select('*', { count: 'exact', head: true }),
      supabase.from('appointments').select('id').eq('date', today),
      supabase.from('appointments').select('price').gte('date', monthStart).lte('date', monthEnd).eq('status', 'completed'),
      supabase.from('appointments').select('price').gte('date', monthStart).lte('date', monthEnd).eq('status', 'scheduled'),
      supabase.from('expenses').select('amount').gte('date', monthStart).lte('date', monthEnd),
      supabase.from('appointments')
        .select('id, date, time, status, price, customers(name), service:service_id(name), service2:service2_id(name)')
    ])

    const revenue = completedApts?.reduce((s, a) => s + (Number(a.price) || 0), 0) || 0
    const projected = scheduledApts?.reduce((s, a) => s + (Number(a.price) || 0), 0) || 0
    const expenses = monthExp?.reduce((s, e) => s + (Number(e.amount) || 0), 0) || 0

    // Sort: upcoming (date >= today) ascending first, then past descending
    const sorted = [...(recentApts || [])].sort((a, b) => {
      const aUp = a.date >= today
      const bUp = b.date >= today
      if (aUp && !bUp) return -1
      if (!aUp && bUp) return 1
      if (aUp) {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return (a.time || '').localeCompare(b.time || '')
      }
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return (b.time || '').localeCompare(a.time || '')
    })

    setStats({ customers: customers || 0, todayApts: todayApts?.length || 0, revenue, projected, expenses })
    setRecent(sorted)
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
  const projectedRevenue = stats.revenue + stats.projected
  const projectedCommission = projectedRevenue * commissionRate / 100
  const projectedNet = projectedRevenue - projectedCommission - stats.expenses

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
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-label">Realized Revenue</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>€{stats.revenue.toFixed(2)}</div>
          <div className="stat-sub">Completed appointments</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔮</div>
          <div className="stat-label">Projected Income</div>
          <div className="stat-value" style={{ color: '#6366f1' }}>€{stats.projected.toFixed(2)}</div>
          <div className="stat-sub">Scheduled this month</div>
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

      {/* Projected breakdown */}
      {stats.projected > 0 && (
        <div className="card" style={{ marginBottom: 24, padding: '14px 20px', background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#5b21b6', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {monthLabel} forecast — if all scheduled appointments complete
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Total Revenue: </span>
              <strong style={{ color: '#6366f1' }}>€{projectedRevenue.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Commission ({commissionRate}%): </span>
              <strong style={{ color: 'var(--warning)' }}>€{projectedCommission.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Expenses: </span>
              <strong style={{ color: 'var(--danger)' }}>€{stats.expenses.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Projected Net: </span>
              <strong style={{ color: projectedNet >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: 15 }}>
                €{projectedNet.toFixed(2)}
              </strong>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>All Appointments</h3>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Upcoming first, then past</span>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th className="hide-mobile">Service(s)</th>
                <th>Date</th>
                <th className="hide-mobile">Time</th>
                <th>Status</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">📅</div><p>No appointments yet</p></div></td></tr>
              ) : recent.map(apt => (
                <tr key={apt.id} style={apt.date === today ? { background: '#fff8fd' } : undefined}>
                  <td>{apt.customers?.name || '—'}</td>
                  <td className="hide-mobile">
                    {[apt.service?.name, apt.service2?.name].filter(Boolean).join(' + ') || '—'}
                  </td>
                  <td>{apt.date}</td>
                  <td className="hide-mobile">{apt.time?.slice(0, 5)}</td>
                  <td>{statusBadge(apt.status)}</td>
                  <td>€{Number(apt.price || 0).toFixed(2)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {apt.status === 'scheduled' && (
                        <>
                          <button className="btn btn-success btn-sm" onClick={() => updateStatus(apt.id, 'completed')}>✓</button>
                          <button className="btn btn-danger btn-sm" onClick={() => updateStatus(apt.id, 'cancelled')}>✕</button>
                        </>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={async () => { if (!confirm('Delete this appointment?')) return; await supabase.from('appointments').delete().eq('id', apt.id); fetchData() }}>🗑</button>
                    </div>
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
