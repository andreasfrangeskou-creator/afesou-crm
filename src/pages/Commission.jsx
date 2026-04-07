import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const RATE_KEY = 'afesou_commission_rate'
const EMPTY_STAFF = { name: '' }

export default function Commission() {
  const [appointments, setAppointments] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [rate, setRate] = useState(() => Number(localStorage.getItem(RATE_KEY) || 20))
  const [editingRate, setEditingRate] = useState(false)
  const [tempRate, setTempRate] = useState(rate)
  const [staffModal, setStaffModal] = useState(null)
  const [staffForm, setStaffForm] = useState(EMPTY_STAFF)
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [savingStaff, setSavingStaff] = useState(false)
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => { fetchAppointments() }, [filterMonth])
  useEffect(() => { fetchStaff() }, [])

  async function fetchStaff() {
    const { data } = await supabase.from('staff').select('*').order('name')
    setStaff(data || [])
  }

  async function saveStaff() {
    if (!staffForm.name.trim()) return
    setSavingStaff(true)
    if (!selectedStaff) {
      await supabase.from('staff').insert([{ name: staffForm.name.trim() }])
    } else {
      await supabase.from('staff').update({ name: staffForm.name.trim() }).eq('id', selectedStaff.id)
    }
    setSavingStaff(false)
    setStaffModal(null)
    fetchStaff()
  }

  async function deleteStaff(id) {
    if (!confirm('Delete this staff member?')) return
    await supabase.from('staff').delete().eq('id', id)
    fetchStaff()
  }

  async function fetchAppointments() {
    setLoading(true)
    const [year, mon] = filterMonth.split('-')
    const start = `${year}-${mon}-01`
    const lastDay = new Date(Number(year), Number(mon), 0).getDate()
    const end = `${year}-${mon}-${lastDay}`
    const { data } = await supabase
      .from('appointments')
      .select('id, date, time, price, status, customers(name), service:service_id(name)')
      .gte('date', start)
      .lte('date', end)
      .eq('status', 'completed')
      .order('date', { ascending: true })
    setAppointments(data || [])
    setLoading(false)
  }

  function saveRate() {
    const r = Math.min(100, Math.max(0, Number(tempRate) || 0))
    setRate(r)
    localStorage.setItem(RATE_KEY, String(r))
    setEditingRate(false)
  }

  const totalRevenue = appointments.reduce((s, a) => s + Number(a.price || 0), 0)
  const toOwner = totalRevenue * rate / 100
  const toBeautician = totalRevenue - toOwner

  const monthLabel = new Date(Number(filterMonth.split('-')[0]), Number(filterMonth.split('-')[1]) - 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Commission</h1>
          <p>Establishment commission tracking — {monthLabel}</p>
        </div>
        <input
          type="month"
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none' }}
        />
      </div>

      {/* Staff Management */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3>Staff Members</h3>
          <button className="btn btn-primary btn-sm" onClick={() => { setStaffForm(EMPTY_STAFF); setSelectedStaff(null); setStaffModal('form') }}>+ Add Staff</button>
        </div>
        {staff.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px' }}><div className="empty-icon">💼</div><p>No staff members yet</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead><tr><th>Name</th><th></th></tr></thead>
              <tbody>
                {staff.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedStaff(s); setStaffForm({ name: s.name }); setStaffModal('form') }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteStaff(s.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Commission Rate Setting */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Establishment Commission Rate</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              You pay <strong style={{ color: 'var(--text)' }}>{rate}%</strong> of your service revenue to the establishment owners.
            </div>
          </div>
          {editingRate ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={tempRate}
                onChange={e => setTempRate(e.target.value)}
                style={{ width: 80, padding: '7px 10px', border: '1px solid var(--primary)', borderRadius: 8, fontSize: 14, outline: 'none', textAlign: 'center', fontWeight: 700 }}
                autoFocus
              />
              <span style={{ fontSize: 14 }}>%</span>
              <button className="btn btn-primary btn-sm" onClick={saveRate}>Save</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingRate(false)}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)' }}>{rate}%</span>
              <button className="btn btn-secondary btn-sm" onClick={() => { setTempRate(rate); setEditingRate(true) }}>Change</button>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon">💶</div>
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value">€{totalRevenue.toFixed(2)}</div>
          <div className="stat-sub">{appointments.length} completed appointments</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏠</div>
          <div className="stat-label">Owed to Establishment</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>€{toOwner.toFixed(2)}</div>
          <div className="stat-sub">{rate}% of revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-label">You Keep</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>€{toBeautician.toFixed(2)}</div>
          <div className="stat-sub">{100 - rate}% of revenue</div>
        </div>
      </div>

      {/* Appointments Breakdown */}
      <div className="card">
        <div className="card-header">
          <h3>Appointment Breakdown</h3>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{appointments.length} completed</span>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : appointments.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📊</div><p>No completed appointments this month</p></div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Customer</th>
                    <th>Service</th>
                    <th>Price</th>
                    <th>To Establishment ({rate}%)</th>
                    <th>You Keep ({100 - rate}%)</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map(a => {
                    const price = Number(a.price || 0)
                    const ownerCut = price * rate / 100
                    const myCut = price - ownerCut
                    return (
                      <tr key={a.id}>
                        <td>{a.date}</td>
                        <td>{a.time?.slice(0, 5)}</td>
                        <td>{a.customers?.name || '—'}</td>
                        <td>{a.service?.name || '—'}</td>
                        <td style={{ fontWeight: 600 }}>€{price.toFixed(2)}</td>
                        <td style={{ color: 'var(--danger)', fontWeight: 600 }}>€{ownerCut.toFixed(2)}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 600 }}>€{myCut.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ borderTop: '2px solid var(--border)', paddingTop: 16, marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 32 }}>
              <div style={{ fontSize: 13 }}>
                Total Revenue: <strong>€{totalRevenue.toFixed(2)}</strong>
              </div>
              <div style={{ fontSize: 13, color: 'var(--danger)' }}>
                To Establishment: <strong>€{toOwner.toFixed(2)}</strong>
              </div>
              <div style={{ fontSize: 13, color: 'var(--success)' }}>
                You Keep: <strong>€{toBeautician.toFixed(2)}</strong>
              </div>
            </div>
          </>
        )}
      </div>
      {staffModal === 'form' && (
        <div className="modal-overlay" onClick={() => setStaffModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{selectedStaff ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
            <div className="form-group">
              <label>Full Name *</label>
              <input value={staffForm.name} onChange={e => setStaffForm({ name: e.target.value })} placeholder="e.g. Elena Stavrou" autoFocus />
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setStaffModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveStaff} disabled={savingStaff}>{savingStaff ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
