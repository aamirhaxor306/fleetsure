import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  vehicles as vehiclesApi,
  trips as tripsApi,
  alerts as alertsApi,
  documents as documentsApi,
  fleetHealth as fleetHealthApi,
  insurance as insuranceApi,
  drivers as driversApi,
  moneyLost as moneyLostApi,
  fuel as fuelApi,
  // tripStats endpoint not available — weekly chart uses trip list instead
} from '../api'
import { useAuth } from '../App'
import { useLang } from '../context/LanguageContext'
import {
  HeartPulseIcon, RouteIcon, TruckIcon, UserIcon, ShieldIcon,
  RefreshIcon, SparkleIcon, AlertTriangleIcon, FuelIcon,
} from '../components/Icons'

/* ── Helpers ───────────────────────────────────────────── */

const inr = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—'
const SETUP_WIZARD_DISMISS_KEY = 'fleetsure-setup-wizard-dismissed'

/** Safely extract a display string — handles objects like { vehicleNumber: '...' } */
function safeStr(val) {
  if (val == null) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object') {
    return val.vehicleNumber || val.registrationNumber || val.name || val.label || val.title || JSON.stringify(val)
  }
  return String(val)
}

function getGreetingKey() {
  const h = new Date().getHours()
  if (h < 12) return 'greetingMorning'
  if (h < 17) return 'greetingAfternoon'
  return 'greetingEvening'
}

/* ── Animated Number Counter ───────────────────────────── */

function AnimatedNumber({ value, prefix = '', suffix = '', duration = 800, format }) {
  const [display, setDisplay] = useState(0)
  const prevVal = useRef(0)
  const rafRef = useRef(null)

  useEffect(() => {
    const numVal = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0
    const start = prevVal.current
    const diff = numVal - start
    if (diff === 0) { setDisplay(numVal); return }
    const startTime = performance.now()
    const ease = (t) => 1 - Math.pow(1 - t, 3)

    const animate = (now) => {
      const elapsed = Math.min((now - startTime) / duration, 1)
      const current = start + diff * ease(elapsed)
      setDisplay(current)
      if (elapsed < 1) rafRef.current = requestAnimationFrame(animate)
      else prevVal.current = numVal
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, duration])

  const formatted = format ? format(display) : Math.round(display).toLocaleString('en-IN')
  return <>{prefix}{formatted}{suffix}</>
}

/* ── SVG Chart Components ──────────────────────────────── */

function DonutChart({ value, max, size = 120, strokeWidth = 10, color = '#0d9488', label, sublabel }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const pct = max > 0 ? value / max : 0
  const offset = circumference * (1 - pct)
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
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

function WeeklyBarChart({ data = [] }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.count), 1)
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  return (
    <div className="flex items-end gap-1.5 h-16">
      {data.slice(-7).map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <div className="w-full rounded-t-sm bg-teal-500/80 transition-all duration-500"
            style={{ height: `${Math.max((d.count / max) * 48, 3)}px` }}
            title={`${d.date}: ${d.count} trips`} />
          <span className="text-[9px] text-slate-400 font-medium">{days[new Date(d.date).getDay()] || '?'}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Stat Row ──────────────────────────────────────────── */

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

/* ── Card Skeleton ─────────────────────────────────────── */

function CardSkeleton({ h = 'h-52' }) {
  return <div className={`card-skeleton ${h}`} />
}

/* ── Error Card ────────────────────────────────────────── */

function ErrorCard({ message, onRetry, t }) {
  return (
    <div className="bg-white rounded-2xl border border-red-200 p-5 flex flex-col items-center justify-center gap-2 min-h-[120px]">
      <AlertTriangleIcon className="w-5 h-5 text-red-400" />
      <span className="text-sm text-red-600 font-medium">{message || t('errorLoading')}</span>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost text-xs text-teal-600 hover:text-teal-700 font-semibold">
          {t('retry')} ↻
        </button>
      )}
    </div>
  )
}

/* ── Empty State ───────────────────────────────────────── */

function EmptyState({ icon: Icon, message, cta, to }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
      {Icon && <Icon className="w-8 h-8 text-slate-300" />}
      <span className="text-sm text-slate-400">{message}</span>
      {cta && to && (
        <Link to={to} className="text-xs font-semibold text-teal-600 hover:text-teal-700">{cta}</Link>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD COMPONENT
   ══════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useLang()

  // ── Section loading / error states (progressive loading) ──
  const [sections, setSections] = useState({
    fleet: { loading: true, error: null },
    trips: { loading: true, error: null },
    health: { loading: true, error: null },
    money: { loading: true, error: null },
  })
  const updateSection = (key, patch) => setSections(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  // ── Data ──
  const [health, setHealth] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [vehicleList, setVehicleList] = useState([])
  const [alertList, setAlertList] = useState([])
  const [docList, setDocList] = useState([])
  const [insuranceData, setInsuranceData] = useState(null)
  const [driverList, setDriverList] = useState([])
  const [moneyData, setMoneyData] = useState(null)
  const [moneyExpanded, setMoneyExpanded] = useState(null)
  const [setupDismissed, setSetupDismissed] = useState(false)
  const [fuelStats, setFuelStats] = useState(null)
  const [weeklyTrips, setWeeklyTrips] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    try { setSetupDismissed(localStorage.getItem(SETUP_WIZARD_DISMISS_KEY) === '1') } catch { }
  }, [])

  // ── Data fetchers ──
  const fetchFleetData = useCallback(async () => {
    updateSection('fleet', { loading: true, error: null })
    try {
      const [v, dr] = await Promise.all([vehiclesApi.list(), driversApi.list()])
      setVehicleList(v)
      setDriverList(Array.isArray(dr) ? dr : [])
      updateSection('fleet', { loading: false, error: null })
    } catch (e) {
      updateSection('fleet', { loading: false, error: e.message })
    }
  }, [])

  const fetchTripData = useCallback(async () => {
    updateSection('trips', { loading: true, error: null })
    try {
      const [a, tripList] = await Promise.all([tripsApi.analytics(), tripsApi.list().catch(() => [])])
      setAnalytics(a)
      // Build last-7-days activity from trip list
      const dayMap = {}
      const today = new Date()
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i)
        dayMap[d.toISOString().slice(0, 10)] = 0
      }
      if (Array.isArray(tripList)) {
        tripList.forEach(tr => {
          const key = (tr.date || tr.createdAt || '').slice(0, 10)
          if (key in dayMap) dayMap[key]++
        })
      }
      setWeeklyTrips(Object.entries(dayMap).map(([date, count]) => ({ date, count })))
      updateSection('trips', { loading: false, error: null })
    } catch (e) {
      updateSection('trips', { loading: false, error: e.message })
    }
  }, [])

  const fetchHealthData = useCallback(async () => {
    updateSection('health', { loading: true, error: null })
    try {
      const [h, al, docs, ins, fs] = await Promise.all([
        fleetHealthApi.score(),
        alertsApi.list(),
        documentsApi.list(),
        insuranceApi.optimizer(),
        fuelApi.stats().catch(() => null),
      ])
      setHealth(h)
      const arr = al?.alerts || al || []
      setAlertList(Array.isArray(arr) ? arr.filter(x => !x.resolved) : [])
      setDocList(Array.isArray(docs) ? docs : [])
      setInsuranceData(ins)
      if (fs) setFuelStats(fs)
      updateSection('health', { loading: false, error: null })
    } catch (e) {
      updateSection('health', { loading: false, error: e.message })
    }
  }, [])

  const fetchMoneyData = useCallback(async () => {
    updateSection('money', { loading: true, error: null })
    try {
      const m = await moneyLostApi.get()
      setMoneyData(m)
      updateSection('money', { loading: false, error: null })
    } catch {
      updateSection('money', { loading: false, error: null }) // silent — optional card
    }
  }, [])

  const fetchAll = useCallback(async () => {
    setRefreshing(true)
    await Promise.allSettled([fetchFleetData(), fetchTripData(), fetchHealthData(), fetchMoneyData()])
    setRefreshing(false)
  }, [fetchFleetData, fetchTripData, fetchHealthData, fetchMoneyData])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Derived data ──
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
  const showSetupWizard = vehicleCount === 0 && !setupDismissed

  // ── Top performing vehicle ──
  const topVehicle = (() => {
    const byVehicle = analytics?.byVehicle || analytics?.vehicleStats
    if (!byVehicle || !Array.isArray(byVehicle) || byVehicle.length === 0) return null
    return byVehicle.reduce((best, v) => (v.revenue || 0) > (best.revenue || 0) ? v : best, byVehicle[0])
  })()

  // ── Most urgent renewal ──
  const mostUrgentDoc = (() => {
    const sorted = [...expiringDocs].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
    return sorted[0] || null
  })()
  const urgentDaysLeft = mostUrgentDoc ? Math.ceil((new Date(mostUrgentDoc.expiryDate) - now) / (1000 * 60 * 60 * 24)) : null

  // ── Fuel efficiency ──
  const avgKmPerL = fuelStats?.avgKmPerL || fuelStats?.fleetAvgKmpl || fuelStats?.avgEfficiency || null

  // ── All-loaded check ──
  const allLoaded = !sections.fleet.loading && !sections.trips.loading && !sections.health.loading

  return (
    <div className="space-y-5">

      {/* ═══ Greeting + Refresh ═══ */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {user?.name
              ? `${t(getGreetingKey())}, ${user.name.split(' ')[0]}`
              : t('navHome', { defaultValue: 'Dashboard' })}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {user?.tenantName && <span className="font-medium text-slate-600">{user.tenantName}</span>}
            {user?.tenantName && ' — '}
            {t('dashboardFleetOverview')}
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
          title={t('refreshData')}
        >
          <RefreshIcon className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin-slow' : ''}`} />
          <span className="hidden sm:inline">{refreshing ? t('refreshing') : t('refreshData')}</span>
        </button>
      </div>

      {/* ═══ Money Lost Card (Glassmorphism) ═══ */}
      {moneyData && moneyData.totalLost > 0 && (
        <div className="glass-card rounded-2xl border border-red-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-red-500 uppercase tracking-wider">{moneyData.month} — {t('avoidableLosses')}</div>
                <div className="text-2xl sm:text-3xl font-black text-red-700 mt-1">
                  <AnimatedNumber value={moneyData.totalLost} prefix="₹" format={(v) => Math.round(v).toLocaleString('en-IN')} />
                </div>
                <div className="text-xs text-red-500/80 mt-0.5">{t('avoidableLossesSub')}</div>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center text-2xl shrink-0">💸</div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {['freight', 'fuel', 'idle', 'penalty'].map(key => {
              const bucket = moneyData.buckets[key]
              if (!bucket || bucket.amount === 0) return null
              const isOpen = moneyExpanded === key
              const icons = { freight: '📉', fuel: '⛽', idle: '🅿️', penalty: '⚠️' }
              const colors = { freight: 'text-amber-700 bg-amber-50', fuel: 'text-orange-700 bg-orange-50', idle: 'text-slate-700 bg-slate-100', penalty: 'text-red-700 bg-red-50' }
              const actions = {
                freight: { label: 'Set floor rates', to: '/trips' },
                fuel: { label: 'Check vehicles', to: '/vehicles' },
                idle: { label: 'View idle trucks', to: '/vehicles' },
                penalty: { label: 'Renew now', to: '/renewals' },
              }
              return (
                <div key={key}>
                  <button type="button" onClick={() => setMoneyExpanded(isOpen ? null : key)}
                    className="w-full px-5 py-3 flex items-center gap-3 hover:bg-white/40 transition-colors text-left">
                    <span className="text-lg">{icons[key]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{bucket.label}</div>
                    </div>
                    <div className="text-sm font-bold text-red-600">{inr(bucket.amount)}</div>
                    <span className={`text-slate-400 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4">
                      <div className="space-y-2 mb-3">
                        {bucket.items.map((item, i) => (
                          <div key={i} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${colors[key]}`}>
                            <div className="min-w-0">
                              <span className="font-bold">{item.vehicle}</span>
                              {key === 'freight' && <span className="ml-2 text-[11px] opacity-70">Got {inr(item.got)} vs avg {inr(item.avg)}</span>}
                              {key === 'fuel' && <span className="ml-2 text-[11px] opacity-70">{item.kmPerL} km/L vs fleet avg {item.fleetAvg}</span>}
                              {key === 'idle' && <span className="ml-2 text-[11px] opacity-70">{item.idleDays} days idle</span>}
                              {key === 'penalty' && <span className="ml-2 text-[11px] opacity-70">{item.type} {item.daysLeft < 0 ? `expired ${Math.abs(item.daysLeft)}d ago` : `expires in ${item.daysLeft}d`}</span>}
                            </div>
                            <span className="font-bold shrink-0 ml-2">{inr(item.lost)}</span>
                          </div>
                        ))}
                      </div>
                      <Link to={actions[key].to} className="btn-primary text-xs !py-1.5">{actions[key].label} →</Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ Setup Wizard ═══ */}
      {showSetupWizard && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Set up your fleet in 3 steps</h2>
              <p className="text-sm text-slate-500 mt-1">Complete these once, then daily work becomes one-tap.</p>
            </div>
            <button type="button" className="text-xs text-slate-400 hover:text-slate-600"
              onClick={() => { setSetupDismissed(true); try { localStorage.setItem(SETUP_WIZARD_DISMISS_KEY, '1') } catch { } }}>
              Skip
            </button>
          </div>
          <div className="mt-4 space-y-2.5">
            <StepRow done={vehicleCount > 0} title="Step 1: Add your first vehicle" subtitle="You need at least one vehicle before logging trips." to="/vehicles" cta="Add Vehicle" />
            <StepRow done={driverCount > 0} title="Step 2: Add a driver (optional)" subtitle="Assign trips and track per-driver performance." to="/drivers" cta="Add Driver" />
            <StepRow done={tripCount > 0} title="Step 3: Log your first trip" subtitle="Start tracking profit, fuel, tolls, and alerts." to="/quick-add" cta="Log Trip" />
          </div>
        </div>
      )}

      {/* ═══ Sticky Critical Alert ═══ */}
      {criticalCount > 0 && (
        <Link to="/fleet-health" className="sticky-alert flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 block hover:shadow-sm transition-shadow">
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangleIcon className="w-4 h-4 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-red-800">{criticalCount === 1 ? t('issueNeedsAttention') : t('issuesNeedAttention', { count: criticalCount })}</span>
            <span className="hidden sm:inline text-xs text-red-500 ml-2">
              {expiredDocs.length > 0 && `${expiredDocs.length} expired`}
              {expiredDocs.length > 0 && criticalAlerts.length > 0 && ' · '}
              {criticalAlerts.length > 0 && `${criticalAlerts.length} critical`}
            </span>
          </div>
          <span className="text-xs font-bold text-red-600">View &rsaquo;</span>
        </Link>
      )}

      {/* ═══ Row 1: Total Vehicles | Trips | Fleet Health ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* ── Total Vehicles Card ── */}
        {sections.fleet.loading ? <CardSkeleton /> : sections.fleet.error ? (
          <ErrorCard t={t} onRetry={fetchFleetData} />
        ) : vehicleCount === 0 && !showSetupWizard ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4">{t('totalVehicles')}</h3>
            <EmptyState icon={TruckIcon} message={t('noVehiclesYet')} cta={t('addFirstVehicle')} to="/vehicles" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4">{t('totalVehicles')}</h3>
            <div className="flex items-center gap-5">
              <div className="relative">
                <DonutChart value={vehicleCount} max={vehicleCount || 1} size={110} strokeWidth={12} color="#0d9488" label={t('navVehicles')} />
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                  <span className="text-xs text-slate-500">{t('activeLabel')}</span>
                  <span className="ml-auto text-sm font-bold text-slate-700">
                    <AnimatedNumber value={activeVehicles} />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-xs text-slate-500">{t('idleLabel')}</span>
                  <span className="ml-auto text-sm font-bold text-slate-700">
                    <AnimatedNumber value={idleVehicles} />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="text-xs text-slate-500">{t('driversLabel')}</span>
                  <span className="ml-auto text-sm font-bold text-slate-700">
                    <AnimatedNumber value={driverCount} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Trips Card ── */}
        {sections.trips.loading ? <CardSkeleton /> : sections.trips.error ? (
          <ErrorCard t={t} onRetry={fetchTripData} />
        ) : tripCount === 0 && vehicleCount > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3">{t('trips')}</h3>
            <EmptyState icon={RouteIcon} message={t('noTripsYet')} cta={t('logFirstTrip')} to="/quick-add" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3">{t('trips')}</h3>
            <div className="space-y-0.5">
              <StatDot color="bg-emerald-500" label={t('statTrips')} value={<AnimatedNumber value={tripCount} />} to="/trips" />
              <StatDot color="bg-teal-500" label={t('statRevenue')} value={<AnimatedNumber value={revenue} prefix="₹" format={(v) => Math.round(v).toLocaleString('en-IN')} />} to="/trips" />
              <StatDot color="bg-blue-500" label={t('profitMargin')} value={<><AnimatedNumber value={margin} />%</>} />
              <StatDot color="bg-amber-500" label={t('statProfit')} value={<AnimatedNumber value={fleetPnL.profit || 0} prefix="₹" format={(v) => Math.round(v).toLocaleString('en-IN')} />} />
            </div>
          </div>
        )}

        {/* ── Fleet Health Card ── */}
        {sections.health.loading ? <CardSkeleton /> : sections.health.error ? (
          <ErrorCard t={t} onRetry={fetchHealthData} />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4">{t('fleetHealthLabel')}</h3>
            <div className="flex items-center justify-around">
              <div className="text-center relative">
                <MiniDonut value={complianceScore} max={100} size={56} strokeWidth={6} color={complianceScore >= 70 ? '#0d9488' : complianceScore >= 40 ? '#f59e0b' : '#ef4444'} />
                <div className="absolute inset-0 flex items-center justify-center" style={{ width: 56, height: 56 }}>
                  <span className="text-xs font-bold text-slate-700"><AnimatedNumber value={complianceScore} /></span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1.5 font-medium">{t('scoreLabel')}</div>
              </div>
              <div className="text-center relative">
                <MiniDonut value={goodVehicles} max={vehicleCount || 1} size={56} strokeWidth={6} color="#10b981" />
                <div className="absolute inset-0 flex items-center justify-center" style={{ width: 56, height: 56 }}>
                  <span className="text-xs font-bold text-slate-700">{goodVehicles}</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1.5 font-medium">{t('goodLabel')}</div>
              </div>
              <div className="text-center relative">
                <MiniDonut value={coverageGaps} max={vehicleCount || 1} size={56} strokeWidth={6} color="#f59e0b" />
                <div className="absolute inset-0 flex items-center justify-center" style={{ width: 56, height: 56 }}>
                  <span className="text-xs font-bold text-slate-700">{coverageGaps}</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1.5 font-medium">{t('atRiskLabel')}</div>
              </div>
            </div>
            {/* Fuel Efficiency Stat */}
            {avgKmPerL != null && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FuelIcon className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-slate-500">{t('fuelEfficiency')}</span>
                </div>
                <span className="text-sm font-bold text-slate-700">{typeof avgKmPerL === 'number' ? avgKmPerL.toFixed(1) : avgKmPerL} {t('kmPerL')}</span>
              </div>
            )}
            <Link to="/fleet-health" className="mt-4 block text-center text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors">
              {t('viewDetails')}
            </Link>
          </div>
        )}
      </div>

      {/* ═══ Row 2: Top Vehicle + Weekly Activity | Renewals + Insurance ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── Top Vehicle + Weekly Activity ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          {/* Top Performer */}
          {topVehicle && (
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3">🏆 {t('topVehicle')}</h3>
              <div className="flex items-center gap-3 bg-emerald-50 rounded-xl px-3 py-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <TruckIcon className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-emerald-800 truncate">{safeStr(topVehicle.vehicleNumber) || safeStr(topVehicle.vehicle) || safeStr(topVehicle.name) || '—'}</div>
                  <div className="text-xs text-emerald-600">{t('revenue')}: {inr(topVehicle.revenue)} · {topVehicle.tripCount || topVehicle.trips || 0} {t('trips').toLowerCase()}</div>
                </div>
              </div>
            </div>
          )}

          {/* Weekly Activity Chart */}
          {weeklyTrips.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3">{t('weeklyActivity')}</h3>
              <WeeklyBarChart data={weeklyTrips} />
            </div>
          )}

          {/* If neither loads, show a simple renewals stat */}
          {!topVehicle && weeklyTrips.length === 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3">{t('renewalsAndInsurance')}</h3>
              <div className="space-y-0.5">
                <StatDot color="bg-red-500" label={t('expiredDocuments')} value={expiredDocs.length} to="/renewals" />
                <StatDot color="bg-amber-500" label={t('expiringSoon')} value={expiringDocs.length} to="/renewals" />
                <StatDot color="bg-blue-500" label={t('coverageGaps')} value={coverageGaps} to="/insurance" />
                <StatDot color="bg-emerald-500" label={t('alertsLabel')} value={alertList.length} to="/fleet-health" />
              </div>
            </div>
          )}
        </div>

        {/* ── Renewals & Insurance + Urgent Countdown ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">{t('renewalsAndInsurance')}</h3>
          <div className="space-y-0.5">
            <StatDot color="bg-red-500" label={t('expiredDocuments')} value={expiredDocs.length} to="/renewals" />
            <StatDot color="bg-amber-500" label={t('expiringSoon')} value={expiringDocs.length} to="/renewals" />
            <StatDot color="bg-blue-500" label={t('coverageGaps')} value={coverageGaps} to="/insurance" />
            <StatDot color="bg-emerald-500" label={t('alertsLabel')} value={alertList.length} to="/fleet-health" />
          </div>

          {/* ── Most Urgent Renewal Countdown ── */}
          {mostUrgentDoc && urgentDaysLeft != null && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">{t('mostUrgentRenewal')}</span>
              </div>
              <Link to="/renewals" className="flex items-center gap-3 bg-amber-50 rounded-xl px-3 py-2.5 hover:bg-amber-100 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <span className="text-lg font-black text-amber-700">{urgentDaysLeft}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-amber-800 truncate">
                    {safeStr(mostUrgentDoc.vehicleNumber) || safeStr(mostUrgentDoc.vehicle) || ''} {safeStr(mostUrgentDoc.type) || safeStr(mostUrgentDoc.name) || ''}
                  </div>
                  <div className="text-[11px] text-amber-600">
                    {urgentDaysLeft > 0
                      ? t('expiresInDays', { days: urgentDaysLeft })
                      : t('expiredDaysAgo', { days: Math.abs(urgentDaysLeft) })}
                  </div>
                </div>
                <span className="text-amber-500 group-hover:text-amber-700 text-xs font-bold transition-colors">{t('renew')} &rsaquo;</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Quick Actions (Horizontally scrollable on mobile) ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">{t('quickActions')}</h3>
        <div className="hidden md:grid grid-cols-3 gap-2.5">
          {quickActionItems(t).map(a => <QuickActionButton key={a.to} {...a} />)}
        </div>
        <div className="md:hidden scroll-snap-x flex gap-2.5 -mx-1 px-1 pb-1">
          {quickActionItems(t).map(a => <QuickActionButton key={a.to} {...a} mobile />)}
        </div>
      </div>

      {/* ═══ Revenue Overview ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-4">{t('revenueOverview')}</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: t('revenue'), value: revenue, color: 'bg-teal-500', key: 'rev' },
            { label: t('expensesLabel'), value: fleetPnL.expenses, color: 'bg-amber-500', key: 'exp' },
            { label: t('profit'), value: fleetPnL.profit, color: 'bg-emerald-500', key: 'pro' },
            { label: t('marginLabel'), value: margin, color: 'bg-blue-500', key: 'mar', isMar: true },
          ].map(s => (
            <div key={s.key} className="text-center">
              <div className={`h-1.5 ${s.color} rounded-full mb-3 mx-auto`} style={{ width: '60%' }} />
              <div className="text-sm sm:text-base font-bold text-slate-800">
                {s.isMar
                  ? <><AnimatedNumber value={s.value} />%</>
                  : <AnimatedNumber value={s.value || 0} prefix="₹" format={(v) => Math.round(v).toLocaleString('en-IN')} />
                }
              </div>
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Quick Action Items ────────────────────────────────── */

function quickActionItems(t) {
  return [
    { to: '/quick-add', icon: RouteIcon, label: t('navQuickAdd', { defaultValue: 'Log Trip' }), color: 'bg-teal-50 text-teal-600 border-teal-100' },
    { to: '/vehicles', icon: TruckIcon, label: t('actionVehicles', { defaultValue: 'Vehicles' }), color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { to: '/drivers', icon: UserIcon, label: t('navDrivers', { defaultValue: 'Drivers' }), color: 'bg-violet-50 text-violet-600 border-violet-100' },
    { to: '/ai-chat', icon: SparkleIcon, label: t('navAIChat', { defaultValue: 'AI Chat' }), color: 'bg-amber-50 text-amber-600 border-amber-100' },
    { to: '/documents', icon: RefreshIcon, label: t('navDocuments', { defaultValue: 'Documents' }), color: 'bg-rose-50 text-rose-600 border-rose-100' },
    { to: '/insurance', icon: ShieldIcon, label: t('navInsurance', { defaultValue: 'Insurance' }), color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  ]
}

function QuickActionButton({ to, icon: Icon, label, color, mobile }) {
  return (
    <Link to={to}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-[13px] font-medium transition-all hover:shadow-sm active:scale-[0.98] ${color} ${mobile ? 'min-w-[140px]' : ''}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  )
}

/* ── Setup Step Row ────────────────────────────────────── */

function StepRow({ done, title, subtitle, to, cta }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
        {done ? '✓' : '•'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
      <Link to={to} className="btn-secondary !py-1.5 !px-3 text-xs">
        {done ? 'View' : cta}
      </Link>
    </div>
  )
}
