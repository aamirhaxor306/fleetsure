import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { drivers as driversApi, vehicles as vehiclesApi } from '../api'
import PageHeader from '../components/PageHeader'
import KPICard from '../components/KPICard'
import FilterBar from '../components/FilterBar'
import DataTable from '../components/DataTable'
import StatusDot from '../components/StatusDot'
import EmptyState from '../components/EmptyState'
import SlideOver from '../components/SlideOver'
import { UserIcon, PlusIcon } from '../components/Icons'

export default function Drivers() {
 const [drivers, setDrivers] = useState([])
 const [vehicles, setVehicles] = useState([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [statusFilter, setStatusFilter] = useState('all')
 const [showAdd, setShowAdd] = useState(false)
 const [form, setForm] = useState({ name: '', phone: '', licenseNumber: '', vehicleId: '' })
 const [saving, setSaving] = useState(false)

 useEffect(() => {
 Promise.allSettled([driversApi.list(), vehiclesApi.list()])
 .then(([d, v]) => {
 if (d.status === 'fulfilled') setDrivers(d.value)
 if (v.status === 'fulfilled') setVehicles(v.value)
 setLoading(false)
 })
 }, [])

 const activeDrivers = drivers.filter(d => d.active)
 const telegramConnected = drivers.filter(d => d.telegramChatId)
 const totalTrips = drivers.reduce((s, d) => s + (d._count?.trips || 0), 0)
 const avgTrips = drivers.length > 0 ? Math.round(totalTrips / drivers.length) : 0

 // Trips per driver chart data
 const chartData = drivers
 .map(d => ({ name: d.name.split(' ')[0], trips: d._count?.trips || 0 }))
 .sort((a, b) => b.trips - a.trips)
 .slice(0, 10)

 const filtered = drivers.filter(d => {
 if (statusFilter === 'active' && !d.active) return false
 if (statusFilter === 'inactive' && d.active) return false
 if (search) {
 const q = search.toLowerCase()
 if (!d.name.toLowerCase().includes(q) && !d.phone.includes(q)) return false
 }
 return true
 })

 const handleAdd = async (e) => {
 e.preventDefault()
 setSaving(true)
 try {
 const nd = await driversApi.create(form)
 setDrivers([nd, ...drivers])
 setShowAdd(false)
 setForm({ name: '', phone: '', licenseNumber: '', vehicleId: '' })
 } catch (err) { alert(err.message) }
 setSaving(false)
 }

 const columns = [
 { key: 'active', label: 'Status', width: '60px', render: (v) => <StatusDot status={v ? 'active' : 'idle'} /> },
 { key: 'name', label: 'Name', render: (v) => <span className="font-medium text-slate-900">{v}</span> },
 { key: 'phone', label: 'Phone', render: (v) => <span className="font-mono text-xs">{v}</span> },
 { key: 'licenseNumber', label: 'License', render: (v) => v || <span className="text-slate-300">--</span> },
 { key: 'vehicle', label: 'Vehicle', render: (v) => v ? <span className="font-mono text-xs">{v.vehicleNumber}</span> : <span className="text-slate-300">--</span> },
 { key: '_count', label: 'Trips', render: (c) => c?.trips || 0 },
 { key: 'telegramChatId', label: 'Telegram', render: (v) => v ? <span className="badge badge-active">Connected</span> : <span className="text-slate-300">--</span> },
 ]

 if (loading) return <div className="animate-pulse"><div className="h-8 bg-slate-200 rounded w-48 mb-4" /><div className="h-64 bg-slate-200 rounded-lg" /></div>

 return (
 <div>
 <PageHeader
 title="Drivers"
 subtitle={`${drivers.length} drivers registered`}
 actions={<button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-xs"><PlusIcon className="w-4 h-4" /> Add Driver</button>}
 />

 {/* Telegram Banner */}
 <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
 <div className="flex items-start gap-3">
 <div className="text-2xl"></div>
 <div>
 <h4 className="text-sm font-semibold text-blue-900">Onboard via Telegram</h4>
 <p className="text-xs text-blue-700 mt-0.5">Drivers can register by messaging <span className="font-mono font-semibold">@fleetsure_driver_bot</span> and typing <span className="font-mono">/start</span></p>
 </div>
 </div>
 </div>

 {/* KPIs */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
 <KPICard label="Total Drivers" value={drivers.length} color="blue" />
 <KPICard label="Active" value={activeDrivers.length} color="emerald" />
 <KPICard label="Telegram Connected" value={telegramConnected.length} color="violet" />
 <KPICard label="Avg Trips/Driver" value={avgTrips} color="amber" />
 </div>

 {/* Chart */}
 {chartData.length > 0 && (
 <div className="chart-card mb-6">
 <h3>Trips per Driver</h3>
 <ResponsiveContainer width="100%" height={200}>
 <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
 <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
 <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={60} />
 <Tooltip />
 <Bar dataKey="trips" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={14} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 )}

 {/* Table */}
 <div className="card overflow-hidden">
 <div className="px-4 pt-4">
 <FilterBar
 search={search}
 onSearch={setSearch}
 placeholder="Search by name or phone..."
 tabs={[
 { value: 'all', label: 'All', count: drivers.length },
 { value: 'active', label: 'Active', count: activeDrivers.length },
 { value: 'inactive', label: 'Inactive', count: drivers.length - activeDrivers.length },
 ]}
 activeTab={statusFilter}
 onTabChange={setStatusFilter}
 />
 </div>
 {filtered.length > 0 ? (
 <DataTable columns={columns} data={filtered} />
 ) : (
 <div className="py-10">
 <EmptyState icon={UserIcon} title="No drivers found" subtitle="Add your first driver manually or onboard via Telegram" />
 <div className="mt-3 text-center">
 <button onClick={() => setShowAdd(true)} className="btn-primary text-xs">Add Your First Driver</button>
 </div>
 </div>
 )}
 </div>

 {/* Add Driver */}
 <SlideOver open={showAdd} onClose={() => setShowAdd(false)} title="Add Driver">
 <form onSubmit={handleAdd} className="space-y-4">
 <div><label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
 <input className="inp" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
 <div><label className="block text-xs font-medium text-slate-600 mb-1">Phone *</label>
 <input className="inp" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required placeholder="+91..." /></div>
 <div><label className="block text-xs font-medium text-slate-600 mb-1">License Number</label>
 <input className="inp" value={form.licenseNumber} onChange={e => setForm({...form, licenseNumber: e.target.value})} /></div>
 <div><label className="block text-xs font-medium text-slate-600 mb-1">Assign Vehicle</label>
 <select className="inp" value={form.vehicleId} onChange={e => setForm({...form, vehicleId: e.target.value})}>
 <option value="">None</option>
 {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}
 </select></div>
 <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Adding...' : 'Add Driver'}</button>
 </form>
 </SlideOver>
 </div>
 )
}
