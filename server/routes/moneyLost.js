import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

const DAILY_OWNERSHIP_COST = 2500
const IDLE_THRESHOLD_DAYS = 7

router.get('/', async (req, res) => {
 try {
 const tenantId = req.tenantId
 const now = new Date()
 const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

 const [trips, vehicles, fuelLogs, documents] = await Promise.all([
 prisma.trip.findMany({
 where: { tenantId, createdAt: { gte: monthStart } },
 include: { vehicle: { select: { vehicleNumber: true } } },
 }),
 prisma.vehicle.findMany({ where: { tenantId } }),
 prisma.fuelLog.findMany({
 where: { tenantId, fuelDate: { gte: monthStart } },
 include: { vehicle: { select: { vehicleNumber: true } } },
 }),
 prisma.document.findMany({
 where: { tenantId },
 include: { vehicle: { select: { vehicleNumber: true } } },
 }),
 ])

 const reconciledTrips = trips.filter(t => t.status === 'reconciled' && t.freightAmount)

 // ── 1. Freight Leakage ─────────────────────────────────────────
 const routeAvg = {}
 for (const t of reconciledTrips) {
 const key = `${t.loadingLocation}→${t.destination}`
 if (!routeAvg[key]) routeAvg[key] = { total: 0, count: 0, trips: [] }
 routeAvg[key].total += t.freightAmount
 routeAvg[key].count++
 routeAvg[key].trips.push(t)
 }

 let freightLoss = 0
 const freightItems = []
 for (const [route, data] of Object.entries(routeAvg)) {
 if (data.count < 2) continue
 const avg = data.total / data.count
 for (const t of data.trips) {
 const diff = avg - t.freightAmount
 if (diff > 500) {
 freightLoss += diff
 freightItems.push({
 vehicle: t.vehicle.vehicleNumber,
 route,
 got: Math.round(t.freightAmount),
 avg: Math.round(avg),
 lost: Math.round(diff),
 date: t.tripDate || t.createdAt,
 })
 }
 }
 }
 freightItems.sort((a, b) => b.lost - a.lost)

 // ── 2. Fuel Waste ──────────────────────────────────────────────
 const vehicleKmPerL = {}
 for (const t of reconciledTrips) {
 if (t.distance > 0 && t.fuelLitres > 0) {
 const vn = t.vehicle.vehicleNumber
 if (!vehicleKmPerL[vn]) vehicleKmPerL[vn] = { totalKm: 0, totalL: 0 }
 vehicleKmPerL[vn].totalKm += t.distance
 vehicleKmPerL[vn].totalL += t.fuelLitres
 }
 }

 const efficiencies = Object.entries(vehicleKmPerL).map(([vn, d]) => ({
 vehicle: vn,
 kmPerL: d.totalKm / d.totalL,
 totalL: d.totalL,
 }))

 const fleetAvgKmPerL = efficiencies.length > 0
 ? efficiencies.reduce((s, e) => s + e.kmPerL, 0) / efficiencies.length
 : 0

 let fuelWaste = 0
 const fuelItems = []
 const avgDieselRate = reconciledTrips.length > 0
 ? reconciledTrips.reduce((s, t) => s + (t.dieselRate || 0), 0) / reconciledTrips.length
 : 90

 for (const e of efficiencies) {
 if (fleetAvgKmPerL > 0 && e.kmPerL < fleetAvgKmPerL * 0.85) {
 const expectedL = e.totalL * (e.kmPerL / fleetAvgKmPerL)
 const wastedL = e.totalL - expectedL
 const wastedRs = Math.round(wastedL * avgDieselRate)
 if (wastedRs > 500) {
 fuelWaste += wastedRs
 fuelItems.push({
 vehicle: e.vehicle,
 kmPerL: Math.round(e.kmPerL * 10) / 10,
 fleetAvg: Math.round(fleetAvgKmPerL * 10) / 10,
 wastedLitres: Math.round(wastedL),
 lost: wastedRs,
 })
 }
 }
 }
 fuelItems.sort((a, b) => b.lost - a.lost)

 // ── 3. Idle Cost ───────────────────────────────────────────────
 const activeVehicleIds = new Set(
 trips.filter(t => t.createdAt >= monthStart).map(t => t.vehicleId)
 )

 let idleCost = 0
 const idleItems = []
 for (const v of vehicles) {
 if (!activeVehicleIds.has(v.id)) {
 const daysSinceMonthStart = Math.floor((now - monthStart) / 86400000)
 const idleDays = Math.max(daysSinceMonthStart, IDLE_THRESHOLD_DAYS)
 const cost = idleDays * DAILY_OWNERSHIP_COST
 idleCost += cost
 idleItems.push({
 vehicle: v.vehicleNumber,
 idleDays,
 dailyCost: DAILY_OWNERSHIP_COST,
 lost: cost,
 })
 }
 }
 idleItems.sort((a, b) => b.lost - a.lost)

 // ── 4. Penalty Risk ────────────────────────────────────────────
 const FINES = { insurance: 4000, FC: 10000, PUC: 10000, permit: 10000 }
 const DAILY_REVENUE_LOSS = 5000

 let penaltyRisk = 0
 const penaltyItems = []
 for (const d of documents) {
 const expiry = new Date(d.expiryDate)
 const daysLeft = Math.floor((expiry - now) / 86400000)
 if (daysLeft <= 15) {
 const fine = FINES[d.documentType] || 5000
 const groundingCost = daysLeft < 0 ? Math.abs(daysLeft) * DAILY_REVENUE_LOSS : 0
 const totalRisk = fine + groundingCost
 penaltyRisk += totalRisk
 penaltyItems.push({
 vehicle: d.vehicle.vehicleNumber,
 vehicleId: d.vehicleId,
 documentId: d.id,
 type: d.documentType,
 daysLeft,
 fine,
 groundingCost,
 lost: totalRisk,
 })
 }
 }
 penaltyItems.sort((a, b) => b.lost - a.lost)

 const totalLost = Math.round(freightLoss + fuelWaste + idleCost + penaltyRisk)

 return res.json({
 month: `${now.toLocaleString('en-IN', { month: 'long' })} ${now.getFullYear()}`,
 totalLost,
 buckets: {
 freight: { amount: Math.round(freightLoss), items: freightItems.slice(0, 10), label: 'Freight Leakage' },
 fuel: { amount: Math.round(fuelWaste), items: fuelItems.slice(0, 10), label: 'Fuel Waste' },
 idle: { amount: Math.round(idleCost), items: idleItems.slice(0, 10), label: 'Idle Trucks' },
 penalty: { amount: Math.round(penaltyRisk), items: penaltyItems.slice(0, 10), label: 'Penalty Risk' },
 },
 })
 } catch (err) {
 console.error('Money lost error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

export default router
