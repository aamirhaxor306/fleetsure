import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { vehicles as vehiclesApi, trips as tripsApi, maintenance as maintenanceApi, documents as documentsApi, tyres as tyresApi } from '../api'
import { useLang } from '../context/LanguageContext'
import PageHeader from '../components/PageHeader'
import KPICard from '../components/KPICard'
import StatusDot from '../components/StatusDot'
import SlideOver from '../components/SlideOver'
import TyreDiagram from '../components/TyreDiagram'
import { TruckIcon, WrenchIcon, FileTextIcon, AlertTriangleIcon } from '../components/Icons'

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function VehicleDetail() {
  const { id } = useParams()
  const { t } = useLang()
  const [vehicle, setVehicle] = useState(null)
  const [vehicleTrips, setVehicleTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('trips')
  const [showMaintForm, setShowMaintForm] = useState(false)
  const [maintForm, setMaintForm] = useState({ maintenanceType: 'general', description: '', amount: '', workshopName: '', maintenanceDate: new Date().toISOString().slice(0, 10) })
  const [showTyreForm, setShowTyreForm] = useState(false)
  const [tyreForm, setTyreForm] = useState({ position: '', brand: '', tyreModel: '', serialNumber: '', installedDate: new Date().toISOString().slice(0, 10), installedKm: 0, expectedLifeKm: 80000, condition: 'good' })

  useEffect(() => {
    Promise.allSettled([
      vehiclesApi.get(id),
      tripsApi.list(),
    ]).then(([v, tr]) => {
      if (v.status === 'fulfilled') setVehicle(v.value)
      if (tr.status === 'fulfilled') setVehicleTrips(tr.value.filter(t => t.vehicleId === id))
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="animate-pulse"><div className="h-8 bg-slate-200 rounded w-48 mb-4" /><div className="h-64 bg-slate-200 rounded-lg" /></div>
  if (!vehicle) return <div className="text-center py-12 text-slate-500">Vehicle not found</div>

  const reconciledTrips = vehicleTrips.filter(t => t.status === 'reconciled' && t.freightAmount)
  const totalRevenue = reconciledTrips.reduce((s, t) => s + (t.freightAmount || 0), 0)
  const totalExpenses = reconciledTrips.reduce((s, t) => s + (t.fuelExpense || 0) + (t.toll || 0) + (t.cashExpense || 0), 0)
  const totalProfit = totalRevenue - totalExpenses
  const totalDist = reconciledTrips.reduce((s, t) => s + (t.distance || 0), 0)
  const costPerKm = totalDist > 0 ? Math.round(totalExpenses / totalDist) : 0
  const margin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0
  const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`
  const shortLoc = (s) => { const p = (s || '').split(' - '); return p.length > 1 ? p.slice(1).join(' - ').trim() : s || '-' }

  // Chart data: trip-by-trip revenue vs cost
  const tripChartData = reconciledTrips.slice(-15).map(t => ({
    name: shortLoc(t.destination).slice(0, 10),
    revenue: t.freightAmount || 0,
    cost: (t.fuelExpense || 0) + (t.toll || 0) + (t.cashExpense || 0),
  }))

  // Maintenance by type
  const maintByType = {}
  ;(vehicle.maintenanceLogs || []).forEach(m => {
    maintByType[m.maintenanceType] = (maintByType[m.maintenanceType] || 0) + m.amount
  })
  const maintPieData = Object.entries(maintByType).map(([name, value]) => ({ name, value }))
  const totalMaintSpend = Object.values(maintByType).reduce((s, v) => s + v, 0)

  const handleAddMaint = async (e) => {
    e.preventDefault()
    try {
      await maintenanceApi.create({ ...maintForm, vehicleId: id, amount: parseInt(maintForm.amount) })
      const updated = await vehiclesApi.get(id)
      setVehicle(updated)
      setShowMaintForm(false)
    } catch (err) { alert(err.message) }
  }

  const handleAddTyre = async (e) => {
    e.preventDefault()
    try {
      await tyresApi.create({ ...tyreForm, vehicleId: id, installedKm: parseInt(tyreForm.installedKm), expectedLifeKm: parseInt(tyreForm.expectedLifeKm) })
      const updated = await vehiclesApi.get(id)
      setVehicle(updated)
      setShowTyreForm(false)
    } catch (err) { alert(err.message) }
  }

  const tabs = [
    { value: 'trips', label: 'Trips', count: vehicleTrips.length },
    { value: 'maintenance', label: 'Maintenance', count: vehicle.maintenanceLogs?.length || 0 },
    { value: 'documents', label: 'Documents', count: vehicle.documents?.length || 0 },
    { value: 'tyres', label: 'Tyres', count: vehicle.tyres?.length || 0 },
  ]

  return (
    <div>
      <PageHeader
        title={vehicle.vehicleNumber}
        subtitle={`${vehicle.vehicleType} · ${vehicle.axleConfig} · ${vehicle.purchaseYear} · ${vehicle.approxKm.toLocaleString()} km`}
        breadcrumbs={[{ label: 'Vehicles', to: '/vehicles' }, { label: vehicle.vehicleNumber }]}
        actions={<StatusDot status={vehicle.status} label={vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1)} />}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KPICard label="Total Earnings" value={inr(totalRevenue)} color="blue" />
        <KPICard label="Total Expenses" value={inr(totalExpenses)} color="red" />
        <KPICard label="Profit" value={inr(totalProfit)} color="emerald" />
        <KPICard label="Total Trips" value={vehicleTrips.length} color="amber" />
      </div>

      {/* Trip Revenue Chart */}
      {tripChartData.length > 0 && (
        <div className="chart-card mb-6">
          <h3>Trip Revenue vs Cost</h3>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={tripChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => inr(v)} />
              <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={20} name="Revenue" />
              <Line type="monotone" dataKey="cost" stroke="#ef4444" strokeWidth={2} dot={false} name="Cost" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabs */}
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
          {/* Trips Tab */}
          {tab === 'trips' && (
            <table className="data-table">
              <thead><tr><th>Status</th><th>Route</th><th>Freight</th><th>Cost</th><th>Profit</th><th>Date</th></tr></thead>
              <tbody>
                {vehicleTrips.slice(0, 20).map(trip => {
                  const cost = (trip.fuelExpense || 0) + (trip.toll || 0) + (trip.cashExpense || 0)
                  const profit = (trip.freightAmount || 0) - cost
                  return (
                    <tr key={trip.id} onClick={() => window.location.href = `/trips/${trip.id}`} className="cursor-pointer">
                      <td><StatusDot status={trip.status} /></td>
                      <td className="text-xs">{shortLoc(trip.loadingLocation)} → {shortLoc(trip.destination)}</td>
                      <td className="text-xs">{trip.freightAmount ? inr(trip.freightAmount) : <span className="badge badge-pending">Pending</span>}</td>
                      <td className="text-xs">{inr(cost)}</td>
                      <td className={`text-xs font-medium ${profit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{trip.freightAmount ? inr(profit) : '-'}</td>
                      <td className="text-xs text-slate-400">{trip.tripDate ? new Date(trip.tripDate).toLocaleDateString() : '-'}</td>
                    </tr>
                  )
                })}
                {vehicleTrips.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-slate-400">No trips recorded</td></tr>}
              </tbody>
            </table>
          )}

          {/* Maintenance Tab */}
          {tab === 'maintenance' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-slate-500">Total spend: <span className="font-semibold text-slate-900">{inr(totalMaintSpend)}</span></div>
                <button onClick={() => setShowMaintForm(true)} className="btn-primary text-xs">+ Add Log</button>
              </div>
              {maintPieData.length > 0 && (
                <div className="flex items-center gap-6 mb-4">
                  <ResponsiveContainer width={150} height={150}>
                    <PieChart>
                      <Pie data={maintPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={3}>
                        {maintPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => inr(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1">
                    {maintPieData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="capitalize text-slate-600">{d.name}</span>
                        <span className="font-semibold text-slate-900">{inr(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <table className="data-table">
                <thead><tr><th>Type</th><th>Amount</th><th>Workshop</th><th>Date</th></tr></thead>
                <tbody>
                  {(vehicle.maintenanceLogs || []).map(m => (
                    <tr key={m.id}>
                      <td><span className="badge badge-low capitalize">{m.maintenanceType}</span></td>
                      <td className="font-medium">{inr(m.amount)}</td>
                      <td className="text-slate-500">{m.workshopName || '-'}</td>
                      <td className="text-slate-400 text-xs">{new Date(m.maintenanceDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {(!vehicle.maintenanceLogs || vehicle.maintenanceLogs.length === 0) && <tr><td colSpan={4} className="text-center py-6 text-slate-400">No maintenance logs</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Documents Tab */}
          {tab === 'documents' && (
            <table className="data-table">
              <thead><tr><th>Type</th><th>Expiry</th><th>Days Left</th><th>Status</th></tr></thead>
              <tbody>
                {(vehicle.documents || []).map(doc => {
                  const now = new Date()
                  const exp = new Date(doc.expiryDate)
                  const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24))
                  const status = daysLeft < 0 ? 'expired' : daysLeft < 30 ? 'expiring' : 'valid'
                  return (
                    <tr key={doc.id}>
                      <td><span className="font-medium uppercase">{doc.documentType}</span></td>
                      <td className="text-xs">{exp.toLocaleDateString()}</td>
                      <td><span className={`badge ${status === 'expired' ? 'badge-high' : status === 'expiring' ? 'badge-medium' : 'badge-success'}`}>{daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}</span></td>
                      <td><StatusDot status={status} label={status.charAt(0).toUpperCase() + status.slice(1)} /></td>
                    </tr>
                  )
                })}
                {(!vehicle.documents || vehicle.documents.length === 0) && <tr><td colSpan={4} className="text-center py-6 text-slate-400">No documents</td></tr>}
              </tbody>
            </table>
          )}

          {/* Tyres Tab */}
          {tab === 'tyres' && (
            <div>
              <div className="flex justify-end mb-4">
                <button onClick={() => setShowTyreForm(true)} className="btn-primary text-xs">+ Add Tyre</button>
              </div>
              <TyreDiagram
                axleConfig={vehicle.axleConfig || '6W'}
                tyres={vehicle.tyres || []}
                vehicleKm={vehicle.approxKm}
                onTyreClick={(pos, tyre) => {
                  if (!tyre) {
                    setTyreForm({ ...tyreForm, position: pos })
                    setShowTyreForm(true)
                  }
                }}
              />
              {(vehicle.tyres || []).length > 0 && (
                <table className="data-table mt-4">
                  <thead><tr><th>Position</th><th>Brand</th><th>Condition</th><th>Installed</th></tr></thead>
                  <tbody>
                    {vehicle.tyres.map(ty => (
                      <tr key={ty.id}>
                        <td className="font-mono font-semibold">{ty.position}</td>
                        <td>{ty.brand || '-'} {ty.model || ''}</td>
                        <td><StatusDot status={ty.condition} label={ty.condition} /></td>
                        <td className="text-xs text-slate-400">{new Date(ty.installedDate).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Maintenance SlideOver */}
      <SlideOver open={showMaintForm} onClose={() => setShowMaintForm(false)} title="Add Maintenance Log">
        <form onSubmit={handleAddMaint} className="space-y-4">
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
            <select className="inp" value={maintForm.maintenanceType} onChange={e => setMaintForm({...maintForm, maintenanceType: e.target.value})}>
              <option value="engine">Engine</option><option value="tyre">Tyre</option><option value="brake">Brake</option><option value="clutch">Clutch</option><option value="general">General</option>
            </select></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Amount (₹)</label>
            <input className="inp" type="number" value={maintForm.amount} onChange={e => setMaintForm({...maintForm, amount: e.target.value})} required /></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Workshop</label>
            <input className="inp" value={maintForm.workshopName} onChange={e => setMaintForm({...maintForm, workshopName: e.target.value})} /></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
            <input className="inp" type="date" value={maintForm.maintenanceDate} onChange={e => setMaintForm({...maintForm, maintenanceDate: e.target.value})} required /></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea className="inp" rows={2} value={maintForm.description} onChange={e => setMaintForm({...maintForm, description: e.target.value})} /></div>
          <button type="submit" className="btn-primary w-full">Add Log</button>
        </form>
      </SlideOver>

      {/* Add Tyre SlideOver */}
      <SlideOver open={showTyreForm} onClose={() => setShowTyreForm(false)} title="Add Tyre">
        <form onSubmit={handleAddTyre} className="space-y-4">
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Position *</label>
            <input className="inp" value={tyreForm.position} onChange={e => setTyreForm({...tyreForm, position: e.target.value})} required placeholder="e.g. Front Left, Rear Right" /></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Brand</label>
            <input className="inp" value={tyreForm.brand} onChange={e => setTyreForm({...tyreForm, brand: e.target.value})} /></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Condition</label>
            <select className="inp" value={tyreForm.condition} onChange={e => setTyreForm({...tyreForm, condition: e.target.value})}>
              <option value="good">Good</option><option value="warn">Warn</option><option value="replace">Replace</option>
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">KM When Installed</label>
              <input className="inp" type="number" value={tyreForm.installedKm} onChange={e => setTyreForm({...tyreForm, installedKm: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Expected Life (KM)</label>
              <input className="inp" type="number" value={tyreForm.expectedLifeKm} onChange={e => setTyreForm({...tyreForm, expectedLifeKm: e.target.value})} /></div>
          </div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Install Date</label>
            <input className="inp" type="date" value={tyreForm.installedDate} onChange={e => setTyreForm({...tyreForm, installedDate: e.target.value})} /></div>
          <button type="submit" className="btn-primary w-full">Add Tyre</button>
        </form>
      </SlideOver>
    </div>
  )
}
