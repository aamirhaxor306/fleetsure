import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { trips as tripsApi, vehicles as vehiclesApi, drivers as driversApi } from '../api'
import PageHeader from '../components/PageHeader'
import KPICard from '../components/KPICard'
import StatusDot from '../components/StatusDot'
import { MapPinIcon, UserIcon, CalendarIcon, TruckIcon } from '../components/Icons'

export default function TripDetail() {
 const { id } = useParams()
 const [trip, setTrip] = useState(null)
 const [loading, setLoading] = useState(true)
 const [editing, setEditing] = useState(false)
 const [saving, setSaving] = useState(false)
 const [vehicleList, setVehicleList] = useState([])
 const [driverList, setDriverList] = useState([])
 const [form, setForm] = useState({})

 useEffect(() => {
 tripsApi.get(id).then(setTrip).catch(() => {}).finally(() => setLoading(false))
 }, [id])

 const startEdit = async () => {
 const [vList, dList] = await Promise.all([vehiclesApi.list(), driversApi.list()])
 setVehicleList(vList || [])
 setDriverList(dList || [])
 setForm({
 vehicleId: trip.vehicle?.id || trip.vehicleId || '',
 driverId: trip.driver?.id || trip.driverId || '',
 loadingLocation: trip.loadingLocation || '',
 destination: trip.destination || '',
 freightAmount: trip.freightAmount || '',
 distance: trip.distance || 0,
 fuelExpense: trip.fuelExpense || 0,
 toll: trip.toll || 0,
 cashExpense: trip.cashExpense || 0,
 tripDate: trip.tripDate ? new Date(trip.tripDate).toISOString().slice(0, 10) : '',
 loadingSlipNumber: trip.loadingSlipNumber || '',
 })
 setEditing(true)
 }

 const cancelEdit = () => { setEditing(false); setForm({}) }

 const saveEdit = async () => {
 setSaving(true)
 try {
 await tripsApi.update(id, form)
 const updated = await tripsApi.get(id)
 setTrip(updated)
 setEditing(false)
 } catch (err) {
 console.error('Save failed:', err)
 } finally {
 setSaving(false)
 }
 }

 const onField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

 if (loading) return <div className="animate-pulse"><div className="h-8 bg-slate-200 rounded w-48 mb-4" /><div className="h-64 bg-slate-200 rounded-lg" /></div>
 if (!trip) return <div className="text-center py-12 text-slate-500">Trip not found</div>

 const cost = (trip.fuelExpense || 0) + (trip.toll || 0) + (trip.cashExpense || 0)
 const profit = (trip.freightAmount || 0) - cost
 const margin = trip.freightAmount ? Math.round((profit / trip.freightAmount) * 100) : 0
 const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`
 const shortLoc = (s) => { const p = (s || '').split(' - '); return p.length > 1 ? p.slice(1).join(' - ').trim() : s || '-' }

 const waterfallData = [
 { name: 'Freight', value: trip.freightAmount || 0, fill: '#10b981' },
 { name: 'Fuel', value: -(trip.fuelExpense || 0), fill: '#ef4444' },
 { name: 'Toll', value: -(trip.toll || 0), fill: '#f59e0b' },
 { name: 'Cash', value: -(trip.cashExpense || 0), fill: '#8b5cf6' },
 { name: 'Profit', value: profit, fill: profit >= 0 ? '#2563eb' : '#ef4444' },
 ]

 const similarTrips = trip.similarTrips || []
 const avgFreight = similarTrips.length > 0 ? Math.round(similarTrips.reduce((s, t) => s + (t.freightAmount || 0), 0) / similarTrips.length) : 0
 const avgCost = similarTrips.length > 0 ? Math.round(similarTrips.reduce((s, t) => s + (t.fuelExpense || 0) + (t.toll || 0) + (t.cashExpense || 0), 0) / similarTrips.length) : 0

 const comparisonData = avgFreight > 0 ? [
 { name: 'This Trip', freight: trip.freightAmount || 0, cost: cost, profit: profit },
 { name: 'Route Avg', freight: avgFreight, cost: avgCost, profit: avgFreight - avgCost },
 ] : []

 const hasMap = trip.locationLogs?.length > 1 || (trip.startLat && trip.endLat)
 const ds = trip.drivingScore

 return (
 <div>
 <PageHeader
 title={`${shortLoc(trip.loadingLocation)} → ${shortLoc(trip.destination)}`}
 subtitle={`${trip.distance || 0} km · ${trip.vehicle?.vehicleNumber || ''}`}
 breadcrumbs={[{ label: 'Trips', to: '/trips' }, { label: 'Trip Detail' }]}
 actions={
 <div className="flex items-center gap-2">
 {!editing && (
 <button onClick={startEdit} className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors">
 Edit Trip
 </button>
 )}
 <StatusDot status={trip.status} label={trip.freightAmount ? 'Completed' : 'Pending'} />
 </div>
 }
 />

 {/* KPIs */}
 <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
 <KPICard label="Freight" value={trip.freightAmount ? inr(trip.freightAmount) : 'Pending'} color="blue" />
 <KPICard label="Fuel" value={inr(trip.fuelExpense || 0)} color="red" />
 <KPICard label="Toll" value={inr(trip.toll || 0)} color="amber" />
 <KPICard label="Cash" value={inr(trip.cashExpense || 0)} color="violet" />
 <KPICard label="Net Profit" value={trip.freightAmount ? inr(profit) : '-'} color={profit >= 0 ? 'emerald' : 'red'} />
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
 {/* Cost Waterfall */}
 {trip.freightAmount && (
 <div className="chart-card">
 <h3>Cost Breakdown</h3>
 <ResponsiveContainer width="100%" height={200}>
 <BarChart data={waterfallData}>
 <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
 <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
 <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₹${Math.abs(v / 1000).toFixed(0)}k`} />
 <Tooltip formatter={v => inr(Math.abs(v))} />
 <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
 {waterfallData.map((d, i) => <Cell key={i} fill={d.fill} />)}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 </div>
 )}

 {/* Trip Info Card — read or edit mode */}
 {editing ? (
 <div className="card p-5">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-sm font-semibold text-slate-700">Edit Trip</h3>
 <div className="flex gap-2">
 <button onClick={cancelEdit} className="px-3 py-1.5 text-xs font-medium bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors">
 Cancel
 </button>
 <button onClick={saveEdit} disabled={saving}
 className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
 {saving ? 'Saving...' : 'Save'}
 </button>
 </div>
 </div>
 <div className="space-y-3">
 <EditField label="Vehicle">
 <select value={form.vehicleId} onChange={e => onField('vehicleId', e.target.value)} className="edit-input">
 <option value="">Select vehicle</option>
 {vehicleList.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}
 </select>
 </EditField>
 <EditField label="Driver">
 <select value={form.driverId} onChange={e => onField('driverId', e.target.value)} className="edit-input">
 <option value="">No driver</option>
 {driverList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
 </select>
 </EditField>
 <EditField label="From">
 <input value={form.loadingLocation} onChange={e => onField('loadingLocation', e.target.value)} className="edit-input" />
 </EditField>
 <EditField label="To">
 <input value={form.destination} onChange={e => onField('destination', e.target.value)} className="edit-input" />
 </EditField>
 <EditField label="Date">
 <input type="date" value={form.tripDate} onChange={e => onField('tripDate', e.target.value)} className="edit-input" />
 </EditField>
 <EditField label="Distance (km)">
 <input type="number" value={form.distance} onChange={e => onField('distance', e.target.value)} className="edit-input" />
 </EditField>
 <div className="border-t border-slate-100 pt-3 mt-1">
 <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Financials</div>
 </div>
 <EditField label="Freight (₹)">
 <input type="number" value={form.freightAmount} onChange={e => onField('freightAmount', e.target.value)} className="edit-input" placeholder="0" />
 </EditField>
 <EditField label="Fuel (₹)">
 <input type="number" value={form.fuelExpense} onChange={e => onField('fuelExpense', e.target.value)} className="edit-input" />
 </EditField>
 <EditField label="Toll (₹)">
 <input type="number" value={form.toll} onChange={e => onField('toll', e.target.value)} className="edit-input" />
 </EditField>
 <EditField label="Cash Expense (₹)">
 <input type="number" value={form.cashExpense} onChange={e => onField('cashExpense', e.target.value)} className="edit-input" />
 </EditField>
 <EditField label="Slip #">
 <input value={form.loadingSlipNumber} onChange={e => onField('loadingSlipNumber', e.target.value)} className="edit-input" placeholder="Optional" />
 </EditField>
 </div>
 </div>
 ) : (
 <div className="card p-5 space-y-4">
 <h3 className="text-sm font-semibold text-slate-700 mb-3">Trip Details</h3>

 <InfoRow icon={TruckIcon} label="Vehicle" value={trip.vehicle?.vehicleNumber || '-'} sub={trip.vehicle?.vehicleType} />
 {trip.driver && <InfoRow icon={UserIcon} label="Driver" value={trip.driver.name} sub={trip.driver.phone} />}
 <InfoRow icon={MapPinIcon} label="From" value={shortLoc(trip.loadingLocation)} />
 <InfoRow icon={MapPinIcon} label="To" value={shortLoc(trip.destination)} />
 <InfoRow icon={CalendarIcon} label="Date" value={trip.tripDate ? new Date(trip.tripDate).toLocaleDateString() : '-'} />

 {trip.loadingSlipNumber && (
 <div className="pt-3 border-t border-slate-100">
 <span className="text-xs text-slate-400">Slip #</span>
 <span className="ml-2 font-mono text-sm">{trip.loadingSlipNumber}</span>
 </div>
 )}

 {trip.loadingSlipImageUrl && (
 <div className="pt-2">
 <img src={trip.loadingSlipImageUrl} alt="Loading slip" className="rounded-lg border border-slate-200 max-h-40 object-contain" />
 </div>
 )}
 </div>
 )}
 </div>

 {/* Driving Behavior Card */}
 {ds && (
 <div className="card p-5 mb-6">
 <h3 className="text-sm font-semibold text-slate-700 mb-4">Driving Behavior</h3>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 {/* Score Gauge */}
 <div className="flex flex-col items-center">
 <ScoreGauge score={ds.overallScore} />
 <div className="mt-2 text-xs text-slate-400">
 {ds.overallScore >= 80 ? 'Excellent Driver' : ds.overallScore >= 60 ? 'Good Driver' : ds.overallScore >= 40 ? 'Needs Improvement' : 'Poor Driving'}
 </div>
 </div>

 {/* Sub-scores */}
 <div className="space-y-3">
 <SubScoreBar label="Speed" value={ds.speedScore} icon="" />
 <SubScoreBar label="Braking" value={ds.brakingScore} icon="" />
 <SubScoreBar label="Acceleration" value={ds.accelerationScore} icon="" />
 <SubScoreBar label="Cornering" value={ds.corneringScore} icon="" />
 </div>

 {/* Stats */}
 <div className="grid grid-cols-2 gap-3">
 <StatBox label="Avg Speed" value={`${Math.round(ds.avgSpeed)} km/h`} />
 <StatBox label="Max Speed" value={`${Math.round(ds.maxSpeed)} km/h`} color={ds.maxSpeed > 70 ? 'red' : undefined} />
 <StatBox label="Distance" value={`${ds.totalDistanceKm.toFixed(1)} km`} />
 <StatBox label="Duration" value={`${Math.round(ds.totalDurationMin)} min`} />
 <StatBox label="Over Speed" value={`${ds.overspeedingPct}%`} color={ds.overspeedingPct > 10 ? 'red' : undefined} />
 <StatBox label="Hard Stops" value={`${ds.harshBrakeCount + ds.harshAccelCount + ds.sharpTurnCount}`} color={(ds.harshBrakeCount + ds.harshAccelCount + ds.sharpTurnCount) > 3 ? 'amber' : undefined} />
 </div>
 </div>

 {/* Event Timeline */}
 {trip.drivingEvents?.length > 0 && (
 <div className="mt-5 pt-4 border-t border-slate-100">
 <h4 className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Driving Events</h4>
 <div className="space-y-2">
 {trip.drivingEvents.map((ev, i) => (
 <div key={i} className="flex items-center gap-3 text-sm">
 <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
 ev.type === 'harsh_brake' ? 'bg-red-500' :
 ev.type === 'harsh_accel' ? 'bg-amber-500' :
 ev.type === 'sharp_turn' ? 'bg-blue-500' : 'bg-slate-400'
 }`} />
 <span className="text-slate-600 capitalize">{ev.type.replace(/_/g, ' ')}</span>
 <span className="text-slate-400 text-xs">
 {ev.severity.toFixed(1)}g @ {ev.speed ? `${Math.round(ev.speed)} km/h` : '-'}
 </span>
 <span className="text-slate-400 text-xs ml-auto">
 {new Date(ev.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
 </span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}

 {/* Route Map */}
 {hasMap && (
 <div className="card overflow-hidden mb-6">
 <div className="px-4 py-3 border-b border-slate-100">
 <h3 className="text-sm font-semibold text-slate-700">Route Map</h3>
 </div>
 <RouteMap trip={trip} />
 </div>
 )}

 {/* Similar Trips Comparison */}
 {comparisonData.length > 0 && (
 <div className="chart-card mb-6">
 <h3>This Trip vs Route Average ({similarTrips.length} similar trips)</h3>
 <ResponsiveContainer width="100%" height={200}>
 <BarChart data={comparisonData}>
 <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
 <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
 <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
 <Tooltip formatter={v => inr(v)} />
 <Bar dataKey="freight" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={20} name="Freight" />
 <Bar dataKey="cost" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} name="Cost" />
 <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} name="Profit" />
 </BarChart>
 </ResponsiveContainer>
 </div>
 )}
 </div>
 )
}

// ── Score Gauge (SVG circular gauge) ──────────────────────────────────────
function ScoreGauge({ score }) {
 const r = 54
 const circ = 2 * Math.PI * r
 const offset = circ * (1 - score / 100)
 const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'

 return (
 <div className="relative" style={{ width: 140, height: 140 }}>
 <svg viewBox="0 0 140 140" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
 <circle cx="70" cy="70" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
 <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="8"
 strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
 style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
 </svg>
 <div className="absolute inset-0 flex flex-col items-center justify-center">
 <span className="text-3xl font-extrabold text-slate-900">{score}</span>
 <span className="text-xs text-slate-400">/100</span>
 </div>
 </div>
 )
}

// ── Sub-score horizontal bar ──────────────────────────────────────────────
function SubScoreBar({ label, value, icon }) {
 const color = value >= 80 ? '#22c55e' : value >= 60 ? '#f59e0b' : '#ef4444'
 return (
 <div>
 <div className="flex items-center justify-between mb-1">
 <span className="text-xs text-slate-500">{icon} {label}</span>
 <span className="text-sm font-bold" style={{ color }}>{value}</span>
 </div>
 <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
 <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
 </div>
 </div>
 )
}

// ── Stat Box ──────────────────────────────────────────────────────────────
function StatBox({ label, value, color }) {
 const textColor = color === 'red' ? 'text-red-500' : color === 'amber' ? 'text-amber-500' : 'text-slate-900'
 return (
 <div className="bg-slate-50 rounded-lg p-2.5">
 <div className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</div>
 <div className={`text-sm font-bold ${textColor}`}>{value}</div>
 </div>
 )
}

function EditField({ label, children }) {
 return (
 <div className="flex items-center gap-3">
 <label className="text-xs text-slate-500 w-24 shrink-0">{label}</label>
 <div className="flex-1">{children}</div>
 </div>
 )
}

function InfoRow({ icon: Icon, label, value, sub }) {
 return (
 <div className="flex items-start gap-3">
 <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100"><Icon className="w-4 h-4 text-slate-500" /></div>
 <div>
 <div className="text-xs text-slate-400">{label}</div>
 <div className="text-sm font-medium text-slate-900">{value}</div>
 {sub && <div className="text-xs text-slate-400">{sub}</div>}
 </div>
 </div>
 )
}

function RouteMap({ trip }) {
 const [MapReady, setMapReady] = useState(false)
 const [leaflet, setLeaflet] = useState(null)

 useEffect(() => {
 Promise.all([
 import('react-leaflet'),
 import('leaflet/dist/leaflet.css'),
 import('leaflet'),
 ]).then(([rl, , L]) => {
 setLeaflet({ ...rl, L: L.default || L })
 setMapReady(true)
 }).catch(() => {})
 }, [])

 if (!MapReady || !leaflet) return <div className="h-64 bg-slate-100 flex items-center justify-center text-sm text-slate-400">Loading map...</div>

 const { MapContainer, TileLayer, Polyline, CircleMarker, Popup } = leaflet
 const locs = trip.locationLogs || []
 const positions = locs.map(l => [l.latitude, l.longitude])

 // If no GPS logs but have start/end coords
 if (positions.length === 0 && trip.startLat && trip.endLat) {
 positions.push([trip.startLat, trip.startLng])
 positions.push([trip.endLat, trip.endLng])
 }

 if (positions.length === 0) return null

 const center = positions[Math.floor(positions.length / 2)]
 const events = trip.drivingEvents || []

 const eventColor = (type) => {
 if (type === 'harsh_brake') return '#ef4444'
 if (type === 'harsh_accel') return '#f59e0b'
 if (type === 'sharp_turn') return '#3b82f6'
 return '#94a3b8'
 }

 return (
 <MapContainer center={center} zoom={7} style={{ height: '300px', width: '100%' }} scrollWheelZoom={false}>
 <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
 {positions.length > 1 && <Polyline positions={positions} color="#2563eb" weight={3} />}
 {events.map((ev, i) => (
 <CircleMarker key={i} center={[ev.latitude, ev.longitude]} radius={6}
 pathOptions={{ color: eventColor(ev.type), fillColor: eventColor(ev.type), fillOpacity: 0.8, weight: 2 }}>
 <Popup>
 <div className="text-xs">
 <strong className="capitalize">{ev.type.replace(/_/g, ' ')}</strong><br/>
 {ev.severity.toFixed(1)}g @ {ev.speed ? `${Math.round(ev.speed)} km/h` : '-'}
 </div>
 </Popup>
 </CircleMarker>
 ))}
 </MapContainer>
 )
}
