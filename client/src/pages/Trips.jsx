import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { trips as tripsApi } from '../api'
import { useLang } from '../context/LanguageContext'
import { SearchIcon, PlusIcon, MapPinIcon, TruckIcon, CalendarIcon, RouteIcon, ChevronRightIcon, UploadIcon, XIcon } from '../components/Icons'

// Approximate coordinates for known LPG plant locations (for map markers)
const LOCATION_COORDS = {
 'GAIL GANDHAR BP': { lat: 21.72, lng: 73.19 },
 'INDORE LPG PLANT': { lat: 22.72, lng: 75.86 },
 'INDORE LPG': { lat: 22.72, lng: 75.86 },
 'BHOPAL-LPG': { lat: 23.26, lng: 77.41 },
 'BHOPAL LPG': { lat: 23.26, lng: 77.41 },
 'CHERLAPALLY LPG': { lat: 17.45, lng: 78.55 },
 'JABALPUR LPG PLANT': { lat: 23.18, lng: 79.95 },
 'JABALPUR LPG': { lat: 23.18, lng: 79.95 },
 'VIJAIPUR GAIL - LPG': { lat: 24.10, lng: 77.75 },
 'VIJAIPUR GAIL': { lat: 24.10, lng: 77.75 },
 'HPC -IOTL SAVALI': { lat: 22.37, lng: 73.22 },
 'HPC IOTL SAVALI': { lat: 22.37, lng: 73.22 },
}

function getCoords(locationStr) {
 if (!locationStr) return null
 const name = locationStr.includes(' - ')
 ? locationStr.split(' - ').slice(1).join(' - ').trim()
 : locationStr.trim()
 const upper = name.toUpperCase()
 for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
 if (upper.includes(key) || key.includes(upper)) return coords
 }
 return null
}

function getTripCoords(trip) {
 const start = (trip.startLat && trip.startLng)
 ? { lat: trip.startLat, lng: trip.startLng }
 : getCoords(trip.loadingLocation)
 const end = (trip.endLat && trip.endLng)
 ? { lat: trip.endLat, lng: trip.endLng }
 : getCoords(trip.destination)
 return { start, end }
}

function downloadSampleTripsCsv() {
 const csv = `Truck,Loading,Dest,Freight,Dist,Rate,Fuel,Diesel Rate,Fuel Exp,Toll,Cash,Trip Date,Loading Slip
MP04HE9634,"12434 - GAIL GANDHAR BP","12507 - INDORE LPG PLANT",59335.45,972,3.5164,324,92.67,30025.08,7776,2000,,
`
 const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
 const url = URL.createObjectURL(blob)
 const a = document.createElement('a')
 a.href = url
 a.download = 'fleetsure-trips-sample.csv'
 a.click()
 URL.revokeObjectURL(url)
}

export default function Trips() {
 const { t } = useLang()
 const navigate = useNavigate()
 const [searchParams, setSearchParams] = useSearchParams()
 const [trips, setTrips] = useState([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [statusFilter, setStatusFilter] = useState('all')
 const [selectedTripId, setSelectedTripId] = useState(null)
 const [mapReady, setMapReady] = useState(false)
 const [leaflet, setLeaflet] = useState(null)

 const [showImport, setShowImport] = useState(false)
 const [importFile, setImportFile] = useState(null)
 const [importPreview, setImportPreview] = useState(null)
 const [importBusy, setImportBusy] = useState(false)
 const [importResult, setImportResult] = useState(null)
 const [importErr, setImportErr] = useState('')

 const runImportPreview = useCallback(async (file) => {
 if (!file) return
 setImportBusy(true)
 setImportErr('')
 setImportResult(null)
 try {
 const data = await tripsApi.importPreview(file)
 setImportPreview(data)
 } catch (e) {
 setImportPreview(null)
 setImportErr(e.message || 'Preview failed')
 }
 setImportBusy(false)
 }, [])

 const closeImport = () => {
 setShowImport(false)
 setImportFile(null)
 setImportPreview(null)
 setImportResult(null)
 setImportErr('')
 setImportBusy(false)
 }

 const handleImportFile = (e) => {
 const f = e.target.files?.[0]
 e.target.value = ''
 if (!f) return
 setImportFile(f)
 setImportPreview(null)
 setImportResult(null)
 setImportErr('')
 runImportPreview(f)
 }

 const handleImportCommit = async () => {
 if (!importFile || importPreview?.missingVehicleColumn) return
 setImportBusy(true)
 setImportErr('')
 try {
 const data = await tripsApi.importCommit(importFile)
 setImportResult(data)
 const list = await tripsApi.list({ bustCache: true })
 setTrips(Array.isArray(list) ? list : [])
 setSearch('')
 setStatusFilter('all')
 } catch (e) {
 setImportErr(e.message || 'Import failed')
 }
 setImportBusy(false)
 }

 useEffect(() => {
 if (searchParams.get('import') === '1') {
 setShowImport(true)
 setImportFile(null)
 setImportPreview(null)
 setImportResult(null)
 setImportErr('')
 const next = new URLSearchParams(searchParams)
 next.delete('import')
 setSearchParams(next, { replace: true })
 }
 }, [searchParams, setSearchParams])

 useEffect(() => {
 tripsApi.list({ bustCache: true })
 .then((list) => setTrips(Array.isArray(list) ? list : []))
 .catch(() => {})
 .finally(() => setLoading(false))
 }, [])

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

 const completed = trips.filter(t => t.freightAmount)
 const pending = trips.filter(t => !t.freightAmount)

 const filtered = trips.filter(t => {
 if (statusFilter === 'pending' && t.freightAmount) return false
 if (statusFilter === 'completed' && !t.freightAmount) return false
 if (search) {
 const q = search.toLowerCase()
 const vn = (t.vehicle?.vehicleNumber || '').toLowerCase()
 const route = `${t.loadingLocation} ${t.destination}`.toLowerCase()
 if (!vn.includes(q) && !route.includes(q)) return false
 }
 return true
 })

 const selectedTrip = trips.find(t => t.id === selectedTripId)

 const inr = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '-'
 const shortLoc = (s) => {
 const p = (s || '').split(' - ')
 return p.length > 1 ? p.slice(1).join(' - ').trim() : s || '-'
 }

 const handleTripClick = useCallback((trip) => {
 navigate(`/trips/${trip.id}`)
 }, [navigate])

 const tabs = [
 { value: 'all', label: 'All', count: trips.length },
 { value: 'completed', label: 'Completed', count: completed.length },
 { value: 'pending', label: 'Pending', count: pending.length },
 ]

 if (loading) {
 return (
 <div className="trips-loading">
 <div className="animate-pulse flex gap-4 h-full">
 <div className="w-[420px] bg-slate-100 rounded-lg" />
 <div className="flex-1 bg-slate-100 rounded-lg" />
 </div>
 </div>
 )
 }

 return (
 <div className="trips-dashboard">
 {/* Top Bar: Search + Filters + Actions */}
 <div className="trips-topbar">
 <div className="trips-topbar-left">
 <div className="trips-search">
 <SearchIcon className="trips-search-icon" />
 <input
 type="text"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search by truck number or route..."
 className="trips-search-input"
 />
 {search && (
 <button onClick={() => setSearch('')} className="trips-search-clear">&times;</button>
 )}
 </div>
 <div className="trips-tabs">
 {tabs.map((tab) => (
 <button
 key={tab.value}
 onClick={() => setStatusFilter(tab.value)}
 className={`trips-tab ${statusFilter === tab.value ? 'active' : ''}`}
 >
 {tab.label}
 <span className="trips-tab-count">{tab.count}</span>
 </button>
 ))}
 </div>
 </div>
 <div className="trips-topbar-right flex items-center gap-2">
 <button
 type="button"
 onClick={() => {
 setShowImport(true)
 setImportFile(null)
 setImportPreview(null)
 setImportResult(null)
 setImportErr('')
 }}
 className="btn-secondary flex items-center gap-1 text-xs"
 >
 <UploadIcon className="w-3.5 h-3.5" /> {t('tripImportBtn')}
 </button>
 <Link to="/quick-add" className="btn-primary flex items-center gap-1 text-xs">
 <PlusIcon className="w-3.5 h-3.5" /> Log Trip
 </Link>
 </div>
 </div>

 {/* Split Pane: List + Map */}
 <div className="trips-split">
 {/* Left Panel: Trip List */}
 <div className="trips-list-panel">
 <div className="trips-list-header">
 <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
 {filtered.length} Trip{filtered.length !== 1 ? 's' : ''}
 </span>
 </div>
 <div className="trips-list-scroll">
 {filtered.length === 0 ? (
 <div className="trips-empty">
 <RouteIcon className="w-10 h-10 text-slate-300 mb-2" />
 <div className="text-sm font-medium text-slate-400">
 {trips.length > 0 ? t('tripsListNoMatch') : 'No trips found'}
 </div>
 <div className="text-xs text-slate-300 mt-1">
 {trips.length > 0 ? t('tripsListNoMatchHint') : 'Log your first trip to start tracking'}
 </div>
 </div>
 ) : (
 filtered.map((trip) => {
 const isSelected = selectedTripId === trip.id
 const profit = trip.freightAmount
 ? trip.freightAmount - (trip.fuelExpense || 0) - (trip.toll || 0) - (trip.cashExpense || 0)
 : null
 const coords = getTripCoords(trip)
 const hasLocation = coords.start || coords.end

 return (
 <div
 key={trip.id}
 className={`trip-card ${isSelected ? 'selected' : ''}`}
 onClick={() => handleTripClick(trip)}
 >
 <div className="trip-card-top">
 <div className="trip-card-status">
 <span className={`trip-status-dot ${trip.freightAmount ? 'green' : 'amber'}`} />
 <span className="trip-card-vehicle">{trip.vehicle?.vehicleNumber || '-'}</span>
 </div>
 <div className="trip-card-actions">
 {hasLocation && <MapPinIcon className="w-3.5 h-3.5 text-blue-400" />}
 <ChevronRightIcon className="w-3.5 h-3.5 text-slate-300" />
 </div>
 </div>

 <div className="trip-card-route">
 <div className="trip-route-line">
 <span className="trip-route-dot start" />
 <span className="trip-route-connector" />
 <span className="trip-route-dot end" />
 </div>
 <div className="trip-route-names">
 <span className="trip-route-from">{shortLoc(trip.loadingLocation)}</span>
 <span className="trip-route-to">{shortLoc(trip.destination)}</span>
 </div>
 </div>

 <div className="trip-card-meta">
 <span className="trip-meta-item">
 <CalendarIcon className="w-3 h-3" />
 {trip.tripDate ? new Date(trip.tripDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}
 </span>
 <span className="trip-meta-item">
 <RouteIcon className="w-3 h-3" />
 {trip.distance || 0} km
 </span>
 {trip.freightAmount ? (
 <span className="trip-meta-item trip-meta-freight">
 {inr(trip.freightAmount)}
 </span>
 ) : (
 <span className="trip-meta-item trip-meta-pending">Pending</span>
 )}
 {profit != null && (
 <span className={`trip-meta-item font-semibold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
 {inr(profit)}
 </span>
 )}
 </div>
 </div>
 )
 })
 )}
 </div>
 </div>

 {/* Right Panel: Map */}
 <div className="trips-map-panel">
 {mapReady && leaflet ? (
 <TripsMap
 leaflet={leaflet}
 trips={filtered}
 selectedTrip={selectedTrip}
 onTripSelect={setSelectedTripId}
 />
 ) : (
 <div className="trips-map-loading">
 <div className="animate-pulse text-sm text-slate-400">Loading map...</div>
 </div>
 )}
 </div>
 </div>

 {showImport && (
 <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm" onClick={closeImport}>
 <div
 className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
 <div>
 <h2 className="text-lg font-bold text-slate-900">{t('tripImportTitle')}</h2>
 <p className="text-xs text-slate-500 mt-1">{t('tripImportSubtitle')}</p>
 </div>
 <button type="button" onClick={closeImport} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" aria-label={t('tripImportClose')}>
 <XIcon className="w-5 h-5" />
 </button>
 </div>

 <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
 <div className="flex flex-wrap items-center gap-2">
 <label className="btn-secondary text-xs cursor-pointer inline-flex items-center gap-1.5">
 <UploadIcon className="w-4 h-4" />
 {t('tripImportChooseFile')}
 <input type="file" accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" className="hidden" onChange={handleImportFile} />
 </label>
 <button type="button" className="text-xs font-semibold text-teal-700 hover:underline" onClick={downloadSampleTripsCsv}>
 {t('tripImportDownloadSample')}
 </button>
 </div>
 <p className="text-[11px] text-slate-500 leading-relaxed">{t('tripImportHelpColumns')}</p>

 {importBusy && !importPreview && !importResult && (
 <p className="text-sm text-slate-500">{t('tripImportPreviewing')}</p>
 )}
 {importErr && (
 <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2">{importErr}</div>
 )}

 {importPreview && !importResult && (
 <>
 {importPreview.missingVehicleColumn ? (
 <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm px-3 py-2">
 {t('tripImportMissingColumn')}
 </div>
 ) : (
 <>
 <div>
 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('tripImportMapping')}</h3>
 <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
 {Object.entries(importPreview.mappingLabels || {}).map(([k, v]) => (
 <div key={k} className="flex justify-between gap-2 border-b border-slate-50 pb-1">
 <dt className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</dt>
 <dd className="font-medium text-slate-800 text-right">{v || '—'}</dd>
 </div>
 ))}
 </dl>
 <p className="text-xs text-slate-500 mt-2">{t('tripImportDataRows', { count: String(importPreview.totalRows ?? 0) })}</p>
 </div>
 <div>
 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('tripImportPreviewRows')}</h3>
 <div className="overflow-x-auto rounded-xl border border-slate-200">
 <table className="w-full text-[10px]">
 <thead>
 <tr className="bg-slate-50 text-slate-600 text-left">
 <th className="px-1.5 py-1.5 font-semibold">#</th>
 <th className="px-1.5 py-1.5 font-semibold">Truck</th>
 <th className="px-1.5 py-1.5 font-semibold">From</th>
 <th className="px-1.5 py-1.5 font-semibold">To</th>
 <th className="px-1.5 py-1.5 font-semibold">Km</th>
 <th className="px-1.5 py-1.5 font-semibold">Freight</th>
 <th className="px-1.5 py-1.5 font-semibold">Fuel</th>
 <th className="px-1.5 py-1.5 font-semibold">Toll</th>
 <th className="px-1.5 py-1.5 font-semibold">{t('date')}</th>
 </tr>
 </thead>
 <tbody>
 {(importPreview.preview || []).map((row) => (
 <tr key={row.row} className="border-t border-slate-100">
 <td className="px-1.5 py-1 text-slate-400">{row.row}</td>
 <td className="px-1.5 py-1 font-mono font-semibold whitespace-nowrap">{row.vehicleNumber}</td>
 <td className="px-1.5 py-1 max-w-[100px] truncate" title={row.loadingLocation}>{row.loadingLocation}</td>
 <td className="px-1.5 py-1 max-w-[100px] truncate" title={row.destination}>{row.destination}</td>
 <td className="px-1.5 py-1">{row.distance}</td>
 <td className="px-1.5 py-1">{row.freightAmount ?? '—'}</td>
 <td className="px-1.5 py-1">{row.fuelExpense}</td>
 <td className="px-1.5 py-1">{row.toll}</td>
 <td className="px-1.5 py-1 whitespace-nowrap">{row.tripDate || '—'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </>
 )}
 </>
 )}

 {importResult && (
 <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 space-y-2">
 <h3 className="text-sm font-bold text-emerald-900">{t('tripImportDone')}</h3>
 <ul className="text-sm text-emerald-800 space-y-1">
 <li>{t('tripImportCreated', { n: String(importResult.created ?? 0) })}</li>
 <li>{t('tripImportSkipped', { n: String(importResult.skipped ?? 0) })}</li>
 {(importResult.errors > 0) && (
 <li>{t('tripImportErrors', { n: String(importResult.errors) })}</li>
 )}
 </ul>
 {Array.isArray(importResult.errorRows) && importResult.errorRows.length > 0 && (
 <ul className="text-xs text-red-700 mt-2 max-h-32 overflow-y-auto list-disc pl-4">
 {importResult.errorRows.map((er, i) => (
 <li key={i}>Row {er.row}: {er.vehicleNumber || '?'} — {er.message}</li>
 ))}
 </ul>
 )}
 {Array.isArray(importResult.skippedRows) && importResult.skippedRows.length > 0 && (
 <details className="text-xs text-slate-600 mt-2">
 <summary className="cursor-pointer font-medium">{t('tripImportSkippedList')}</summary>
 <ul className="mt-1 max-h-28 overflow-y-auto list-disc pl-4">
 {importResult.skippedRows.map((s, i) => (
 <li key={i}>Row {s.row}: {s.vehicleNumber} — {s.reason}</li>
 ))}
 </ul>
 </details>
 )}
 </div>
 )}
 </div>

 <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/80">
 {importResult ? (
 <button type="button" className="btn-primary text-xs" onClick={closeImport}>{t('tripImportClose')}</button>
 ) : (
 <>
 <button type="button" className="btn-secondary text-xs" onClick={closeImport}>{t('cancel')}</button>
 <button
 type="button"
 className="btn-primary text-xs"
 disabled={importBusy || !importFile || importPreview?.missingVehicleColumn}
 onClick={handleImportCommit}
 >
 {importBusy ? t('loading') : t('tripImportRunBtn')}
 </button>
 </>
 )}
 </div>
 </div>
 </div>
 )}
 </div>
 )
}

// Map auto-fit component
function FitBounds({ leaflet, bounds }) {
 const { useMap } = leaflet
 const map = useMap()
 useEffect(() => {
 if (bounds && bounds.length > 0) {
 try {
 const L = leaflet.L
 const b = L.latLngBounds(bounds)
 if (b.isValid()) {
 map.fitBounds(b, { padding: [40, 40], maxZoom: 10 })
 }
 } catch (e) { /* ignore invalid bounds */ }
 }
 }, [map, bounds, leaflet])
 return null
}

function TripsMap({ leaflet, trips, selectedTrip, onTripSelect }) {
 const { MapContainer, TileLayer, CircleMarker, Polyline, Popup, Tooltip: MapTooltip } = leaflet

 const defaultCenter = [22.5, 77.5]
 const defaultZoom = 5

 // Build all markers
 const markers = []
 const allPoints = []

 for (const trip of trips) {
 const coords = getTripCoords(trip)
 if (coords.start) {
 markers.push({
 tripId: trip.id,
 type: 'start',
 pos: [coords.start.lat, coords.start.lng],
 label: trip.loadingLocation,
 vehicle: trip.vehicle?.vehicleNumber,
 status: trip.status,
 })
 allPoints.push([coords.start.lat, coords.start.lng])
 }
 if (coords.end) {
 markers.push({
 tripId: trip.id,
 type: 'end',
 pos: [coords.end.lat, coords.end.lng],
 label: trip.destination,
 vehicle: trip.vehicle?.vehicleNumber,
 status: trip.status,
 })
 allPoints.push([coords.end.lat, coords.end.lng])
 }
 }

 // Build route line for selected trip
 let selectedRoute = null
 if (selectedTrip) {
 const coords = getTripCoords(selectedTrip)
 if (coords.start && coords.end) {
 selectedRoute = [
 [coords.start.lat, coords.start.lng],
 [coords.end.lat, coords.end.lng],
 ]
 }
 }

 // Deduplicate markers by position to avoid stacking
 const uniqueMarkers = []
 const seen = new Set()
 for (const m of markers) {
 const key = `${m.pos[0].toFixed(4)},${m.pos[1].toFixed(4)},${m.type}`
 if (!seen.has(key)) {
 seen.add(key)
 uniqueMarkers.push(m)
 }
 }

 return (
 <MapContainer
 center={defaultCenter}
 zoom={defaultZoom}
 style={{ height: '100%', width: '100%' }}
 scrollWheelZoom={true}
 zoomControl={true}
 >
 <TileLayer
 url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
 attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
 />

 {allPoints.length > 0 && (
 <FitBounds leaflet={leaflet} bounds={allPoints} />
 )}

 {/* All trip markers */}
 {uniqueMarkers.map((m, i) => {
 const isSelected = selectedTrip?.id === m.tripId
 const isStart = m.type === 'start'
 const baseColor = m.status === 'reconciled' || m.freight ? '#10b981' : '#f59e0b'
 const color = isSelected ? '#2563eb' : baseColor
 const radius = isSelected ? 8 : 5
 const weight = isSelected ? 3 : 1.5

 return (
 <CircleMarker
 key={`${m.tripId}-${m.type}-${i}`}
 center={m.pos}
 radius={radius}
 pathOptions={{
 color: color,
 fillColor: isStart ? color : '#ffffff',
 fillOpacity: isStart ? 0.8 : 1,
 weight: weight,
 }}
 eventHandlers={{
 click: () => onTripSelect(m.tripId),
 }}
 >
 <Popup>
 <div className="text-xs leading-relaxed">
 <div className="font-bold text-slate-800">{m.vehicle}</div>
 <div className="text-slate-500">{isStart ? 'From' : 'To'}: {m.label?.split(' - ').pop()}</div>
 </div>
 </Popup>
 </CircleMarker>
 )
 })}

 {/* Selected trip route line */}
 {selectedRoute && (
 <Polyline
 positions={selectedRoute}
 pathOptions={{
 color: '#2563eb',
 weight: 3,
 dashArray: '8, 6',
 opacity: 0.8,
 }}
 />
 )}
 </MapContainer>
 )
}
