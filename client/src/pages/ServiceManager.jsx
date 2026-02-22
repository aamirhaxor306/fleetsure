import { useState, useEffect } from 'react'
import { maintenance as api, vehicles as vehiclesApi } from '../api'
import PageHeader from '../components/PageHeader'

const SERVICE_TYPES = [
  { value: 'engine', label: 'Engine' },
  { value: 'tyre', label: 'Tyre' },
  { value: 'brake', label: 'Brake' },
  { value: 'clutch', label: 'Clutch' },
  { value: 'oil_change', label: 'Oil Change' },
  { value: 'battery', label: 'Battery' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'body_work', label: 'Body Work' },
  { value: 'ac', label: 'AC' },
  { value: 'general', label: 'General' },
]

const TYPE_COLORS = {
  engine: 'bg-red-100 text-red-700',
  tyre: 'bg-amber-100 text-amber-700',
  brake: 'bg-orange-100 text-orange-700',
  clutch: 'bg-violet-100 text-violet-700',
  oil_change: 'bg-yellow-100 text-yellow-700',
  battery: 'bg-blue-100 text-blue-700',
  electrical: 'bg-cyan-100 text-cyan-700',
  body_work: 'bg-slate-100 text-slate-700',
  ac: 'bg-sky-100 text-sky-700',
  general: 'bg-teal-100 text-teal-700',
}

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function ServiceManager() {
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')

  const [form, setForm] = useState({
    vehicleId: '', maintenanceType: 'general', description: '',
    amount: '', workshopName: '', maintenanceDate: new Date().toISOString().slice(0, 10),
  })

  useEffect(() => {
    Promise.allSettled([api.list(), api.stats(), vehiclesApi.list()])
      .then(([l, s, v]) => {
        if (l.status === 'fulfilled') setLogs(l.value)
        if (s.status === 'fulfilled') setStats(s.value)
        if (v.status === 'fulfilled') setVehicles(v.value)
        setLoading(false)
      })
  }, [])

  const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.maintenanceType === filter)

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const log = await api.create(form)
      setLogs(prev => [log, ...prev])
      setShowAdd(false)
      setForm({ vehicleId: '', maintenanceType: 'general', description: '', amount: '', workshopName: '', maintenanceDate: new Date().toISOString().slice(0, 10) })
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  if (loading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-slate-200 rounded w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-200 rounded-2xl" />)}
      </div>
      <div className="h-64 bg-slate-200 rounded-2xl" />
    </div>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Service Management"
        subtitle={`${logs.length} service records`}
        action={<button onClick={() => setShowAdd(true)} className="btn-primary">+ Add Service</button>}
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <div className="text-xl font-bold text-slate-800">{stats.totalServices}</div>
            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total Services</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <div className="text-xl font-bold text-slate-800">{inr(stats.totalSpend)}</div>
            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total Spend</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <div className="text-xl font-bold text-slate-800">{stats.byType?.[0]?.type?.replace('_', ' ') || '-'}</div>
            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Most Common</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <div className="text-xl font-bold text-slate-800">{stats.workshops?.[0]?.name || '-'}</div>
            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Top Workshop</div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${filter === 'all' ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          All ({logs.length})
        </button>
        {SERVICE_TYPES.map(t => {
          const count = logs.filter(l => l.maintenanceType === t.value).length
          if (count === 0) return null
          return (
            <button key={t.value} onClick={() => setFilter(t.value)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${filter === t.value ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {t.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Service list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-3xl mb-2">🔧</div>
            <div className="text-sm font-semibold text-slate-700">No service records yet</div>
            <p className="text-xs text-slate-400 mt-1">Add your first service entry</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map(log => (
              <div key={log.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                <div className="shrink-0">
                  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize ${TYPE_COLORS[log.maintenanceType] || 'bg-slate-100 text-slate-600'}`}>
                    {log.maintenanceType.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800">{log.vehicle?.vehicleNumber}</div>
                  <div className="text-xs text-slate-500 truncate">{log.description || log.workshopName || 'No details'}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-slate-800">{inr(log.amount)}</div>
                  <div className="text-[11px] text-slate-400">
                    {new Date(log.maintenanceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Service Modal */}
      {showAdd && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setShowAdd(false)} />
          <div className="fixed inset-x-4 top-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg bg-white rounded-2xl shadow-2xl z-50 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-5">Add Service Record</h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle *</label>
                  <select className="inp" value={form.vehicleId} onChange={e => setForm({...form, vehicleId: e.target.value})} required>
                    <option value="">Select vehicle...</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber} — {v.vehicleType}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Service Type *</label>
                    <select className="inp" value={form.maintenanceType} onChange={e => setForm({...form, maintenanceType: e.target.value})}>
                      {SERVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Amount (₹) *</label>
                    <input className="inp" type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Workshop / Garage</label>
                  <input className="inp" value={form.workshopName} onChange={e => setForm({...form, workshopName: e.target.value})} placeholder="e.g. Sharma Motors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                  <input className="inp" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="What was done?" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
                  <input className="inp" type="date" value={form.maintenanceDate} onChange={e => setForm({...form, maintenanceDate: e.target.value})} required />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={saving || !form.vehicleId || !form.amount} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save Service'}</button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
