import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { insurance } from '../api'
import PageHeader from '../components/PageHeader'

const POLICY_LABELS = {
 comprehensive: 'Full Cover',
 third_party: 'Basic (Legal Minimum)',
 own_damage: 'Own Damage Only',
}

export default function InsuranceOptimizer({ embedded = false }) {
 const [data, setData] = useState(null)
 const [loading, setLoading] = useState(true)
 const [showGoodVehicles, setShowGoodVehicles] = useState(false)
 const [showClaimGuide, setShowClaimGuide] = useState(false)

 useEffect(() => {
 insurance.optimizer()
 .then(setData)
 .catch(console.error)
 .finally(() => setLoading(false))
 }, [])

 if (loading) return (
 <div className="animate-pulse space-y-4">
 <div className={`h-8 bg-slate-200 dark:bg-slate-700 rounded ${embedded ? 'w-full max-w-md' : 'w-48'}`} />
 <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
 <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-200 dark:bg-slate-700 rounded-xl" />)}</div>
 </div>
 )

 if (!data) return <div className="text-center py-12 text-slate-500">Unable to load insurance data</div>

 const { kpis, vehicleSummaries, recommendations, claimProcess } = data

 const needAction = vehicleSummaries
 .filter(v => v.coverageStatus === 'expired' || v.coverageStatus === 'warning' || v.coverageStatus === 'gap')
 .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)

 const allGood = vehicleSummaries.filter(v => v.coverageStatus === 'good')
 const insuredCount = allGood.length
 const totalCount = kpis.vehicleCount

 const recMap = {}
 for (const r of recommendations) {
 if (!recMap[r.vehicleNumber]) recMap[r.vehicleNumber] = []
 recMap[r.vehicleNumber].push(r)
 }

 const ringColor = needAction.length === 0 ? '#10b981' : needAction.some(v => v.coverageStatus === 'expired') ? '#ef4444' : '#f59e0b'
 const ringPct = totalCount > 0 ? (insuredCount / totalCount) * 100 : 0

 const inner = (
 <>
 {/* Section 1: Fleet Summary */}
 <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 mb-5">
 <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
 {/* Shield Ring */}
 <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0">
 <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
 <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="10" />
 <circle cx="60" cy="60" r="52" fill="none" stroke={ringColor} strokeWidth="10"
 strokeLinecap="round"
 strokeDasharray={`${ringPct * 3.27} ${327 - ringPct * 3.27}`}
 />
 </svg>
 <div className="absolute inset-0 flex flex-col items-center justify-center">
 <span className="text-2xl sm:text-3xl font-black text-slate-900">{insuredCount}</span>
 <span className="text-[10px] sm:text-xs text-slate-400 font-medium">of {totalCount}</span>
 </div>
 </div>

 {/* Status Text */}
 <div className="text-center sm:text-left flex-1">
 <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
 {needAction.length === 0
 ? 'All vehicles insured'
 : `${needAction.length} vehicle${needAction.length !== 1 ? 's' : ''} need attention`
 }
 </h2>
 <div className="flex flex-wrap justify-center sm:justify-start gap-3">
 {needAction.filter(v => v.coverageStatus === 'expired').length > 0 && (
 <span className="inline-flex items-center gap-1.5 text-sm text-red-700 bg-red-50 px-3 py-1 rounded-full font-medium">
 <span className="w-2 h-2 rounded-full bg-red-500" />
 {needAction.filter(v => v.coverageStatus === 'expired').length} expired
 </span>
 )}
 {needAction.filter(v => v.coverageStatus === 'warning').length > 0 && (
 <span className="inline-flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 px-3 py-1 rounded-full font-medium">
 <span className="w-2 h-2 rounded-full bg-amber-500" />
 {needAction.filter(v => v.coverageStatus === 'warning').length} expiring soon
 </span>
 )}
 {needAction.filter(v => v.coverageStatus === 'gap').length > 0 && (
 <span className="inline-flex items-center gap-1.5 text-sm text-orange-700 bg-orange-50 px-3 py-1 rounded-full font-medium">
 <span className="w-2 h-2 rounded-full bg-orange-500" />
 {needAction.filter(v => v.coverageStatus === 'gap').length} basic only
 </span>
 )}
 {insuredCount > 0 && (
 <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full font-medium">
 <span className="w-2 h-2 rounded-full bg-emerald-500" />
 {insuredCount} all good
 </span>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* Section 2: Vehicles Needing Action */}
 {needAction.length > 0 && (
 <div className="mb-5">
 <div className="flex items-center gap-2 mb-3">
 <span className="text-lg"></span>
 <h3 className="text-sm font-bold text-slate-800">These vehicles need your attention</h3>
 </div>
 <div className="space-y-2.5">
 {needAction.map(v => (
 <ActionVehicleCard key={v.id} vehicle={v} tips={recMap[v.vehicleNumber]} />
 ))}
 </div>
 </div>
 )}

 {/* Section 3: All Good Vehicles */}
 {allGood.length > 0 && (
 <div className="mb-5">
 <button
 onClick={() => setShowGoodVehicles(!showGoodVehicles)}
 className="w-full flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 hover:bg-emerald-100 transition-colors"
 >
 <div className="flex items-center gap-2">
 <span className="text-lg"></span>
 <span className="text-sm font-semibold text-emerald-800">
 {allGood.length} vehicle{allGood.length !== 1 ? 's' : ''} fully insured
 </span>
 </div>
 <svg className={`w-5 h-5 text-emerald-600 transition-transform ${showGoodVehicles ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </button>

 {showGoodVehicles && (
 <div className="mt-2.5 space-y-2">
 {allGood.map(v => (
 <GoodVehicleCard key={v.id} vehicle={v} />
 ))}
 </div>
 )}
 </div>
 )}

 {/* Section 4: How to Claim (collapsible) */}
 <ClaimSection process={claimProcess} expanded={showClaimGuide} onToggle={() => setShowClaimGuide(!showClaimGuide)} />
 </>
 )

 if (embedded) return <div className="insurance-optimizer-embedded">{inner}</div>

 return (
 <div>
 <PageHeader
 title="Insurance"
 subtitle="Your fleet's insurance at a glance"
 breadcrumbs={[{ label: 'Insurance' }]}
 />
 {inner}
 </div>
 )
}


function ActionVehicleCard({ vehicle: v, tips }) {
 const isExpired = v.coverageStatus === 'expired'
 const isGap = v.coverageStatus === 'gap'

 let statusText, statusClass
 if (isExpired) {
 statusText = `Insurance expired ${Math.abs(v.daysUntilExpiry)} days ago`
 statusClass = 'text-red-700'
 } else if (isGap) {
 statusText = 'Only basic cover — your vehicle is not protected'
 statusClass = 'text-orange-700'
 } else {
 statusText = `Insurance expiring in ${v.daysUntilExpiry} days`
 statusClass = 'text-amber-700'
 }

 const borderColor = isExpired ? 'border-red-300 bg-red-50/50' : isGap ? 'border-orange-300 bg-orange-50/50' : 'border-amber-300 bg-amber-50/50'

 const tip = tips?.[0]

 return (
 <div className={`rounded-xl border-2 ${borderColor} p-4`}>
 <div className="flex items-start justify-between gap-3">
 <div className="flex-1 min-w-0">
 <div className="text-base font-bold text-slate-900 mb-0.5">{v.vehicleNumber}</div>
 <div className={`text-sm font-semibold ${statusClass} mb-1`}>{statusText}</div>
 <div className="text-xs text-slate-500">
 {POLICY_LABELS[v.policyType] || v.policyType}
 {v.ncbPercentage > 0 && <span className="ml-2">· No-claim discount: {v.ncbPercentage}%</span>}
 </div>
 </div>
 <Link
 to="/renewals?tab=queue"
 className={`shrink-0 text-xs font-bold px-4 py-2 rounded-lg transition-colors ${
 isExpired
 ? 'bg-red-600 text-white hover:bg-red-700'
 : 'bg-amber-500 text-white hover:bg-amber-600'
 }`}
 >
 Renew Now
 </Link>
 </div>

 {tip && (
 <div className="mt-2.5 bg-white/70 rounded-lg px-3 py-2 text-xs text-slate-600 leading-relaxed">
 {tip.message}
 </div>
 )}
 </div>
 )
}


function GoodVehicleCard({ vehicle: v }) {
 const ncbText = v.ncbPercentage > 0
 ? `No-claim discount: ${v.ncbPercentage}%${v.nextNcb?.isMax ? ' (Maximum!)' : ''}`
 : null

 return (
 <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
 <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
 <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
 </svg>
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-sm font-bold text-slate-900">{v.vehicleNumber}</div>
 <div className="text-xs text-slate-500">
 {POLICY_LABELS[v.policyType] || v.policyType}
 <span className="mx-1.5 text-slate-300">·</span>
 {v.daysUntilExpiry > 0 ? `${v.daysUntilExpiry} days left` : 'Active'}
 </div>
 {ncbText && (
 <div className="text-xs text-emerald-600 font-medium mt-0.5">{ncbText}</div>
 )}
 </div>
 </div>
 )
}


function ClaimSection({ process, expanded, onToggle }) {
 const helplines = [
 { name: 'ICICI Lombard', phone: '1800-266-9725' },
 { name: 'Bajaj Allianz', phone: '1800-209-5858' },
 { name: 'HDFC ERGO', phone: '1800-266-0700' },
 { name: 'Go Digit', phone: '1800-258-5956' },
 { name: 'New India', phone: '1800-209-1415' },
 { name: 'Tata AIG', phone: '1800-266-7780' },
 ]

 return (
 <div>
 <button
 onClick={onToggle}
 className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 hover:bg-slate-50 transition-colors"
 >
 <div className="flex items-center gap-2">
 <span className="text-lg"></span>
 <span className="text-sm font-semibold text-slate-700">How to file a claim + Emergency numbers</span>
 </div>
 <svg className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </button>

 {expanded && (
 <div className="mt-3 space-y-3">
 {/* Claim Steps */}
 <div className="bg-white rounded-xl border border-slate-200 p-4">
 <h4 className="text-sm font-bold text-slate-800 mb-3">Step-by-step claim process</h4>
 <div className="space-y-3">
 {process.map((step, i) => (
 <div key={step.step} className="flex gap-3">
 <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
 {step.step}
 </div>
 <div className="flex-1">
 <div className="text-sm font-semibold text-slate-900">{step.title}</div>
 <div className="text-xs text-slate-500 leading-relaxed">{step.description}</div>
 {step.tip && (
 <div className="mt-1 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
 Tip: {step.tip}
 </div>
 )}
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Emergency Numbers */}
 <div className="bg-white rounded-xl border border-slate-200 p-4">
 <h4 className="text-sm font-bold text-slate-800 mb-3">Emergency helplines (toll-free)</h4>
 <div className="grid grid-cols-2 gap-2">
 {helplines.map(h => (
 <a key={h.name} href={`tel:${h.phone}`} className="flex items-center gap-2.5 bg-slate-50 rounded-lg p-2.5 hover:bg-blue-50 transition-colors">
 <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-[10px] font-bold shrink-0">
 {h.name.charAt(0)}
 </div>
 <div>
 <div className="text-xs font-medium text-slate-700">{h.name}</div>
 <div className="text-xs text-blue-600 font-mono">{h.phone}</div>
 </div>
 </a>
 ))}
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
