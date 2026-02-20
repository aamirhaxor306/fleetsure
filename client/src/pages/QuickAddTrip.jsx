import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { vehicles as vehiclesApi, trips as tripsApi, savedRoutes as savedRoutesApi, ocr as ocrApi } from '../api'
import { useLang } from '../context/LanguageContext'
import PageHeader from '../components/PageHeader'
import { CheckIcon, UploadIcon } from '../components/Icons'

const STEPS = ['Trip Details', 'Review & Save']

export default function QuickAddTrip() {
  const navigate = useNavigate()
  const { t } = useLang()
  const [step, setStep] = useState(0)
  const [vehicles, setVehicles] = useState([])
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    vehicleId: '', loadingLocation: '', destination: '', distance: '',
    fuelLitres: '', dieselRate: '', fuelExpense: '', toll: '', cashExpense: '',
    loadingSlipNumber: '', tripDate: new Date().toISOString().slice(0, 10),
  })

  const fileRef = useRef(null)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    Promise.allSettled([vehiclesApi.list(), savedRoutesApi.list()])
      .then(([v, r]) => {
        if (v.status === 'fulfilled') setVehicles(v.value)
        if (r.status === 'fulfilled') setRoutes(r.value)
        setLoading(false)
      })
  }, [])

  const selectedVehicle = vehicles.find(v => v.id === form.vehicleId)

  // Auto-calculate fuel cost when litres or rate changes
  const updateFuel = (field, value) => {
    const next = { ...form, [field]: value }
    const litres = parseFloat(next.fuelLitres) || 0
    const rate = parseFloat(next.dieselRate) || 0
    if (litres > 0 && rate > 0) {
      next.fuelExpense = String(Math.round(litres * rate))
    }
    setForm(next)
  }

  const handleScan = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    try {
      const result = await ocrApi.scanLoadingSlip(file)
      if (result) {
        setForm(prev => ({
          ...prev,
          loadingLocation: result.originPlant || prev.loadingLocation,
          destination: result.destinationPlant || prev.destination,
          loadingSlipNumber: result.loadingSlipNumber || prev.loadingSlipNumber,
          tripDate: result.tripDate || prev.tripDate,
        }))

        if (result.vehicleNumber) {
          const match = vehicles.find(v =>
            v.vehicleNumber.replace(/[\s\-.]/g, '').toUpperCase() === result.vehicleNumber.replace(/[\s\-.]/g, '').toUpperCase()
          )
          if (match) setForm(prev => ({ ...prev, vehicleId: match.id }))
        }
      }
    } catch (err) { console.error('OCR error:', err) }
    setScanning(false)
  }

  const handleRouteSelect = (routeId) => {
    const route = routes.find(r => r.id === routeId)
    if (!route) return
    setForm(prev => ({
      ...prev,
      loadingLocation: route.loadingLocation,
      destination: route.destination,
      distance: route.distance,
      fuelLitres: route.defaultFuelLitres,
      dieselRate: route.defaultDieselRate,
      fuelExpense: route.defaultFuelExpense,
      toll: route.defaultToll,
      cashExpense: route.defaultCash,
    }))
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await tripsApi.create(form)
      setSuccess(true)
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  if (loading) return <div className="animate-pulse"><div className="h-8 bg-slate-200 rounded w-48 mb-4" /><div className="h-64 bg-slate-200 rounded-lg" /></div>

  if (success) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <CheckIcon className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Trip Saved!</h2>
        <p className="text-sm text-slate-500 mb-6">The trip has been recorded successfully.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => { setSuccess(false); setStep(0); setForm({ vehicleId: '', loadingLocation: '', destination: '', distance: '', fuelLitres: '', dieselRate: '', fuelExpense: '', toll: '', cashExpense: '', loadingSlipNumber: '', tripDate: new Date().toISOString().slice(0, 10) }) }} className="btn-secondary">Log Another</button>
          <button onClick={() => navigate('/trips')} className="btn-primary">View Trips</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title={t('logTrip') || 'Log Trip'} subtitle="Fill the details and save" />

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              i <= step ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
            }`}>{i + 1}</div>
            <span className={`text-xs font-medium ${i <= step ? 'text-slate-900' : 'text-slate-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`w-12 h-0.5 ${i < step ? 'bg-blue-600' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 0: Vehicle + Details (merged) */}
      {step === 0 && (
        <div className="card p-5 space-y-4">
          {/* Vehicle Selection — dropdown instead of full grid */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle *</label>
            <select
              className="inp"
              value={form.vehicleId}
              onChange={e => setForm({ ...form, vehicleId: e.target.value })}
              required
            >
              <option value="">Select vehicle...</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.vehicleNumber} — {v.vehicleType}</option>
              ))}
            </select>
          </div>

          {/* Photo Scan */}
          <div className="border border-dashed border-slate-300 rounded-lg p-4 text-center">
            <input type="file" ref={fileRef} accept="image/*" capture="environment" className="hidden" onChange={handleScan} />
            <button onClick={() => fileRef.current?.click()} disabled={scanning} className="btn-secondary text-xs">
              <UploadIcon className="w-4 h-4 inline mr-1" />
              {scanning ? 'Reading...' : 'Take Photo of Slip'}
            </button>
            <p className="text-[11px] text-slate-400 mt-1">We'll read vehicle number, route & date from the photo</p>
          </div>

          {/* Saved Route Quick-fill */}
          {routes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Use Saved Route</label>
              <select className="inp" onChange={e => handleRouteSelect(e.target.value)} defaultValue="">
                <option value="">Select route to auto-fill...</option>
                {routes.map(r => <option key={r.id} value={r.id}>{r.shortName}</option>)}
              </select>
            </div>
          )}

          {/* Route */}
          <div className="pt-2 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Route</div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">From</label>
                <input className="inp" value={form.loadingLocation} onChange={e => setForm({...form, loadingLocation: e.target.value})} placeholder="Loading point" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">To</label>
                <input className="inp" value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} placeholder="Destination" /></div>
            </div>
          </div>

          {/* Expenses */}
          <div className="pt-2 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Expenses</div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Distance (km)</label>
                <input className="inp" type="number" value={form.distance} onChange={e => setForm({...form, distance: e.target.value})} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Toll (₹)</label>
                <input className="inp" type="number" value={form.toll} onChange={e => setForm({...form, toll: e.target.value})} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Cash Given (₹)</label>
                <input className="inp" type="number" value={form.cashExpense} onChange={e => setForm({...form, cashExpense: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Fuel (Litres)</label>
                <input className="inp" type="number" value={form.fuelLitres} onChange={e => updateFuel('fuelLitres', e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Price/Litre (₹)</label>
                <input className="inp" type="number" value={form.dieselRate} onChange={e => updateFuel('dieselRate', e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Fuel Cost (₹)</label>
                <input className="inp" type="number" value={form.fuelExpense} onChange={e => setForm({...form, fuelExpense: e.target.value})} placeholder="Auto-calculated" /></div>
            </div>
          </div>

          {/* Other Details */}
          <div className="pt-2 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Slip Number</label>
                <input className="inp" value={form.loadingSlipNumber} onChange={e => setForm({...form, loadingSlipNumber: e.target.value})} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Trip Date</label>
                <input className="inp" type="date" value={form.tripDate} onChange={e => setForm({...form, tripDate: e.target.value})} /></div>
            </div>
          </div>

          <div className="pt-2">
            <button onClick={() => setStep(1)} disabled={!form.vehicleId} className="btn-primary w-full">Next → Review</button>
            {!form.vehicleId && <p className="text-[11px] text-amber-600 mt-1 text-center">Please select a vehicle first</p>}
          </div>
        </div>
      )}

      {/* Step 1: Review */}
      {step === 1 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Review & Confirm</h3>
          <div className="grid grid-cols-2 gap-3 text-sm mb-6">
            <ReviewRow label="Vehicle" value={selectedVehicle?.vehicleNumber} />
            <ReviewRow label="From" value={form.loadingLocation || '-'} />
            <ReviewRow label="To" value={form.destination || '-'} />
            <ReviewRow label="Distance" value={`${form.distance || 0} km`} />
            <ReviewRow label="Fuel" value={`₹${form.fuelExpense || 0}`} />
            <ReviewRow label="Toll" value={`₹${form.toll || 0}`} />
            <ReviewRow label="Cash" value={`₹${form.cashExpense || 0}`} />
            <ReviewRow label="Date" value={form.tripDate || '-'} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="btn-secondary flex-1">Back</button>
            <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save Trip'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ReviewRow({ label, value }) {
  return (
    <div className="py-2 border-b border-slate-100">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="font-medium text-slate-800">{value}</div>
    </div>
  )
}
