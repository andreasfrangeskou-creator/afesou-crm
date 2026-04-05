import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const EMPTY = { name: '', phone: '', email: '', notes: '' }

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'add' | 'edit' | 'view'
  const [form, setForm] = useState(EMPTY)
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchCustomers() }, [])

  async function fetchCustomers() {
    const { data } = await supabase.from('customers').select('*').order('name')
    setCustomers(data || [])
    setLoading(false)
  }

  async function openView(c) {
    setSelected(c)
    const { data } = await supabase
      .from('appointments')
      .select('id, date, time, status, price, services(name), staff(name)')
      .eq('customer_id', c.id)
      .order('date', { ascending: false })
    setHistory(data || [])
    setModal('view')
  }

  function openAdd() { setForm(EMPTY); setModal('add') }

  function openEdit(c) {
    setSelected(c)
    setForm({ name: c.name, phone: c.phone || '', email: c.email || '', notes: c.notes || '' })
    setModal('edit')
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    if (modal === 'add') {
      await supabase.from('customers').insert([form])
    } else {
      await supabase.from('customers').update(form).eq('id', selected.id)
    }
    setSaving(false)
    setModal(null)
    fetchCustomers()
  }

  async function remove(id) {
    if (!confirm('Delete this customer?')) return
    await supabase.from('customers').delete().eq('id', id)
    fetchCustomers()
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const statusBadge = (s) => {
    if (s === 'completed') return <span className="badge badge-success">Completed</span>
    if (s === 'cancelled') return <span className="badge badge-danger">Cancelled</span>
    return <span className="badge badge-info">Scheduled</span>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Customers</h1>
          <p>{customers.length} total customers</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Customer</button>
      </div>

      <div className="card">
        <div className="toolbar">
          <input
            className="search-input"
            placeholder="Search by name, phone or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Notes</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon">👤</div><p>No customers found</p></div></td></tr>
              ) : filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <button
                      onClick={() => openView(c)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, color: 'var(--primary-dark)', fontSize: 13, padding: 0 }}
                    >
                      {c.name}
                    </button>
                  </td>
                  <td>{c.phone || '—'}</td>
                  <td>{c.email || '—'}</td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.notes || '—'}</td>
                  <td>{new Date(c.created_at).toLocaleDateString('en-GB')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(c.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'add' ? 'Add Customer' : 'Edit Customer'}</h2>
            <div className="form-group">
              <label>Full Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Maria Papadopoulou" />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Phone</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="e.g. 6912345678" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="e.g. maria@email.com" />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Allergies, preferences, etc." />
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* View / History Modal */}
      {modal === 'view' && selected && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ marginBottom: 0 }}>{selected.name}</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  {[selected.phone, selected.email].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => { setModal(null); openEdit(selected) }}>Edit</button>
            </div>
            {selected.notes && (
              <div className="alert alert-info" style={{ marginBottom: 16 }}>📝 {selected.notes}</div>
            )}
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Appointment History</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Date</th><th>Time</th><th>Service</th><th>Staff</th><th>Status</th><th>Price</th></tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No appointments yet</td></tr>
                  ) : history.map(a => (
                    <tr key={a.id}>
                      <td>{a.date}</td>
                      <td>{a.time?.slice(0, 5)}</td>
                      <td>{a.services?.name || '—'}</td>
                      <td>{a.staff?.name || '—'}</td>
                      <td>{statusBadge(a.status)}</td>
                      <td>€{Number(a.price || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
