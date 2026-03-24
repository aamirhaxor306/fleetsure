/**
 * Driving Score Engine
 * ────────────────────
 * Calculates a driving behavior score (0-100) for a trip
 * based on location logs (speed) and driving events (harsh braking, etc.)
 */

import prisma from '../lib/prisma.js'

const SPEED_LIMIT_KMH = 70 // overspeeding threshold for loaded trucks
const IDLE_SPEED_KMH = 3 // below this = idle

/**
 * Calculate driving score for a completed trip.
 * @param {string} tripId
 * @param {string|null} [tenantId] - Tenant ID for the trip (resolved from trip if not provided)
 * @returns {object} The created/updated DrivingScore record
 */
export async function calculateDrivingScore(tripId, tenantId = null) {
 let resolvedTenantId = tenantId
 if (!resolvedTenantId) {
 const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { tenantId: true } })
 resolvedTenantId = trip?.tenantId ?? null
 }
 const logWhere = { tripId, ...(resolvedTenantId && { tenantId: resolvedTenantId }) }
 const eventWhere = { tripId, ...(resolvedTenantId && { tenantId: resolvedTenantId }) }

 // Fetch location logs with speed
 const logs = await prisma.locationLog.findMany({
 where: logWhere,
 orderBy: { timestamp: 'asc' },
 })

 // Fetch driving events
 const events = await prisma.drivingEvent.findMany({
 where: eventWhere,
 })

 const defaultData = {
 overallScore: 100, speedScore: 100, brakingScore: 100,
 accelerationScore: 100, corneringScore: 100,
 avgSpeed: 0, maxSpeed: 0, overspeedingPct: 0,
 harshBrakeCount: 0, harshAccelCount: 0, sharpTurnCount: 0,
 idleMinutes: 0, totalDistanceKm: 0, totalDurationMin: 0,
 }

 if (logs.length < 2) {
 // Not enough data — return a default score
 const createData = { tripId, ...defaultData }
 if (resolvedTenantId) createData.tenantId = resolvedTenantId
 return prisma.drivingScore.upsert({
 where: { tripId },
 update: defaultData,
 create: createData,
 })
 }

 // ── Calculate distance & duration ───────────────────────────────────────
 let totalDistanceKm = 0
 let totalIdleMs = 0
 let overspeedingMs = 0
 let totalMs = 0
 let maxSpeed = 0
 let speedSum = 0
 let speedCount = 0

 for (let i = 0; i < logs.length; i++) {
 const speed = logs[i].speed || 0

 if (speed > maxSpeed) maxSpeed = speed
 speedSum += speed
 speedCount++

 if (i > 0) {
 const dist = haversine(
 logs[i - 1].latitude, logs[i - 1].longitude,
 logs[i].latitude, logs[i].longitude
 )
 totalDistanceKm += dist

 const dt = new Date(logs[i].timestamp) - new Date(logs[i - 1].timestamp)
 totalMs += dt

 if (speed < IDLE_SPEED_KMH) {
 totalIdleMs += dt
 }
 if (speed > SPEED_LIMIT_KMH) {
 overspeedingMs += dt
 }
 }
 }

 const totalDurationMin = totalMs / 60000
 const idleMinutes = totalIdleMs / 60000
 const avgSpeed = speedCount > 0 ? Math.round((speedSum / speedCount) * 10) / 10 : 0
 const overspeedingPct = totalMs > 0 ? Math.round((overspeedingMs / totalMs) * 1000) / 10 : 0

 // ── Count events by type ────────────────────────────────────────────────
 const harshBrakeCount = events.filter(e => e.type === 'harsh_brake').length
 const harshAccelCount = events.filter(e => e.type === 'harsh_accel').length
 const sharpTurnCount = events.filter(e => e.type === 'sharp_turn').length

 // ── Calculate sub-scores ────────────────────────────────────────────────
 // Speed score: 100 - penalty for overspeeding
 const speedScore = Math.max(0, Math.min(100, Math.round(100 - overspeedingPct * 2.5)))

 // Braking score: 100 - 8 per harsh brake (min 0)
 const brakingScore = Math.max(0, Math.min(100, 100 - harshBrakeCount * 8))

 // Acceleration score: 100 - 8 per harsh accel
 const accelerationScore = Math.max(0, Math.min(100, 100 - harshAccelCount * 8))

 // Cornering score: 100 - 10 per sharp turn
 const corneringScore = Math.max(0, Math.min(100, 100 - sharpTurnCount * 10))

 // Overall: weighted average
 const overallScore = Math.round(
 speedScore * 0.30 +
 brakingScore * 0.30 +
 accelerationScore * 0.20 +
 corneringScore * 0.20
 )

 // ── Upsert score record ─────────────────────────────────────────────────
 const data = {
 overallScore,
 speedScore,
 brakingScore,
 accelerationScore,
 corneringScore,
 avgSpeed,
 maxSpeed: Math.round(maxSpeed * 10) / 10,
 overspeedingPct,
 harshBrakeCount,
 harshAccelCount,
 sharpTurnCount,
 idleMinutes: Math.round(idleMinutes * 10) / 10,
 totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
 totalDurationMin: Math.round(totalDurationMin * 10) / 10,
 }

 const createPayload = { tripId, ...data }
 if (resolvedTenantId) createPayload.tenantId = resolvedTenantId
 return prisma.drivingScore.upsert({
 where: { tripId },
 update: data,
 create: createPayload,
 })
}

// ── Haversine distance in km ──────────────────────────────────────────────

function haversine(lat1, lon1, lat2, lon2) {
 const R = 6371
 const dLat = (lat2 - lat1) * Math.PI / 180
 const dLon = (lon2 - lon1) * Math.PI / 180
 const a = Math.sin(dLat / 2) ** 2 +
 Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
 Math.sin(dLon / 2) ** 2
 return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
