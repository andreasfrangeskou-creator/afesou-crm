import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const CATEGORIES = ['Rent', 'Supplies', 'Products', 'Utilities', 'Equipment', 'Marketing', 'Staff', 'Other']
const EMPTY = { category: 'Supplies', description: '', amount: '', date: new Date().toISOString().split('T')[0] }

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => { fetchExpenses() }, [filterMonth])

  async function fetchExpenses() {
    const [year, mon] = filterMonth.split('-')
    const start = `${year}-${mon}-01`
    const lastDay = new Date(Number(year), Number(mon), 0).getDate()
    const end = `${year}-${mon}-${lastDay}`
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })
    setExpenses(data || [])
    setLoading(false)
  }

  function openAdd() { setForm({ ...EMPTY, date: new Date().toISOString().split('T')[0] }); setSelected(null); setModal('form') }
  function openEdit(e) { setSelected(e); setForm({ category: e.category, description: e.description || '', amount: String(e.amount), date: e.date }); setModal('form') }

  async function save() {
    if (!form.amount || !form.date) return
    setSaving(true)
    const payload = { category: form.category, description: form.description || null, amount: Number(form.amount), date: form.date }
    if (!selected) {
      await supabase.from('expenses').insert([payload])
    } else {
      await supabase.from('expenses').update(payload).eq('id', selected.id)
    }
    setSaving(false)
    setModal(null)
    fetchExpenses()
  }

  async function remove(id) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', id)
    fetchExpenses()
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

  // Group by category for summary
  const byCategory = {}
  expenses.forEach(e => {
    if (!byCategory[e.category]) byCategory[e.category] = 0
    byCategory[e.category] += Number(e.amount)
  })
  const maxCat = Math.max(...Object.values(byCategory), 1)

  const catColor = {
    Rent: '#6366f1', Supplies: '#ec4899', Products: '#f59e0b',
    Utilities: '#10b981', Equipment: '#3b82f6', Marketing: '#8b5cf6',
    Staff: '#f97316', Other: '#94a3b8'
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Expenses</h1>
          <p>Track business expenses</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Expense</button>
      </div>

      <div className="two-col" style={{ marginBottom: 24 }}>
        {/* Summary by category */}
        <div className="card">
          <div className="card-header">
            <h3>By Category</h3>
            <input
              type="month"
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none' }}
            />
          </div>
          {Object.keys(byCategory).length === 0 ? (
            <div className="empty-state"><div className="empty-icon">💸</div><p>No expenses this month</p></div>
          ) : Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
            <div key={cat} className="report-bar-row">
              <span className="report-bar-label">{cat}</span>
              <div className="report-bar-track">
                <div className="report-bar-fill" style={{ width: `${(amt / maxCat) * 100}%`, background: catColor[cat] || 'var(--primary)' }} />
              </div>
              <span className="report-bar-value">€{amt.toFixed(2)}</span>
            </div>
          ))}
          {Object.keys(byCategory).length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12, fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between' }}>
              <span>Total</span>
              <span style={{ color: 'var(--danger)' }}>€{total.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="stat-card">
            <div className="stat-icon">💸</div>
            <div className="stat-label">Total This Month</div>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>€{total.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🧾</div>
            <div className="stat-label">Number of Expenses</div>
            <div className="stat-value">{expenses.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-label">Average per Expense</div>
            <div className="stat-value">€{expenses.length ? (total / expenses.length).toFixed(2) : '0.00'}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Expense List</h3>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Loading...</td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan={5}><div className="empty-state"><div className="empty-icon">💸</div><p>No expenses this month</p></div></td></tr>
              ) : expenses.map(e => (
                <tr key={e.id}>
                  <td>{e.date}</td>
                  <td>
                    <span className="badge" style={{ background: (catColor[e.category] || '#94a3b8') + '22', color: catColor[e.category] || '#94a3b8' }}>
                      {e.category}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{e.description || '—'}</td>
                  <td style={{ fontWeight: 700, color: 'var(--danger)' }}>€{Number(e.amount).toFixed(2)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(e)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(e.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'form' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{selected ? 'Edit Expense' : 'Add Expense'}</h2>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Date *</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Amount (€) *</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What was this for?" />
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
