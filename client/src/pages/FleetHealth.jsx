import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fleetHealth as fleetHealthApi, documents as documentsApi, alerts as alertsApi, maintenance as maintenanceApi, vehicles as vehiclesApi } from '../api'
import PageHeader from '../components/PageHeader'
import KPICard from '../components/KPICard'
import HealthScore from '../components/HealthScore'
import StatusDot from '../components/StatusDot'
import FilterBar from '../components/FilterBar'
import SlideOver from '../components/SlideOver'
import EmptyState from '../components/EmptyState'
import { HeartPulseIcon, FileTextIcon, AlertTriangleIcon, WrenchIcon, PlusIcon } from '../components/Icons'

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#2563eb', '#8b5cf6']

export default function FleetHealth() {
  const navigate = useNavigate()
  const [health, setHealth] = useState(null)
  const [documents, setDocuments] = useState([])
  const [alertList, setAlerts] = useState([])
  const [maintLogs, setMaintLogs] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('documents')

  // Document add form
  const [showDocForm, setShowDocForm] = useState(false)
  const [docForm, setDocForm] = useState({ vehicleId: '', documentType: 'insurance', expiryDate: '', reminderDays: 30 })

  // Maintenance add form
  const [showMaintForm, setShowMaintForm] = useState(false)
  const [maintForm, setMaintForm] = useState({ vehicleId: '', maintenanceType: 'general', description: '', amount: '', workshopName: '', maintenanceDate: new Date().toISOString().slice(0, 10) })

  useEffect(() => {
    Promise.allSettled([
      fleetHealthApi.score(),
      documentsApi.list(),
      alertsApi.list(),
      maintenanceApi.list(),
      vehiclesApi.list(),
    ]).then(([h, d, a, m, v]) => {
      if (h.status === 'fulfilled') setHealth(h.value)
      if (d.status === 'fulfilled') setDocuments(d.value)
      if (a.status === 'fulfilled') setAlerts(a.value?.alerts || a.value || [])
      if (m.status === 'fulfilled') setMaintLogs(m.value)
      if (v.status === 'fulfilled') setVehicles(v.value)
      setLoading(false)
    })
  }, [])

  const now = new Date()
  const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

  // Document analysis
  const expiredDocs = documents.filter(d => new Date(d.expiryDate) <= now)
  const expiringSoon = documents.filter(d => {
    const exp = new Date(d.expiryDate)
    return exp > now && exp <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  })
  const validDocs = documents.filter(d => new Date(d.expiryDate) > new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000))

  const docPieData = [
    { name: 'Expired', value: expiredDocs.length },
    { name: 'Expiring', value: expiringSoon.length },
    { name: 'Valid', value: validDocs.length },
  ].filter(d => d.value > 0)

  // Alerts analysis
  const unresolvedAlerts = alertList.filter(a => !a.resolved)
  const highAlerts = unresolvedAlerts.filter(a => a.severity === 'high')
  const mediumAlerts = unresolvedAlerts.filter(a => a.severity === 'medium')
  const lowAlerts = unresolvedAlerts.filter(a => a.severity === 'low')

  const alertByType = {}
  unresolvedAlerts.forEach(a => {
    if (!alertByType[a.alertType]) alertByType[a.alertType] = { type: a.alertType, high: 0, medium: 0, low: 0 }
    alertByType[a.alertType][a.severity]++
  })
  const alertChartData = Object.values(alertByType)

  // Maintenance analysis
  const totalMaintSpend = maintLogs.reduce((s, m) => s + m.amount, 0)
  const maintByType = {}
  maintLogs.forEach(m => {
    maintByType[m.maintenanceType] = (maintByType[m.maintenanceType] || 0) + m.amount
  })
  const maintPieData = Object.entries(maintByType).map(([name, value]) => ({ name, value }))

  // Monthly maintenance trend
  const maintByMonth = {}
  maintLogs.forEach(m => {
    const d = new Date(m.maintenanceDate)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    maintByMonth[key] = (maintByMonth[key] || 0) + m.amount
  })
  const maintTrend = Object.entries(maintByMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([month, amount]) => ({ month, amount }))

  const resolveAlert = async (id) => {
    try {
      await alertsApi.resolve(id)
      setAlerts(alertList.map(a => a.id === id ? { ...a, resolved: true } : a))
    } catch (err) { alert(err.message) }
  }

  const handleAddDoc = async (e) => {
    e.preventDefault()
    try {
      await documentsApi.create(docForm)
      const updated = await documentsApi.list()
      setDocuments(updated)
      setShowDocForm(false)
    } catch (err) { alert(err.message) }
  }

  const handleAddMaint = async (e) => {
    e.preventDefault()
    try {
      await maintenanceApi.create({ ...maintForm, amount: parseInt(maintForm.amount) })
      const updated = await maintenanceApi.list()
      setMaintLogs(updated)
      setShowMaintForm(false)
    } catch (err) { alert(err.message) }
  }

  const tabs = [
    { value: 'documents', label: 'Documents', count: documents.length },
    { value: 'alerts', label: 'Alerts', count: unresolvedAlerts.length },
    { value: 'maintenance', label: 'Maintenance', count: maintLogs.length },
  ]

  if (loading) return <div className="animate-pulse"><div className="h-8 bg-slate-200 rounded w-48 mb-4" /><div className="h-64 bg-slate-200 rounded-lg" /></div>

  return (
    <div>
      <PageHeader title="Fleet Health" subtitle="See what needs attention — expired documents, alerts, and repairs" />

      {/* Health Score */}
      <div className="card p-6 mb-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <HealthScore
            score={health?.overall || 0}
            size={120}
            segments={[
              { label: 'Documents', value: health?.documents?.score || 0 },
              { label: 'Alerts', value: health?.alerts?.score || 0 },
              { label: 'Maintenance', value: health?.maintenance?.score || 0 },
              { label: 'Tyres', value: health?.tyres?.score || 0 },
            ]}
          />
          <div className="flex-1">
            {/* Plain English explanation */}
            <div className="bg-slate-50 rounded-xl px-4 py-3 mb-3">
              <p className="text-sm text-slate-700">
                {(health?.overall || 0) >= 80
                  ? 'Your fleet is in good shape! Keep it up.'
                  : (health?.overall || 0) >= 50
                  ? `Your fleet needs some attention — ${expiredDocs.length > 0 ? `${expiredDocs.length} expired document${expiredDocs.length !== 1 ? 's' : ''}` : ''}${expiredDocs.length > 0 && unresolvedAlerts.length > 0 ? ' and ' : ''}${unresolvedAlerts.length > 0 ? `${unresolvedAlerts.length} unresolved alert${unresolvedAlerts.length !== 1 ? 's' : ''}` : ''}.`
                  : `Your fleet needs urgent attention! Renew expired documents and resolve alerts to avoid fines.`}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard label="Expired Docs" value={expiredDocs.length} color="red" />
              <KPICard label="Expiring Soon" value={expiringSoon.length} color="amber" />
              <KPICard label="Open Alerts" value={unresolvedAlerts.length} color="red" />
              <KPICard label="Repair Spend" value={inr(totalMaintSpend)} color="blue" />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="card overflow-hidden">
        <div className="flex border-b border-slate-200">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.value ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label} <span className="text-slate-400 ml-1">({t.count})</span>
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* ── Documents Tab ────────────────────────────────── */}
          {tab === 'documents' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-slate-700">
                  {expiredDocs.length > 0 ? `${expiredDocs.length} document(s) expired -- renew to avoid fines` : 'All documents up to date'}
                </h3>
                <button onClick={() => setShowDocForm(true)} className="btn-primary text-xs flex items-center gap-1"><PlusIcon className="w-3 h-3" /> Add</button>
              </div>

              {docPieData.length > 0 && (
                <div className="flex items-center gap-6 mb-4">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={docPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
                        <Cell fill="#ef4444" /><Cell fill="#f59e0b" /><Cell fill="#10b981" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-red-500" /> Expired ({expiredDocs.length})</div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-amber-500" /> Expiring ({expiringSoon.length})</div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-emerald-500" /> Valid ({validDocs.length})</div>
                  </div>
                </div>
              )}

              <table className="data-table">
                <thead><tr><th>Vehicle</th><th>Type</th><th>Expiry</th><th>Days Left</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {[...expiredDocs, ...expiringSoon, ...validDocs].map(doc => {
                    const exp = new Date(doc.expiryDate)
                    const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24))
                    const status = daysLeft < 0 ? 'expired' : daysLeft < 30 ? 'expiring' : 'valid'
                    const veh = vehicles.find(v => v.id === doc.vehicleId)
                    return (
                      <tr key={doc.id}>
                        <td className="font-mono text-xs">{veh?.vehicleNumber || '-'}</td>
                        <td><span className="uppercase font-medium text-xs">{doc.documentType}</span></td>
                        <td className="text-xs">{exp.toLocaleDateString()}</td>
                        <td><span className={`badge ${status === 'expired' ? 'badge-high' : status === 'expiring' ? 'badge-medium' : 'badge-success'}`}>{daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d`}</span></td>
                        <td><StatusDot status={status} /></td>
                        <td>{status !== 'valid' && <button onClick={() => navigate('/renewals')} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Renew</button>}</td>
                      </tr>
                    )
                  })}
                  {documents.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-slate-400">No documents tracked</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Alerts Tab ───────────────────────────────────── */}
          {tab === 'alerts' && (
            <div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <KPICard label="High" value={highAlerts.length} color="red" />
                <KPICard label="Medium" value={mediumAlerts.length} color="amber" />
                <KPICard label="Low" value={lowAlerts.length} color="blue" />
              </div>

              {alertChartData.length > 0 && (
                <div className="chart-card mb-4">
                  <h3>Alerts by Type</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={alertChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="type" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip />
                      <Bar dataKey="high" stackId="a" fill="#ef4444" name="High" />
                      <Bar dataKey="medium" stackId="a" fill="#f59e0b" name="Medium" />
                      <Bar dataKey="low" stackId="a" fill="#2563eb" name="Low" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="space-y-2">
                {unresolvedAlerts.map(alert => (
                  <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg border-l-4 bg-white border ${
                    alert.severity === 'high' ? 'border-l-red-500 border-red-100' :
                    alert.severity === 'medium' ? 'border-l-amber-500 border-amber-100' :
                    'border-l-blue-500 border-blue-100'
                  }`}>
                    <StatusDot status={alert.severity} />
                    <div className="flex-1">
                      <p className="text-sm text-slate-700">{alert.message}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{new Date(alert.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => resolveAlert(alert.id)} className="btn-ghost text-xs text-emerald-600">Resolve</button>
                  </div>
                ))}
                {unresolvedAlerts.length === 0 && (
                  <EmptyState icon={AlertTriangleIcon} title="All clear" subtitle="No unresolved alerts" />
                )}
              </div>
            </div>
          )}

          {/* ── Maintenance Tab ──────────────────────────────── */}
          {tab === 'maintenance' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-slate-500">Total spend: <span className="font-semibold text-slate-900">{inr(totalMaintSpend)}</span></div>
                <button onClick={() => setShowMaintForm(true)} className="btn-primary text-xs flex items-center gap-1"><PlusIcon className="w-3 h-3" /> Add Log</button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                {/* Spend by type pie */}
                {maintPieData.length > 0 && (
                  <div className="chart-card">
                    <h3>Spend by Type</h3>
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width={140} height={140}>
                        <PieChart>
                          <Pie data={maintPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
                            {maintPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={v => inr(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1 text-xs">
                        {maintPieData.map((d, i) => (
                          <div key={d.name} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="capitalize">{d.name}</span>
                            <span className="font-semibold">{inr(d.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Monthly trend */}
                {maintTrend.length > 1 && (
                  <div className="chart-card">
                    <h3>Monthly Trend</h3>
                    <ResponsiveContainer width="100%" height={140}>
                      <LineChart data={maintTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={v => inr(v)} />
                        <Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <table className="data-table">
                <thead><tr><th>Vehicle</th><th>Type</th><th>Amount</th><th>Workshop</th><th>Date</th></tr></thead>
                <tbody>
                  {maintLogs.slice(0, 30).map(m => {
                    const veh = vehicles.find(v => v.id === m.vehicleId)
                    return (
                      <tr key={m.id}>
                        <td className="font-mono text-xs">{veh?.vehicleNumber || '-'}</td>
                        <td><span className="badge badge-low capitalize">{m.maintenanceType}</span></td>
                        <td className="font-medium">{inr(m.amount)}</td>
                        <td className="text-slate-500 text-xs">{m.workshopName || '-'}</td>
                        <td className="text-slate-400 text-xs">{new Date(m.maintenanceDate).toLocaleDateString()}</td>
                      </tr>
                    )
                  })}
                  {maintLogs.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-slate-400">No maintenance logs</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Document SlideOver */}
      <SlideOver open={showDocForm} onClose={() => setShowDocForm(false)} title="Add Document">
        <form onSubmit={handleAddDoc} className="space-y-4">
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Vehicle *</label>
            <select className="inp" value={docForm.vehicleId} onChange={e => setDocForm({...docForm, vehicleId: e.target.value})} required>
              <option value="">Select vehicle...</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}
            </select></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Type *</label>
            <select className="inp" value={docForm.documentType} onChange={e => setDocForm({...docForm, documentType: e.target.value})}>
              <option value="insurance">Insurance</option><option value="FC">FC</option><option value="permit">Permit</option><option value="PUC">PUC</option>
            </select></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Expiry Date *</label>
            <input className="inp" type="date" value={docForm.expiryDate} onChange={e => setDocForm({...docForm, expiryDate: e.target.value})} required /></div>
          <button type="submit" className="btn-primary w-full">Add Document</button>
        </form>
      </SlideOver>

      {/* Add Maintenance SlideOver */}
      <SlideOver open={showMaintForm} onClose={() => setShowMaintForm(false)} title="Add Maintenance Log">
        <form onSubmit={handleAddMaint} className="space-y-4">
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Vehicle *</label>
            <select className="inp" value={maintForm.vehicleId} onChange={e => setMaintForm({...maintForm, vehicleId: e.target.value})} required>
              <option value="">Select vehicle...</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}
            </select></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
            <select className="inp" value={maintForm.maintenanceType} onChange={e => setMaintForm({...maintForm, maintenanceType: e.target.value})}>
              <option value="engine">Engine</option><option value="tyre">Tyre</option><option value="brake">Brake</option><option value="clutch">Clutch</option><option value="general">General</option>
            </select></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Amount (₹) *</label>
            <input className="inp" type="number" value={maintForm.amount} onChange={e => setMaintForm({...maintForm, amount: e.target.value})} required /></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Workshop</label>
            <input className="inp" value={maintForm.workshopName} onChange={e => setMaintForm({...maintForm, workshopName: e.target.value})} /></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
            <input className="inp" type="date" value={maintForm.maintenanceDate} onChange={e => setMaintForm({...maintForm, maintenanceDate: e.target.value})} required /></div>
          <button type="submit" className="btn-primary w-full">Add Log</button>
        </form>
      </SlideOver>
    </div>
  )
}
