import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { renewals as renewalsApi, insurance as insuranceApi } from '../api'
import PageHeader from '../components/PageHeader'
import { CheckIcon, AlertTriangleIcon } from '../components/Icons'

const INR = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })

const STATUS_STEPS = ['pending', 'quotes_received', 'confirmed', 'renewed']
const STATUS_LABELS = { pending: 'Pending', quotes_received: 'Quotes Ready', confirmed: 'Confirmed', renewed: 'Renewed' }

export default function RenewalDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [renewal, setRenewal] = useState(null)
  const [benefits, setBenefits] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [selecting, setSelecting] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [newExpiry, setNewExpiry] = useState('')
  const [showCompleteForm, setShowCompleteForm] = useState(false)
  const [showCoverage, setShowCoverage] = useState(false)
  const [quoteForm, setQuoteForm] = useState({ idv: '', policyType: 'comprehensive', ncbPercentage: '0' })

  const load = () => {
    renewalsApi.get(id).then(setRenewal).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    insuranceApi.benefits().then(setBenefits).catch(() => {})
  }, [])

  if (loading) return <div className="animate-pulse"><div className="h-8 bg-slate-200 rounded w-48 mb-4" /><div className="h-64 bg-slate-200 rounded-lg" /></div>
  if (!renewal) return <div className="text-center py-12 text-slate-500">Renewal not found</div>

  const currentStep = STATUS_STEPS.indexOf(renewal.status)
  const quotes = renewal.quotes || []
  const selectedQuote = quotes.find(q => q.selected)
  const isInsurance = renewal.documentType === 'insurance'
  const vehicle = renewal.vehicle || {}
  const previousInsurer = vehicle.previousInsurer
  const ncb = parseInt(quoteForm.ncbPercentage) || vehicle.ncbPercentage || 0

  // Estimate previous premium (highest quote + 10% or manual estimate)
  const sortedQuotes = [...quotes].sort((a, b) => a.amount - b.amount)
  const cheapest = sortedQuotes[0]
  const mostExpensive = sortedQuotes[sortedQuotes.length - 1]
  const estimatedPrevious = mostExpensive ? Math.round(mostExpensive.amount * 1.1) : 0

  const handleFetchQuotes = async () => {
    setFetching(true)
    try {
      await renewalsApi.fetchQuotes(id, quoteForm)
      load()
    } catch (err) { alert(err.message) }
    setFetching(false)
  }

  const handleSelectQuote = async (quoteId) => {
    setSelecting(quoteId)
    try {
      await renewalsApi.selectQuote(id, quoteId)
      load()
    } catch (err) { alert(err.message) }
    setSelecting(null)
  }

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      await renewalsApi.confirm(id)
      load()
    } catch (err) { alert(err.message) }
    setConfirming(false)
  }

  const handleComplete = async () => {
    if (!newExpiry) return alert('Please enter new expiry date')
    setCompleting(true)
    try {
      await renewalsApi.complete(id, newExpiry)
      load()
    } catch (err) { alert(err.message) }
    setCompleting(false)
  }

  // NCB next slab calculation
  const ncbSlabs = [0, 20, 25, 35, 45, 50]
  const ncbIdx = ncbSlabs.indexOf(ncb)
  const nextNcb = ncbIdx >= 0 && ncbIdx < ncbSlabs.length - 1 ? ncbSlabs[ncbIdx + 1] : ncb
  const isMaxNcb = ncb >= 50

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={`${renewal.documentType?.toUpperCase()} Renewal`}
        subtitle={renewal.vehicle?.vehicleNumber || ''}
        breadcrumbs={[{ label: 'Renewals', to: '/renewals' }, { label: 'Detail' }]}
      />

      {/* Coming Soon note */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 flex items-start gap-2">
        <AlertTriangleIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">Live quotes from insurance partners are coming soon. Currently showing estimated/manual quotes.</p>
      </div>

      {/* Status Pipeline */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between">
          {STATUS_STEPS.map((step, i) => {
            const done = i <= currentStep
            const active = i === currentStep
            return (
              <div key={step} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  done ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                } ${active ? 'ring-2 ring-blue-200' : ''}`}>
                  {done && i < currentStep ? <CheckIcon className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${done ? 'text-slate-900' : 'text-slate-400'}`}>
                  {STATUS_LABELS[step]}
                </span>
                {i < STATUS_STEPS.length - 1 && <div className={`flex-1 h-0.5 ${done && i < currentStep ? 'bg-blue-600' : 'bg-slate-200'}`} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step: Pending -- Fetch Quotes */}
      {renewal.status === 'pending' && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Get Quotes</h3>
          {isInsurance && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Vehicle Value (IDV) ₹</label>
                <input className="inp" type="number" value={quoteForm.idv} onChange={e => setQuoteForm({...quoteForm, idv: e.target.value})} placeholder="e.g. 500000" />
                <p className="text-[10px] text-slate-400 mt-0.5">How much your vehicle is insured for</p></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Policy Type</label>
                <select className="inp" value={quoteForm.policyType} onChange={e => setQuoteForm({...quoteForm, policyType: e.target.value})}>
                  <option value="comprehensive">Full Cover (Comprehensive)</option><option value="third_party">Third Party Only</option><option value="own_damage">Own Damage Only</option>
                </select></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">No Claim Bonus %</label>
                <select className="inp" value={quoteForm.ncbPercentage} onChange={e => setQuoteForm({...quoteForm, ncbPercentage: e.target.value})}>
                  {[0, 20, 25, 35, 45, 50].map(n => <option key={n} value={n}>{n}%</option>)}
                </select>
                <p className="text-[10px] text-slate-400 mt-0.5">Discount for not making claims — increases each year</p></div>
            </div>
          )}
          <button onClick={handleFetchQuotes} disabled={fetching} className="btn-primary">
            {fetching ? 'Fetching...' : 'Get Quotes'}
          </button>
        </div>
      )}

      {/* Step: Quotes Received -- Compare & Select */}
      {renewal.status === 'quotes_received' && quotes.length > 0 && (
        <>
          {/* Savings Callout */}
          {isInsurance && cheapest && estimatedPrevious > cheapest.amount && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4 flex items-center gap-3">
              <div className="text-2xl">💰</div>
              <div>
                <div className="text-sm font-bold text-emerald-700">
                  Save {INR(estimatedPrevious - cheapest.amount)} vs {previousInsurer || 'market average'}!
                </div>
                <div className="text-xs text-emerald-600">
                  Best quote: {INR(cheapest.amount)} ({cheapest.partnerName}) — {Math.round(((estimatedPrevious - cheapest.amount) / estimatedPrevious) * 100)}% cheaper
                </div>
              </div>
            </div>
          )}

          <div className="card p-5 mb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Compare Quotes ({quotes.length})</h3>

            {/* Benefits Comparison Matrix (for insurance) */}
            {isInsurance && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-2 text-slate-500 font-medium">Feature</th>
                      {sortedQuotes.map((q, i) => (
                        <th key={q.id} className={`text-center py-2 px-2 ${i === 0 ? 'bg-emerald-50' : ''}`}>
                          <div className="font-semibold text-slate-900">{q.partnerName}</div>
                          <div className={`text-sm font-bold ${i === 0 ? 'text-emerald-600' : 'text-blue-600'}`}>{INR(q.amount)}</div>
                          {i === 0 && <span className="inline-block bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1">BEST VALUE</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {['Zero Depreciation', 'Roadside Assistance', 'Engine Protector', 'Return to Invoice', 'Consumable Cover', 'Key Replacement'].map(addon => (
                      <tr key={addon} className="border-b border-slate-50">
                        <td className="py-2 px-2 text-slate-600">{addon}</td>
                        {sortedQuotes.map((q, i) => {
                          const addOns = q.coverageDetails?.addOns || []
                          const has = addOns.some(a => a.toLowerCase().includes(addon.split(' ')[0].toLowerCase()))
                          return (
                            <td key={q.id} className={`text-center py-2 px-2 ${i === 0 ? 'bg-emerald-50' : ''}`}>
                              {has ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-slate-300">✗</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    {/* Premium breakdown rows */}
                    {sortedQuotes[0]?.premiumBreakdown && (
                      <>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <td className="py-2 px-2 text-slate-500 font-medium" colSpan={sortedQuotes.length + 1}>Premium Breakdown</td>
                        </tr>
                        {[
                          { key: 'od', label: 'Own Damage' },
                          { key: 'tp', label: 'Third Party' },
                          { key: 'ncbDiscount', label: 'NCB Discount' },
                          { key: 'gst', label: 'GST (18%)' },
                        ].map(row => (
                          <tr key={row.key} className="border-b border-slate-50">
                            <td className="py-1.5 px-2 text-slate-500">{row.label}</td>
                            {sortedQuotes.map((q, i) => (
                              <td key={q.id} className={`text-center py-1.5 px-2 ${i === 0 ? 'bg-emerald-50' : ''} ${row.key === 'ncbDiscount' ? 'text-emerald-600' : 'text-slate-700'}`}>
                                {row.key === 'ncbDiscount' ? '-' : ''}{INR(q.premiumBreakdown?.[row.key] || 0)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Quote cards with select buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {quotes.map(q => (
                <div key={q.id} className={`p-4 rounded-lg border-2 transition-all ${
                  q.selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-semibold text-slate-900">{q.partnerName}</span>
                    <span className="text-lg font-bold text-blue-600">{INR(q.amount)}</span>
                  </div>
                  {q.coverageDetails?.addOns && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {q.coverageDetails.addOns.map(a => (
                        <span key={a} className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{a}</span>
                      ))}
                    </div>
                  )}
                  {estimatedPrevious > 0 && q.amount < estimatedPrevious && (
                    <div className="text-xs text-emerald-600 font-medium mb-2">
                      Save {INR(estimatedPrevious - q.amount)} vs {previousInsurer || 'previous'}
                    </div>
                  )}
                  <button
                    onClick={() => handleSelectQuote(q.id)}
                    disabled={selecting === q.id}
                    className={q.selected ? 'btn-primary w-full text-xs' : 'btn-secondary w-full text-xs'}
                  >
                    {q.selected ? 'Selected' : selecting === q.id ? 'Selecting...' : 'Select'}
                  </button>
                </div>
              ))}
            </div>
            {selectedQuote && (
              <button onClick={handleConfirm} disabled={confirming} className="btn-primary w-full">
                {confirming ? 'Confirming...' : `Confirm ${selectedQuote.partnerName} - ${INR(selectedQuote.amount)}`}
              </button>
            )}
          </div>

          {/* What This Covers Panel */}
          {isInsurance && benefits && (
            <div className="card mb-4 overflow-hidden">
              <button className="w-full text-left px-5 py-3 flex items-center justify-between" onClick={() => setShowCoverage(!showCoverage)}>
                <span className="text-sm font-semibold text-slate-700">What Does This Policy Cover?</span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${showCoverage ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showCoverage && (
                <div className="px-5 pb-4 border-t border-slate-100">
                  <div className="mt-3 space-y-4">
                    {/* Covered risks */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Covered Risks (Comprehensive)</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {benefits.policyTypes?.comprehensive?.coveredRisks?.map(risk => (
                          <div key={risk.key} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                            risk.covered ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'
                          }`}>
                            <span>{risk.icon}</span>
                            <span>{risk.label}</span>
                            <span className="ml-auto">{risk.covered ? '✓' : '✗'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Add-on explanations */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Add-Ons Explained</h4>
                      <div className="space-y-2">
                        {benefits.addOns?.slice(0, 4).map(addon => (
                          <div key={addon.key} className="bg-slate-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span>{addon.icon}</span>
                              <span className="text-xs font-semibold text-slate-700">{addon.label}</span>
                              <span className="text-[10px] text-slate-400 ml-auto">{INR(addon.estimatedCost.min)}-{INR(addon.estimatedCost.max)}/yr</span>
                            </div>
                            <p className="text-xs text-slate-500">{addon.description}</p>
                            <p className="text-xs text-emerald-600 mt-1 font-medium">{addon.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NCB Impact Calculator */}
          {isInsurance && ncb >= 0 && (
            <div className="card p-5 mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">NCB Impact</h3>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1 bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-blue-500 uppercase font-medium">Current NCB</div>
                  <div className="text-2xl font-extrabold text-blue-700">{ncb}%</div>
                </div>
                <div className="text-slate-300 text-xl">→</div>
                <div className="flex-1 bg-emerald-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-emerald-500 uppercase font-medium">Next Year (claim-free)</div>
                  <div className="text-2xl font-extrabold text-emerald-700">{isMaxNcb ? '50%' : `${nextNcb}%`}</div>
                  {isMaxNcb && <div className="text-[10px] text-emerald-500">Maximum!</div>}
                </div>
              </div>
              {/* NCB progress bar */}
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all" style={{ width: `${(ncb / 50) * 100}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-3">
                {ncbSlabs.map(s => <span key={s}>{s}%</span>)}
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-700">
                <strong>Remember:</strong> One claim resets NCB to 0%. If repair cost is less than NCB savings, consider paying out of pocket.
              </div>
            </div>
          )}
        </>
      )}

      {/* Step: Confirmed -- Mark Renewed */}
      {renewal.status === 'confirmed' && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Mark as Renewed</h3>
          <p className="text-sm text-slate-500 mb-4">Complete the renewal and enter the new document expiry date.</p>
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">New Expiry Date *</label>
            <input type="date" className="inp" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} />
          </div>
          <button onClick={handleComplete} disabled={completing} className="btn-primary w-full">
            {completing ? 'Completing...' : 'Mark Renewed'}
          </button>
        </div>
      )}

      {/* Step: Renewed -- Done */}
      {renewal.status === 'renewed' && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckIcon className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Renewal Complete</h2>
          <p className="text-sm text-slate-500 mb-4">The document has been renewed successfully.</p>
          <button onClick={() => navigate('/renewals')} className="btn-primary">Back to Renewals</button>
        </div>
      )}
    </div>
  )
}
