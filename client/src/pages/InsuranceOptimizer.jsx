import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { insurance } from '../api'
import PageHeader from '../components/PageHeader'
import KPICard from '../components/KPICard'

const INR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

export default function InsuranceOptimizer() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [expandedVehicle, setExpandedVehicle] = useState(null)
  const [expandedClaim, setExpandedClaim] = useState(false)

  useEffect(() => {
    insurance.optimizer()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-slate-200 rounded w-64" />
      <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-200 rounded-lg" />)}</div>
      <div className="h-64 bg-slate-200 rounded-lg" />
    </div>
  )

  if (!data) return <div className="text-center py-12 text-slate-500">Unable to load insurance data</div>

  const { kpis, vehicleSummaries, savingsPerVehicle, recommendations, policyTypes, addOns, ncbSlabs, claimProcess } = data
  const tabs = [
    { key: 'overview', label: 'Coverage Overview' },
    { key: 'savings', label: 'Savings Tracker' },
    { key: 'ncb', label: 'NCB Tracker' },
    { key: 'recommendations', label: 'Smart Insights' },
    { key: 'claims', label: 'How to Claim' },
  ]

  return (
    <div>
      <PageHeader
        title="Insurance Optimizer"
        subtitle={`${kpis.vehicleCount} vehicles in fleet`}
        breadcrumbs={[{ label: 'Insurance' }]}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KPICard label="Fleet Insurance Spend" value={kpis.totalFleetInsuranceSpend > 0 ? INR(kpis.totalFleetInsuranceSpend) : '-'} color="blue" />
        <KPICard label="Total Savings" value={kpis.totalSavings > 0 ? INR(kpis.totalSavings) : '-'} color="emerald" />
        <KPICard label="NCB Fleet Value" value={kpis.ncbFleetValue > 0 ? `${INR(kpis.ncbFleetValue)}/yr` : '-'} color="violet" />
        <KPICard label="Coverage Gaps" value={kpis.coverageGapCount} color={kpis.coverageGapCount > 0 ? 'red' : 'emerald'} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === t.key ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <CoverageOverview vehicles={vehicleSummaries} policyTypes={policyTypes} addOns={addOns} expanded={expandedVehicle} onExpand={setExpandedVehicle} />}
      {activeTab === 'savings' && <SavingsTracker savings={savingsPerVehicle} kpis={kpis} />}
      {activeTab === 'ncb' && <NcbTracker vehicles={vehicleSummaries} slabs={ncbSlabs} />}
      {activeTab === 'recommendations' && <SmartRecommendations recommendations={recommendations} navigate={navigate} />}
      {activeTab === 'claims' && <ClaimGuide process={claimProcess} expanded={expandedClaim} onExpand={setExpandedClaim} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION A: Coverage Overview
// ═══════════════════════════════════════════════════════════════════════════════

function CoverageOverview({ vehicles, policyTypes, addOns, expanded, onExpand }) {
  const statusColors = {
    good: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    gap: 'bg-orange-50 border-orange-200 text-orange-700',
    expired: 'bg-red-50 border-red-200 text-red-700',
  }
  const statusLabels = {
    good: 'Well Covered',
    warning: 'Expiring Soon',
    gap: 'Coverage Gap',
    expired: 'Expired',
  }

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="card p-4 flex flex-wrap gap-4">
        {['good', 'warning', 'gap', 'expired'].map(s => {
          const count = vehicles.filter(v => v.coverageStatus === s).length
          if (count === 0) return null
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${s === 'good' ? 'bg-emerald-500' : s === 'warning' ? 'bg-amber-500' : s === 'gap' ? 'bg-orange-500' : 'bg-red-500'}`} />
              <span className="text-sm text-slate-600">{statusLabels[s]}: <strong>{count}</strong></span>
            </div>
          )
        })}
      </div>

      {/* Vehicle cards */}
      {vehicles.map(v => {
        const isExpanded = expanded === v.id
        const pt = policyTypes[v.policyType] || policyTypes.comprehensive
        return (
          <div key={v.id} className={`card border overflow-hidden ${statusColors[v.coverageStatus]}`}>
            <button className="w-full text-left p-4 flex items-center gap-4" onClick={() => onExpand(isExpanded ? null : v.id)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm text-slate-900">{v.vehicleNumber}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    v.coverageStatus === 'good' ? 'bg-emerald-100 text-emerald-700' :
                    v.coverageStatus === 'warning' ? 'bg-amber-100 text-amber-700' :
                    v.coverageStatus === 'gap' ? 'bg-orange-100 text-orange-700' :
                    'bg-red-100 text-red-700'
                  }`}>{statusLabels[v.coverageStatus]}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{pt.label}</span>
                  <span>NCB: {v.ncbPercentage}%</span>
                  {v.daysUntilExpiry > 0 && <span>{v.daysUntilExpiry} days left</span>}
                  {v.daysUntilExpiry <= 0 && <span className="text-red-600 font-semibold">Expired {Math.abs(v.daysUntilExpiry)} days ago</span>}
                </div>
              </div>
              <svg className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 border-t border-slate-100 bg-white">
                {/* Covered Risks Grid */}
                <div className="mt-3 mb-4">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">What's Covered</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {v.coveredRisks.map(risk => (
                      <div key={risk.key} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                        risk.covered ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400 line-through'
                      }`}>
                        <span>{risk.icon}</span>
                        <span>{risk.label}</span>
                        <span className="ml-auto">{risk.covered ? '✓' : '✗'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vehicle Stats */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-[10px] text-slate-400 uppercase">Annual Maintenance</div>
                    <div className="text-sm font-bold text-slate-900">{INR(v.maintenanceCost)}</div>
                    <div className="text-[10px] text-slate-400">{v.maintenanceCount} events</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-[10px] text-slate-400 uppercase">Monthly KM</div>
                    <div className="text-sm font-bold text-slate-900">{v.monthlyKm.toLocaleString('en-IN')}</div>
                    <div className="text-[10px] text-slate-400">estimated</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-[10px] text-slate-400 uppercase">Previous Insurer</div>
                    <div className="text-sm font-bold text-slate-900">{v.previousInsurer || '-'}</div>
                    <div className="text-[10px] text-slate-400">last renewal</div>
                  </div>
                </div>

                {/* Best For note */}
                <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                  <strong>Tip:</strong> {pt.bestFor}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION B: Savings Tracker
// ═══════════════════════════════════════════════════════════════════════════════

function SavingsTracker({ savings, kpis }) {
  if (savings.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="text-4xl mb-3">💡</div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">No Savings Data Yet</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Complete insurance renewals through Fleetsure to see how much you're saving by comparing quotes from multiple insurers.
        </p>
      </div>
    )
  }

  const chartData = savings.map(s => ({
    vehicle: s.vehicleNumber.replace('MP04HE', ''),
    previous: s.previousEstimate,
    selected: s.selectedAmount,
    savings: s.savings,
  }))

  return (
    <div className="space-y-4">
      {/* Savings headline */}
      <div className="card p-6 text-center bg-gradient-to-r from-emerald-50 to-blue-50 border-emerald-200">
        <div className="text-sm text-emerald-600 font-medium mb-1">Total Savings Through Fleetsure</div>
        <div className="text-4xl font-extrabold text-emerald-700 mb-2">{INR(kpis.totalSavings)}</div>
        <div className="text-xs text-slate-500">across {savings.length} renewals by comparing {savings.length * 3}+ quotes</div>
      </div>

      {/* Chart */}
      <div className="chart-card">
        <h3>Previous Premium vs Best Quote Found</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="vehicle" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={v => INR(v)} />
            <Bar dataKey="previous" fill="#f87171" name="Market/Previous" radius={[4, 4, 0, 0]} barSize={24} />
            <Bar dataKey="selected" fill="#22c55e" name="Fleetsure Quote" radius={[4, 4, 0, 0]} barSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per vehicle breakdown */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Savings Breakdown</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {savings.map((s, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900">{s.vehicleNumber}</div>
                <div className="text-xs text-slate-400">{s.previousInsurer} → {s.selectedInsurer}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400 line-through">{INR(s.previousEstimate)}</div>
                <div className="text-sm font-bold text-emerald-600">{INR(s.selectedAmount)}</div>
              </div>
              <div className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full">
                Save {s.savingsPercent}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION C: NCB Tracker
// ═══════════════════════════════════════════════════════════════════════════════

function NcbTracker({ vehicles, slabs }) {
  return (
    <div className="space-y-4">
      {/* NCB Ladder */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">NCB Progression Ladder</h3>
        <div className="flex items-center gap-0 mb-6">
          {slabs.map((s, i) => (
            <div key={s.year} className="flex-1 relative">
              <div className={`h-2 ${i === 0 ? 'rounded-l-full' : ''} ${i === slabs.length - 1 ? 'rounded-r-full' : ''} ${
                i <= 3 ? 'bg-gradient-to-r from-blue-400 to-blue-600' : 'bg-gradient-to-r from-emerald-400 to-emerald-600'
              }`} />
              <div className="text-center mt-2">
                <div className="text-lg font-bold text-slate-900">{s.percentage}%</div>
                <div className="text-[10px] text-slate-400">Year {s.year}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
          <strong>How NCB works:</strong> Every claim-free year, your OD premium discount increases. At 50%, you save half your Own Damage premium. One claim resets it to 0%.
        </div>
      </div>

      {/* Per vehicle NCB */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Vehicle NCB Status</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {vehicles.map(v => {
            const slab = slabs.find(s => s.percentage === v.ncbPercentage) || slabs[0]
            const pct = v.ncbPercentage || 0
            const nextPct = v.nextNcb?.next || 20
            const isMax = v.nextNcb?.isMax

            return (
              <div key={v.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-medium text-slate-900">{v.vehicleNumber}</span>
                    <span className="text-xs text-slate-400 ml-2">{v.vehicleType}</span>
                  </div>
                  <span className={`text-sm font-bold ${pct >= 35 ? 'text-emerald-600' : pct >= 20 ? 'text-blue-600' : 'text-slate-500'}`}>
                    {pct}% NCB
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                  <div className={`h-full rounded-full transition-all ${pct >= 35 ? 'bg-emerald-500' : pct >= 20 ? 'bg-blue-500' : 'bg-slate-300'}`}
                    style={{ width: `${(pct / 50) * 100}%` }} />
                </div>
                <div className="text-xs text-slate-400">
                  {isMax
                    ? '🏆 Maximum NCB reached!'
                    : `Next year (claim-free): ${nextPct}% → save more on OD premium`
                  }
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION D: Smart Recommendations
// ═══════════════════════════════════════════════════════════════════════════════

function SmartRecommendations({ recommendations, navigate }) {
  if (recommendations.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">All Good!</h3>
        <p className="text-sm text-slate-500">No insurance recommendations at this time. Your fleet coverage looks solid.</p>
      </div>
    )
  }

  const severityStyles = {
    critical: 'border-l-red-500 bg-red-50',
    high: 'border-l-orange-500 bg-orange-50',
    medium: 'border-l-amber-500 bg-amber-50',
    low: 'border-l-blue-500 bg-blue-50',
  }
  const severityBadge = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="space-y-3">
      <div className="card p-4 bg-gradient-to-r from-slate-50 to-blue-50">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🧠</span>
          <span className="text-sm font-semibold text-slate-700">AI-Powered Insurance Insights</span>
        </div>
        <p className="text-xs text-slate-500">Based on your fleet's maintenance history, trip data, and coverage analysis</p>
      </div>

      {recommendations.map((r, i) => (
        <div key={i} className={`card border-l-4 p-4 ${severityStyles[r.severity] || ''}`}>
          <div className="flex items-start gap-3">
            <span className="text-xl">{r.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-slate-600">{r.vehicleNumber}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase ${severityBadge[r.severity]}`}>
                  {r.severity}
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{r.message}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION E: Claim Guide
// ═══════════════════════════════════════════════════════════════════════════════

function ClaimGuide({ process, expanded, onExpand }) {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">How to File an Insurance Claim</h3>
        <p className="text-xs text-slate-500 mb-4">Follow these steps when you need to make a claim on your commercial vehicle insurance.</p>

        <div className="space-y-0">
          {process.map((step, i) => (
            <div key={step.step} className="flex gap-4">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {step.step}
                </div>
                {i < process.length - 1 && <div className="w-0.5 flex-1 bg-blue-200 my-1" />}
              </div>

              {/* Content */}
              <div className={`flex-1 pb-6 ${i === process.length - 1 ? 'pb-0' : ''}`}>
                <h4 className="text-sm font-semibold text-slate-900 mb-1">{step.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed mb-2">{step.description}</p>
                <div className="bg-amber-50 rounded-lg px-3 py-2 text-xs text-amber-700">
                  <strong>Tip:</strong> {step.tip}
                </div>
                {step.titleHi && (
                  <div className="mt-2 text-xs text-slate-400 italic">{step.titleHi}: {step.descriptionHi}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Emergency Numbers */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Emergency Helplines</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: 'ICICI Lombard', phone: '1800-266-9725' },
            { name: 'Bajaj Allianz', phone: '1800-209-5858' },
            { name: 'HDFC ERGO', phone: '1800-266-0700' },
            { name: 'Go Digit', phone: '1800-258-5956' },
            { name: 'New India', phone: '1800-209-1415' },
            { name: 'Tata AIG', phone: '1800-266-7780' },
          ].map(h => (
            <div key={h.name} className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                {h.name.charAt(0)}
              </div>
              <div>
                <div className="text-xs font-medium text-slate-700">{h.name}</div>
                <div className="text-xs text-blue-600 font-mono">{h.phone}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
