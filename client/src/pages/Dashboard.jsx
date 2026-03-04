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
  moneyLost as moneyLostApi,
} from '../api'
import { useAuth } from '../App'
import { useLang } from '../context/LanguageContext'
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
const SETUP_WIZARD_DISMISS_KEY = 'fleetsure-setup-wizard-dismissed'

export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useLang()
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    try {
      setSetupDismissed(localStorage.getItem(SETUP_WIZARD_DISMISS_KEY) === '1')
    } catch { }
  }, [])

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
      moneyLostApi.get().then(setMoneyData).catch(() => { })
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
  const showSetupWizard = vehicleCount === 0 && !setupDismissed

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
          {user?.name ? `${t('dashboardHi')}, ${user.name.split(' ')[0]}` : t('navHome', { defaultValue: 'Dashboard' })}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {user?.tenantName && <span className="font-medium text-slate-600">{user.tenantName}</span>}
          {user?.tenantName && ' — '}
          {t('dashboardFleetOverview')}
        </p>
      </div>

      {/* Money Lost Card */}
      {moneyData && moneyData.totalLost > 0 && (
        <div className="bg-white rounded-2xl border border-red-200 overflow-hidden">
          <div className="px-5 py-4 bg-red-50/60">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-red-500 uppercase tracking-wider">{moneyData.month} — {t('avoidableLosses')}</div>
                <div className="text-2xl sm:text-3xl font-black text-red-700 mt-1">{inr(moneyData.totalLost)}</div>
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
                  <button
                    type="button"
                    onClick={() => setMoneyExpanded(isOpen ? null : key)}
                    className="w-full px-5 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors text-left"
                  >
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

      {showSetupWizard && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Set up your fleet in 3 steps</h2>
              <p className="text-sm text-slate-500 mt-1">Complete these once, then daily work becomes one-tap.</p>
            </div>
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-slate-600"
              onClick={() => {
                setSetupDismissed(true)
                try { localStorage.setItem(SETUP_WIZARD_DISMISS_KEY, '1') } catch { }
              }}
            >
              Skip
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            <StepRow
              done={vehicleCount > 0}
              title="Step 1: Add your first vehicle"
              subtitle="You need at least one vehicle before logging trips."
              to="/vehicles"
              cta="Add Vehicle"
            />
            <StepRow
              done={driverCount > 0}
              title="Step 2: Add a driver (optional)"
              subtitle="Assign trips and track per-driver performance."
              to="/drivers"
              cta="Add Driver"
            />
            <StepRow
              done={tripCount > 0}
              title="Step 3: Log your first trip"
              subtitle="Start tracking profit, fuel, tolls, and alerts."
              to="/quick-add"
              cta="Log Trip"
            />
          </div>
        </div>
      )}

      {/* Critical Alert */}
      {criticalCount > 0 && (
        <Link to="/fleet-health" className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 block hover:shadow-sm transition-shadow">
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

      {/* Row 1: Total Vehicles | Trips | Vehicle Condition */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Total Vehicles - Donut */}
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
                <span className="ml-auto text-sm font-bold text-slate-700">{activeVehicles}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-xs text-slate-500">{t('idleLabel')}</span>
                <span className="ml-auto text-sm font-bold text-slate-700">{idleVehicles}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="text-xs text-slate-500">{t('driversLabel')}</span>
                <span className="ml-auto text-sm font-bold text-slate-700">{driverCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trips */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">{t('trips')}</h3>
          <div className="space-y-0.5">
            <StatDot color="bg-emerald-500" label={t('statTrips')} value={tripCount} to="/trips" />
            <StatDot color="bg-teal-500" label={t('statRevenue')} value={inr(revenue)} to="/trips" />
            <StatDot color="bg-blue-500" label={t('profitMargin')} value={`${margin}%`} />
            <StatDot color="bg-amber-500" label={t('statProfit')} value={inr(fleetPnL.profit)} />
          </div>
        </div>

        {/* Vehicle Condition / Fleet Health */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">{t('fleetHealthLabel')}</h3>
          <div className="flex items-center justify-around">
            <div className="text-center relative">
              <MiniDonut value={complianceScore} max={100} size={56} strokeWidth={6} color={complianceScore >= 70 ? '#0d9488' : complianceScore >= 40 ? '#f59e0b' : '#ef4444'} />
              <div className="absolute inset-0 flex items-center justify-center" style={{ width: 56, height: 56 }}>
                <span className="text-xs font-bold text-slate-700">{complianceScore}</span>
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
          <Link to="/fleet-health" className="mt-4 block text-center text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors">
            {t('viewDetails')}
          </Link>
        </div>
      </div>

      {/* Row 2: Renewals + Insurance | Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Renewals & Insurance */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">{t('renewalsAndInsurance')}</h3>
          <div className="space-y-0.5">
            <StatDot color="bg-red-500" label={t('expiredDocuments')} value={expiredDocs.length} to="/renewals" />
            <StatDot color="bg-amber-500" label={t('expiringSoon')} value={expiringDocs.length} to="/renewals" />
            <StatDot color="bg-blue-500" label={t('coverageGaps')} value={coverageGaps} to="/insurance" />
            <StatDot color="bg-emerald-500" label={t('alertsLabel')} value={alertList.length} to="/fleet-health" />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">{t('quickActions')}</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { to: '/quick-add', icon: RouteIcon, label: t('navQuickAdd', { defaultValue: 'Log Trip' }), color: 'bg-teal-50 text-teal-600 border-teal-100' },
              { to: '/vehicles', icon: TruckIcon, label: t('actionVehicles', { defaultValue: 'Vehicles' }), color: 'bg-blue-50 text-blue-600 border-blue-100' },
              { to: '/drivers', icon: UserIcon, label: t('navDrivers', { defaultValue: 'Drivers' }), color: 'bg-violet-50 text-violet-600 border-violet-100' },
              { to: '/ai-chat', icon: SparkleIcon, label: t('navAIChat', { defaultValue: 'AI Chat' }), color: 'bg-amber-50 text-amber-600 border-amber-100' },
              { to: '/documents', icon: RefreshIcon, label: t('navDocuments', { defaultValue: 'Documents' }), color: 'bg-rose-50 text-rose-600 border-rose-100' },
              { to: '/insurance', icon: ShieldIcon, label: t('navInsurance', { defaultValue: 'Insurance' }), color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
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
        <h3 className="text-sm font-bold text-slate-700 mb-4">{t('revenueOverview')}</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: t('revenue'), value: inr(revenue), color: 'bg-teal-500', key: 'rev' },
            { label: t('expensesLabel'), value: inr(fleetPnL.expenses), color: 'bg-amber-500', key: 'exp' },
            { label: t('profit'), value: inr(fleetPnL.profit), color: 'bg-emerald-500', key: 'pro' },
            { label: t('marginLabel'), value: `${margin}%`, color: 'bg-blue-500', key: 'mar' },
          ].map(s => (
            <div key={s.key} className="text-center">
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
