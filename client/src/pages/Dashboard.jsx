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

// ── Welcome Modal ────────────────────────────────────────────────────────────

function WelcomeModal({ userName, onDismiss }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(onDismiss, 200)
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center px-4 transition-all duration-300 ${
        visible ? 'bg-black/50 backdrop-blur-sm' : 'bg-black/0'
      }`}
      onClick={handleDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transition-all duration-300 ${
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="h-1.5 bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-500" />
        <div className="px-7 pt-7 pb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-2xl mb-5 shadow-lg shadow-blue-500/20">
            F
          </div>
          <h2 className="text-2xl font-bold text-slate-900 leading-tight">
            Save Smart. Manage Smart.
          </h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Welcome aboard{userName ? `, ${userName}` : ''}! You're now on <span className="font-semibold text-slate-700">Fleetsure</span> — your fleet's compliance and management expert.
          </p>
          <div className="mt-6 space-y-4">
            {[
              { icon: '🛡️', title: 'Compliance Tracking', desc: 'Never miss a renewal or document expiry.' },
              { icon: '📊', title: 'Trip Profitability', desc: 'Know what each trip earns. Track margins.' },
              { icon: '🤖', title: 'AI Insights', desc: 'Smart recommendations to cut costs.' },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 text-lg">{f.icon}</div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{f.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleDismiss}
            className="mt-7 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl py-3 transition-colors shadow-lg shadow-blue-500/20"
          >
            Let's Get Started
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tile Card (compact on mobile, expanded on desktop) ──────────────────────

function TileCard({ to, icon: Icon, title, stat, statusColor, statusLabel }) {
  return (
    <Link
      to={to}
      className="group block bg-white rounded-xl border border-slate-200 overflow-hidden transition-all duration-200 hover:shadow-md hover:shadow-slate-200/50 hover:border-slate-300 active:scale-[0.98]"
    >
      <div className="p-3 sm:p-5">
        {/* Mobile: compact horizontal layout */}
        <div className="flex items-center gap-3 sm:block">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 sm:mb-3">
            <Icon className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-slate-500 group-hover:text-slate-800 transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between sm:block">
              <div>
                <h3 className="text-[13px] sm:text-sm font-bold text-slate-900 leading-tight">{title}</h3>
                <div className="text-base sm:text-xl font-black text-slate-800 tracking-tight">{stat}</div>
              </div>
              {/* Status badge — only shown when meaningful */}
              {statusLabel && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold sm:mt-2 ${
                  statusColor === 'red' ? 'bg-red-50 text-red-600' :
                  statusColor === 'amber' ? 'bg-amber-50 text-amber-600' :
                  statusColor === 'green' ? 'bg-emerald-50 text-emerald-600' :
                  'bg-slate-50 text-slate-500'
                }`}>
                  {statusColor === 'red' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                  {statusColor === 'amber' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                  {statusColor === 'green' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  {statusLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const inr = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—'

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

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

  // Welcome modal
  const welcomeKey = user?.id ? `fleetsure_welcome_seen_${user.id}` : null
  const [showWelcome, setShowWelcome] = useState(() => {
    if (!welcomeKey) return false
    return !localStorage.getItem(welcomeKey)
  })
  const dismissWelcome = () => {
    if (welcomeKey) localStorage.setItem(welcomeKey, '1')
    setShowWelcome(false)
  }

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

  // ── Derived stats ────────────────────────────────────────────────────────

  const complianceScore = health?.overall || 0

  const fleetPnL = analytics?.fleetPnL || {}
  const tripCount = fleetPnL.tripCount || 0
  const revenue = fleetPnL.revenue || 0
  const margin = fleetPnL.margin || 0

  const vehicleCount = vehicleList.length
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
  const renewalCount = expiringDocs.length + expiredDocs.length

  // ── Loading skeleton ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-7 bg-slate-200 rounded w-56" />
        <div className="h-10 bg-slate-100 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 sm:h-36 bg-slate-200 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div>
      {showWelcome && <WelcomeModal userName={user?.name} onDismiss={dismissWelcome} />}

      {/* ── Greeting ────────────────────────────────────────────────────── */}
      <div className="mb-4">
        <h1 className="text-lg sm:text-xl font-bold text-slate-900">
          {user?.name ? `Welcome, ${user.name}` : 'Dashboard'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          {user?.tenantName && <span className="font-medium text-slate-700">{user.tenantName}</span>}
          {user?.tenantName && <span className="mx-1.5 text-slate-300">|</span>}
          Your fleet at a glance
        </p>
      </div>

      {/* ── Critical Alert Banner ───────────────────────────────────────── */}
      {criticalCount > 0 && (
        <Link to="/fleet-health" className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 block">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangleIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-red-800">
              {criticalCount} issue{criticalCount !== 1 ? 's' : ''} need attention
            </span>
            <span className="hidden sm:inline text-xs text-red-500 ml-2">
              {expiredDocs.length > 0 && `${expiredDocs.length} expired doc${expiredDocs.length !== 1 ? 's' : ''}`}
              {expiredDocs.length > 0 && criticalAlerts.length > 0 && ' · '}
              {criticalAlerts.length > 0 && `${criticalAlerts.length} high alert${criticalAlerts.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          <span className="text-xs font-bold text-red-600 whitespace-nowrap">
            Fix →
          </span>
        </Link>
      )}

      {/* ── Tile Grid — 2 cols on mobile, 3 on desktop ───────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">

        {/* 1. Fleet Health */}
        <TileCard
          to="/fleet-health"
          icon={HeartPulseIcon}
          title="Fleet Health"
          stat={`${complianceScore}/100`}
          statusColor={complianceScore >= 80 ? 'green' : complianceScore >= 50 ? 'amber' : 'red'}
          statusLabel={complianceScore >= 80 ? 'Good' : complianceScore >= 50 ? 'At Risk' : 'Critical'}
        />

        {/* 2. Trips */}
        <TileCard
          to="/trips"
          icon={RouteIcon}
          title="Trips"
          stat={`${tripCount}`}
          statusColor={margin > 20 ? 'green' : margin > 0 ? null : null}
          statusLabel={margin > 0 ? `${margin}% profit` : null}
        />

        {/* 3. Vehicles */}
        <TileCard
          to="/vehicles"
          icon={TruckIcon}
          title="Vehicles"
          stat={`${vehicleCount}`}
        />

        {/* 4. Drivers */}
        <TileCard
          to="/drivers"
          icon={UserIcon}
          title="Drivers"
          stat={`${driverCount}`}
        />

        {/* 5. Renewals */}
        <TileCard
          to="/renewals"
          icon={RefreshIcon}
          title="Renewals"
          stat={`${renewalCount} pending`}
          statusColor={expiredDocs.length > 0 ? 'red' : expiringDocs.length > 0 ? 'amber' : 'green'}
          statusLabel={expiredDocs.length > 0 ? `${expiredDocs.length} expired` : expiringDocs.length > 0 ? `${expiringDocs.length} expiring` : 'All good'}
        />

        {/* 6. Insurance */}
        <TileCard
          to="/insurance"
          icon={ShieldIcon}
          title="Insurance"
          stat={coverageGaps > 0 ? `${coverageGaps} gap${coverageGaps !== 1 ? 's' : ''}` : 'Covered'}
          statusColor={coverageGaps > 0 ? 'amber' : 'green'}
          statusLabel={coverageGaps > 0 ? 'Needs attention' : 'All good'}
        />
      </div>

      {/* ── AI Chat — slim bar, not a full card ──────────────────────── */}
      <Link
        to="/ai-chat"
        className="mt-3 sm:mt-4 flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-slate-300 hover:shadow-sm transition-all group"
      >
        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
          <SparkleIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
        </div>
        <div className="flex-1">
          <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">AI Chat</span>
          <span className="text-xs text-slate-400 ml-2 hidden sm:inline">Ask anything about your fleet</span>
        </div>
        <span className="text-xs text-slate-400 group-hover:text-blue-600 font-medium transition-colors">Ask →</span>
      </Link>

      {/* ── Quick Stats ──────────────────────────────────────────────── */}
      <div className="mt-4 sm:mt-5 grid grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Revenue', value: inr(revenue) },
          { label: 'Profit', value: inr(fleetPnL.profit) },
          { label: 'Profit %', value: `${margin}%` },
          { label: 'Alerts', value: String(alertList.length) },
        ].map((s) => (
          <div key={s.label} className="bg-slate-50 rounded-lg sm:rounded-xl px-2.5 sm:px-4 py-2 sm:py-3 text-center sm:text-left">
            <div className="text-xs sm:text-base font-bold text-slate-700 truncate">{s.value}</div>
            <div className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
