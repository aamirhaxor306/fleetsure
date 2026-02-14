import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { documents as documentsApi, vehicles as vehiclesApi, renewals as renewalsApi } from '../api'
import SlideOver from '../components/SlideOver'

export default function Documents() {
  const [docs, setDocs] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ vehicleId: '', documentType: '', expiryDate: '', reminderDays: '30' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [renewingDocId, setRenewingDocId] = useState(null)
  const navigate = useNavigate()

  const load = () => {
    Promise.all([documentsApi.list(), vehiclesApi.list()])
      .then(([d, v]) => { setDocs(d); setVehicles(v) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await documentsApi.create(form)
      setForm({ vehicleId: '', documentType: '', expiryDate: '', reminderDays: '30' })
      setShowForm(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const daysLeft = (date) => {
    const d = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24))
    if (d <= 0) return <span className="badge badge-high">EXPIRED</span>
    if (d <= 30) return <span className="badge badge-medium">{d}d left</span>
    return <span className="badge badge-active">{d}d left</span>
  }

  const expired = docs.filter((d) => new Date(d.expiryDate) <= new Date()).length
  const expiringSoon = docs.filter((d) => {
    const dl = Math.ceil((new Date(d.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
    return dl > 0 && dl <= 30
  }).length

  const isExpiringSoon = (date) => {
    const dl = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24))
    return dl <= 45
  }

  const handleRenew = async (doc) => {
    setRenewingDocId(doc.id)
    try {
      const result = await renewalsApi.create({
        vehicleId: doc.vehicleId || doc.vehicle?.id,
        documentId: doc.id,
        documentType: doc.documentType,
      })
      navigate(`/renewals/${result.id}`)
    } catch (err) {
      console.error('Create renewal error:', err)
      setRenewingDocId(null)
    }
  }

  if (loading) return (
    <div className="page-wide">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded-xl w-36" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
      </div>
    </div>
  )

  return (
    <div className="page-wide">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Documents</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + Add Document
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-6">
        {docs.length} total
        {expired > 0 && <span className="text-red-500 font-bold"> · {expired} expired</span>}
        {expiringSoon > 0 && <span className="text-amber-500 font-bold"> · {expiringSoon} expiring soon</span>}
      </p>

      {/* Summary cards */}
      {(expired > 0 || expiringSoon > 0) && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="stat-card red">
            <p className="stat-value text-red-600">{expired}</p>
            <p className="stat-label">Expired</p>
          </div>
          <div className="stat-card amber">
            <p className="stat-value text-amber-600">{expiringSoon}</p>
            <p className="stat-label">Expiring Soon</p>
          </div>
          <div className="stat-card emerald">
            <p className="stat-value text-emerald-600">{docs.length - expired - expiringSoon}</p>
            <p className="stat-label">Valid</p>
          </div>
        </div>
      )}

      {/* SlideOver Form */}
      <SlideOver open={showForm} onClose={() => setShowForm(false)} title="Add Document">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FSelect label="Vehicle" required value={form.vehicleId}
            onChange={(v) => setForm({ ...form, vehicleId: v })}
            options={[{ value: '', label: '— Select —' }, ...vehicles.map((v) => ({ value: v.id, label: v.vehicleNumber }))]} />
          <FSelect label="Type" required value={form.documentType}
            onChange={(v) => setForm({ ...form, documentType: v })}
            options={[{ value: '', label: '— Select —' }, ...['insurance', 'FC', 'permit', 'PUC'].map((t) => ({ value: t, label: t }))]} />
          <FInput label="Expiry Date" type="date" required value={form.expiryDate}
            onChange={(v) => setForm({ ...form, expiryDate: v })} />
          <FInput label="Reminder Days" type="number" value={form.reminderDays}
            onChange={(v) => setForm({ ...form, reminderDays: v })} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      </SlideOver>

      {/* Table */}
      {docs.length === 0 ? (
        <Empty text="No documents added yet." icon="📄" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="clean-table">
              <thead>
                <tr>
                  <th>Vehicle</th><th>Document</th><th>Expiry</th><th>Status</th><th>Reminder</th><th></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td className="font-bold text-gray-800">{d.vehicle?.vehicleNumber}</td>
                    <td><span className="uppercase font-bold text-gray-700 text-xs">{d.documentType}</span></td>
                    <td className="text-gray-500">{new Date(d.expiryDate).toLocaleDateString('en-IN')}</td>
                    <td>{daysLeft(d.expiryDate)}</td>
                    <td className="text-gray-400 text-xs">{d.reminderDays}d before</td>
                    <td>
                      {isExpiringSoon(d.expiryDate) && (
                        <button onClick={() => handleRenew(d)} disabled={renewingDocId === d.id}
                          className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg transition-all disabled:opacity-50">
                          {renewingDocId === d.id ? '...' : 'Renew →'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Shared ──────────────────────────────────── */

function FInput({ label, value, onChange, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1.5">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="inp" {...props} />
    </div>
  )
}

function FSelect({ label, value, onChange, options, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1.5">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="inp" {...props}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function Empty({ text, icon = '📄' }) {
  return (
    <div className="py-16 text-center">
      <p className="text-3xl mb-3">{icon}</p>
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  )
}
