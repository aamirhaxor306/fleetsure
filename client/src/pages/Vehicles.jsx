import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { vehicles as vehiclesApi, trips as tripsApi } from '../api'
import { useLang } from '../context/LanguageContext'
import PageHeader from '../components/PageHeader'
import KPICard from '../components/KPICard'
import FilterBar from '../components/FilterBar'
import DataTable from '../components/DataTable'
import StatusDot from '../components/StatusDot'
import EmptyState from '../components/EmptyState'
import SlideOver from '../components/SlideOver'
import { TruckIcon, PlusIcon, UploadIcon, XIcon } from '../components/Icons'
import { useRechartsTheme } from '../hooks/useRechartsTheme'

function downloadSampleVehiclesCsv() {
 const csv = `Vehicle Number,Type,Year,KM,Axle,Status
MH12AB1234,truck,2022,25000,6W,active
DL01CX9999,tanker,2021,80000,14W,active`
 const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
 const url = URL.createObjectURL(blob)
 const a = document.createElement('a')
 a.href = url
 a.download = 'fleetsure-vehicles-sample.csv'
 a.click()
 URL.revokeObjectURL(url)
}

export default function Vehicles() {
 const { t } = useLang()
 const navigate = useNavigate()
 const [searchParams, setSearchParams] = useSearchParams()
 const [vehicles, setVehicles] = useState([])
 const [analytics, setAnalytics] = useState(null)
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [statusFilter, setStatusFilter] = useState('all')
 const [showAdd, setShowAdd] = useState(false)
 const [form, setForm] = useState({ vehicleNumber: '', vehicleType: 'truck', purchaseYear: new Date().getFullYear(), approxKm: 0, axleConfig: '6W' })
 const [saving, setSaving] = useState(false)
 const [fetchingRC, setFetchingRC] = useState(false)
 const [rcStatus, setRcStatus] = useState({ available: false, message: 'Checking auto-fetch availability...', supported: [] })
 const [rcFetchInfo, setRcFetchInfo] = useState(null)

 const [showImport, setShowImport] = useState(false)
 const [importFile, setImportFile] = useState(null)
 const [importPreview, setImportPreview] = useState(null)
 const [importBusy, setImportBusy] = useState(false)
 const [importResult, setImportResult] = useState(null)
 const [importErr, setImportErr] = useState('')

 const chartTheme = useRechartsTheme()

 const runImportPreview = useCallback(async (file) => {
 if (!file) return
 setImportBusy(true)
 setImportErr('')
 setImportResult(null)
 try {
 const data = await vehiclesApi.importPreview(file)
 setImportPreview(data)
 } catch (e) {
 setImportPreview(null)
 setImportErr(e.message || 'Preview failed')
 }
 setImportBusy(false)
 }, [])

 const closeImport = () => {
 setShowImport(false)
 setImportFile(null)
 setImportPreview(null)
 setImportResult(null)
 setImportErr('')
 setImportBusy(false)
 }

 const handleImportFile = (e) => {
 const f = e.target.files?.[0]
 e.target.value = ''
 if (!f) return
 setImportFile(f)
 setImportPreview(null)
 setImportResult(null)
 setImportErr('')
 runImportPreview(f)
 }

 const handleImportCommit = async () => {
 if (!importFile || importPreview?.missingVehicleColumn) return
 setImportBusy(true)
 setImportErr('')
 try {
 const data = await vehiclesApi.importCommit(importFile)
 setImportResult(data)
 const list = await vehiclesApi.list()
 setVehicles(list)
 } catch (e) {
 setImportErr(e.message || 'Import failed')
 }
 setImportBusy(false)
 }

 useEffect(() => {
 if (searchParams.get('import') === '1') {
 setShowImport(true)
 setImportFile(null)
 setImportPreview(null)
 setImportResult(null)
 setImportErr('')
 const next = new URLSearchParams(searchParams)
 next.delete('import')
 setSearchParams(next, { replace: true })
 }
 }, [searchParams, setSearchParams])

 useEffect(() => {
 Promise.allSettled([vehiclesApi.list(), tripsApi.analytics(), vehiclesApi.fetchRCStatus()])
 .then(([v, a, rc]) => {
 if (v.status === 'fulfilled') setVehicles(v.value)
 if (a.status === 'fulfilled') setAnalytics(a.value)
 if (rc.status === 'fulfilled') setRcStatus(rc.value)
 if (rc.status === 'rejected') {
 setRcStatus({
 available: false,
 message: 'Auto-fetch unavailable right now. You can continue with manual entry.',
 supported: ['RC', 'insurance', 'FC', 'PUC', 'permit'],
 })
 }
 setLoading(false)
 })
 }, [])

 const vehicleProfit = (analytics?.vehicleProfit || []).slice(0, 10)
 const activeCount = vehicles.filter(v => v.status === 'active').length
 const idleCount = vehicles.filter(v => v.status === 'idle').length
 const totalTrips = analytics?.fleetPnL?.tripCount || 0
 const avgTripsPerVehicle = vehicles.length > 0 ? Math.round(totalTrips / vehicles.length) : 0

 const filtered = vehicles.filter(v => {
 if (statusFilter !== 'all' && v.status !== statusFilter) return false
 if (search && !v.vehicleNumber.toLowerCase().includes(search.toLowerCase())) return false
 return true
 })

 const handleAdd = async (e) => {
 e.preventDefault()
 setSaving(true)
 try {
 const nv = await vehiclesApi.create(form)
 setVehicles([nv, ...vehicles])
 setShowAdd(false)
 setForm({ vehicleNumber: '', vehicleType: 'truck', purchaseYear: new Date().getFullYear(), approxKm: 0, axleConfig: '6W' })
 } catch (err) {
 alert(err.message)
 }
 setSaving(false)
 }

 const normalizeVehicleType = (type) => {
 const t = String(type || '').toLowerCase()
 if (t.includes('tanker')) return 'tanker'
 if (t.includes('trailer')) return 'trailer'
 return 'truck'
 }

 const handleFetchRC = async () => {
 if (!form.vehicleNumber?.trim()) {
 setRcFetchInfo({ type: 'error', message: 'Enter vehicle number first (e.g. MH04AB1234).' })
 return
 }
 setFetchingRC(true)
 setRcFetchInfo(null)
 try {
 const res = await vehiclesApi.fetchRC(form.vehicleNumber)
 if (res.available === false) {
 setRcFetchInfo({
 type: 'warn',
 message: res.message || 'Auto-fetch is not configured. Continue with manual entry.',
 })
 return
 }

 const fetchedVehicle = res.vehicle
 setVehicles((prev) => [fetchedVehicle, ...prev.filter((v) => v.id !== fetchedVehicle.id)])
 setForm((prev) => ({
 ...prev,
 vehicleNumber: fetchedVehicle.vehicleNumber || prev.vehicleNumber,
 vehicleType: normalizeVehicleType(fetchedVehicle.vehicleType),
 purchaseYear: fetchedVehicle.purchaseYear || prev.purchaseYear,
 }))

 const docCount = Array.isArray(res.documents) ? res.documents.length : 0
 setRcFetchInfo({
 type: 'success',
 message: `Vehicle synced from RC lookup. ${docCount} compliance document${docCount === 1 ? '' : 's'} updated (insurance/FC/PUC/permit where available).`,
 })
 } catch (err) {
 setRcFetchInfo({ type: 'error', message: err.message || 'Auto-fetch failed. Continue with manual entry.' })
 }
 setFetchingRC(false)
 }

 const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

 const columns = [
 { key: 'status', label: 'Status', width: '60px', render: (_, row) => <StatusDot status={row.status} /> },
 { key: 'vehicleNumber', label: 'Vehicle', render: (v) => <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{v}</span> },
 { key: 'vehicleType', label: 'Type', render: (v) => <span className="capitalize">{v}</span> },
 { key: 'axleConfig', label: 'Size', render: (v) => { const m = { '6W': '6-Wheeler', '10W': '10-Wheeler', '12W': '12-Wheeler', '14W': '14-Wheeler' }; return m[v] || v } },
 { key: 'purchaseYear', label: 'Year' },
 { key: 'approxKm', label: 'KM', render: (v) => `${(v || 0).toLocaleString('en-IN')} km` },
 { key: '_count', label: 'Issues', render: (c) => {
 const alerts = c?.alerts || 0
 return alerts > 0 ? <span className="badge badge-high">{alerts}</span> : <span className="text-slate-300">--</span>
 }},
 ]

 if (loading) {
 return <div className="animate-pulse"><div className="h-8 bg-slate-200 rounded w-48 mb-4" /><div className="h-64 bg-slate-200 rounded-lg" /></div>
 }

 return (
 <div>
 <PageHeader
 title="Vehicles"
 subtitle={`${vehicles.length} vehicles in your fleet`}
 actions={<button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-xs"><PlusIcon className="w-4 h-4" /> Add Vehicle</button>}
 />

 {/* KPIs */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
 <KPICard label="Total Vehicles" value={vehicles.length} color="blue" />
 <KPICard label="Active" value={activeCount} color="emerald" />
 <KPICard label="Idle" value={idleCount} color="amber" />
 <KPICard label="Avg Trips/Vehicle" value={avgTripsPerVehicle} color="violet" />
 </div>

 {/* Profit per Vehicle Chart */}
 {vehicleProfit.length > 0 && (
 <div className="chart-card mb-6">
 <h3>Profit per Vehicle (Top 10)</h3>
 <ResponsiveContainer width="100%" height={220}>
 <BarChart data={vehicleProfit} layout="vertical" margin={{ left: 70 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
 <XAxis type="number" tick={{ fontSize: 11, fill: chartTheme.tickFill }} tickFormatter={v => inr(v)} />
 <YAxis type="category" dataKey="vehicleNumber" tick={{ fontSize: 10, fill: chartTheme.tickFill }} width={70} />
 <Tooltip
 formatter={v => inr(v)}
 contentStyle={chartTheme.tooltipContentStyle}
 labelStyle={chartTheme.tooltipLabelStyle}
 itemStyle={chartTheme.tooltipItemStyle}
 />
 <Bar dataKey="profit" radius={[0, 4, 4, 0]} barSize={16}>
 {vehicleProfit.map((entry, i) => (
 <Cell key={i} fill={entry.margin > 30 ? '#10b981' : entry.margin > 15 ? '#f59e0b' : '#ef4444'} />
 ))}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 </div>
 )}

 {/* Filter + Table */}
 <div className="card overflow-hidden">
 <div className="px-4 pt-4">
 <FilterBar
 search={search}
 onSearch={setSearch}
 placeholder="Search by vehicle number..."
 tabs={[
 { value: 'all', label: 'All', count: vehicles.length },
 { value: 'active', label: 'Active', count: activeCount },
 { value: 'idle', label: 'Idle', count: idleCount },
 ]}
 activeTab={statusFilter}
 onTabChange={setStatusFilter}
 />
 </div>
 {filtered.length > 0 ? (
 <DataTable columns={columns} data={filtered} onRowClick={(row) => navigate(`/vehicles/${row.id}`)} />
 ) : (
 <div className="py-10">
 <EmptyState icon={TruckIcon} title="No vehicles found" subtitle="Add your first vehicle to start logging trips" />
 <div className="mt-3 text-center">
 <button onClick={() => setShowAdd(true)} className="btn-primary text-xs">Add Your First Vehicle</button>
 </div>
 </div>
 )}
 </div>

 {/* Add Vehicle SlideOver */}
 <SlideOver open={showAdd} onClose={() => setShowAdd(false)} title="Add Vehicle">
 <form onSubmit={handleAdd} className="space-y-4">
 <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
 <div className="flex items-center justify-between gap-3">
 <div>
 <p className="text-xs font-semibold text-slate-700">Auto-fetch from RC/VAHAN</p>
 <p className="text-[11px] text-slate-500 mt-0.5">
 {rcStatus.available ? 'Fetch RC + insurance + FC + PUC + permit (if available)' : rcStatus.message}
 </p>
 </div>
 <button
 type="button"
 className="btn-secondary text-xs whitespace-nowrap"
 onClick={handleFetchRC}
 disabled={fetchingRC}
 >
 {fetchingRC ? 'Fetching...' : 'Fetch Details'}
 </button>
 </div>
 </div>

 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle Number *</label>
 <input className="inp" placeholder="MH04AB1234" value={form.vehicleNumber} onChange={e => setForm({ ...form, vehicleNumber: e.target.value })} required />
 </div>

 {rcFetchInfo && (
 <div className={`rounded-lg px-3 py-2 text-xs font-medium ${
 rcFetchInfo.type === 'success'
 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
 : rcFetchInfo.type === 'warn'
 ? 'bg-amber-50 text-amber-700 border border-amber-200'
 : 'bg-red-50 text-red-700 border border-red-200'
 }`}>
 {rcFetchInfo.message}
 </div>
 )}

 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Type *</label>
 <select className="inp" value={form.vehicleType} onChange={e => setForm({ ...form, vehicleType: e.target.value })}>
 <option value="truck">Truck</option>
 <option value="trailer">Trailer</option>
 <option value="tanker">Tanker</option>
 </select>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Year *</label>
 <input className="inp" type="number" value={form.purchaseYear} onChange={e => setForm({ ...form, purchaseYear: e.target.value })} required />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle Size</label>
 <select className="inp" value={form.axleConfig} onChange={e => setForm({ ...form, axleConfig: e.target.value })}>
 <option value="6W">6-Wheeler</option>
 <option value="10W">10-Wheeler</option>
 <option value="12W">12-Wheeler</option>
 <option value="14W">14-Wheeler</option>
 </select>
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Current KM Reading</label>
 <input className="inp" type="number" value={form.approxKm} onChange={e => setForm({ ...form, approxKm: e.target.value })} />
 </div>
 <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Adding...' : 'Add Vehicle'}</button>
 </form>
 </SlideOver>

 {/* Import vehicles modal */}
 {showImport && (
 <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm" onClick={closeImport}>
 <div
 className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
 <div>
 <h2 className="text-lg font-bold text-slate-900">{t('vehicleImportTitle')}</h2>
 <p className="text-xs text-slate-500 mt-1">{t('vehicleImportSubtitle')}</p>
 </div>
 <button type="button" onClick={closeImport} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" aria-label={t('vehicleImportClose')}>
 <XIcon className="w-5 h-5" />
 </button>
 </div>

 <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
 <div className="flex flex-wrap items-center gap-2">
 <label className="btn-secondary text-xs cursor-pointer inline-flex items-center gap-1.5">
 <UploadIcon className="w-4 h-4" />
 {t('vehicleImportChooseFile')}
 <input type="file" accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" className="hidden" onChange={handleImportFile} />
 </label>
 <button type="button" className="text-xs font-semibold text-teal-700 hover:underline" onClick={downloadSampleVehiclesCsv}>
 {t('vehicleImportDownloadSample')}
 </button>
 </div>
 <p className="text-[11px] text-slate-500 leading-relaxed">{t('vehicleImportHelpColumns')}</p>

 {importBusy && !importPreview && !importResult && (
 <p className="text-sm text-slate-500">{t('vehicleImportPreviewing')}</p>
 )}
 {importErr && (
 <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2">{importErr}</div>
 )}

 {importPreview && !importResult && (
 <>
 {importPreview.missingVehicleColumn ? (
 <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm px-3 py-2">
 {t('vehicleImportMissingColumn')}
 </div>
 ) : (
 <>
 <div>
 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('vehicleImportMapping')}</h3>
 <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
 {Object.entries(importPreview.mappingLabels || {}).map(([k, v]) => (
 <div key={k} className="flex justify-between gap-2 border-b border-slate-50 pb-1">
 <dt className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</dt>
 <dd className="font-medium text-slate-800 text-right">{v || '—'}</dd>
 </div>
 ))}
 </dl>
 <p className="text-xs text-slate-500 mt-2">{t('vehicleImportDataRows', { count: String(importPreview.totalRows ?? 0) })}</p>
 </div>
 <div>
 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('vehicleImportPreviewRows')}</h3>
 <div className="overflow-x-auto rounded-xl border border-slate-200">
 <table className="w-full text-[11px]">
 <thead>
 <tr className="bg-slate-50 text-slate-600 text-left">
 <th className="px-2 py-2 font-semibold">#</th>
 <th className="px-2 py-2 font-semibold">Vehicle</th>
 <th className="px-2 py-2 font-semibold">Type</th>
 <th className="px-2 py-2 font-semibold">Year</th>
 <th className="px-2 py-2 font-semibold">KM</th>
 <th className="px-2 py-2 font-semibold">Axle</th>
 <th className="px-2 py-2 font-semibold">{t('status')}</th>
 </tr>
 </thead>
 <tbody>
 {(importPreview.preview || []).map((row) => (
 <tr key={row.row} className="border-t border-slate-100">
 <td className="px-2 py-1.5 text-slate-400">{row.row}</td>
 <td className="px-2 py-1.5 font-mono font-semibold">{row.vehicleNumber}</td>
 <td className="px-2 py-1.5 capitalize">{row.vehicleType}</td>
 <td className="px-2 py-1.5">{row.purchaseYear}</td>
 <td className="px-2 py-1.5">{row.approxKm}</td>
 <td className="px-2 py-1.5">{row.axleConfig}</td>
 <td className="px-2 py-1.5">{row.status}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </>
 )}
 </>
 )}

 {importResult && (
 <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 space-y-2">
 <h3 className="text-sm font-bold text-emerald-900">{t('vehicleImportDone')}</h3>
 <ul className="text-sm text-emerald-800 space-y-1">
 <li>{t('vehicleImportCreated', { n: String(importResult.created ?? 0) })}</li>
 <li>{t('vehicleImportSkipped', { n: String(importResult.skipped ?? 0) })}</li>
 {(importResult.errors > 0) && (
 <li>{t('vehicleImportErrors', { n: String(importResult.errors) })}</li>
 )}
 </ul>
 {Array.isArray(importResult.errorRows) && importResult.errorRows.length > 0 && (
 <ul className="text-xs text-red-700 mt-2 max-h-32 overflow-y-auto list-disc pl-4">
 {importResult.errorRows.map((er, i) => (
 <li key={i}>Row {er.row}: {er.vehicleNumber || '?'} — {er.message}</li>
 ))}
 </ul>
 )}
 {Array.isArray(importResult.skippedRows) && importResult.skippedRows.length > 0 && (
 <details className="text-xs text-slate-600 mt-2">
 <summary className="cursor-pointer font-medium">{t('vehicleImportSkippedList')}</summary>
 <ul className="mt-1 max-h-28 overflow-y-auto list-disc pl-4">
 {importResult.skippedRows.map((s, i) => (
 <li key={i}>Row {s.row}: {s.vehicleNumber} — {s.reason}</li>
 ))}
 </ul>
 </details>
 )}
 </div>
 )}
 </div>

 <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/80">
 {importResult ? (
 <button type="button" className="btn-primary text-xs" onClick={closeImport}>{t('vehicleImportClose')}</button>
 ) : (
 <>
 <button type="button" className="btn-secondary text-xs" onClick={closeImport}>{t('cancel')}</button>
 <button
 type="button"
 className="btn-primary text-xs"
 disabled={importBusy || !importFile || importPreview?.missingVehicleColumn}
 onClick={handleImportCommit}
 >
 {importBusy ? t('loading') : t('vehicleImportRunBtn')}
 </button>
 </>
 )}
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
