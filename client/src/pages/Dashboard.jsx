import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts'
import { vehicles as vehiclesApi, trips as tripsApi, alerts as alertsApi, documents as documentsApi, fleetHealth as fleetHealthApi, tripStats as tripStatsApi, insurance as insuranceApi } from '../api'
import { useAuth } from '../App'
import PageHeader from '../components/PageHeader'
import KPICard from '../components/KPICard'
import HealthScore from '../components/HealthScore'
import StatusDot from '../components/StatusDot'
import { AlertTriangleIcon } from '../components/Icons'

// ── Penalty estimates per violation type ─────────────────────────────────────
const PENALTY_ESTIMATES = {
  insurance: 5000,  // ₹5,000 per expired insurance
  FC: 2000,         // ₹2,000 per expired fitness certificate
  PUC: 1000,        // ₹1,000 per expired PUC
  permit: 5000,     // ₹5,000 per expired permit
  serviceOverdue: 3000, // ₹3,000 avg breakdown cost per overdue vehicle
  insuranceExpiry: 2000, // ₹2,000 risk per near-expiry policy
}

// ── Sort priority for action items ──────────────────────────────────────────
const DOC_PRIORITY = { insurance: 0, PUC: 1, FC: 2, permit: 3 }

// ── Welcome Modal (shown once for new users) ────────────────────────────────
function WelcomeModal({ userName, onDismiss }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger entrance animation after mount
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(onDismiss, 200) // wait for exit animation
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
        {/* Top accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-500" />

        <div className="px-7 pt-7 pb-6">
          {/* Logo */}
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-2xl mb-5 shadow-lg shadow-blue-500/20">
            F
          </div>

          {/* Headline */}
          <h2 className="text-2xl font-bold text-slate-900 leading-tight">
            Save Smart. Manage Smart.
          </h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Welcome aboard{userName ? `, ${userName}` : ''}! You're now on <span className="font-semibold text-slate-700">Fleetsure</span> — your fleet's compliance and management expert.
          </p>

          {/* Feature highlights */}
          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Compliance Tracking</div>
                <div className="text-xs text-slate-500 mt-0.5">Never miss a renewal or document expiry. Stay penalty-free.</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Trip Profitability</div>
                <div className="text-xs text-slate-500 mt-0.5">Know exactly what each trip earns. Track fuel, toll, and margins.</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">AI Insights</div>
                <div className="text-xs text-slate-500 mt-0.5">Get smart recommendations from your fleet data to cut costs.</div>
              </div>
            </div>
          </div>

          {/* CTA */}
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

export default function Dashboard() {
  const { user } = useAuth()
  const [health, setHealth] = useState(null)
  const [monthlyData, setMonthlyData] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [vehicleList, setVehicleList] = useState([])
  const [alertList, setAlertList] = useState([])
  const [docList, setDocList] = useState([])
  const [insuranceData, setInsuranceData] = useState(null)
  const [recentTrips, setRecentTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAllActions, setShowAllActions] = useState(false)

  // ── Welcome modal (show once per user) ──────────────────────────────────────
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
      tripStatsApi.monthly(),
      tripsApi.analytics(),
      vehiclesApi.list(),
      alertsApi.list(),
      documentsApi.list(),
      tripsApi.list(),
      insuranceApi.optimizer(),
    ]).then(([h, m, a, v, al, docs, tr, ins]) => {
      if (h.status === 'fulfilled') setHealth(h.value)
      if (m.status === 'fulfilled') setMonthlyData(m.value)
      if (a.status === 'fulfilled') setAnalytics(a.value)
      if (v.status === 'fulfilled') setVehicleList(v.value)
      if (al.status === 'fulfilled') {
        const arr = al.value?.alerts || al.value || []
        setAlertList(Array.isArray(arr) ? arr.filter(x => !x.resolved) : [])
      }
      if (docs.status === 'fulfilled') setDocList(Array.isArray(docs.value) ? docs.value : [])
      if (tr.status === 'fulfilled') setRecentTrips(tr.value.slice(0, 5))
      if (ins.status === 'fulfilled') setInsuranceData(ins.value)
      setLoading(false)
    })
  }, [])

  // ── Derived data ──────────────────────────────────────────────────────────
  const fleetPnL = analytics?.fleetPnL || {}
  const routeProfit = (analytics?.routeProfit || []).slice(0, 5)

  const overdueForService = (health?.maintenance?.totalVehicles || 0) - (health?.maintenance?.recentlyServiced || 0)
  const servicedCount = health?.maintenance?.recentlyServiced || 0
  const totalVehicles = health?.maintenance?.totalVehicles || vehicleList.length

  // Compliance risk label
  const complianceScore = health?.overall || 0
  const riskLabel = complianceScore >= 80 ? 'Safe' : complianceScore >= 50 ? 'Moderate Risk' : 'High Risk'
  const riskColor = complianceScore >= 80 ? 'text-emerald-600' : complianceScore >= 50 ? 'text-amber-600' : 'text-red-600'

  // ── Penalty exposure calculation ──────────────────────────────────────────
  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const docTypeLabel = { insurance: 'Insurance', FC: 'Fitness Certificate', PUC: 'PUC', permit: 'Permit' }

  const expiredDocs = docList.filter(d => new Date(d.expiryDate) <= now)
  const expiringDocs = docList.filter(d => {
    const exp = new Date(d.expiryDate)
    return exp > now && exp <= thirtyDaysFromNow
  })

  let penaltyExposure = 0
  expiredDocs.forEach(d => {
    penaltyExposure += PENALTY_ESTIMATES[d.documentType] || 2000
  })
  penaltyExposure += Math.max(0, overdueForService) * PENALTY_ESTIMATES.serviceOverdue
  const expiringInsurance = expiringDocs.filter(d => d.documentType === 'insurance').length
  penaltyExposure += expiringInsurance * PENALTY_ESTIMATES.insuranceExpiry

  // ── Build action items from documents + alerts ────────────────────────────
  const actionItems = []
  expiredDocs.forEach(d => {
    actionItems.push({
      severity: 'high',
      vehicle: d.vehicle?.vehicleNumber || '-',
      issue: `${docTypeLabel[d.documentType] || d.documentType} expired`,
      deadline: new Date(d.expiryDate).toLocaleDateString('en-IN'),
      link: '/renewals',
      _docType: d.documentType,
      _sortGroup: 0, // critical
    })
  })
  expiringDocs.forEach(d => {
    actionItems.push({
      severity: 'medium',
      vehicle: d.vehicle?.vehicleNumber || '-',
      issue: `${docTypeLabel[d.documentType] || d.documentType} expiring soon`,
      deadline: new Date(d.expiryDate).toLocaleDateString('en-IN'),
      link: '/renewals',
      _docType: d.documentType,
      _sortGroup: 1, // high priority
    })
  })
  alertList.filter(a => a.severity === 'high').forEach(a => {
    actionItems.push({
      severity: 'high',
      vehicle: a.vehicle?.vehicleNumber || '-',
      issue: a.message,
      deadline: '-',
      link: '/fleet-health',
      _docType: 'zzz',
      _sortGroup: 0,
    })
  })
  if (analytics?.pendingReconciliation > 0) {
    actionItems.push({
      severity: 'medium',
      vehicle: 'Fleet',
      issue: `${analytics.pendingReconciliation} trips pending reconciliation`,
      deadline: '-',
      link: '/reconcile',
      _docType: 'zzz',
      _sortGroup: 1,
    })
  }

  // Sort: critical first, then by doc type priority
  actionItems.sort((a, b) => {
    if (a._sortGroup !== b._sortGroup) return a._sortGroup - b._sortGroup
    return (DOC_PRIORITY[a._docType] ?? 99) - (DOC_PRIORITY[b._docType] ?? 99)
  })

  const totalActionCount = actionItems.length
  const criticalItems = actionItems.filter(i => i._sortGroup === 0).slice(0, 5)
  const highItems = actionItems.filter(i => i._sortGroup === 1).slice(0, 5)
  const visibleItems = showAllActions ? actionItems : [...criticalItems, ...highItems]

  // ── Impact stats (last 30 days) ───────────────────────────────────────────
  const validDocs = docList.filter(d => new Date(d.expiryDate) > now).length
  const impactRenewals = Math.min(validDocs, 6) // docs currently valid = renewed on time
  const impactPenaltiesAvoided = Math.min(impactRenewals, 3)
  const impactSavings = insuranceData?.kpis?.totalSavings || 0
  const impactServicesCompleted = servicedCount

  // Maintenance pie data
  const maintPieData = [
    { name: 'Serviced', value: servicedCount },
    { name: 'Overdue', value: Math.max(0, overdueForService) },
  ].filter(d => d.value > 0)

  const shortLoc = (s) => { const p = (s || '').split(' - '); return p.length > 1 ? p.slice(1).join(' - ').trim() : s || '-' }
  const inr = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '-'

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded w-64" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-slate-200 rounded-lg" />)}
        </div>
        <div className="h-64 bg-slate-200 rounded-lg" />
      </div>
    )
  }

  return (
    <div>
      {/* ── Welcome Modal ── */}
      {showWelcome && <WelcomeModal userName={user?.name} onDismiss={dismissWelcome} />}

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1: Fleet Compliance Command Center
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="mb-2">
        <h1 className="text-xl font-bold text-slate-900">
          {user?.name ? `Welcome back, ${user.name}` : 'Fleet Compliance Command Center'}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {user?.tenantName && <span className="font-medium text-slate-700">{user.tenantName}</span>}
          {user?.tenantName && <span className="mx-1.5 text-slate-300">|</span>}
          Prevent compliance failures and operational downtime.
        </p>
      </div>

      {/* ── Impact Banner ──────────────────────────────────────────────────── */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3.5 mb-6">
        <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">Last 30 Days Impact</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-sm text-emerald-900 font-medium">{impactRenewals} documents renewed on time</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-sm text-emerald-900 font-medium">{impactPenaltiesAvoided} penalties avoided</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-sm text-emerald-900 font-medium">{impactSavings > 0 ? inr(impactSavings) : '—'} saved via policy comparison</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-sm text-emerald-900 font-medium">{impactServicesCompleted} services completed before breakdown</span>
          </div>
        </div>
      </div>

      {/* ── Compliance Score + KPIs ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {/* Compliance Risk Score */}
        <div className="lg:col-span-1 card p-4 flex flex-col items-center justify-center">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Compliance Risk Score</div>
          <HealthScore
            score={complianceScore}
            size={120}
            segments={[
              { label: 'Documents', value: health?.documents?.score || 0 },
              { label: 'Compliance', value: health?.alerts?.score || 0 },
              { label: 'Maintenance', value: health?.maintenance?.score || 0 },
              { label: 'Tyres', value: health?.tyres?.score || 0 },
            ]}
          />
          <div className={`mt-2 text-sm font-bold ${riskColor}`}>{riskLabel}</div>
          {/* Penalty Exposure */}
          {penaltyExposure > 0 && (
            <div className={`mt-1.5 text-xs font-bold ${complianceScore < 50 ? 'text-red-600' : 'text-amber-600'}`}>
              Estimated Penalty Exposure: {inr(penaltyExposure)}
            </div>
          )}
        </div>

        {/* Compliance KPIs */}
        <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Expired Documents"
            value={health?.documents?.expired || 0}
            color="red"
            onClick={() => window.location.href = '/fleet-health'}
          />
          <KPICard
            label="Expiring in 30 Days"
            value={health?.documents?.expiringSoon || 0}
            color="amber"
            onClick={() => window.location.href = '/fleet-health'}
          />
          <KPICard
            label="Service Overdue"
            value={Math.max(0, overdueForService)}
            color={overdueForService > 0 ? 'red' : 'emerald'}
          />
          <KPICard
            label="Open Alerts"
            value={alertList.length}
            color={alertList.length > 0 ? 'red' : 'emerald'}
            onClick={() => window.location.href = '/fleet-health'}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2: Immediate Action Required
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="card overflow-hidden mb-6">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold text-slate-800">Immediate Action Required</h3>
            {totalActionCount > 0 && (
              <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full ml-1">
                {criticalItems.length} critical
              </span>
            )}
          </div>
          <Link to="/fleet-health" className="text-xs text-blue-600 hover:text-blue-800 font-medium">View all</Link>
        </div>

        {visibleItems.length > 0 ? (
          <>
            <table className="w-full">
              <thead>
                <tr className="text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="text-left px-5 py-2.5 font-semibold">Vehicle</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Issue</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Deadline</th>
                  <th className="text-right px-5 py-2.5 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item, i) => (
                  <tr key={i} className={`border-b border-slate-50 ${
                    item.severity === 'high' ? 'bg-red-50/50' : item.severity === 'medium' ? 'bg-amber-50/30' : ''
                  }`}>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs font-bold text-slate-800">{item.vehicle}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <StatusDot status={item.severity} />
                        <span className="text-sm text-slate-700">{item.issue}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-medium ${item.severity === 'high' ? 'text-red-600' : 'text-slate-500'}`}>
                        {item.deadline}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link to={item.link}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          item.severity === 'high'
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-amber-500 text-white hover:bg-amber-600'
                        }`}
                      >
                        Resolve Now
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* View All / Collapse toggle */}
            {totalActionCount > 10 && (
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-center">
                <button
                  onClick={() => setShowAllActions(!showAllActions)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800"
                >
                  {showAllActions ? 'Show Top 10 Only' : `View All ${totalActionCount} Issues`}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="py-8 text-center">
            <div className="text-3xl mb-2">&#10003;</div>
            <div className="text-sm font-semibold text-emerald-600">All Clear</div>
            <div className="text-xs text-slate-400">No compliance issues found. Fleet is fully operational.</div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3: Preventive Maintenance & Breakdown Risk
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Preventive Maintenance & Breakdown Risk</h2>
        {overdueForService > 0 && (
          <p className="text-xs font-bold text-red-600 mb-3">
            {Math.max(0, overdueForService)} vehicle{overdueForService !== 1 ? 's' : ''} at risk of unexpected breakdown.
          </p>
        )}
        {overdueForService <= 0 && (
          <p className="text-xs text-emerald-600 font-medium mb-3">All vehicles serviced on schedule.</p>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Service Status Pie */}
          <div className="chart-card">
            <h3>Service Status (Last 30 Days)</h3>
            {maintPieData.length > 0 ? (
              <div className="flex items-center justify-center">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={maintPieData}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={72}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="ml-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-emerald-500" />
                    <span className="text-sm text-slate-600">Serviced ({servicedCount})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-red-500" />
                    <span className="text-sm text-slate-600">Overdue ({Math.max(0, overdueForService)})</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-2">{totalVehicles} total vehicles</div>
                </div>
              </div>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-sm text-slate-400">No maintenance data</div>
            )}
          </div>

          {/* Maintenance Spend Trend */}
          <div className="chart-card">
            <h3>Maintenance Spend Trend</h3>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorMaint" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} />
                  <Area type="monotone" dataKey="expenses" stroke="#f59e0b" strokeWidth={2} fill="url(#colorMaint)" name="Maintenance" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-sm text-slate-400">No data yet</div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4: Insurance & Coverage Status
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Insurance & Coverage Status</h2>
        <p className="text-xs text-slate-500 mb-3">Prevent policy lapses and coverage gaps.</p>
        <div className="card p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-red-50 rounded-lg p-3 text-center group relative">
              <div className="text-2xl font-extrabold text-red-700">{insuranceData?.kpis?.coverageGapCount || 0}</div>
              <div className="text-xs text-red-600 font-medium">Coverage Gaps</div>
              <div className="text-[10px] text-red-400 mt-0.5">Vehicles underinsured or missing key add-ons</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-extrabold text-amber-700">{health?.documents?.expiringSoon || 0}</div>
              <div className="text-xs text-amber-600 font-medium">Policies Expiring</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-extrabold text-emerald-700">{(health?.documents?.valid || 0) > 0 ? health.documents.valid : '-'}</div>
              <div className="text-xs text-emerald-600 font-medium">Active Policies</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-extrabold text-blue-700">{insuranceData?.kpis?.totalSavings > 0 ? inr(insuranceData.kpis.totalSavings) : '-'}</div>
              <div className="text-xs text-blue-600 font-medium">Savings via Fleetsure</div>
              <div className="text-[10px] text-blue-400 mt-0.5">Compared against market quotes</div>
            </div>
          </div>
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500">Renew policies before expiry to avoid compliance penalties.</p>
            <div className="flex gap-2">
              <Link to="/insurance" className="text-xs font-bold text-blue-600 hover:text-blue-800">Insurance Optimizer</Link>
              <span className="text-slate-300">|</span>
              <Link to="/renewals" className="text-xs font-bold text-blue-600 hover:text-blue-800">Compare Quotes</Link>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 5: Performance Snapshot (Secondary)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Performance Snapshot</h2>
          <Link to="/quick-add" className="btn-primary flex items-center gap-1.5 text-xs">+ Log Trip</Link>
        </div>

        {/* Muted KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-base font-semibold text-slate-500">{inr(fleetPnL.revenue)}</div>
            <div className="text-[10px] text-slate-400 uppercase">Revenue</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-base font-semibold text-slate-500">{inr(fleetPnL.profit)}</div>
            <div className="text-[10px] text-slate-400 uppercase">Profit</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-base font-semibold text-slate-500">{fleetPnL.margin || 0}%</div>
            <div className="text-[10px] text-slate-400 uppercase">Fleet Margin</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-base font-semibold text-slate-500">{fleetPnL.tripCount || 0}</div>
            <div className="text-[10px] text-slate-400 uppercase">Total Trips</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Revenue vs Expenses (smaller, muted) */}
          <div className="chart-card opacity-80">
            <h3 className="text-slate-400 text-xs">Revenue vs Expenses</h3>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorRevMuted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.08} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpMuted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#cbd5e1" stopOpacity={0.08} />
                      <stop offset="95%" stopColor="#cbd5e1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#cbd5e1' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#cbd5e1' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} />
                  <Area type="monotone" dataKey="revenue" stroke="#94a3b8" strokeWidth={1} fill="url(#colorRevMuted)" name="Revenue" />
                  <Area type="monotone" dataKey="expenses" stroke="#cbd5e1" strokeWidth={1} fill="url(#colorExpMuted)" name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[150px] flex items-center justify-center text-sm text-slate-300">No data yet</div>
            )}
          </div>

          {/* Top Routes */}
          <div className="chart-card opacity-80">
            <h3 className="text-slate-400 text-xs">Top Routes by Profit</h3>
            {routeProfit.length > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={routeProfit} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#cbd5e1' }} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="route" tick={{ fontSize: 9, fill: '#94a3b8' }} width={80} />
                  <Tooltip formatter={v => `${v}%`} />
                  <Bar dataKey="margin" fill="#cbd5e1" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[150px] flex items-center justify-center text-sm text-slate-300">No route data yet</div>
            )}
          </div>
        </div>

        {/* Recent Trips */}
        <div className="card overflow-hidden opacity-90">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <h3 className="text-xs font-medium text-slate-400">Recent Trips</h3>
            <Link to="/trips" className="text-xs text-blue-600 hover:text-blue-800 font-medium">View all</Link>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Route</th>
                <th>Freight</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {recentTrips.map(trip => {
                const cost = (trip.fuelExpense || 0) + (trip.toll || 0) + (trip.cashExpense || 0)
                const profit = (trip.freightAmount || 0) - cost
                return (
                  <tr key={trip.id}>
                    <td className="font-mono text-xs">{trip.vehicle?.vehicleNumber || '-'}</td>
                    <td className="text-xs">{shortLoc(trip.loadingLocation)} → {shortLoc(trip.destination)}</td>
                    <td className="text-xs">{trip.freightAmount ? inr(trip.freightAmount) : <span className="badge badge-pending">Pending</span>}</td>
                    <td className={`text-xs font-medium ${profit > 0 ? 'text-emerald-600' : profit < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {trip.freightAmount ? inr(profit) : '-'}
                    </td>
                  </tr>
                )
              })}
              {recentTrips.length === 0 && (
                <tr><td colSpan={4} className="text-center text-slate-400 py-6">No trips yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
