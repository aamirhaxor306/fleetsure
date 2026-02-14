import { useState, useEffect } from 'react'
import { maintenance as maintenanceApi, vehicles as vehiclesApi } from '../api'
import SlideOver from '../components/SlideOver'

export default function Maintenance() {
  const [logs, setLogs] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    vehicleId: '', maintenanceType: '', amount: '', maintenanceDate: '', description: '', workshopName: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    Promise.all([maintenanceApi.list(), vehiclesApi.list()])
      .then(([m, v]) => { setLogs(m); setVehicles(v) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await maintenanceApi.create({ ...form, amount: parseInt(form.amount) })
      setForm({ vehicleId: '', maintenanceType: '', amount: '', maintenanceDate: '', description: '', workshopName: '' })
      setShowForm(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const totalSpend = logs.reduce((s, m) => s + m.amount, 0)

  if (loading) return (
    <div className="page-wide">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded-xl w-40" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
      </div>
    </div>
  )

  return (
    <div className="page-wide">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Maintenance</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + Add Log
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-6">
        {logs.length} entries · Total spend: <span className="font-bold text-gray-600">₹{totalSpend.toLocaleString('en-IN')}</span>
      </p>

      {/* SlideOver Form */}
      <SlideOver open={showForm} onClose={() => setShowForm(false)} title="Add Maintenance Log">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FSelect label="Vehicle" required value={form.vehicleId}
            onChange={(v) => setForm({ ...form, vehicleId: v })}
            options={[{ value: '', label: '— Select —' }, ...vehicles.map((v) => ({ value: v.id, label: v.vehicleNumber }))]} />
          <FSelect label="Type" required value={form.maintenanceType}
            onChange={(v) => setForm({ ...form, maintenanceType: v })}
            options={[{ value: '', label: '— Select —' }, ...['engine', 'tyre', 'brake', 'clutch', 'general'].map((t) => ({ value: t, label: t }))]} />
          <FInput label="Amount (₹)" type="number" required value={form.amount}
            onChange={(v) => setForm({ ...form, amount: v })} />
          <FInput label="Date" type="date" required value={form.maintenanceDate}
            onChange={(v) => setForm({ ...form, maintenanceDate: v })} />
          <FInput label="Workshop" value={form.workshopName}
            onChange={(v) => setForm({ ...form, workshopName: v })} />
          <FInput label="Description" value={form.description}
            onChange={(v) => setForm({ ...form, description: v })} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      </SlideOver>

      {/* Table */}
      {logs.length === 0 ? (
        <Empty text="No maintenance logs yet." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="clean-table">
              <thead>
                <tr>
                  <th>Vehicle</th><th>Type</th><th>Amount</th><th>Date</th><th>Workshop</th><th>Description</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((m) => (
                  <tr key={m.id}>
                    <td className="font-bold text-gray-800">{m.vehicle?.vehicleNumber}</td>
                    <td><span className="capitalize badge badge-idle">{m.maintenanceType}</span></td>
                    <td className="font-bold text-gray-800 tabular-nums">₹{m.amount.toLocaleString('en-IN')}</td>
                    <td className="text-gray-500">{new Date(m.maintenanceDate).toLocaleDateString('en-IN')}</td>
                    <td className="text-gray-400">{m.workshopName || '—'}</td>
                    <td className="text-gray-400 max-w-xs truncate">{m.description || '—'}</td>
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

function Empty({ text }) {
  return (
    <div className="py-16 text-center">
      <p className="text-3xl mb-3">🔧</p>
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  )
}
