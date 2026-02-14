import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts'
import { trips as tripsApi, tripStats as tripStatsApi } from '../api'
import PageHeader from '../components/PageHeader'
import KPICard from '../components/KPICard'
import FilterBar from '../components/FilterBar'
import DataTable from '../components/DataTable'
import StatusDot from '../components/StatusDot'
import EmptyState from '../components/EmptyState'
import MiniChart from '../components/MiniChart'
import { RouteIcon, PlusIcon } from '../components/Icons'

export default function Trips() {
  const navigate = useNavigate()
  const [trips, setTrips] = useState([])
  const [monthlyStats, setMonthlyStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    Promise.allSettled([tripsApi.list(), tripStatsApi.monthly()])
      .then(([t, m]) => {
        if (t.status === 'fulfilled') setTrips(t.value)
        if (m.status === 'fulfilled') setMonthlyStats(m.value)
        setLoading(false)
      })
  }, [])

  const reconciled = trips.filter(t => t.status === 'reconciled' && t.freightAmount)
  const pending = trips.filter(t => t.status === 'logged')
  const totalRevenue = reconciled.reduce((s, t) => s + (t.freightAmount || 0), 0)
  const totalProfit = reconciled.reduce((s, t) => s + ((t.freightAmount || 0) - (t.fuelExpense || 0) - (t.toll || 0) - (t.cashExpense || 0)), 0)
  const avgProfit = reconciled.length > 0 ? Math.round(totalProfit / reconciled.length) : 0

  const filtered = trips.filter(t => {
    if (statusFilter === 'logged' && t.status !== 'logged') return false
    if (statusFilter === 'reconciled' && t.status !== 'reconciled') return false
    if (search) {
      const q = search.toLowerCase()
      const vn = (t.vehicle?.vehicleNumber || '').toLowerCase()
      const route = `${t.loadingLocation} ${t.destination}`.toLowerCase()
      if (!vn.includes(q) && !route.includes(q)) return false
    }
    return true
  })

  const inr = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '-'
  const shortLoc = (s) => { const p = (s || '').split(' - '); return p.length > 1 ? p.slice(1).join(' - ').trim() : s || '-' }

  const columns = [
    { key: 'status', label: 'Status', width: '60px', render: (_, row) => <StatusDot status={row.status} /> },
    { key: 'vehicleNumber', label: 'Vehicle', render: (_, row) => <span className="font-mono text-xs font-semibold">{row.vehicle?.vehicleNumber || '-'}</span> },
    { key: 'route', label: 'Route', sortable: false, render: (_, row) => <span className="text-xs">{shortLoc(row.loadingLocation)} → {shortLoc(row.destination)}</span> },
    { key: 'distance', label: 'Dist', render: (v) => `${v || 0} km` },
    { key: 'freightAmount', label: 'Freight', render: (v) => v ? inr(v) : <span className="badge badge-pending">Pending</span> },
    { key: 'expenses', label: 'Expenses', sortable: false, render: (_, row) => inr((row.fuelExpense || 0) + (row.toll || 0) + (row.cashExpense || 0)) },
    { key: 'profit', label: 'Profit', sortable: false, render: (_, row) => {
      if (!row.freightAmount) return '-'
      const p = row.freightAmount - (row.fuelExpense || 0) - (row.toll || 0) - (row.cashExpense || 0)
      return <span className={`font-medium ${p > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{inr(p)}</span>
    }},
    { key: 'tripDate', label: 'Date', render: (v) => v ? new Date(v).toLocaleDateString() : '-' },
  ]

  if (loading) return <div className="animate-pulse"><div className="h-8 bg-slate-200 rounded w-48 mb-4" /><div className="h-64 bg-slate-200 rounded-lg" /></div>

  return (
    <div>
      <PageHeader
        title="Trips & P&L"
        subtitle="Track every trip's profitability"
        actions={
          <div className="flex gap-2">
            <Link to="/reconcile" className="btn-secondary text-xs">Reconcile</Link>
            <Link to="/quick-add" className="btn-primary flex items-center gap-1 text-xs"><PlusIcon className="w-4 h-4" /> Log Trip</Link>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <KPICard label="Total Trips" value={trips.length} color="blue"
          sparkline={<MiniChart data={monthlyStats.map(m => ({ value: m.trips }))} color="#2563eb" />} />
        <KPICard label="Pending" value={pending.length} color="amber" />
        <KPICard label="Revenue" value={inr(totalRevenue)} color="emerald"
          sparkline={<MiniChart data={monthlyStats.map(m => ({ value: m.revenue }))} color="#10b981" />} />
        <KPICard label="Total Profit" value={inr(totalProfit)} color="violet" />
        <KPICard label="Avg Profit/Trip" value={inr(avgProfit)} color="cyan" />
      </div>

      {/* Monthly Chart */}
      {monthlyStats.length > 0 && (
        <div className="chart-card mb-6">
          <h3>Monthly Trip Count & Revenue</h3>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={monthlyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v, name) => name === 'revenue' ? inr(v) : v} />
              <Bar yAxisId="left" dataKey="trips" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={20} name="Trips" />
              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} name="Revenue" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filter + Table */}
      <div className="card overflow-hidden">
        <div className="px-4 pt-4">
          <FilterBar
            search={search}
            onSearch={setSearch}
            placeholder="Search vehicle or route..."
            tabs={[
              { value: 'all', label: 'All', count: trips.length },
              { value: 'logged', label: 'Pending', count: pending.length },
              { value: 'reconciled', label: 'Reconciled', count: reconciled.length },
            ]}
            activeTab={statusFilter}
            onTabChange={setStatusFilter}
          />
        </div>
        {filtered.length > 0 ? (
          <DataTable columns={columns} data={filtered} onRowClick={(row) => navigate(`/trips/${row.id}`)} />
        ) : (
          <EmptyState icon={RouteIcon} title="No trips found" subtitle="Log your first trip to start tracking profitability" />
        )}
      </div>
    </div>
  )
}
