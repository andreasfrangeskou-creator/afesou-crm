import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const RATE_KEY = 'afesou_commission_rate'

export default function Reports() {
  const commissionRate = Number(localStorage.getItem(RATE_KEY) || 20)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => { fetchReport() }, [filterMonth])

  async function fetchReport() {
    setLoading(true)
    const [year, mon] = filterMonth.split('-')
    const start = `${year}-${mon}-01`
    const lastDay = new Date(Number(year), Number(mon), 0).getDate()
    const end = `${year}-${mon}-${lastDay}`

    const [
      { data: appointments },
      { data: expenses },
      { data: newCustomers }
    ] = await Promise.all([
      supabase.from('appointments')
        .select('id, date, price, price2, status, services(name)')
        .gte('date', start).lte('date', end),
      supabase.from('expenses')
        .select('id, amount, category')
        .gte('date', start).lte('date', end),
      supabase.from('customers')
        .select('id')
        .gte('created_at', start + 'T00:00:00')
        .lte('created_at', end + 'T23:59:59')
    ])

    const completed = (appointments || []).filter(a => a.status === 'completed')
    const cancelled = (appointments || []).filter(a => a.status === 'cancelled')

    const revenue = completed.reduce((s, a) => s + Number(a.price || 0) + Number(a.price2 || 0), 0)
    const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0)
    const commissionOwed = revenue * commissionRate / 100
    const netProfit = revenue - totalExpenses - commissionOwed

    // Top services
    const serviceMap = {}
    completed.forEach(a => {
      const name = a.services?.name || 'Unknown'
      if (!serviceMap[name]) serviceMap[name] = { count: 0, revenue: 0 }
      serviceMap[name].count++
      serviceMap[name].revenue += Number(a.price || 0)
    })
    const topServices = Object.entries(serviceMap)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)

    // Expenses by category
    const expCatMap = {}
    ;(expenses || []).forEach(e => {
      if (!expCatMap[e.category]) expCatMap[e.category] = 0
      expCatMap[e.category] += Number(e.amount)
    })

    setData({
      revenue, totalExpenses, commissionOwed, netProfit,
      totalApts: (appointments || []).length,
      completedApts: completed.length,
      cancelledApts: cancelled.length,
      newCustomers: newCustomers?.length || 0,
      topServices, expCatMap
    })
    setLoading(false)
  }

  const monthLabel = new Date(Number(filterMonth.split('-')[0]), Number(filterMonth.split('-')[1]) - 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' })

  const maxSvcRev = data?.topServices?.[0]?.revenue || 1
  const maxExpCat = data?.expCatMap ? Math.max(...Object.values(data.expCatMap), 1) : 1

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Monthly Reports</h1>
          <p>{monthLabel}</p>
        </div>
        <input
          type="month"
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none' }}
        />
      </div>

      {loading ? (
        <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
      ) : (
        <>
          {/* Financial Summary */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-icon">💶</div>
              <div className="stat-label">Revenue</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>€{data.revenue.toFixed(2)}</div>
              <div className="stat-sub">{data.completedApts} completed apts</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🏠</div>
              <div className="stat-label">To Establishment ({commissionRate}%)</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>€{data.commissionOwed.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">💸</div>
              <div className="stat-label">Expenses</div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>€{data.totalExpenses.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">{data.netProfit >= 0 ? '📈' : '📉'}</div>
              <div className="stat-label">Net Profit</div>
              <div className="stat-value" style={{ color: data.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                €{data.netProfit.toFixed(2)}
              </div>
              <div className="stat-sub">After commission & expenses</div>
            </div>
          </div>

          {/* Appointment Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-label">Total Appointments</div>
              <div className="stat-value">{data.totalApts}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Completed</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>{data.completedApts}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Cancelled</div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{data.cancelledApts}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">New Customers</div>
              <div className="stat-value" style={{ color: 'var(--primary)' }}>{data.newCustomers}</div>
            </div>
          </div>

          <div className="two-col">
            {/* Top Services */}
            <div className="card">
              <div className="card-header"><h3>Top Services by Revenue</h3></div>
              {data.topServices.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">✂️</div><p>No completed appointments</p></div>
              ) : data.topServices.map(s => (
                <div key={s.name} className="report-bar-row">
                  <span className="report-bar-label">{s.name}</span>
                  <div className="report-bar-track">
                    <div className="report-bar-fill" style={{ width: `${(s.revenue / maxSvcRev) * 100}%` }} />
                  </div>
                  <span className="report-bar-value">€{s.revenue.toFixed(0)}</span>
                </div>
              ))}
            </div>

            {/* Expenses by Category */}
            <div className="card">
              <div className="card-header"><h3>Expenses by Category</h3></div>
              {Object.keys(data.expCatMap).length === 0 ? (
                <div className="empty-state"><div className="empty-icon">💸</div><p>No expenses this month</p></div>
              ) : Object.entries(data.expCatMap).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                <div key={cat} className="report-bar-row">
                  <span className="report-bar-label">{cat}</span>
                  <div className="report-bar-track">
                    <div className="report-bar-fill" style={{ width: `${(amt / maxExpCat) * 100}%`, background: 'var(--danger)' }} />
                  </div>
                  <span className="report-bar-value">€{amt.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
