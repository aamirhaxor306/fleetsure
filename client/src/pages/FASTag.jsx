import { useState, useEffect, useCallback } from 'react'
import { fastag as fastagApi } from '../api'

// ── Icons (inline for this page) ────────────────────────────────────────────

const FasTagIcon = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
    <circle cx="17" cy="15" r="1.5" />
    <path d="M6 15h5" />
  </svg>
)

const RefreshCw = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0115-6.7L21 8" />
    <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 01-15 6.7L3 16" />
  </svg>
)

const WalletIcon = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="14" rx="2" />
    <path d="M2 10h20" /><circle cx="17" cy="14" r="1" />
  </svg>
)

const LinkIcon = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </svg>
)

const XIcon = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)

const CheckCircleIcon = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" />
  </svg>
)

const AlertIcon = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

// ── Helpers ──────────────────────────────────────────────────────────────────

const inr = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '₹0'

function balanceColor(balance) {
  if (balance >= 500) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' }
  if (balance >= 200) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' }
  return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' }
}

function statusBadge(status) {
  if (status === 'SUCCESS') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">Success</span>
  if (status === 'PENDING') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">Pending</span>
  if (status === 'FAILED') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700">Failed</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">{status}</span>
}

function tagStatusBadge(status) {
  if (!status || status === 'unknown') return <span className="text-[10px] text-slate-400">Not checked</span>
  if (status.toLowerCase().includes('activ')) return <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active</span>
  return <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{status}</span>
}

// ── Link FASTag Modal ───────────────────────────────────────────────────────

function LinkModal({ vehicles, onClose, onLink }) {
  const [vehicleId, setVehicleId] = useState('')
  const [provider, setProvider] = useState('')
  const [providerName, setProviderName] = useState('')
  const [fastagId, setFastagId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const unlinked = vehicles.filter(v => !v.fastag)

  const COMMON_PROVIDERS = [
    { id: 'ICIC00000NATFT', name: 'ICICI Bank FASTag' },
    { id: 'HDFC00000NATFT', name: 'HDFC Bank FASTag' },
    { id: 'SBIN00000NATFT', name: 'SBI FASTag' },
    { id: 'UTIB00000NATFT', name: 'Axis Bank FASTag' },
    { id: 'KKBK00000NATFT', name: 'Kotak Bank FASTag' },
    { id: 'PUNB00000NATFT', name: 'PNB FASTag' },
    { id: 'IDFB00000NATFT', name: 'IDFC FIRST Bank FASTag' },
    { id: 'AIRP00000NATFT', name: 'Airtel Payments Bank FASTag' },
    { id: 'PAYT00000NATFT', name: 'Paytm FASTag' },
    { id: 'YESB00000NATFT', name: 'YES Bank FASTag' },
  ]

  const handleProviderSelect = (billerId) => {
    setProvider(billerId)
    const p = COMMON_PROVIDERS.find(cp => cp.id === billerId)
    setProviderName(p?.name || billerId)
  }

  const handleSubmit = async () => {
    if (!vehicleId || !provider) { setError('Select a vehicle and provider'); return }
    setSaving(true); setError('')
    try {
      await onLink({ vehicleId, provider, providerName, fastagId: fastagId || undefined })
      onClose()
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Link FASTag</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><XIcon className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Vehicle</label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
              <option value="">Select vehicle...</option>
              {unlinked.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">FASTag Provider (Bank)</label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm" value={provider} onChange={e => handleProviderSelect(e.target.value)}>
              <option value="">Select bank...</option>
              {COMMON_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">FASTag ID / Tag Number <span className="text-slate-300">(optional)</span></label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm placeholder-slate-300" value={fastagId} onChange={e => setFastagId(e.target.value)} placeholder="34XXXXXXXXXX" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 rounded-lg transition-colors">
            {saving ? 'Linking...' : 'Link FASTag'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Recharge Modal ──────────────────────────────────────────────────────────

function RechargeModal({ fastag, vehicleNumber, onClose, onSuccess }) {
  const [amount, setAmount] = useState('')
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const PRESETS = [200, 500, 1000, 2000, 5000]
  const bc = balanceColor(fastag.balance)

  const handleRecharge = async () => {
    const num = Number(amount)
    if (!num || num < 100) { setError('Minimum ₹100'); return }
    setProcessing(true); setError('')
    try {
      const res = await fastagApi.recharge(fastag.id, num)
      setResult(res)
      if (res.paymentStatus === 'SUCCESS') onSuccess()
    } catch (err) { setError(err.message) }
    setProcessing(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="h-1 bg-gradient-to-r from-blue-500 to-emerald-500" />
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Recharge FASTag</h3>
          <p className="text-xs text-slate-400 mt-0.5">{vehicleNumber} &middot; {fastag.providerName}</p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Current balance */}
          <div className={`${bc.bg} border ${bc.border} rounded-xl px-4 py-3 flex items-center justify-between`}>
            <span className="text-xs text-slate-500">Current Balance</span>
            <span className={`text-lg font-bold ${bc.text}`}>{inr(fastag.balance)}</span>
          </div>

          {result ? (
            <div className={`rounded-xl p-4 text-center ${result.paymentStatus === 'SUCCESS' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              {result.paymentStatus === 'SUCCESS' ? (
                <>
                  <CheckCircleIcon className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <div className="text-sm font-bold text-emerald-800">Recharge Successful</div>
                  <div className="text-xs text-emerald-600 mt-1">{inr(amount)} added to {vehicleNumber}</div>
                  {result.transaction?.bulkpeTxnId && <div className="text-[10px] text-emerald-500 mt-2">Txn: {result.transaction.bulkpeTxnId}</div>}
                </>
              ) : (
                <>
                  <AlertIcon className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                  <div className="text-sm font-bold text-amber-800">Payment {result.paymentStatus}</div>
                  <div className="text-xs text-amber-600 mt-1">Status will update shortly</div>
                </>
              )}
              <button onClick={onClose} className="mt-4 px-5 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg">Done</button>
            </div>
          ) : (
            <>
              {error && <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

              {/* Preset amounts */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Quick Select</label>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map(p => (
                    <button key={p} onClick={() => setAmount(String(p))}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                        String(p) === amount ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}>
                      {inr(p)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom amount */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Amount (₹)</label>
                <input type="number" min="100" className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-lg font-bold text-slate-900 placeholder-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                  value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount" />
                <p className="text-[10px] text-slate-400 mt-1">Minimum ₹100. Debited from BulkPe account.</p>
              </div>

              <button onClick={handleRecharge} disabled={processing || !amount}
                className="w-full py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 rounded-xl transition-colors flex items-center justify-center gap-2">
                {processing ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Processing...</>
                ) : (
                  <>Recharge {amount ? inr(amount) : ''}</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function FASTagPage() {
  const [loading, setLoading] = useState(true)
  const [vehicles, setVehicles] = useState([])
  const [summary, setSummary] = useState({})
  const [configured, setConfigured] = useState(true)
  const [transactions, setTransactions] = useState([])
  const [totalSpent, setTotalSpent] = useState(0)
  const [tab, setTab] = useState('vehicles') // vehicles | transactions
  const [refreshing, setRefreshing] = useState(false)
  const [checkingId, setCheckingId] = useState(null)

  // Modals
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [rechargeTarget, setRechargeTarget] = useState(null) // { fastag, vehicleNumber }

  const [flash, setFlash] = useState({ msg: '', error: false })
  const showFlash = (msg, error = false) => { setFlash({ msg, error }); setTimeout(() => setFlash({ msg: '', error: false }), 4000) }

  const loadData = useCallback(async () => {
    try {
      const [vData, tData] = await Promise.allSettled([
        fastagApi.vehicles(),
        fastagApi.transactions(),
      ])
      if (vData.status === 'fulfilled') {
        setVehicles(vData.value.vehicles || [])
        setSummary(vData.value.summary || {})
        setConfigured(vData.value.configured !== false)
      }
      if (tData.status === 'fulfilled') {
        setTransactions(tData.value.transactions || [])
        setTotalSpent(tData.value.totalSpent || 0)
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleRefreshAll = async () => {
    setRefreshing(true)
    try {
      await fastagApi.balanceAll()
      await loadData()
      showFlash('All balances refreshed')
    } catch (err) { showFlash(err.message, true) }
    setRefreshing(false)
  }

  const handleCheckBalance = async (fastagId) => {
    setCheckingId(fastagId)
    try {
      await fastagApi.balance(fastagId)
      await loadData()
    } catch (err) { showFlash(err.message, true) }
    setCheckingId(null)
  }

  const handleLink = async (data) => {
    await fastagApi.link(data)
    await loadData()
    showFlash('FASTag linked successfully')
  }

  const handleUnlink = async (id) => {
    if (!confirm('Unlink this FASTag? Transaction history will be preserved.')) return
    try {
      await fastagApi.unlink(id)
      await loadData()
      showFlash('FASTag unlinked')
    } catch (err) { showFlash(err.message, true) }
  }

  const linkedVehicles = vehicles.filter(v => v.fastag)

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-slate-200 rounded w-56" />
        <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-200 rounded-xl" />)}</div>
        <div className="h-64 bg-slate-200 rounded-xl" />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-[80vh]">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
            <FasTagIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">FASTag Management</h1>
            <p className="text-xs text-slate-400">Balance monitoring, recharge & transaction history</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefreshAll} disabled={refreshing || !configured}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh All'}
          </button>
          <button onClick={() => setShowLinkModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors">
            <LinkIcon className="w-3.5 h-3.5" />
            Link FASTag
          </button>
        </div>
      </div>

      {/* Flash */}
      {flash.msg && (
        <div className={`mb-5 flex items-center gap-3 rounded-xl px-4 py-3 ${flash.error ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          {flash.error
            ? <AlertIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
            : <CheckCircleIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          }
          <span className={`text-sm font-medium ${flash.error ? 'text-red-800' : 'text-emerald-800'}`}>{flash.msg}</span>
        </div>
      )}

      {/* ── API not configured banner ──────────────────────────────── */}
      {!configured && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-800">BulkPe API not configured</h3>
              <p className="text-xs text-amber-600 mt-1">Add your <code className="bg-amber-100 px-1 rounded">BULKPE_API_KEY</code> in the .env file to enable live balance checks and recharge. You can still link FASTags and view the interface.</p>
              <p className="text-xs text-amber-500 mt-2">Sign up at <a href="https://app.bulkpe.in" target="_blank" rel="noopener noreferrer" className="underline">app.bulkpe.in</a> to get your API key.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Linked Vehicles', value: `${summary.linkedVehicles || 0} / ${summary.totalVehicles || 0}`, accent: 'bg-blue-500' },
          { label: 'Total Balance', value: inr(summary.totalBalance || 0), accent: 'bg-emerald-500' },
          { label: 'Low Balance', value: String(summary.lowBalanceCount || 0), accent: summary.lowBalanceCount > 0 ? 'bg-red-500' : 'bg-slate-300' },
          { label: 'Total Recharged', value: inr(totalSpent), accent: 'bg-violet-500' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className={`h-1 ${card.accent}`} />
            <div className="px-4 py-3">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{card.label}</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-5">
        {[{ key: 'vehicles', label: 'Vehicles' }, { key: 'transactions', label: 'Transactions' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Vehicles Tab ────────────────────────────────────────────── */}
      {tab === 'vehicles' && (
        <div>
          {linkedVehicles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center py-16 px-8">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
                <FasTagIcon className="w-8 h-8 text-orange-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">No FASTags linked yet</h3>
              <p className="text-sm text-slate-400 text-center max-w-sm mb-4">Link your vehicles' FASTags to monitor balances, get low-balance alerts, and recharge directly.</p>
              <button onClick={() => setShowLinkModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800">
                <LinkIcon className="w-4 h-4" /> Link Your First FASTag
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {linkedVehicles.map(v => {
                const ft = v.fastag
                const bc = balanceColor(ft.balance)
                const isChecking = checkingId === ft.id
                return (
                  <div key={v.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                    <div className={`h-1 ${bc.dot.replace('bg-', 'bg-')}`} />
                    <div className="p-4">
                      {/* Vehicle header */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-sm font-bold text-slate-900">{v.vehicleNumber}</div>
                          <div className="text-[10px] text-slate-400">{ft.providerName}</div>
                        </div>
                        {tagStatusBadge(ft.tagStatus)}
                      </div>

                      {/* Balance */}
                      <div className={`${bc.bg} border ${bc.border} rounded-xl px-4 py-3 mb-3 text-center`}>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Balance</div>
                        <div className={`text-2xl font-black ${bc.text} mt-0.5`}>{inr(ft.balance)}</div>
                        {ft.lastCheckedAt && (
                          <div className="text-[9px] text-slate-400 mt-1">
                            Updated {new Date(ft.lastCheckedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      {ft.customerName && <div className="text-[10px] text-slate-400 mb-1">Owner: <span className="text-slate-600">{ft.customerName}</span></div>}
                      {ft.vehicleClass && <div className="text-[10px] text-slate-400 mb-3">Class: <span className="text-slate-600">{ft.vehicleClass}</span></div>}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button onClick={() => handleCheckBalance(ft.id)} disabled={isChecking || !configured}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
                          <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
                          {isChecking ? 'Checking...' : 'Check'}
                        </button>
                        <button onClick={() => setRechargeTarget({ fastag: ft, vehicleNumber: v.vehicleNumber })}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                          <WalletIcon className="w-3 h-3" />
                          Recharge
                        </button>
                      </div>

                      {/* Unlink */}
                      <button onClick={() => handleUnlink(ft.id)}
                        className="w-full mt-2 text-[10px] text-slate-400 hover:text-red-500 transition-colors text-center py-1">
                        Unlink FASTag
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Transactions Tab ────────────────────────────────────────── */}
      {tab === 'transactions' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Transaction History</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">All FASTag recharge transactions</p>
          </div>
          {transactions.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <WalletIcon className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No transactions yet</p>
              <p className="text-xs text-slate-300 mt-1">Recharge a FASTag to see transactions here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Vehicle</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Charges</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-left">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transactions.map(txn => (
                    <tr key={txn.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {new Date(txn.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-900">{txn.vehicleNumber || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                          {txn.type === 'recharge' ? 'Recharge' : txn.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-900 text-right">{inr(txn.amount)}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 text-right">{txn.charge > 0 ? inr(txn.charge + txn.gst) : '-'}</td>
                      <td className="px-4 py-3 text-center">{statusBadge(txn.status)}</td>
                      <td className="px-4 py-3 text-[10px] text-slate-400 font-mono">{txn.bulkpeTxnId || txn.reference?.slice(0, 16)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────── */}
      {showLinkModal && <LinkModal vehicles={vehicles} onClose={() => setShowLinkModal(false)} onLink={handleLink} />}
      {rechargeTarget && (
        <RechargeModal
          fastag={rechargeTarget.fastag}
          vehicleNumber={rechargeTarget.vehicleNumber}
          onClose={() => setRechargeTarget(null)}
          onSuccess={() => { setRechargeTarget(null); loadData() }}
        />
      )}
    </div>
  )
}
