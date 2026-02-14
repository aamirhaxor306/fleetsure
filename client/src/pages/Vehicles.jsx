import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { vehicles as vehiclesApi, trips as tripsApi } from '../api'
import PageHeader from '../components/PageHeader'
import KPICard from '../components/KPICard'
import FilterBar from '../components/FilterBar'
import DataTable from '../components/DataTable'
import StatusDot from '../components/StatusDot'
import EmptyState from '../components/EmptyState'
import SlideOver from '../components/SlideOver'
import { TruckIcon, PlusIcon } from '../components/Icons'

export default function Vehicles() {
  const navigate = useNavigate()
  const [vehicles, setVehicles] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ vehicleNumber: '', vehicleType: 'truck', purchaseYear: new Date().getFullYear(), approxKm: 0, axleConfig: '6W' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.allSettled([vehiclesApi.list(), tripsApi.analytics()])
      .then(([v, a]) => {
        if (v.status === 'fulfilled') setVehicles(v.value)
        if (a.status === 'fulfilled') setAnalytics(a.value)
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

  const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

  const columns = [
    { key: 'status', label: 'Status', width: '60px', render: (_, row) => <StatusDot status={row.status} /> },
    { key: 'vehicleNumber', label: 'Vehicle', render: (v) => <span className="font-mono font-semibold text-slate-900">{v}</span> },
    { key: 'vehicleType', label: 'Type', render: (v) => <span className="capitalize">{v}</span> },
    { key: 'axleConfig', label: 'Axle' },
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
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => inr(v)} />
              <YAxis type="category" dataKey="vehicleNumber" tick={{ fontSize: 10, fill: '#64748b' }} width={70} />
              <Tooltip formatter={v => inr(v)} />
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
          <EmptyState icon={TruckIcon} title="No vehicles found" subtitle="Try adjusting your search or add a new vehicle" />
        )}
      </div>

      {/* Add Vehicle SlideOver */}
      <SlideOver open={showAdd} onClose={() => setShowAdd(false)} title="Add Vehicle">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle Number *</label>
            <input className="inp" placeholder="MH04AB1234" value={form.vehicleNumber} onChange={e => setForm({ ...form, vehicleNumber: e.target.value })} required />
          </div>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Axle</label>
              <select className="inp" value={form.axleConfig} onChange={e => setForm({ ...form, axleConfig: e.target.value })}>
                <option value="6W">6W</option>
                <option value="10W">10W</option>
                <option value="12W">12W</option>
                <option value="14W">14W</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Approx KM</label>
            <input className="inp" type="number" value={form.approxKm} onChange={e => setForm({ ...form, approxKm: e.target.value })} />
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Adding...' : 'Add Vehicle'}</button>
        </form>
      </SlideOver>
    </div>
  )
}
