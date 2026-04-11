import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const RATE_KEY = 'afesou_commission_rate'
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Reports() {
  const commissionRate = Number(localStorage.getItem(RATE_KEY) || 20)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('summary')
  const [yearData, setYearData] = useState(null)
  const [yearLoading, setYearLoading] = useState(false)
  const [loadedYear, setLoadedYear] = useState(null)
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => { fetchReport() }, [filterMonth])

  useEffect(() => {
    if (tab === 'year') {
      const year = filterMonth.split('-')[0]
      if (loadedYear !== year) fetchYear(year)
    }
  }, [tab, filterMonth])

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
        .select('id, date, price, status, customers(name), service:service_id(name), service2:service2_id(name)')
        .gte('date', start).lte('date', end)
        .order('date', { ascending: true })
        .order('time', { ascending: true }),
      supabase.from('expenses')
        .select('id, amount, category, date, description')
        .gte('date', start).lte('date', end)
        .order('date', { ascending: false }),
      supabase.from('customers')
        .select('id')
        .gte('created_at', start + 'T00:00:00')
        .lte('created_at', end + 'T23:59:59')
    ])

    const completed = (appointments || []).filter(a => a.status === 'completed')
    const cancelled = (appointments || []).filter(a => a.status === 'cancelled')
    const scheduled = (appointments || []).filter(a => a.status === 'scheduled')

    const revenue = completed.reduce((s, a) => s + Number(a.price || 0), 0)
    const scheduledRevenue = scheduled.reduce((s, a) => s + Number(a.price || 0), 0)
    const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0)
    const commissionOwed = revenue * commissionRate / 100
    const netProfit = revenue - totalExpenses - commissionOwed
    const projectedRevenue = revenue + scheduledRevenue
    const projectedNet = projectedRevenue - (projectedRevenue * commissionRate / 100) - totalExpenses

    // Top services — count BOTH service1 and service2
    const serviceMap = {}
    completed.forEach(a => {
      const s1 = a.service?.name
      const s2 = a.service2?.name
      const numServices = [s1, s2].filter(Boolean).length
      const priceEach = Number(a.price || 0) / (numServices || 1)

      if (s1) {
        if (!serviceMap[s1]) serviceMap[s1] = { count: 0, revenue: 0 }
        serviceMap[s1].count++
        serviceMap[s1].revenue += priceEach
      }
      if (s2) {
        if (!serviceMap[s2]) serviceMap[s2] = { count: 0, revenue: 0 }
        serviceMap[s2].count++
        serviceMap[s2].revenue += priceEach
      }
    })
    const topServices = Object.entries(serviceMap)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Expenses by category
    const expCatMap = {}
    ;(expenses || []).forEach(e => {
      if (!expCatMap[e.category]) expCatMap[e.category] = 0
      expCatMap[e.category] += Number(e.amount)
    })

    setData({
      revenue, totalExpenses, commissionOwed, netProfit,
      projectedRevenue, projectedNet, scheduledRevenue,
      totalApts: (appointments || []).length,
      completedApts: completed.length,
      cancelledApts: cancelled.length,
      scheduledApts: scheduled,
      newCustomers: newCustomers?.length || 0,
      topServices, expCatMap,
      expenses: expenses || [],
      completed
    })
    setLoading(false)
  }

  async function fetchYear(year) {
    setYearLoading(true)
    const start = `${year}-01-01`
    const end = `${year}-12-31`
    const [{ data: apts }, { data: exps }] = await Promise.all([
      supabase.from('appointments').select('date, price, status').gte('date', start).lte('date', end),
      supabase.from('expenses').select('date, amount').gte('date', start).lte('date', end)
    ])

    const months = Array.from({ length: 12 }, (_, i) => {
      const mon = String(i + 1).padStart(2, '0')
      const mApts = (apts || []).filter(a => a.date.startsWith(`${year}-${mon}`))
      const mExps = (exps || []).filter(e => e.date.startsWith(`${year}-${mon}`))
      const revenue = mApts.filter(a => a.status === 'completed').reduce((s, a) => s + Number(a.price || 0), 0)
      const expenses = mExps.reduce((s, e) => s + Number(e.amount || 0), 0)
      const commission = revenue * commissionRate / 100
      const net = revenue - commission - expenses
      const scheduled = mApts.filter(a => a.status === 'scheduled').reduce((s, a) => s + Number(a.price || 0), 0)
      return { month: i, revenue, expenses, commission, net, scheduled }
    })

    setYearData(months)
    setLoadedYear(year)
    setYearLoading(false)
  }

  const monthLabel = new Date(Number(filterMonth.split('-')[0]), Number(filterMonth.split('-')[1]) - 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' })

  const maxSvcCount = data?.topServices?.[0]?.count || 1
  const maxExpCat = data?.expCatMap ? Math.max(...Object.values(data.expCatMap), 1) : 1

  const statusBadge = (s) => {
    if (s === 'completed') return <span className="badge badge-success">Completed</span>
    if (s === 'cancelled') return <span className="badge badge-danger">Cancelled</span>
    return <span className="badge badge-info">Scheduled</span>
  }

  const selectedYear = filterMonth.split('-')[0]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p>{tab === 'year' ? `${selectedYear} overview` : monthLabel}</p>
        </div>
        {tab !== 'year' && (
          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none' }}
          />
        )}
        {tab === 'year' && (
          <input
            type="number"
            value={selectedYear}
            min="2020" max="2099"
            onChange={e => setFilterMonth(`${e.target.value}-${filterMonth.split('-')[1]}`)}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', width: 90 }}
          />
        )}
      </div>

      <div className="tabs">
        {[
          { key: 'summary', label: 'Summary' },
          { key: 'services', label: 'Services' },
          { key: 'expenses', label: 'Expenses' },
          { key: 'scheduled', label: `Upcoming${data ? ` (${data.scheduledApts.length})` : ''}` },
          { key: 'year', label: `${selectedYear} Overview` },
        ].map(t => (
          <button
            key={t.key}
            className={`tab-btn${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* YEAR OVERVIEW TAB */}
      {tab === 'year' && (
        yearLoading ? (
          <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading year data...</div>
        ) : yearData ? (
          <div className="card">
            <div className="card-header">
              <h3>{selectedYear} — Month by Month</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>All amounts in €</span>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Revenue</th>
                    <th className="hide-mobile">Commission</th>
                    <th>Expenses</th>
                    <th>Net Profit</th>
                    <th className="hide-mobile">Scheduled</th>
                  </tr>
                </thead>
                <tbody>
                  {yearData.map((m, i) => {
                    const hasData = m.revenue > 0 || m.expenses > 0
                    return (
                      <tr
                        key={i}
                        style={{ opacity: hasData ? 1 : 0.4, cursor: hasData ? 'pointer' : 'default' }}
                        onClick={() => {
                          if (hasData) {
                            setFilterMonth(`${selectedYear}-${String(i + 1).padStart(2, '0')}`)
                            setTab('summary')
                          }
                        }}
                      >
                        <td style={{ fontWeight: 600 }}>{MONTH_NAMES[i]}</td>
                        <td style={{ color: 'var(--success)' }}>
                          {m.revenue > 0 ? `€${m.revenue.toFixed(2)}` : '—'}
                        </td>
                        <td className="hide-mobile" style={{ color: 'var(--warning)' }}>
                          {m.commission > 0 ? `€${m.commission.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ color: m.expenses > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                          {m.expenses > 0 ? `€${m.expenses.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ color: m.net >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                          {hasData ? `€${m.net.toFixed(2)}` : '—'}
                        </td>
                        <td className="hide-mobile" style={{ color: '#6366f1' }}>
                          {m.scheduled > 0 ? `€${m.scheduled.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700, background: '#f8fafc' }}>
                    <td>Total</td>
                    <td style={{ color: 'var(--success)' }}>€{yearData.reduce((s, m) => s + m.revenue, 0).toFixed(2)}</td>
                    <td className="hide-mobile" style={{ color: 'var(--warning)' }}>€{yearData.reduce((s, m) => s + m.commission, 0).toFixed(2)}</td>
                    <td style={{ color: 'var(--danger)' }}>€{yearData.reduce((s, m) => s + m.expenses, 0).toFixed(2)}</td>
                    <td style={{ color: yearData.reduce((s, m) => s + m.net, 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      €{yearData.reduce((s, m) => s + m.net, 0).toFixed(2)}
                    </td>
                    <td className="hide-mobile" style={{ color: '#6366f1' }}>€{yearData.reduce((s, m) => s + m.scheduled, 0).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              Click a month row to jump to its detailed report.
            </div>
          </div>
        ) : null
      )}

      {tab !== 'year' && (loading ? (
        <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
      ) : (
        <>
          {/* SUMMARY TAB */}
          {tab === 'summary' && (
            <>
              <div className="stats-grid" style={{ marginBottom: 16 }}>
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

              {/* Projected forecast bar */}
              {data.scheduledApts.length > 0 && (
                <div className="card" style={{ marginBottom: 16, padding: '14px 20px', background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#5b21b6', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    If all {data.scheduledApts.length} upcoming appointments complete
                  </div>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Total Revenue: </span>
                      <strong style={{ color: '#6366f1' }}>€{data.projectedRevenue.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Commission: </span>
                      <strong style={{ color: 'var(--warning)' }}>€{(data.projectedRevenue * commissionRate / 100).toFixed(2)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Projected Net: </span>
                      <strong style={{ color: data.projectedNet >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: 15 }}>
                        €{data.projectedNet.toFixed(2)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

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

              {/* Completed appointments list */}
              <div className="card">
                <div className="card-header"><h3>Completed Appointments</h3></div>
                {data.completed.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">✅</div><p>No completed appointments this month</p></div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Customer</th>
                          <th className="hide-mobile">Service(s)</th>
                          <th>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.completed.map(a => (
                          <tr key={a.id}>
                            <td>{a.date}</td>
                            <td>{a.customers?.name || '—'}</td>
                            <td className="hide-mobile">
                              {[a.service?.name, a.service2?.name].filter(Boolean).join(' + ') || '—'}
                            </td>
                            <td>€{Number(a.price || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* SERVICES TAB */}
          {tab === 'services' && (
            <div className="card">
              <div className="card-header">
                <h3>Top Services</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Both service slots counted, revenue split proportionally</span>
              </div>
              {data.topServices.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">✂️</div><p>No completed appointments this month</p></div>
              ) : data.topServices.map(s => (
                <div key={s.name} className="report-bar-row">
                  <span className="report-bar-label">{s.name}</span>
                  <div className="report-bar-track">
                    <div className="report-bar-fill" style={{ width: `${(s.count / maxSvcCount) * 100}%` }} />
                  </div>
                  <span className="report-bar-value" style={{ minWidth: 90, textAlign: 'right' }}>
                    {s.count}x · €{s.revenue.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* EXPENSES TAB */}
          {tab === 'expenses' && (
            <div className="two-col">
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

              <div className="card">
                <div className="card-header"><h3>All Expenses</h3></div>
                {data.expenses.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">💸</div><p>No expenses this month</p></div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr><th>Date</th><th>Category</th><th className="hide-mobile">Description</th><th>Amount</th></tr>
                      </thead>
                      <tbody>
                        {data.expenses.map(e => (
                          <tr key={e.id}>
                            <td>{e.date}</td>
                            <td>{e.category}</td>
                            <td className="hide-mobile">{e.description || '—'}</td>
                            <td style={{ color: 'var(--danger)' }}>€{Number(e.amount).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* UPCOMING TAB */}
          {tab === 'scheduled' && (
            <div className="card">
              <div className="card-header">
                <h3>Upcoming Appointments</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Projected revenue: €{data.scheduledRevenue.toFixed(2)}
                </span>
              </div>
              {data.scheduledApts.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">🔮</div><p>No upcoming appointments this month</p></div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Customer</th>
                        <th className="hide-mobile">Service(s)</th>
                        <th>Status</th>
                        <th>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.scheduledApts.map(a => (
                        <tr key={a.id}>
                          <td>{a.date}</td>
                          <td>{a.customers?.name || '—'}</td>
                          <td className="hide-mobile">
                            {[a.service?.name, a.service2?.name].filter(Boolean).join(' + ') || '—'}
                          </td>
                          <td>{statusBadge(a.status)}</td>
                          <td>€{Number(a.price || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      ))}
    </div>
  )
}
