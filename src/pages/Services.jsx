import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const EMPTY = { name: '', price: '', duration: '', description: '' }

export default function Services() {
  const [services, setServices] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchServices() }, [])

  async function fetchServices() {
    const { data } = await supabase.from('services').select('*').order('name')
    setServices(data || [])
    setLoading(false)
  }

  function openAdd() { setForm(EMPTY); setSelected(null); setModal('form') }
  function openEdit(s) { setSelected(s); setForm({ name: s.name, price: String(s.price), duration: String(s.duration || ''), description: s.description || '' }); setModal('form') }

  async function save() {
    if (!form.name.trim() || !form.price) return
    setSaving(true)
    const payload = { name: form.name.trim(), price: Number(form.price), duration: form.duration ? Number(form.duration) : null, description: form.description || null }
    if (!selected) {
      const { error } = await supabase.from('services').insert([payload])
      if (error) { alert('Error: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('services').update(payload).eq('id', selected.id)
      if (error) { alert('Error: ' + error.message); setSaving(false); return }
    }
    setSaving(false)
    setModal(null)
    fetchServices()
  }

  async function remove(id) {
    if (!confirm('Delete this service?')) return
    await supabase.from('services').delete().eq('id', id)
    fetchServices()
  }

  const filtered = services.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
  const totalRevenuePotential = services.reduce((sum, s) => sum + Number(s.price), 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Services & Pricing</h1>
          <p>{services.length} services</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Service</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon">✂️</div>
          <div className="stat-label">Total Services</div>
          <div className="stat-value">{services.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💶</div>
          <div className="stat-label">Average Price</div>
          <div className="stat-value">€{services.length ? (services.reduce((s, x) => s + Number(x.price), 0) / services.length).toFixed(2) : '0.00'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⬆️</div>
          <div className="stat-label">Highest Price</div>
          <div className="stat-value">€{services.length ? Math.max(...services.map(s => Number(s.price))).toFixed(2) : '0.00'}</div>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <input className="search-input" placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Service Name</th>
                <th>Price</th>
                <th>Duration</th>
                <th>Description</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5}><div className="empty-state"><div className="empty-icon">✂️</div><p>No services found</p></div></td></tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: 14 }}>€{Number(s.price).toFixed(2)}</span>
                  </td>
                  <td>{s.duration ? `${s.duration} min` : '—'}</td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                    {s.description || '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(s.id)}>Delete</button>
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
            <h2>{selected ? 'Edit Service' : 'Add Service'}</h2>
            <div className="form-group">
              <label>Service Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Full Hair Color" />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Price (€) *</label>
                <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Duration (min)</label>
                <input type="number" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 60" />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Short description..." />
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
