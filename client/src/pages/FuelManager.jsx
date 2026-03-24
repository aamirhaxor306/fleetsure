import { useState, useEffect } from 'react'
import { fuel as api, vehicles as vehiclesApi } from '../api'
import PageHeader from '../components/PageHeader'

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

const FUEL_TYPES = [
 { value: 'diesel', label: 'Diesel' },
 { value: 'petrol', label: 'Petrol' },
 { value: 'cng', label: 'CNG' },
 { value: 'electric', label: 'Electric' },
]

const PAY_MODES = ['Cash', 'UPI', 'Card', 'Credit', 'Fleet Card']

const EMPTY_FORM = {
 vehicleId: '', litres: '', ratePerLitre: '', odometerKm: '',
 vendorName: '', vendorLocation: '', fuelType: 'diesel',
 paymentMode: 'Cash', billNumber: '', notes: '',
 fuelDate: new Date().toISOString().slice(0, 10),
}

export default function FuelManager() {
 const [logs, setLogs] = useState([])
 const [stats, setStats] = useState(null)
 const [vehicles, setVehicles] = useState([])
 const [loading, setLoading] = useState(true)
 const [tab, setTab] = useState('history')
 const [showAdd, setShowAdd] = useState(false)
 const [saving, setSaving] = useState(false)
 const [filterVehicle, setFilterVehicle] = useState('all')

 const [showSms, setShowSms] = useState(false)
 const [smsText, setSmsText] = useState('')
 const [smsParsing, setSmsParsing] = useState(false)
 const [smsResult, setSmsResult] = useState(null)

 const [form, setForm] = useState({ ...EMPTY_FORM })

 useEffect(() => {
 Promise.allSettled([api.list(), api.stats(), vehiclesApi.list()])
 .then(([l, s, v]) => {
 if (l.status === 'fulfilled') setLogs(l.value)
 if (s.status === 'fulfilled') setStats(s.value)
 if (v.status === 'fulfilled') setVehicles(v.value)
 setLoading(false)
 })
 }, [])

 const filteredLogs = filterVehicle === 'all' ? logs : logs.filter(l => l.vehicleId === filterVehicle)

 const cost = form.litres && form.ratePerLitre ? (parseFloat(form.litres) * parseFloat(form.ratePerLitre)).toFixed(2) : ''

 const handleParseSms = async () => {
 if (!smsText.trim()) return
 setSmsParsing(true)
 setSmsResult(null)
 try {
 const res = await api.parseSms(smsText)
 if (res.parsed) {
 const d = res.data
 setForm({
 vehicleId: d.vehicleId || '',
 litres: d.litres ? String(d.litres) : '',
 ratePerLitre: d.ratePerLitre ? String(d.ratePerLitre) : '',
 odometerKm: '',
 vendorName: d.vendorName || '',
 vendorLocation: d.vendorLocation || '',
 fuelType: d.fuelType || 'diesel',
 paymentMode: 'Fleet Card',
 billNumber: d.billNumber || '',
 notes: `Auto-parsed from ${d.provider || 'SMS'}`,
 fuelDate: d.fuelDate || new Date().toISOString().slice(0, 10),
 })
 setSmsResult({ success: true, provider: d.provider })
 setShowSms(false)
 setShowAdd(true)
 } else {
 setSmsResult({ success: false, message: res.message || 'Could not parse SMS' })
 }
 } catch (err) {
 setSmsResult({ success: false, message: err.message })
 }
 setSmsParsing(false)
 }

 const handleAdd = async (e) => {
 e.preventDefault()
 setSaving(true)
 try {
 const log = await api.create(form)
 setLogs(prev => [log, ...prev])
 setShowAdd(false)
 setForm({ ...EMPTY_FORM })
 const newStats = await api.stats()
 setStats(newStats)
 } catch (err) { alert(err.message) }
 setSaving(false)
 }

 if (loading) return (
 <div className="animate-pulse space-y-4">
 <div className="h-8 bg-slate-200 rounded w-48" />
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-200 rounded-2xl" />)}
 </div>
 <div className="h-64 bg-slate-200 rounded-2xl" />
 </div>
 )

 return (
 <div className="space-y-5">
 <PageHeader
 title="Fuel Management"
 subtitle={`${logs.length} fill-ups tracked`}
 action={
 <div className="flex gap-2">
 <button onClick={() => { setShowSms(true); setSmsText(''); setSmsResult(null) }} className="btn-secondary text-xs">
 Paste SMS
 </button>
 <button onClick={() => { setForm({ ...EMPTY_FORM }); setShowAdd(true) }} className="btn-primary">+ Log Fuel</button>
 </div>
 }
 />

 {/* Stats overview */}
 {stats && (
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 <StatCard label="Total Fills" value={stats.totalFills} />
 <StatCard label="Total Litres" value={`${Math.round(stats.totalLitres).toLocaleString('en-IN')} L`} />
 <StatCard label="Total Spend" value={inr(Math.round(stats.totalCost))} />
 <StatCard label="Avg Rate / L" value={`₹${stats.avgRate.toFixed(2)}`} />
 </div>
 )}

 {/* Tabs */}
 <div className="flex gap-2 border-b border-slate-200">
 {['history', 'vendors'].map(t => (
 <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all capitalize ${tab === t ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
 {t === 'history' ? 'Fill-up History' : 'Vendor Analytics'}
 </button>
 ))}
 </div>

 {/* History tab */}
 {tab === 'history' && (
 <>
 <div className="flex gap-2">
 <select className="inp !w-auto text-xs" value={filterVehicle} onChange={e => setFilterVehicle(e.target.value)}>
 <option value="all">All Vehicles</option>
 {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}
 </select>
 </div>

 <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
 {filteredLogs.length === 0 ? (
 <div className="py-16 text-center">
 <div className="text-3xl mb-2"></div>
 <div className="text-sm font-semibold text-slate-700">No fuel records</div>
 <p className="text-xs text-slate-400 mt-1">Log your first fill-up or paste a fuel SMS</p>
 <div className="mt-4 flex items-center justify-center gap-2">
 <button onClick={() => setShowSms(true)} className="btn-secondary text-xs">Paste SMS</button>
 <button onClick={() => setShowAdd(true)} className="btn-primary text-xs">Log First Fill-up</button>
 </div>
 </div>
 ) : (
 <div className="divide-y divide-slate-100">
 {filteredLogs.map(log => (
 <div key={log.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-lg shrink-0"></div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="text-sm font-semibold text-slate-800">{log.vehicle?.vehicleNumber}</span>
 <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 uppercase">{log.fuelType}</span>
 </div>
 <div className="text-xs text-slate-500 mt-0.5">
 {log.vendorName && <span className="font-medium text-teal-600">{log.vendorName}</span>}
 {log.vendorName && log.vendorLocation && <span> — </span>}
 {log.vendorLocation && <span>{log.vendorLocation}</span>}
 {!log.vendorName && !log.vendorLocation && 'No vendor info'}
 </div>
 </div>
 <div className="text-right shrink-0">
 <div className="text-sm font-bold text-slate-800">{inr(log.totalCost)}</div>
 <div className="text-[11px] text-slate-400">{log.litres}L @ ₹{log.ratePerLitre}/L</div>
 </div>
 </div>
 <div className="flex items-center gap-4 ml-14 mt-1.5">
 <span className="text-[11px] text-slate-400">
 {new Date(log.fuelDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
 </span>
 {log.odometerKm && <span className="text-[11px] text-slate-400"> {log.odometerKm.toLocaleString()} km</span>}
 {log.paymentMode && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-600">{log.paymentMode}</span>}
 {log.billNumber && <span className="text-[11px] text-slate-400">Bill: {log.billNumber}</span>}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </>
 )}

 {/* Vendor tab */}
 {tab === 'vendors' && stats?.vendors && (
 <div className="space-y-3">
 {stats.vendors.length === 0 ? (
 <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center">
 <div className="text-3xl mb-2"></div>
 <div className="text-sm font-semibold text-slate-700">No vendor data yet</div>
 <p className="text-xs text-slate-400 mt-1">Add vendor names when logging fuel</p>
 </div>
 ) : (
 stats.vendors.map((v, i) => (
 <div key={v.name} className="bg-white rounded-2xl border border-slate-200 p-5">
 <div className="flex items-center gap-3 mb-3">
 <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center text-sm font-bold text-teal-700 shrink-0">{i + 1}</div>
 <div className="flex-1">
 <div className="text-sm font-bold text-slate-800">{v.name}</div>
 <div className="text-xs text-slate-400">{v.fills} fill-up{v.fills > 1 ? 's' : ''}</div>
 </div>
 <div className="text-right">
 <div className="text-sm font-bold text-slate-800">{inr(Math.round(v.cost))}</div>
 <div className="text-[11px] text-slate-400">{Math.round(v.litres).toLocaleString()} L</div>
 </div>
 </div>
 <div className="w-full bg-slate-100 rounded-full h-2">
 <div
 className="bg-teal-500 h-2 rounded-full transition-all"
 style={{ width: `${Math.min(100, (v.fills / stats.totalFills) * 100)}%` }}
 />
 </div>
 </div>
 ))
 )}
 </div>
 )}

 {/* SMS Parse Modal */}
 {showSms && (
 <>
 <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setShowSms(false)} />
 <div className="fixed inset-x-4 top-[15%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg bg-white rounded-2xl shadow-2xl z-50">
 <div className="p-6">
 <h3 className="text-lg font-bold text-slate-900 mb-1">Paste Fuel SMS</h3>
 <p className="text-xs text-slate-500 mb-4">
 Paste your HPCL / IOCL / BPCL fleet card SMS and we'll auto-fill the fuel form.
 </p>

 <textarea
 className="inp min-h-[120px] text-sm"
 placeholder={"Paste your fuel SMS here...\n\nExample: Your HPCL Fleet Card ending 1234 used for Rs.5340.00 at HP Sharma Fuels Pune for 59.55 Ltrs of HSD on 17-Feb-2026"}
 value={smsText}
 onChange={e => { setSmsText(e.target.value); setSmsResult(null) }}
 autoFocus
 />

 {smsResult && !smsResult.success && (
 <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200">
 <div className="text-xs font-semibold text-red-700">{smsResult.message}</div>
 <div className="text-[11px] text-red-500 mt-1">Try a different SMS format or log manually.</div>
 </div>
 )}

 <div className="flex gap-3 mt-4">
 <button type="button" onClick={() => setShowSms(false)} className="btn-secondary flex-1">Cancel</button>
 <button
 type="button"
 onClick={handleParseSms}
 disabled={smsParsing || !smsText.trim()}
 className="btn-primary flex-1"
 >
 {smsParsing ? 'Parsing...' : 'Parse & Fill Form'}
 </button>
 </div>

 <div className="mt-4 pt-4 border-t border-slate-100">
 <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Supported formats</div>
 <div className="flex flex-wrap gap-1.5">
 {['HPCL Fleet Card', 'IndianOil Fleet Card', 'BPCL SmartFleet', 'Generic fuel SMS'].map(f => (
 <span key={f} className="px-2 py-1 rounded-lg bg-slate-50 text-[11px] font-medium text-slate-500">{f}</span>
 ))}
 </div>
 </div>
 </div>
 </div>
 </>
 )}

 {/* Add Fuel Modal */}
 {showAdd && (
 <>
 <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setShowAdd(false)} />
 <div className="fixed inset-x-4 top-[5%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg bg-white rounded-2xl shadow-2xl z-50 max-h-[90vh] overflow-y-auto">
 <div className="p-6">
 <div className="flex items-center justify-between mb-5">
 <h3 className="text-lg font-bold text-slate-900">Log Fuel Fill-up</h3>
 {form.notes?.includes('Auto-parsed') && (
 <span className="px-2 py-1 rounded-lg bg-green-50 text-[11px] font-bold text-green-600">SMS Auto-filled</span>
 )}
 </div>
 <form onSubmit={handleAdd} className="space-y-4">
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle *</label>
 <select className="inp" value={form.vehicleId} onChange={e => setForm({...form, vehicleId: e.target.value})} required>
 <option value="">Select vehicle...</option>
 {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber} — {v.vehicleType}</option>)}
 </select>
 </div>

 <div className="grid grid-cols-3 gap-3">
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Litres *</label>
 <input className="inp" type="number" step="0.01" value={form.litres} onChange={e => setForm({...form, litres: e.target.value})} placeholder="150" required />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Rate/Litre *</label>
 <input className="inp" type="number" step="0.01" value={form.ratePerLitre} onChange={e => setForm({...form, ratePerLitre: e.target.value})} placeholder="89.50" required />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Total</label>
 <input className="inp bg-slate-50" readOnly value={cost ? `₹${parseFloat(cost).toLocaleString('en-IN')}` : ''} />
 </div>
 </div>

 <div className="bg-teal-50 rounded-xl p-4 space-y-3">
 <div className="text-xs font-semibold text-teal-700 uppercase tracking-wider">Vendor / Pump Details</div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Vendor / Pump Name</label>
 <input className="inp" value={form.vendorName} onChange={e => setForm({...form, vendorName: e.target.value})} placeholder="HP Petrol Pump" />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
 <input className="inp" value={form.vendorLocation} onChange={e => setForm({...form, vendorLocation: e.target.value})} placeholder="NH-48, Pune" />
 </div>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Fuel Type</label>
 <select className="inp" value={form.fuelType} onChange={e => setForm({...form, fuelType: e.target.value})}>
 {FUEL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Payment Mode</label>
 <select className="inp" value={form.paymentMode} onChange={e => setForm({...form, paymentMode: e.target.value})}>
 {PAY_MODES.map(m => <option key={m} value={m}>{m}</option>)}
 </select>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Odometer (km)</label>
 <input className="inp" type="number" value={form.odometerKm} onChange={e => setForm({...form, odometerKm: e.target.value})} placeholder="125000" />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Bill Number</label>
 <input className="inp" value={form.billNumber} onChange={e => setForm({...form, billNumber: e.target.value})} placeholder="INV-0042" />
 </div>
 </div>

 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
 <input className="inp" type="date" value={form.fuelDate} onChange={e => setForm({...form, fuelDate: e.target.value})} required />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
 <input className="inp" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Any additional info..." />
 </div>

 <div className="flex gap-3 pt-2">
 <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
 <button type="submit" disabled={saving || !form.vehicleId || !form.litres || !form.ratePerLitre} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save Fuel Log'}</button>
 </div>
 </form>
 </div>
 </div>
 </>
 )}
 </div>
 )
}

function StatCard({ label, value }) {
 return (
 <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
 <div className="text-xl font-bold text-slate-800">{value}</div>
 <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{label}</div>
 </div>
 )
}
