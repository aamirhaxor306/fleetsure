import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fleetHealth as fleetHealthApi, documents as documentsApi, alerts as alertsApi, maintenance as maintenanceApi, vehicles as vehiclesApi } from '../api'
import PageHeader from '../components/PageHeader'
import HealthScore from '../components/HealthScore'
import StatusDot from '../components/StatusDot'
import SlideOver from '../components/SlideOver'
import EmptyState from '../components/EmptyState'
import { AlertTriangleIcon, PlusIcon } from '../components/Icons'
import { useRechartsTheme } from '../hooks/useRechartsTheme'

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#2563eb', '#8b5cf6']

export default function FleetHealth() {
 const chartTheme = useRechartsTheme()
 const navigate = useNavigate()
 const [health, setHealth] = useState(null)
 const [documents, setDocuments] = useState([])
 const [alertList, setAlerts] = useState([])
 const [maintLogs, setMaintLogs] = useState([])
 const [vehicles, setVehicles] = useState([])
 const [loading, setLoading] = useState(true)
 const [tab, setTab] = useState('documents')
 const tabPicked = useRef(false)

 const [showDocForm, setShowDocForm] = useState(false)
 const [docForm, setDocForm] = useState({ vehicleId: '', documentType: 'insurance', expiryDate: '', reminderDays: 30 })

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

 const expiredDocs = documents.filter(d => new Date(d.expiryDate) <= now)
 const expiringSoon = documents.filter(d => {
 const exp = new Date(d.expiryDate)
 return exp > now && exp <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
 })
 const validDocs = documents.filter(d => new Date(d.expiryDate) > new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000))

 const unresolvedAlerts = alertList.filter(a => !a.resolved)
 const highAlerts = unresolvedAlerts.filter(a => a.severity === 'high')
 const mediumAlerts = unresolvedAlerts.filter(a => a.severity === 'medium')
 const lowAlerts = unresolvedAlerts.filter(a => a.severity === 'low')

 const totalMaintSpend = maintLogs.reduce((s, m) => s + m.amount, 0)
 const maintByType = {}
 maintLogs.forEach(m => {
 maintByType[m.maintenanceType] = (maintByType[m.maintenanceType] || 0) + m.amount
 })
 const maintPieData = Object.entries(maintByType).map(([name, value]) => ({ name, value }))

 const maintByMonth = {}
 maintLogs.forEach(m => {
 const d = new Date(m.maintenanceDate)
 const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
 maintByMonth[key] = (maintByMonth[key] || 0) + m.amount
 })
 const maintTrend = Object.entries(maintByMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([month, amount]) => ({ month, amount }))

 const showMaintBreakdownChart = maintLogs.length > 3 && maintPieData.length > 1

 useEffect(() => {
 if (loading || tabPicked.current) return
 if (unresolvedAlerts.length > 0) setTab('alerts')
 else if (expiredDocs.length > 0 || expiringSoon.length > 0) setTab('documents')
 tabPicked.current = true
 }, [loading, unresolvedAlerts.length, expiredDocs.length, expiringSoon.length])

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
 { value: 'maintenance', label: 'Repairs', count: maintLogs.length },
 ]

 const overall = health?.overall || 0
 const summaryParts = []
 if (expiredDocs.length) summaryParts.push(`${expiredDocs.length} expired doc${expiredDocs.length !== 1 ? 's' : ''}`)
 if (expiringSoon.length) summaryParts.push(`${expiringSoon.length} expiring soon`)
 if (unresolvedAlerts.length) summaryParts.push(`${unresolvedAlerts.length} open alert${unresolvedAlerts.length !== 1 ? 's' : ''}`)
 if (maintLogs.length && totalMaintSpend > 0) summaryParts.push(`${inr(totalMaintSpend)} repair spend`)

 let summaryLine = ''
 if (overall >= 80) summaryLine = 'Your fleet looks in good shape.'
 else if (overall >= 50) summaryLine = summaryParts.length ? `Focus on: ${summaryParts.join(' · ')}.` : 'Review each section below when you have time.'
 else summaryLine = 'Urgent: renew expired documents and clear alerts to reduce risk.'

 if (loading) return <div className="animate-pulse"><div className="h-8 bg-slate-200 rounded w-48 mb-4" /><div className="h-64 bg-slate-200 rounded-lg" /></div>

 return (
 <div>
 <PageHeader title="Fleet Health" subtitle="Documents, alerts, and repair logs in one place." />

 <div className="card overflow-hidden">
 <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700">
 <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
 <HealthScore
 score={overall}
 size={88}
 compact
 segments={[
 { label: 'Documents', value: health?.documents?.score || 0 },
 { label: 'Maintenance', value: health?.maintenance?.score || 0 },
 { label: 'Alerts', value: health?.alerts?.score || 0 },
 { label: 'Tyres', value: health?.tyres?.score || 0 },
 ]}
 />
 <div className="flex-1 min-w-0">
 <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{summaryLine}</p>
 </div>
 </div>

 <div
 role="tablist"
 aria-label="Fleet health sections"
 className="flex w-full rounded-xl bg-slate-100 dark:bg-slate-800/90 p-1 gap-0.5 mt-4"
 >
 {tabs.map((t) => (
 <button
 key={t.value}
 type="button"
 role="tab"
 id={`fh-tab-${t.value}`}
 aria-selected={tab === t.value}
 aria-controls={`fh-panel-${t.value}`}
 onClick={() => { setTab(t.value); tabPicked.current = true }}
 className={`flex-1 min-w-0 rounded-lg py-2 px-1 sm:px-2 text-center transition-all ${
 tab === t.value
 ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
 : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
 }`}
 >
 <span className="block text-xs sm:text-sm font-semibold truncate">{t.label}</span>
 <span className="block text-[10px] sm:text-xs font-medium tabular-nums opacity-70">({t.count})</span>
 </button>
 ))}
 </div>
 </div>

 <div className="p-4 sm:p-5">
 {tab === 'documents' && (
 <div role="tabpanel" id="fh-panel-documents" aria-labelledby="fh-tab-documents">
 <div className="flex justify-between items-center mb-4">
 <h3 className="text-sm font-semibold text-slate-700">
 {expiredDocs.length > 0 ? `${expiredDocs.length} expired — renew to avoid fines` : expiringSoon.length > 0 ? `${expiringSoon.length} expiring within 30 days` : 'Documents'}
 </h3>
 <button type="button" onClick={() => setShowDocForm(true)} className="btn-primary text-xs flex items-center gap-1"><PlusIcon className="w-3 h-3" /> Add</button>
 </div>

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
 <td>{status !== 'valid' && <button type="button" onClick={() => navigate('/renewals')} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Renew</button>}</td>
 </tr>
 )
 })}
 {documents.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-slate-400">No documents tracked</td></tr>}
 </tbody>
 </table>
 </div>
 )}

 {tab === 'alerts' && (
 <div role="tabpanel" id="fh-panel-alerts" aria-labelledby="fh-tab-alerts">
 {unresolvedAlerts.length > 0 && (
 <p className="text-xs text-slate-500 mb-3">
 {unresolvedAlerts.length} open
 {highAlerts.length + mediumAlerts.length + lowAlerts.length > 0 && (
 <> — {highAlerts.length} high · {mediumAlerts.length} medium · {lowAlerts.length} low</>
 )}
 </p>
 )}
 <div className="space-y-2">
 {unresolvedAlerts.map(alert => (
 <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg border-l-4 bg-white border ${
 alert.severity === 'high' ? 'border-l-red-500 border-red-100' :
 alert.severity === 'medium' ? 'border-l-amber-500 border-amber-100' :
 'border-l-blue-500 border-blue-100'
 }`}>
 <StatusDot status={alert.severity} />
 <div className="flex-1 min-w-0">
 <p className="text-sm text-slate-700">{alert.message}</p>
 <p className="text-xs text-slate-400 mt-0.5">{new Date(alert.createdAt).toLocaleDateString()}</p>
 </div>
 <button type="button" onClick={() => resolveAlert(alert.id)} className="btn-ghost text-xs text-emerald-600 shrink-0">Resolve</button>
 </div>
 ))}
 {unresolvedAlerts.length === 0 && (
 <EmptyState icon={AlertTriangleIcon} title="All clear" subtitle="No unresolved alerts" />
 )}
 </div>
 </div>
 )}

 {tab === 'maintenance' && (
 <div role="tabpanel" id="fh-panel-maintenance" aria-labelledby="fh-tab-maintenance">
 <div className="flex justify-between items-center mb-4">
 <div className="text-sm text-slate-600">
 {maintLogs.length > 0 ? (
 <>Total spend <span className="font-semibold text-slate-900 tabular-nums">{inr(totalMaintSpend)}</span> · {maintLogs.length} log{maintLogs.length !== 1 ? 's' : ''}</>
 ) : (
 <span>No repair logs yet</span>
 )}
 </div>
 <button type="button" onClick={() => setShowMaintForm(true)} className="btn-primary text-xs flex items-center gap-1"><PlusIcon className="w-3 h-3" /> Add log</button>
 </div>

 {showMaintBreakdownChart && (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
 <div className="chart-card">
 <h3>Spend by type</h3>
 <div className="flex items-center gap-4">
 <ResponsiveContainer width={140} height={140}>
 <PieChart>
 <Pie data={maintPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
 {maintPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
 </Pie>
 <Tooltip
 formatter={v => inr(v)}
 contentStyle={chartTheme.tooltipContentStyle}
 labelStyle={chartTheme.tooltipLabelStyle}
 itemStyle={chartTheme.tooltipItemStyle}
 />
 </PieChart>
 </ResponsiveContainer>
 <div className="space-y-1 text-xs">
 {maintPieData.map((d, i) => (
 <div key={d.name} className="flex items-center gap-2">
 <div className="w-2.5 h-2.5 rounded shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
 <span className="capitalize">{d.name}</span>
 <span className="font-semibold tabular-nums">{inr(d.value)}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 {maintTrend.length > 1 && (
 <div className="chart-card">
 <h3>Monthly trend</h3>
 <ResponsiveContainer width="100%" height={140}>
 <LineChart data={maintTrend}>
 <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
 <XAxis dataKey="month" tick={{ fontSize: 10, fill: chartTheme.tickFill }} />
 <YAxis tick={{ fontSize: 11, fill: chartTheme.tickFill }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
 <Tooltip
 formatter={v => inr(v)}
 contentStyle={chartTheme.tooltipContentStyle}
 labelStyle={chartTheme.tooltipLabelStyle}
 itemStyle={chartTheme.tooltipItemStyle}
 />
 <Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
 </LineChart>
 </ResponsiveContainer>
 </div>
 )}
 </div>
 )}

 {!showMaintBreakdownChart && maintPieData.length > 0 && (
 <div className="flex flex-wrap gap-2 mb-4 text-xs text-slate-600">
 <span className="font-medium text-slate-700">By type:</span>
 {maintPieData.map((d, i) => (
 <span key={d.name} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
 <span className="capitalize">{d.name}</span>
 <span className="font-semibold tabular-nums">{inr(d.value)}</span>
 </span>
 ))}
 </div>
 )}

 <table className="data-table">
 <thead><tr><th>Vehicle</th><th>Type</th><th>Amount</th><th>Workshop</th><th>Date</th></tr></thead>
 <tbody>
 {maintLogs.slice(0, 30).map(m => {
 const veh = vehicles.find(v => v.id === m.vehicleId)
 return (
 <tr key={m.id}>
 <td className="font-mono text-xs">{veh?.vehicleNumber || '-'}</td>
 <td><span className="badge badge-low capitalize">{m.maintenanceType}</span></td>
 <td className="font-medium tabular-nums">{inr(m.amount)}</td>
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
