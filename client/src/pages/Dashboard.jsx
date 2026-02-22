import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  vehicles as vehiclesApi,
  trips as tripsApi,
  alerts as alertsApi,
  documents as documentsApi,
  fleetHealth as fleetHealthApi,
  insurance as insuranceApi,
  drivers as driversApi,
} from '../api'
import { useAuth } from '../App'
import {
  HeartPulseIcon, RouteIcon, TruckIcon, UserIcon, ShieldIcon,
  RefreshIcon, SparkleIcon, AlertTriangleIcon,
} from '../components/Icons'

function DonutChart({ value, max, size = 120, strokeWidth = 10, color = '#0d9488', label, sublabel }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const pct = max > 0 ? value / max : 0
  const offset = circumference * (1 - pct)

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-xl font-bold text-slate-800">{value}</span>
        <span className="text-[10px] text-slate-400 font-medium">{label}</span>
      </div>
      {sublabel && <div className="text-[10px] text-slate-500 mt-1 font-medium">{sublabel}</div>}
    </div>
  )
}

function MiniDonut({ value, max, size = 48, strokeWidth = 5, color = '#0d9488' }) {
  const radius = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * radius
  const pct = max > 0 ? value / max : 0
  const offset = circ * (1 - pct)
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-500" />
    </svg>
  )
}

function StatDot({ color, label, value, to }) {
  const Tag = to ? Link : 'div'
  return (
    <Tag to={to} className="flex items-center justify-between py-2 group hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors">
      <div className="flex items-center gap-2.5">
        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold text-slate-800">{value}</span>
        {to && <span className="text-slate-400 group-hover:text-teal-600 text-xs transition-colors">&rsaquo;</span>}
      </div>
    </Tag>
  )
}

const inr = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—'

export default function Dashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [health, setHealth] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [vehicleList, setVehicleList] = useState([])
  const [alertList, setAlertList] = useState([])
  const [docList, setDocList] = useState([])
  const [insuranceData, setInsuranceData] = useState(null)
  const [driverList, setDriverList] = useState([])

  useEffect(() => {
    Promise.allSettled([
      fleetHealthApi.score(),
      tripsApi.analytics(),
      vehiclesApi.list(),
      alertsApi.list(),
      documentsApi.list(),
      insuranceApi.optimizer(),
      driversApi.list(),
    ]).then(([h, a, v, al, docs, ins, dr]) => {
      if (h.status === 'fulfilled') setHealth(h.value)
      if (a.status === 'fulfilled') setAnalytics(a.value)
      if (v.status === 'fulfilled') setVehicleList(v.value)
      if (al.status === 'fulfilled') {
        const arr = al.value?.alerts || al.value || []
        setAlertList(Array.isArray(arr) ? arr.filter(x => !x.resolved) : [])
      }
      if (docs.status === 'fulfilled') setDocList(Array.isArray(docs.value) ? docs.value : [])
      if (ins.status === 'fulfilled') setInsuranceData(ins.value)
      if (dr.status === 'fulfilled') setDriverList(Array.isArray(dr.value) ? dr.value : [])
      setLoading(false)
    })
  }, [])

  const complianceScore = health?.overall || 0
  const fleetPnL = analytics?.fleetPnL || {}
  const tripCount = fleetPnL.tripCount || 0
  const revenue = fleetPnL.revenue || 0
  const margin = fleetPnL.margin || 0

  const vehicleCount = vehicleList.length
  const activeVehicles = vehicleList.filter(v => v.status === 'active').length
  const idleVehicles = vehicleList.filter(v => v.status === 'idle').length
  const driverCount = driverList.length

  const coverageGaps = insuranceData?.kpis?.coverageGapCount || 0
  const now = new Date()
  const expiredDocs = docList.filter(d => new Date(d.expiryDate) <= now)
  const expiringDocs = docList.filter(d => {
    const exp = new Date(d.expiryDate)
    return exp > now && exp <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  })
  const criticalAlerts = alertList.filter(a => a.severity === 'high')
  const criticalCount = expiredDocs.length + criticalAlerts.length

  const goodVehicles = Math.max(0, vehicleCount - coverageGaps)

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-7 bg-slate-200 rounded w-56" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-52 bg-slate-200 rounded-2xl" />
          <div className="h-52 bg-slate-200 rounded-2xl" />
          <div className="h-52 bg-slate-200 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          {user?.name ? `Hi, ${user.name.split(' ')[0]}` : 'Dashboard'}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {user?.tenantName && <span className="font-medium text-slate-600">{user.tenantName}</span>}
          {user?.tenantName && ' — '}
          Here's your fleet overview
        </p>
      </div>

      {/* Critical Alert */}
      {criticalCount > 0 && (
        <Link to="/fleet-health" className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 block hover:shadow-sm transition-shadow">
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangleIcon className="w-4 h-4 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-red-800">{criticalCount} issue{criticalCount !== 1 ? 's' : ''} need attention</span>
            <span className="hidden sm:inline text-xs text-red-500 ml-2">
              {expiredDocs.length > 0 && `${expiredDocs.length} expired`}
              {expiredDocs.length > 0 && criticalAlerts.length > 0 && ' · '}
              {criticalAlerts.length > 0 && `${criticalAlerts.length} critical`}
            </span>
          </div>
          <span className="text-xs font-bold text-red-600">View &rsaquo;</span>
        </Link>
      )}

      {/* Row 1: Total Vehicles | Trips | Vehicle Condition */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Total Vehicles - Donut */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Total Vehicles</h3>
          <div className="flex items-center gap-5">
            <div className="relative">
              <DonutChart value={vehicleCount} max={vehicleCount || 1} size={110} strokeWidth={12} color="#0d9488" label="Vehicles" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                <span className="text-xs text-slate-500">Active</span>
                <span className="ml-auto text-sm font-bold text-slate-700">{activeVehicles}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-xs text-slate-500">Idle</span>
                <span className="ml-auto text-sm font-bold text-slate-700">{idleVehicles}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="text-xs text-slate-500">Drivers</span>
                <span className="ml-auto text-sm font-bold text-slate-700">{driverCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trips */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Trips</h3>
          <div className="space-y-0.5">
            <StatDot color="bg-emerald-500" label="Total Trips" value={tripCount} to="/trips" />
            <StatDot color="bg-teal-500" label="Revenue" value={inr(revenue)} to="/trips" />
            <StatDot color="bg-blue-500" label="Profit Margin" value={`${margin}%`} />
            <StatDot color="bg-amber-500" label="Profit" value={inr(fleetPnL.profit)} />
          </div>
        </div>

        {/* Vehicle Condition / Fleet Health */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Fleet Health</h3>
          <div className="flex items-center justify-around">
            <div className="text-center relative">
              <MiniDonut value={complianceScore} max={100} size={56} strokeWidth={6} color={complianceScore >= 70 ? '#0d9488' : complianceScore >= 40 ? '#f59e0b' : '#ef4444'} />
              <div className="absolute inset-0 flex items-center justify-center" style={{ width: 56, height: 56 }}>
                <span className="text-xs font-bold text-slate-700">{complianceScore}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1.5 font-medium">Score</div>
            </div>
            <div className="text-center relative">
              <MiniDonut value={goodVehicles} max={vehicleCount || 1} size={56} strokeWidth={6} color="#10b981" />
              <div className="absolute inset-0 flex items-center justify-center" style={{ width: 56, height: 56 }}>
                <span className="text-xs font-bold text-slate-700">{goodVehicles}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1.5 font-medium">Good</div>
            </div>
            <div className="text-center relative">
              <MiniDonut value={coverageGaps} max={vehicleCount || 1} size={56} strokeWidth={6} color="#f59e0b" />
              <div className="absolute inset-0 flex items-center justify-center" style={{ width: 56, height: 56 }}>
                <span className="text-xs font-bold text-slate-700">{coverageGaps}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1.5 font-medium">At Risk</div>
            </div>
          </div>
          <Link to="/fleet-health" className="mt-4 block text-center text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors">
            View Details &rsaquo;
          </Link>
        </div>
      </div>

      {/* Row 2: Renewals + Insurance | Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Renewals & Insurance */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Renewals & Insurance</h3>
          <div className="space-y-0.5">
            <StatDot color="bg-red-500" label="Expired Documents" value={expiredDocs.length} to="/renewals" />
            <StatDot color="bg-amber-500" label="Expiring Soon (30d)" value={expiringDocs.length} to="/renewals" />
            <StatDot color="bg-blue-500" label="Coverage Gaps" value={coverageGaps} to="/insurance" />
            <StatDot color="bg-emerald-500" label="Alerts" value={alertList.length} to="/fleet-health" />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { to: '/quick-add', icon: RouteIcon, label: 'Log Trip', color: 'bg-teal-50 text-teal-600 border-teal-100' },
              { to: '/vehicles', icon: TruckIcon, label: 'Add Vehicle', color: 'bg-blue-50 text-blue-600 border-blue-100' },
              { to: '/drivers', icon: UserIcon, label: 'Add Driver', color: 'bg-violet-50 text-violet-600 border-violet-100' },
              { to: '/ai-chat', icon: SparkleIcon, label: 'AI Chat', color: 'bg-amber-50 text-amber-600 border-amber-100' },
              { to: '/documents', icon: RefreshIcon, label: 'Documents', color: 'bg-rose-50 text-rose-600 border-rose-100' },
              { to: '/insurance', icon: ShieldIcon, label: 'Insurance', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
            ].map(a => (
              <Link
                key={a.to}
                to={a.to}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-[13px] font-medium transition-all hover:shadow-sm active:scale-[0.98] ${a.color}`}
              >
                <a.icon className="w-4 h-4 shrink-0" />
                <span>{a.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Revenue Overview</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Revenue', value: inr(revenue), color: 'bg-teal-500' },
            { label: 'Expenses', value: inr(fleetPnL.expenses), color: 'bg-amber-500' },
            { label: 'Profit', value: inr(fleetPnL.profit), color: 'bg-emerald-500' },
            { label: 'Margin', value: `${margin}%`, color: 'bg-blue-500' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className={`h-1.5 ${s.color} rounded-full mb-3 mx-auto`} style={{ width: '60%' }} />
              <div className="text-sm sm:text-base font-bold text-slate-800">{s.value}</div>
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
