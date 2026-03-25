import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { estimateTrip, fetchExternalDieselRate, fetchIndiaDieselRateGroq } from '../services/tripEstimate.js'

const router = Router()
router.use(requireAuth)

// ── POST /api/trips/auto-estimate — Distance + diesel rate suggestions ──────
router.post('/auto-estimate', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const { from, to, vehicleId } = req.body
 if (!from || !to) return res.status(400).json({ error: 'from and to are required' })

 const tripEstimate = await estimateTrip({ from, to })

 const groqIndia = await fetchIndiaDieselRateGroq({ from, to })
 let dieselRate = groqIndia?.dieselRate || null
 let dieselRateSource = groqIndia ? 'groq_india' : null
 let dieselRateNote = groqIndia?.note || null

 if (!dieselRate) {
 const externalRate = await fetchExternalDieselRate({ from, to })
 if (externalRate?.dieselRate) {
 dieselRate = externalRate.dieselRate
 dieselRateSource = 'external'
 dieselRateNote = externalRate.note || 'Market API'
 }
 }

 if (!dieselRate) {
 const latestFuel = await prisma.fuelLog.findFirst({
 where: {
 tenantId: req.tenantId,
 ...(vehicleId ? { vehicleId } : {}),
 fuelType: 'diesel',
 },
 orderBy: [{ fuelDate: 'desc' }, { createdAt: 'desc' }],
 select: { ratePerLitre: true },
 })

 if (latestFuel?.ratePerLitre) {
 dieselRate = latestFuel.ratePerLitre
 dieselRateSource = vehicleId ? 'internal_vehicle' : 'internal_recent'
 dieselRateNote = vehicleId ? 'From latest fuel log for selected vehicle' : 'From latest fleet fuel log'
 }
 }

 if (!dieselRate) {
 const latestTrip = await prisma.trip.findFirst({
 where: {
 tenantId: req.tenantId,
 dieselRate: { gt: 0 },
 ...(vehicleId ? { vehicleId } : {}),
 },
 orderBy: { createdAt: 'desc' },
 select: { dieselRate: true },
 })

 if (latestTrip?.dieselRate) {
 dieselRate = latestTrip.dieselRate
 dieselRateSource = vehicleId ? 'internal_vehicle_trip' : 'internal_trip_recent'
 dieselRateNote = vehicleId ? 'From latest trip for selected vehicle' : 'From latest fleet trip'
 }
 }

 return res.json({
 distanceKm: tripEstimate.distanceKm,
 distanceSource: tripEstimate.distanceSource,
 dieselRate,
 dieselRateSource,
 dieselRateNote,
 })
 } catch (err) {
 console.error('Auto-estimate error:', err)
 return res.status(400).json({ error: err.message || 'Could not estimate route' })
 }
})

// ── GET /api/trips — List all trips ─────────────────────────────────────────

router.get('/', async (req, res) => {
 try {
 const where = { tenantId: req.tenantId }
 if (req.query.status) where.status = req.query.status

 const trips = await prisma.trip.findMany({
 where,
 orderBy: { createdAt: 'desc' },
 include: {
 vehicle: { select: { vehicleNumber: true } },
 driver: { select: { id: true, name: true } },
 },
 })
 return res.json(trips)
 } catch (err) {
 console.error('List trips error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── GET /api/trips/:id — Full trip detail ────────────────────────────────────

router.get('/:id', async (req, res, next) => {
 try {
 // Avoid matching "analytics" as an :id — let it pass through
 if (req.params.id === 'analytics') return next()

 const trip = await prisma.trip.findFirst({
 where: { id: req.params.id, tenantId: req.tenantId },
 include: {
 vehicle: { select: { id: true, vehicleNumber: true, vehicleType: true } },
 driver: { select: { id: true, name: true, phone: true, licenseNumber: true, licensePhotoUrl: true, vehicleId: true } },
 locationLogs: {
 orderBy: { timestamp: 'asc' },
 select: { latitude: true, longitude: true, speed: true, heading: true, timestamp: true },
 },
 drivingScore: true,
 drivingEvents: {
 orderBy: { timestamp: 'asc' },
 select: { type: true, severity: true, latitude: true, longitude: true, speed: true, timestamp: true },
 },
 },
 })
 if (!trip) return res.status(404).json({ error: 'Trip not found' })

 // Also fetch similar trips on the same route for comparison
 const similarTrips = await prisma.trip.findMany({
 where: {
 tenantId: req.tenantId,
 loadingLocation: trip.loadingLocation,
 destination: trip.destination,
 status: 'reconciled',
 id: { not: trip.id },
 },
 orderBy: { createdAt: 'desc' },
 take: 10,
 select: {
 id: true, freightAmount: true, fuelExpense: true, toll: true, cashExpense: true,
 distance: true, tripDate: true, createdAt: true,
 vehicle: { select: { vehicleNumber: true } },
 },
 })

 return res.json({ ...trip, similarTrips })
 } catch (err) {
 console.error('Get trip detail error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── POST /api/trips — Add a trip ────────────────────────────────────────────
// Now supports:
// 1. Quick-log from loading slip — no freight required (status = logged)
// 2. Quick-add with savedRouteId + optional freight
// 3. Full manual entry

router.post('/', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const {
 vehicleId, freightAmount, savedRouteId, tripDate, loadingSlipNumber,
 loadingLocation, destination, distance, ratePerKm,
 fuelLitres, dieselRate, fuelExpense, toll, cashExpense,
 } = req.body

 if (!vehicleId) {
 return res.status(400).json({ error: 'vehicleId is required' })
 }

 let tripData

 if (savedRouteId) {
 // ── Route-based mode: fill from saved route template ────────────
 const route = await prisma.savedRoute.findFirst({ where: { id: savedRouteId, tenantId: req.tenantId } })
 if (!route) {
 return res.status(400).json({ error: 'Saved route not found' })
 }

 tripData = {
 vehicleId,
 loadingLocation: route.loadingLocation,
 destination: route.destination,
 freightAmount: freightAmount ? parseFloat(freightAmount) : null,
 distance: route.distance,
 ratePerKm: route.ratePerKm,
 fuelLitres: route.defaultFuelLitres,
 dieselRate: route.defaultDieselRate,
 fuelExpense: route.defaultFuelExpense,
 toll: toll !== undefined ? parseFloat(toll) : route.defaultToll,
 cashExpense: cashExpense !== undefined ? parseFloat(cashExpense) : route.defaultCash,
 status: freightAmount ? 'reconciled' : 'logged',
 tripDate: tripDate ? new Date(tripDate) : null,
 loadingSlipNumber: loadingSlipNumber || null,
 }
 } else {
 // ── Quick-log mode: just vehicle + optional OCR data ────────────
 // Expenses default to 0 — they'll be filled during reconciliation
 tripData = {
 tenantId: req.tenantId,
 vehicleId,
 loadingLocation: loadingLocation || 'Unknown',
 destination: destination || 'Unknown',
 freightAmount: freightAmount ? parseFloat(freightAmount) : null,
 distance: distance ? parseInt(distance) : 0,
 ratePerKm: ratePerKm ? parseFloat(ratePerKm) : 0,
 fuelLitres: fuelLitres ? parseFloat(fuelLitres) : 0,
 dieselRate: dieselRate ? parseFloat(dieselRate) : 0,
 fuelExpense: fuelExpense ? parseFloat(fuelExpense) : 0,
 toll: toll ? parseFloat(toll) : 0,
 cashExpense: cashExpense ? parseFloat(cashExpense) : 0,
 status: freightAmount ? 'reconciled' : 'logged',
 tripDate: tripDate ? new Date(tripDate) : null,
 loadingSlipNumber: loadingSlipNumber || null,
 }
 }

 const trip = await prisma.trip.create({ data: tripData })
 return res.status(201).json(trip)
 } catch (err) {
 console.error('Create trip error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── PUT /api/trips/:id — Update a trip ──────────────────────────────────────

router.put('/:id', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const existing = await prisma.trip.findFirst({
 where: { id: req.params.id, tenantId: req.tenantId },
 })
 if (!existing) return res.status(404).json({ error: 'Trip not found' })

 const {
 vehicleId, driverId, loadingLocation, destination,
 freightAmount, distance, ratePerKm,
 fuelLitres, dieselRate, fuelExpense, toll, cashExpense,
 tripDate, loadingSlipNumber, status,
 } = req.body

 const data = {}
 if (vehicleId !== undefined) data.vehicleId = vehicleId
 if (driverId !== undefined) data.driverId = driverId || null
 if (loadingLocation !== undefined) data.loadingLocation = loadingLocation
 if (destination !== undefined) data.destination = destination
 if (freightAmount !== undefined) data.freightAmount = freightAmount ? parseFloat(freightAmount) : null
 if (distance !== undefined) data.distance = parseInt(distance) || 0
 if (ratePerKm !== undefined) data.ratePerKm = parseFloat(ratePerKm) || 0
 if (fuelLitres !== undefined) data.fuelLitres = parseFloat(fuelLitres) || 0
 if (dieselRate !== undefined) data.dieselRate = parseFloat(dieselRate) || 0
 if (fuelExpense !== undefined) data.fuelExpense = parseFloat(fuelExpense) || 0
 if (toll !== undefined) data.toll = parseFloat(toll) || 0
 if (cashExpense !== undefined) data.cashExpense = parseFloat(cashExpense) || 0
 if (tripDate !== undefined) data.tripDate = tripDate ? new Date(tripDate) : null
 if (loadingSlipNumber !== undefined) data.loadingSlipNumber = loadingSlipNumber || null
 if (status !== undefined) data.status = status

 if (data.freightAmount && !data.status) {
 data.status = 'reconciled'
 }

 const trip = await prisma.trip.update({
 where: { id: req.params.id },
 data,
 include: {
 vehicle: { select: { id: true, vehicleNumber: true, vehicleType: true } },
 driver: { select: { id: true, name: true, phone: true } },
 },
 })
 return res.json(trip)
 } catch (err) {
 console.error('Update trip error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── GET /api/trips/analytics — Full analytics ───────────────────────────────

router.get('/analytics', async (req, res) => {
 try {
 const allTrips = await prisma.trip.findMany({
 where: { tenantId: req.tenantId },
 include: {
 vehicle: { select: { vehicleNumber: true } },
 },
 })

 // Separate reconciled (have freight) from logged (pending)
 const trips = allTrips.filter((t) => t.status === 'reconciled' && t.freightAmount)
 const pendingTrips = allTrips.filter((t) => t.status === 'logged')

 if (trips.length === 0) {
 return res.json({
 fleetPnL: { revenue: 0, expenses: 0, profit: 0, margin: 0, tripCount: 0 },
 vehicleProfit: [],
 routeProfit: [],
 insights: [],
 totalLeakage: 0,
 premiumInsights: [],
 pendingReconciliation: pendingTrips.length,
 })
 }

 // ── Fleet P&L ─────────────────────────────────────────────────────────
 let totalRevenue = 0
 let totalExpenses = 0

 for (const t of trips) {
 const cost = t.fuelExpense + t.toll + t.cashExpense
 totalRevenue += t.freightAmount
 totalExpenses += cost
 }

 const fleetProfit = totalRevenue - totalExpenses
 const fleetMargin = totalRevenue > 0 ? (fleetProfit / totalRevenue) * 100 : 0

 const fleetPnL = {
 revenue: round(totalRevenue),
 expenses: round(totalExpenses),
 profit: round(fleetProfit),
 margin: round(fleetMargin),
 tripCount: trips.length,
 }

 // ── Per-vehicle profit ────────────────────────────────────────────────
 const byVehicle = {}
 for (const t of trips) {
 const vn = t.vehicle.vehicleNumber
 if (!byVehicle[vn]) {
 byVehicle[vn] = { vehicleNumber: vn, trips: 0, revenue: 0, expenses: 0, totalDistance: 0 }
 }
 const cost = t.fuelExpense + t.toll + t.cashExpense
 byVehicle[vn].trips++
 byVehicle[vn].revenue += t.freightAmount
 byVehicle[vn].expenses += cost
 byVehicle[vn].totalDistance += t.distance
 }

 const vehicleProfit = Object.values(byVehicle)
 .map((v) => ({
 ...v,
 profit: round(v.revenue - v.expenses),
 revenue: round(v.revenue),
 expenses: round(v.expenses),
 profitPerTrip: round((v.revenue - v.expenses) / v.trips),
 profitPerKm: round((v.revenue - v.expenses) / v.totalDistance),
 margin: round(((v.revenue - v.expenses) / v.revenue) * 100),
 }))
 .sort((a, b) => b.profit - a.profit)

 // ── Route profitability ───────────────────────────────────────────────
 const byRoute = {}
 for (const t of trips) {
 const routeKey = `${shortName(t.loadingLocation)} → ${shortName(t.destination)}`
 if (!byRoute[routeKey]) {
 byRoute[routeKey] = {
 route: routeKey,
 loadingLocation: t.loadingLocation,
 destination: t.destination,
 distance: t.distance,
 trips: 0,
 totalRevenue: 0,
 totalExpenses: 0,
 freights: [],
 }
 }
 const cost = t.fuelExpense + t.toll + t.cashExpense
 byRoute[routeKey].trips++
 byRoute[routeKey].totalRevenue += t.freightAmount
 byRoute[routeKey].totalExpenses += cost
 byRoute[routeKey].freights.push(t.freightAmount)
 }

 const routeProfit = Object.values(byRoute)
 .map((r) => {
 const profit = r.totalRevenue - r.totalExpenses
 const minFreight = Math.min(...r.freights)
 const maxFreight = Math.max(...r.freights)
 return {
 route: r.route,
 distance: r.distance,
 trips: r.trips,
 avgFreight: round(r.totalRevenue / r.trips),
 avgCost: round(r.totalExpenses / r.trips),
 avgProfit: round(profit / r.trips),
 totalProfit: round(profit),
 profitPerKm: round(profit / (r.distance * r.trips)),
 margin: round((profit / r.totalRevenue) * 100),
 freightSpread: round(maxFreight - minFreight),
 freightSpreadPct: round(((maxFreight - minFreight) / minFreight) * 100),
 }
 })
 .sort((a, b) => b.totalProfit - a.totalProfit)

 // ── Monetizable Insights (Free — with ₹ loss amounts) ─────────────────
 const insights = []
 let totalLeakage = 0

 // 1. Freight rate inconsistency
 for (const routeKey of Object.keys(byRoute)) {
 const r = byRoute[routeKey]
 if (r.freights.length <= 1) continue
 const avg = r.totalRevenue / r.trips
 const belowAvg = r.freights.filter((f) => f < avg)
 const lostAmount = Math.round(belowAvg.reduce((sum, f) => sum + (avg - f), 0))

 if (lostAmount > 1000) {
 totalLeakage += lostAmount
 insights.push({
 type: 'freight_variance',
 title: `You got paid less on ${belowAvg.length} trips — ${routeKey}`,
 message: `Some trips on this route earned less than average. You could have earned ₹${lostAmount.toLocaleString('en-IN')} more.`,
 lostAmount,
 })
 }
 }

 // 2. Low-earning routes
 for (const r of routeProfit) {
 if (r.margin < 28 && r.trips >= 2) {
 const expectedProfit = (fleetMargin / 100) * r.avgFreight * r.trips
 const actualProfit = r.totalProfit
 const lostAmount = Math.round(Math.max(0, expectedProfit - actualProfit))

 if (lostAmount > 0) {
 totalLeakage += lostAmount
 insights.push({
 type: 'low_margin_route',
 title: `${r.route} is barely making money`,
 message: `This route earns much less than your other routes. You're missing out on ₹${lostAmount.toLocaleString('en-IN')}.`,
 lostAmount,
 })
 }
 }
 }

 // 3. Idle trucks
 const avgTripsPerVehicle = trips.length / vehicleProfit.length
 const avgProfitPerTrip = fleetProfit / trips.length
 for (const v of vehicleProfit) {
 if (v.trips <= Math.floor(avgTripsPerVehicle * 0.5)) {
 const missedTrips = Math.round(avgTripsPerVehicle) - v.trips
 const lostAmount = Math.round(missedTrips * avgProfitPerTrip)

 if (lostAmount > 0) {
 totalLeakage += lostAmount
 insights.push({
 type: 'underutilized',
 title: `Truck ${v.vehicleNumber.slice(-4)} is sitting idle — still costs money`,
 message: `Only ${v.trips} trip(s). If it did ${Math.round(avgTripsPerVehicle)} trips like others, you'd earn ₹${lostAmount.toLocaleString('en-IN')} more.`,
 lostAmount,
 })
 }
 }
 }

 // 4. Driver cash overpay on short trips
 const allDistances = [...new Set(trips.map((t) => t.distance))].sort((a, b) => a - b)
 if (allDistances.length > 1) {
 const allCashSame = trips.every((t) => t.cashExpense === trips[0].cashExpense)
 if (allCashSame) {
 const cash = trips[0].cashExpense
 const longest = allDistances[allDistances.length - 1]
 const cashPerKmLong = cash / longest
 let cashOverpay = 0
 let shortTripCount = 0
 for (const t of trips) {
 if (t.distance < longest * 0.7) {
 const fairCash = Math.round(cashPerKmLong * t.distance)
 cashOverpay += cash - fairCash
 shortTripCount++
 }
 }

 if (cashOverpay > 0 && shortTripCount > 0) {
 totalLeakage += cashOverpay
 insights.push({
 type: 'flat_cash',
 title: `Overpaying ₹${cashOverpay.toLocaleString('en-IN')} on driver cash`,
 message: `You pay ₹${cash.toLocaleString('en-IN')} cash for both ${allDistances[0]}km and ${longest}km trips. Short trips overpay by ~₹${Math.round(cashOverpay / shortTripCount).toLocaleString('en-IN')} each.`,
 lostAmount: cashOverpay,
 })
 }
 }
 }

 // 5. Best vs worst truck gap
 if (vehicleProfit.length >= 2) {
 const top = vehicleProfit[0]
 const bottom = vehicleProfit[vehicleProfit.length - 1]
 const gap = top.profit - bottom.profit
 if (gap > 50000) {
 insights.push({
 type: 'vehicle_gap',
 title: 'Some trucks earn much more than others',
 message: `Best truck (${top.vehicleNumber.slice(-4)}) earned ₹${top.profit.toLocaleString('en-IN')}. Worst (${bottom.vehicleNumber.slice(-4)}) earned ₹${bottom.profit.toLocaleString('en-IN')}. Gap: ₹${gap.toLocaleString('en-IN')}.`,
 lostAmount: gap,
 })
 }
 }

 // Sort insights by biggest losses first
 insights.sort((a, b) => (b.lostAmount || 0) - (a.lostAmount || 0))

 // ── Premium Insights (locked for free users) ────────────────────────────
 const premiumInsights = []

 const growRoutes = routeProfit.filter((r) => r.margin >= 35).length
 const dropRoutes = routeProfit.filter((r) => r.margin < 20).length
 if (growRoutes > 0 || dropRoutes > 0) {
 premiumInsights.push({
 type: 'route_optimizer',
 title: 'Route Optimization Plan',
 teaser: `We found ${growRoutes} route(s) to do more trips on and ${dropRoutes} to reconsider. Unlock to see the full plan.`,
 locked: true,
 })
 }

 premiumInsights.push({
 type: 'freight_advisor',
 title: 'Minimum Freight Rates per Route',
 teaser: 'Based on your best trips, we calculated the minimum rate you should accept for each route. Unlock to see the numbers.',
 locked: true,
 })

 const poorVehicles = vehicleProfit.filter((v) => v.margin < 20).length
 if (poorVehicles > 0) {
 premiumInsights.push({
 type: 'vehicle_advisor',
 title: 'Vehicle Sell / Keep Report',
 teaser: `${poorVehicles} vehicle(s) may not be worth keeping based on their earnings. Unlock to see which ones.`,
 locked: true,
 })
 }

 const annualSavings = Math.round(totalLeakage * 12)
 if (annualSavings > 0) {
 premiumInsights.push({
 type: 'annual_projection',
 title: 'Annual Savings Projection',
 teaser: `Fixing these issues could save ₹${annualSavings.toLocaleString('en-IN')}/year. Unlock for the detailed breakdown.`,
 locked: true,
 })
 }

 return res.json({
 fleetPnL,
 vehicleProfit,
 routeProfit,
 insights,
 totalLeakage: round(totalLeakage),
 premiumInsights,
 pendingReconciliation: pendingTrips.length,
 })
 } catch (err) {
 console.error('Analytics error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function round(n) {
 return Math.round(n * 100) / 100
}

// ── GET /api/trips/monthly-stats — Monthly aggregated stats for charts ────────

router.get('/monthly-stats', async (req, res) => {
 try {
 const trips = await prisma.trip.findMany({
 where: { tenantId: req.tenantId, status: 'reconciled', freightAmount: { not: null } },
 select: { freightAmount: true, fuelExpense: true, toll: true, cashExpense: true, createdAt: true },
 orderBy: { createdAt: 'asc' },
 })

 const byMonth = {}
 for (const t of trips) {
 const d = new Date(t.createdAt)
 const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
 if (!byMonth[key]) byMonth[key] = { month: key, trips: 0, revenue: 0, expenses: 0 }
 const cost = (t.fuelExpense || 0) + (t.toll || 0) + (t.cashExpense || 0)
 byMonth[key].trips++
 byMonth[key].revenue += t.freightAmount || 0
 byMonth[key].expenses += cost
 }

 const result = Object.values(byMonth)
 .sort((a, b) => a.month.localeCompare(b.month))
 .slice(-12)
 .map(m => ({
 ...m,
 profit: Math.round(m.revenue - m.expenses),
 revenue: Math.round(m.revenue),
 expenses: Math.round(m.expenses),
 }))

 return res.json(result)
 } catch (err) {
 console.error('Monthly stats error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

function shortName(location) {
 // "12434 - GAIL GANDHAR BP" → "GAIL GANDHAR BP"
 const parts = location.split(' - ')
 return parts.length > 1 ? parts.slice(1).join(' - ').trim() : location
}

export default router
