import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { vehicles as vehiclesApi, trips as tripsApi, savedRoutes as savedRoutesApi, ocr as ocrApi } from '../api'
import { useLang } from '../context/LanguageContext'
import PageHeader from '../components/PageHeader'
import { TruckIcon, CheckIcon, UploadIcon } from '../components/Icons'

const STEPS = ['Vehicle', 'Details', 'Review']

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

  const handleScan = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    try {
      const result = await ocrApi.scanLoadingSlip(file)
      if (result) {
        setForm(prev => ({
          ...prev,
          loadingLocation: result.loadingLocation || prev.loadingLocation,
          destination: result.destination || prev.destination,
          loadingSlipNumber: result.slipNumber || prev.loadingSlipNumber,
        }))
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
        <h2 className="text-lg font-bold text-slate-900 mb-1">Trip Logged</h2>
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
      <PageHeader title={t('logTrip') || 'Log Trip'} subtitle="Record a new trip in 3 steps" />

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

      {/* Step 0: Vehicle Selection */}
      {step === 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Select Vehicle</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {vehicles.map(v => (
              <button
                key={v.id}
                onClick={() => { setForm({ ...form, vehicleId: v.id }); setStep(1) }}
                className={`card p-4 text-left transition-all hover:border-blue-300 ${form.vehicleId === v.id ? 'border-blue-500 ring-2 ring-blue-100' : ''}`}
              >
                <TruckIcon className="w-5 h-5 text-slate-400 mb-2" />
                <div className="font-mono font-bold text-sm">{v.vehicleNumber}</div>
                <div className="text-xs text-slate-400 capitalize">{v.vehicleType}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Details */}
      {step === 1 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-700">Trip Details</h3>
            <span className="text-xs text-slate-400 font-mono">{selectedVehicle?.vehicleNumber}</span>
          </div>

          {/* OCR Scan */}
          <div className="border border-dashed border-slate-300 rounded-lg p-4 text-center">
            <input type="file" ref={fileRef} accept="image/*" capture="environment" className="hidden" onChange={handleScan} />
            <button onClick={() => fileRef.current?.click()} disabled={scanning} className="btn-secondary text-xs">
              <UploadIcon className="w-4 h-4 inline mr-1" />
              {scanning ? 'Scanning...' : 'Scan Loading Slip (OCR)'}
            </button>
          </div>

          {/* Saved Route Quick-fill */}
          {routes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Quick-fill from Saved Route</label>
              <select className="inp" onChange={e => handleRouteSelect(e.target.value)} defaultValue="">
                <option value="">Select route...</option>
                {routes.map(r => <option key={r.id} value={r.id}>{r.shortName}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">From</label>
              <input className="inp" value={form.loadingLocation} onChange={e => setForm({...form, loadingLocation: e.target.value})} placeholder="Loading point" /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">To</label>
              <input className="inp" value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} placeholder="Destination" /></div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Distance (km)</label>
              <input className="inp" type="number" value={form.distance} onChange={e => setForm({...form, distance: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Toll (₹)</label>
              <input className="inp" type="number" value={form.toll} onChange={e => setForm({...form, toll: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Cash (₹)</label>
              <input className="inp" type="number" value={form.cashExpense} onChange={e => setForm({...form, cashExpense: e.target.value})} /></div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Fuel (L)</label>
              <input className="inp" type="number" value={form.fuelLitres} onChange={e => setForm({...form, fuelLitres: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Diesel Rate</label>
              <input className="inp" type="number" value={form.dieselRate} onChange={e => setForm({...form, dieselRate: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Fuel Cost (₹)</label>
              <input className="inp" type="number" value={form.fuelExpense} onChange={e => setForm({...form, fuelExpense: e.target.value})} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Slip Number</label>
              <input className="inp" value={form.loadingSlipNumber} onChange={e => setForm({...form, loadingSlipNumber: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Trip Date</label>
              <input className="inp" type="date" value={form.tripDate} onChange={e => setForm({...form, tripDate: e.target.value})} /></div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep(0)} className="btn-secondary flex-1">Back</button>
            <button onClick={() => setStep(2)} className="btn-primary flex-1">Review</button>
          </div>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 2 && (
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
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">Back</button>
            <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Log Trip'}</button>
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
