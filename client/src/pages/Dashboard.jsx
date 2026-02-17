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
  fastag as fastagApi,
} from '../api'
import { useAuth } from '../App'
import {
  HeartPulseIcon, RouteIcon, TruckIcon, UserIcon, ShieldIcon,
  RefreshIcon, SparkleIcon, FileTextIcon, AlertTriangleIcon, FasTagIcon,
} from '../components/Icons'

// ── Welcome Modal (shown once for new users) ────────────────────────────────

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

// ── Feature Card ────────────────────────────────────────────────────────────

function FeatureCard({ to, icon: Icon, title, stat, indicator, description, accent }) {
  return (
    <Link
      to={to}
      className="group block bg-white rounded-xl border border-slate-200 overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-slate-300"
    >
      <div className={`h-1 ${accent}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent.replace('bg-', 'bg-').replace('-500', '-50').replace('-600', '-50').replace('-700', '-50')}`}>
            <Icon className="w-5 h-5 text-slate-600 group-hover:text-slate-900 transition-colors" />
          </div>
          {indicator && <div>{indicator}</div>}
        </div>
        <h3 className="text-sm font-bold text-slate-900 group-hover:text-slate-950">{title}</h3>
        <div className="text-xl font-black text-slate-800 mt-1 tracking-tight">{stat}</div>
        <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{description}</p>
      </div>
    </Link>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const inr = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—'
const compactInr = (n) => {
  if (!n || n === 0) return '—'
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return inr(n)
}

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
  const [fastagSummary, setFastagSummary] = useState(null)

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
      fastagApi.vehicles(),
    ]).then(([h, a, v, al, docs, ins, dr, ft]) => {
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
      if (ft.status === 'fulfilled') setFastagSummary(ft.value?.summary || null)
      setLoading(false)
    })
  }, [])

  // ── Derived stats ────────────────────────────────────────────────────────

  const complianceScore = health?.overall || 0
  const scoreColor = complianceScore >= 80 ? 'text-emerald-600' : complianceScore >= 50 ? 'text-amber-600' : 'text-red-600'
  const scoreBg = complianceScore >= 80 ? 'bg-emerald-500' : complianceScore >= 50 ? 'bg-amber-500' : 'bg-red-500'

  const fleetPnL = analytics?.fleetPnL || {}
  const tripCount = fleetPnL.tripCount || 0
  const revenue = fleetPnL.revenue || 0
  const margin = fleetPnL.margin || 0

  const vehicleCount = vehicleList.length
  const driverCount = driverList.length

  const coverageGaps = insuranceData?.kpis?.coverageGapCount || 0
  const totalSavings = insuranceData?.kpis?.totalSavings || 0

  const fastagLinked = fastagSummary?.linkedVehicles || 0
  const fastagBalance = fastagSummary?.totalBalance || 0
  const fastagLowCount = fastagSummary?.lowBalanceCount || 0

  const now = new Date()
  const expiredDocs = docList.filter(d => new Date(d.expiryDate) <= now)
  const expiringDocs = docList.filter(d => {
    const exp = new Date(d.expiryDate)
    return exp > now && exp <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  })
  const criticalAlerts = alertList.filter(a => a.severity === 'high')
  const criticalCount = expiredDocs.length + criticalAlerts.length

  // ── Loading skeleton ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-slate-200 rounded w-72" />
        <div className="h-12 bg-slate-100 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-40 bg-slate-200 rounded-xl" />
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
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">
          {user?.name ? `Welcome back, ${user.name}` : 'Dashboard'}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {user?.tenantName && <span className="font-medium text-slate-700">{user.tenantName}</span>}
          {user?.tenantName && <span className="mx-1.5 text-slate-300">|</span>}
          Your fleet at a glance
        </p>
      </div>

      {/* ── Critical Alert Banner ───────────────────────────────────────── */}
      {criticalCount > 0 && (
        <div className="mb-5 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangleIcon className="w-4 h-4 text-red-600" />
          </div>
          <div className="flex-1">
            <span className="text-sm font-bold text-red-800">
              {criticalCount} critical issue{criticalCount !== 1 ? 's' : ''} need attention
            </span>
            <span className="text-xs text-red-500 ml-2">
              {expiredDocs.length > 0 && `${expiredDocs.length} expired doc${expiredDocs.length !== 1 ? 's' : ''}`}
              {expiredDocs.length > 0 && criticalAlerts.length > 0 && ' · '}
              {criticalAlerts.length > 0 && `${criticalAlerts.length} high alert${criticalAlerts.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          <Link to="/fleet-health" className="text-xs font-bold text-red-600 hover:text-red-800 whitespace-nowrap">
            Resolve Now →
          </Link>
        </div>
      )}

      {/* ── Feature Card Grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* 1. Fleet Health */}
        <FeatureCard
          to="/fleet-health"
          icon={HeartPulseIcon}
          title="Fleet Health"
          accent="bg-emerald-500"
          stat={`${complianceScore}/100`}
          indicator={
            <div className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${scoreBg}`} />
              <span className={`text-xs font-bold ${scoreColor}`}>
                {complianceScore >= 80 ? 'Safe' : complianceScore >= 50 ? 'At Risk' : 'Critical'}
              </span>
            </div>
          }
          description="Compliance score, alerts & maintenance status"
        />

        {/* 2. Trips */}
        <FeatureCard
          to="/trips"
          icon={RouteIcon}
          title="Trips"
          accent="bg-blue-500"
          stat={`${tripCount} trips`}
          indicator={
            margin > 0 ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                {margin}% margin
              </span>
            ) : null
          }
          description={revenue > 0 ? `${compactInr(revenue)} total revenue` : 'Trip logging & profitability tracking'}
        />

        {/* 3. Vehicles */}
        <FeatureCard
          to="/vehicles"
          icon={TruckIcon}
          title="Vehicles"
          accent="bg-slate-600"
          stat={`${vehicleCount} vehicle${vehicleCount !== 1 ? 's' : ''}`}
          indicator={
            vehicleCount > 0 ? (
              <span className="text-[10px] font-medium text-slate-400">
                {vehicleList.filter(v => v.status === 'active').length || vehicleCount} active
              </span>
            ) : null
          }
          description="Fleet registry, documents & details"
        />

        {/* 4. Drivers */}
        <FeatureCard
          to="/drivers"
          icon={UserIcon}
          title="Drivers"
          accent="bg-violet-500"
          stat={`${driverCount} driver${driverCount !== 1 ? 's' : ''}`}
          indicator={
            driverCount > 0 ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700">
                Managed
              </span>
            ) : null
          }
          description="Driver management & driving scores"
        />

        {/* 5. Insurance */}
        <FeatureCard
          to="/insurance"
          icon={ShieldIcon}
          title="Insurance"
          accent="bg-amber-500"
          stat={coverageGaps > 0 ? `${coverageGaps} gap${coverageGaps !== 1 ? 's' : ''}` : 'All covered'}
          indicator={
            totalSavings > 0 ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                {compactInr(totalSavings)} saved
              </span>
            ) : null
          }
          description="Coverage optimizer & premium quotes"
        />

        {/* 6. Renewals */}
        <FeatureCard
          to="/renewals"
          icon={RefreshIcon}
          title="Renewals"
          accent="bg-red-500"
          stat={`${expiringDocs.length + expiredDocs.length} pending`}
          indicator={
            expiredDocs.length > 0 ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 animate-pulse">
                {expiredDocs.length} expired
              </span>
            ) : expiringDocs.length > 0 ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600">
                {expiringDocs.length} expiring
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600">
                All good
              </span>
            )
          }
          description="Document renewal tracking & reminders"
        />

        {/* 7. AI Chat */}
        <FeatureCard
          to="/ai-chat"
          icon={SparkleIcon}
          title="AI Chat"
          accent="bg-purple-500"
          stat="Ask anything"
          indicator={
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500" />
            </span>
          }
          description="AI-powered fleet assistant & insights"
        />

        {/* 8. Documents */}
        <FeatureCard
          to="/documents"
          icon={FileTextIcon}
          title="Documents"
          accent="bg-teal-500"
          stat="Generate PDFs"
          indicator={
            <span className="text-[10px] font-medium text-slate-400">4 templates</span>
          }
          description="Invoices, receipts, letterheads & statements"
        />

        {/* 9. FASTag */}
        <FeatureCard
          to="/fastag"
          icon={FasTagIcon}
          title="FASTag"
          accent="bg-orange-500"
          stat={fastagLinked > 0 ? compactInr(fastagBalance) : 'Setup'}
          indicator={
            fastagLowCount > 0 ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 animate-pulse">
                {fastagLowCount} low
              </span>
            ) : fastagLinked > 0 ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600">
                {fastagLinked} linked
              </span>
            ) : null
          }
          description="Balance monitoring, recharge & toll tracking"
        />

      </div>

      {/* ── Quick Stats Footer ──────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Revenue', value: compactInr(revenue) },
          { label: 'Profit', value: compactInr(fleetPnL.profit) },
          { label: 'Fleet Margin', value: `${margin}%` },
          { label: 'Open Alerts', value: String(alertList.length) },
        ].map((s) => (
          <div key={s.label} className="bg-slate-50 rounded-xl px-4 py-3">
            <div className="text-base font-bold text-slate-700">{s.value}</div>
            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
