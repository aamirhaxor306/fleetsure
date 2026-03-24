import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { trips as tripsApi } from '../api'
import { SearchIcon, PlusIcon, MapPinIcon, TruckIcon, CalendarIcon, RouteIcon, ChevronRightIcon } from '../components/Icons'

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

export default function Trips() {
 const navigate = useNavigate()
 const [trips, setTrips] = useState([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [statusFilter, setStatusFilter] = useState('all')
 const [selectedTripId, setSelectedTripId] = useState(null)
 const [mapReady, setMapReady] = useState(false)
 const [leaflet, setLeaflet] = useState(null)

 useEffect(() => {
 tripsApi.list()
 .then(setTrips)
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
 <div className="trips-topbar-right">
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
 <div className="text-sm font-medium text-slate-400">No trips found</div>
 <div className="text-xs text-slate-300 mt-1">Log your first trip to start tracking</div>
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
