import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { monthlyBills as billsApi, trips as tripsApi } from '../api'
import PageHeader from '../components/PageHeader'
import { UploadIcon, CheckIcon } from '../components/Icons'

const STEPS = ['Upload', 'Assign', 'Review', 'Done']

export default function Reconcile() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [bills, setBills] = useState([])
  const [pendingTrips, setPendingTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBill, setSelectedBill] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [tripFreights, setTripFreights] = useState({})

  useEffect(() => {
    Promise.allSettled([billsApi.list(), tripsApi.list()])
      .then(([b, t]) => {
        if (b.status === 'fulfilled') setBills(b.value)
        if (t.status === 'fulfilled') setPendingTrips(t.value.filter(tr => tr.status === 'logged'))
        setLoading(false)
      })
  }, [])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await billsApi.parsePdf(file)
      const newBill = await billsApi.create({
        month: result.month || new Date().getMonth() + 1,
        year: result.year || new Date().getFullYear(),
        totalAmount: result.totalAmount || 0,
        tripCount: result.tripCount || 0,
        sourceFile: file.name,
      })
      setSelectedBill(newBill)
      setStep(1)
    } catch (err) { alert(err.message) }
    setUploading(false)
  }

  const totalAssigned = Object.values(tripFreights).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const billAmount = selectedBill?.totalAmount || 0
  const balance = billAmount - totalAssigned
  const balancePct = billAmount > 0 ? Math.min(100, (totalAssigned / billAmount) * 100) : 0

  const handleReconcile = async () => {
    if (!selectedBill) return
    try {
      const tripUpdates = Object.entries(tripFreights)
        .filter(([, v]) => parseFloat(v) > 0)
        .map(([tripId, amount]) => ({ tripId, freightAmount: parseFloat(amount) }))
      await billsApi.reconcile(selectedBill.id, { trips: tripUpdates })
      setStep(3)
    } catch (err) { alert(err.message) }
  }

  const autoDistribute = () => {
    if (pendingTrips.length === 0) return
    const totalDist = pendingTrips.reduce((s, t) => s + (t.distance || 1), 0)
    const newFreights = {}
    pendingTrips.forEach(t => {
      newFreights[t.id] = Math.round((t.distance || 1) / totalDist * billAmount)
    })
    setTripFreights(newFreights)
  }

  const splitEqual = () => {
    if (pendingTrips.length === 0) return
    const each = Math.round(billAmount / pendingTrips.length)
    const newFreights = {}
    pendingTrips.forEach(t => { newFreights[t.id] = each })
    setTripFreights(newFreights)
  }

  const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`
  const shortLoc = (s) => { const p = (s || '').split(' - '); return p.length > 1 ? p.slice(1).join(' - ').trim() : s || '-' }

  if (loading) return <div className="animate-pulse"><div className="h-8 bg-slate-200 rounded w-48" /></div>

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Reconcile Bills" subtitle="Match monthly bills to trips" breadcrumbs={[{ label: 'Trips', to: '/trips' }, { label: 'Reconcile' }]} />

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              i <= step ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
            }`}>{i < step ? <CheckIcon className="w-4 h-4" /> : i + 1}</div>
            <span className={`text-xs font-medium hidden sm:inline ${i <= step ? 'text-slate-900' : 'text-slate-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < step ? 'bg-blue-600' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 0: Upload */}
      {step === 0 && (
        <div className="card p-8 text-center">
          <UploadIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Upload Monthly Bill PDF</h3>
          <p className="text-xs text-slate-400 mb-4">We'll extract the total amount and match it to your trips</p>
          <input type="file" accept=".pdf" className="hidden" id="bill-upload" onChange={handleUpload} />
          <label htmlFor="bill-upload" className={`btn-primary inline-flex items-center gap-2 cursor-pointer ${uploading ? 'opacity-50' : ''}`}>
            <UploadIcon className="w-4 h-4" />
            {uploading ? 'Processing...' : 'Choose PDF'}
          </label>

          {bills.length > 0 && (
            <div className="mt-8 text-left">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Previous Bills</h4>
              <div className="space-y-2">
                {bills.slice(0, 5).map(b => (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                    <span className="text-sm">{b.month}/{b.year}</span>
                    <span className="font-semibold text-sm">{inr(b.totalAmount)}</span>
                    <span className={`badge ${b.reconciledAt ? 'badge-success' : 'badge-pending'}`}>
                      {b.reconciledAt ? 'Done' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 1: Assign */}
      {step === 1 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-sm font-semibold text-slate-700">Bill Total: {inr(billAmount)}</span>
                <span className="ml-3 text-sm text-slate-500">Assigned: {inr(totalAssigned)}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={autoDistribute} className="btn-ghost text-xs">By Distance</button>
                <button onClick={splitEqual} className="btn-ghost text-xs">Split Equal</button>
              </div>
            </div>
            {/* Balance Bar */}
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${Math.abs(balance) < 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${balancePct}%` }}
              />
            </div>
            <div className="text-xs mt-1 text-right">
              {Math.abs(balance) < 100 ? (
                <span className="text-emerald-600 font-medium">Balanced</span>
              ) : (
                <span className="text-amber-600">Gap: {inr(balance)}</span>
              )}
            </div>
          </div>

          <table className="data-table">
            <thead><tr><th>Vehicle</th><th>Route</th><th>Dist</th><th>Freight (₹)</th></tr></thead>
            <tbody>
              {pendingTrips.map(t => (
                <tr key={t.id}>
                  <td className="font-mono text-xs">{t.vehicle?.vehicleNumber || '-'}</td>
                  <td className="text-xs">{shortLoc(t.loadingLocation)} → {shortLoc(t.destination)}</td>
                  <td className="text-xs">{t.distance} km</td>
                  <td>
                    <input
                      type="number"
                      className="inp w-24 text-right"
                      value={tripFreights[t.id] || ''}
                      onChange={e => setTripFreights({ ...tripFreights, [t.id]: e.target.value })}
                      placeholder="0"
                    />
                  </td>
                </tr>
              ))}
              {pendingTrips.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate-400">No pending trips to reconcile</td></tr>}
            </tbody>
          </table>

          <div className="flex gap-3 p-4 border-t border-slate-100">
            <button onClick={() => setStep(0)} className="btn-secondary flex-1">Back</button>
            <button onClick={() => setStep(2)} className="btn-primary flex-1">Review</button>
          </div>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 2 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Confirm Reconciliation</h3>
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Bill Total</span><span className="font-semibold">{inr(billAmount)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Assigned</span><span className="font-semibold">{inr(totalAssigned)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Balance</span><span className={`font-semibold ${Math.abs(balance) < 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{inr(balance)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Trips</span><span className="font-semibold">{Object.values(tripFreights).filter(v => parseFloat(v) > 0).length}</span></div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">Back</button>
            <button onClick={handleReconcile} className="btn-primary flex-1">Confirm</button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 3 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckIcon className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Reconciliation Complete</h2>
          <p className="text-sm text-slate-500 mb-6">All trip freight amounts have been updated.</p>
          <button onClick={() => navigate('/trips')} className="btn-primary">View Trips</button>
        </div>
      )}
    </div>
  )
}
