import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const EMPTY_FORM = { customer_id: '', service_id: '', staff_id: '', date: '', time: '', status: 'scheduled', notes: '', price: '' }

export default function CalendarPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [appointments, setAppointments] = useState([])
  const [customers, setCustomers] = useState([])
  const [services, setServices] = useState([])
  const [staff, setStaff] = useState([])
  const [modal, setModal] = useState(null) // null | 'add' | 'edit' | 'day'
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
    const { data } = await supabase
      .from('appointments')
      .select('id, date, time, status, price, notes, customer_id, service_id, staff_id, customers(name), services(name, price), staff(name)')
      .gte('date', start)
      .lte('date', end)
      .order('time')
    setAppointments(data || [])
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  function openDay(day) {
    setSelectedDay(day)
    setModal('day')
  }

  function openAdd(day) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setForm({ ...EMPTY_FORM, date: dateStr })
    setModal('add')
  }

  function openEdit(apt) {
    setSelectedApt(apt)
    setForm({
      customer_id: apt.customer_id || '',
      service_id: apt.service_id || '',
      staff_id: apt.staff_id || '',
      date: apt.date,
      time: apt.time?.slice(0, 5) || '',
      status: apt.status,
      notes: apt.notes || '',
      price: apt.price || ''
    })
    setModal('edit')
  }

  function handleServiceChange(id) {
    const svc = services.find(s => s.id === id)
    setForm(f => ({ ...f, service_id: id, price: svc ? String(svc.price) : f.price }))
  }

  async function save() {
    if (!form.customer_id || !form.date || !form.time) return
    setSaving(true)
    const payload = {
      customer_id: form.customer_id,
      service_id: form.service_id || null,
      staff_id: form.staff_id || null,
      date: form.date,
      time: form.time,
      status: form.status,
      notes: form.notes,
      price: form.price ? Number(form.price) : null
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
                {dayAptList.length > 3 && (
                  <span className="apt-chip more">+{dayAptList.length - 3} more</span>
                )}
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
              <button className="btn btn-primary btn-sm" onClick={() => { openAdd(selectedDay); }}>+ Add</button>
            </div>
            {dayApts.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📅</div><p>No appointments this day</p></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>Time</th><th>Customer</th><th>Service</th><th>Staff</th><th>Status</th><th>Price</th><th></th></tr>
                  </thead>
                  <tbody>
                    {dayApts.map(a => (
                      <tr key={a.id}>
                        <td>{a.time?.slice(0, 5)}</td>
                        <td>{a.customers?.name || '—'}</td>
                        <td>{a.services?.name || '—'}</td>
                        <td>{a.staff?.name || '—'}</td>
                        <td>{statusBadge(a.status)}</td>
                        <td>€{Number(a.price || 0).toFixed(2)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {a.status === 'scheduled' && (
                              <>
                                <button className="btn btn-success btn-sm" onClick={() => updateStatus(a.id, 'completed')}>✓ Done</button>
                                <button className="btn btn-danger btn-sm" onClick={() => updateStatus(a.id, 'cancelled')}>✕ Cancel</button>
                              </>
                            )}
                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(a)}>Edit</button>
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
              <select value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">Select customer...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Service</label>
                <select value={form.service_id} onChange={e => handleServiceChange(e.target.value)}>
                  <option value="">Select service...</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name} — €{s.price}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Staff</label>
                <select value={form.staff_id} onChange={e => setForm({ ...form, staff_id: e.target.value })}>
                  <option value="">Select staff...</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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

            <div className="form-grid-2">
              <div className="form-group">
                <label>Price (€)</label>
                <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
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

            <div className="form-group">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any notes..." />
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              {modal === 'edit' && (
                <button className="btn btn-danger" onClick={() => remove(selectedApt.id)}>Delete</button>
              )}
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
