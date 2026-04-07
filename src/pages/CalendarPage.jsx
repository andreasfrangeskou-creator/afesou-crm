import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const EMPTY_FORM = {
  customer_id: '', customer_name: '',
  service_id: '', service2_id: '',
  staff_id: '', date: '', time: '',
  status: 'scheduled', notes: '', price: '', price2: ''
}

function CustomerSearch({ customers, value, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // When value changes externally (edit mode), sync display name
  useEffect(() => {
    if (value) {
      const c = customers.find(c => c.id === value)
      if (c) setQuery(c.name)
    } else {
      setQuery('')
    }
  }, [value, customers])

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = customers.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange('', '') }}
        onFocus={() => setOpen(true)}
        placeholder="Type to search customer..."
        style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, background: 'white',
          border: '1px solid var(--border)', borderRadius: 8, zIndex: 500,
          maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 2
        }}>
          {filtered.map(c => (
            <div
              key={c.id}
              onClick={() => { onChange(c.id, c.name); setQuery(c.name); setOpen(false) }}
              style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => e.target.style.background = 'var(--primary-light)'}
              onMouseLeave={e => e.target.style.background = 'white'}
            >
              {c.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CalendarPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [appointments, setAppointments] = useState([])
  const [customers, setCustomers] = useState([])
  const [services, setServices] = useState([])
  const [staff, setStaff] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedDay, setSelectedDay] = useState(null)
  const [selectedApt, setSelectedApt] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAppointments() }, [year, month])
  useEffect(() => { fetchMeta() }, [])

  async function fetchMeta() {
    const [{ data: c }, { data: s }, { data: st }] = await Promise.all([
      supabase.from('customers').select('id, name').order('name'),
      supabase.from('services').select('id, name, price').order('name'),
      supabase.from('staff').select('id, name').order('name'),
    ])
    setCustomers(c || [])
    setServices(s || [])
    setStaff(st || [])
  }

  async function fetchAppointments() {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`
    let { data, error } = await supabase
      .from('appointments')
      .select('id, date, time, status, price, price2, notes, customer_id, service_id, service2_id, staff_id, customers(name), services(name, price), staff(name)')
      .gte('date', start).lte('date', end).order('time')
    if (error) {
      // Fallback: fetch without new columns if schema cache hasn't updated yet
      const fallback = await supabase
        .from('appointments')
        .select('id, date, time, status, price, notes, customer_id, service_id, staff_id, customers(name), services(name, price), staff(name)')
        .gte('date', start).lte('date', end).order('time')
      data = fallback.data
    }
    setAppointments(data || [])
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  function openDay(day) { setSelectedDay(day); setModal('day') }

  function openAdd(day) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setForm({ ...EMPTY_FORM, date: dateStr })
    setModal('add')
  }

  function openEdit(apt) {
    setSelectedApt(apt)
    const cust = customers.find(c => c.id === apt.customer_id)
    setForm({
      customer_id: apt.customer_id || '',
      customer_name: cust?.name || '',
      service_id: apt.service_id || '',
      service2_id: apt.service2_id || '',
      staff_id: apt.staff_id || '',
      date: apt.date,
      time: apt.time?.slice(0, 5) || '',
      status: apt.status,
      notes: apt.notes || '',
      price: apt.price || '',
      price2: apt.price2 || ''
    })
    setModal('edit')
  }

  function handleService1Change(id) {
    const svc = services.find(s => s.id === id)
    setForm(f => ({ ...f, service_id: id, price: svc ? String(svc.price) : f.price }))
  }

  function handleService2Change(id) {
    const svc = services.find(s => s.id === id)
    setForm(f => ({ ...f, service2_id: id, price2: svc ? String(svc.price) : f.price2 }))
  }

  const totalPrice = (Number(form.price) || 0) + (Number(form.price2) || 0)

  async function save() {
    if (!form.customer_id || !form.date || !form.time) return
    setSaving(true)
    const payload = {
      customer_id: form.customer_id,
      service_id: form.service_id || null,
      service2_id: form.service2_id || null,
      staff_id: form.staff_id || null,
      date: form.date,
      time: form.time,
      status: form.status,
      notes: form.notes || null,
      price: form.price ? Number(form.price) : null,
      price2: form.price2 ? Number(form.price2) : null,
    }
    if (modal === 'add') {
      const { error } = await supabase.from('appointments').insert([payload])
      if (error) { alert('Error: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('appointments').update(payload).eq('id', selectedApt.id)
      if (error) { alert('Error: ' + error.message); setSaving(false); return }
    }
    setSaving(false)
    setModal(null)
    fetchAppointments()
  }

  async function updateStatus(id, status) {
    await supabase.from('appointments').update({ status }).eq('id', id)
    fetchAppointments()
  }

  async function remove(id) {
    if (!confirm('Delete this appointment?')) return
    await supabase.from('appointments').delete().eq('id', id)
    fetchAppointments()
    setModal(null)
  }

  // Build calendar grid
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = new Date().toISOString().split('T')[0]

  const aptsByDay = {}
  appointments.forEach(a => {
    const d = parseInt(a.date.split('-')[2])
    if (!aptsByDay[d]) aptsByDay[d] = []
    aptsByDay[d].push(a)
  })

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const monthName = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })

  const statusBadge = (s) => {
    if (s === 'completed') return <span className="badge badge-success">Completed</span>
    if (s === 'cancelled') return <span className="badge badge-danger">Cancelled</span>
    return <span className="badge badge-info">Scheduled</span>
  }

  const aptTotal = (a) => (Number(a.price || 0) + Number(a.price2 || 0)).toFixed(2)
  const aptServices = (a) => [a.services?.name, a.service2_id ? '+ 2nd' : null].filter(Boolean).join(', ')

  const dayApts = selectedDay ? (aptsByDay[selectedDay] || []) : []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Calendar</h1>
          <p>{appointments.length} appointments this month</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ ...EMPTY_FORM, date: todayStr }); setModal('add') }}>
          + New Appointment
        </button>
      </div>

      <div className="card">
        <div className="calendar-header">
          <button className="btn btn-secondary btn-sm" onClick={prevMonth}>‹ Prev</button>
          <h3>{monthName}</h3>
          <button className="btn btn-secondary btn-sm" onClick={nextMonth}>Next ›</button>
        </div>
        <div className="calendar-grid">
          {DAYS.map(d => <div key={d} className="calendar-day-name">{d}</div>)}
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} className="calendar-day empty" />
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday = dateStr === todayStr
            const dayAptList = aptsByDay[day] || []
            return (
              <div key={day} className={`calendar-day${isToday ? ' today' : ''}`} onClick={() => openDay(day)}>
                <div className="day-number">{day}</div>
                {dayAptList.slice(0, 3).map(a => (
                  <span key={a.id} className={`apt-chip ${a.status}`}>
                    {a.time?.slice(0, 5)} {a.customers?.name?.split(' ')[0]}
                  </span>
                ))}
                {dayAptList.length > 3 && <span className="apt-chip more">+{dayAptList.length - 3} more</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Day view modal */}
      {modal === 'day' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ marginBottom: 0 }}>
                {selectedDay} {new Date(year, month).toLocaleString('default', { month: 'long' })} {year}
              </h2>
              <button className="btn btn-primary btn-sm" onClick={() => openAdd(selectedDay)}>+ Add</button>
            </div>
            {dayApts.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📅</div><p>No appointments this day</p></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>Time</th><th>Customer</th><th>Service(s)</th><th>Status</th><th>Total</th><th></th></tr>
                  </thead>
                  <tbody>
                    {dayApts.map(a => (
                      <tr key={a.id}>
                        <td>{a.time?.slice(0, 5)}</td>
                        <td>{a.customers?.name || '—'}</td>
                        <td>{aptServices(a)}</td>
                        <td>{statusBadge(a.status)}</td>
                        <td>€{aptTotal(a)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {a.status === 'scheduled' && (
                              <>
                                <button className="btn btn-success btn-sm" onClick={() => updateStatus(a.id, 'completed')}>✓</button>
                                <button className="btn btn-danger btn-sm" onClick={() => updateStatus(a.id, 'cancelled')}>✕</button>
                              </>
                            )}
                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(a)}>Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={() => remove(a.id)}>Del</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Appointment Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'add' ? 'New Appointment' : 'Edit Appointment'}</h2>

            <div className="form-group">
              <label>Customer *</label>
              <CustomerSearch
                customers={customers}
                value={form.customer_id}
                onChange={(id, name) => setForm(f => ({ ...f, customer_id: id, customer_name: name }))}
              />
            </div>

            {/* Session 1 */}
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Session 1</div>
              <div className="form-grid-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Service</label>
                  <select value={form.service_id} onChange={e => handleService1Change(e.target.value)}>
                    <option value="">Select service...</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} — €{s.price}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Price (€)</label>
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
                </div>
              </div>
            </div>

            {/* Session 2 */}
            <div style={{ background: '#fdf2f8', borderRadius: 8, padding: '12px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Session 2 (optional)</div>
              <div className="form-grid-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Service</label>
                  <select value={form.service2_id} onChange={e => handleService2Change(e.target.value)}>
                    <option value="">None</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} — €{s.price}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Price (€)</label>
                  <input type="number" step="0.01" value={form.price2} onChange={e => setForm({ ...form, price2: e.target.value })} placeholder="0.00" disabled={!form.service2_id} />
                </div>
              </div>
            </div>

            {/* Total */}
            {(Number(form.price) > 0 || Number(form.price2) > 0) && (
              <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)', marginBottom: 12 }}>
                Total: €{totalPrice.toFixed(2)}
              </div>
            )}

            <div className="form-grid-2">
              <div className="form-group">
                <label>Staff</label>
                <select value={form.staff_id} onChange={e => setForm({ ...form, staff_id: e.target.value })}>
                  <option value="">Select staff...</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Date *</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Time *</label>
                <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
              </div>
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any notes..." />
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              {modal === 'edit' && (
                <button className="btn btn-danger" onClick={() => remove(selectedApt.id)}>Delete</button>
              )}
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.customer_id}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
