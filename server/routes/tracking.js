/**
 * Live Tracking API Routes
 * ────────────────────────
 * Used by the Telegram Mini App to stream GPS + accelerometer data.
 */

import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { calculateDrivingScore } from '../services/drivingScore.js'

const router = Router()

router.use(requireAuth)

// ── POST /api/tracking/location — Stream GPS point ──────────────────────────

router.post('/location', async (req, res) => {
 try {
 const { tripId, driverId, latitude, longitude, speed, heading, accuracy } = req.body

 if (!tripId || !driverId || latitude == null || longitude == null) {
 return res.status(400).json({ error: 'tripId, driverId, latitude, longitude required' })
 }

 await prisma.locationLog.create({
 data: {
 tenantId: req.tenantId,
 tripId,
 driverId,
 latitude,
 longitude,
 speed: speed || null,
 heading: heading || null,
 },
 })

 // Update trip start coords if not set
 const trip = await prisma.trip.findFirst({
 where: { id: tripId, tenantId: req.tenantId },
 select: { startLat: true },
 })
 if (trip && !trip.startLat) {
 await prisma.trip.update({
 where: { id: tripId, tenantId: req.tenantId },
 data: { startLat: latitude, startLng: longitude },
 })
 }

 return res.json({ ok: true })
 } catch (err) {
 console.error('[Tracking] Location error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── POST /api/tracking/event — Log a driving event ──────────────────────────

router.post('/event', async (req, res) => {
 try {
 const { tripId, driverId, type, severity, latitude, longitude, speed } = req.body

 if (!tripId || !driverId || !type) {
 return res.status(400).json({ error: 'tripId, driverId, type required' })
 }

 await prisma.drivingEvent.create({
 data: {
 tenantId: req.tenantId,
 tripId,
 driverId,
 type,
 severity: severity || 0,
 latitude: latitude || 0,
 longitude: longitude || 0,
 speed: speed || null,
 },
 })

 return res.json({ ok: true })
 } catch (err) {
 console.error('[Tracking] Event error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── POST /api/tracking/stop — Stop tracking & compute score ─────────────────

router.post('/stop', async (req, res) => {
 try {
 const { tripId, driverId, latitude, longitude } = req.body

 if (!tripId) {
 return res.status(400).json({ error: 'tripId required' })
 }

 // Save final location as end coords
 if (latitude != null && longitude != null) {
 const trip = await prisma.trip.findFirst({
 where: { id: tripId, tenantId: req.tenantId },
 select: { id: true },
 })
 if (trip) {
 await prisma.trip.update({
 where: { id: tripId, tenantId: req.tenantId },
 data: { endLat: latitude, endLng: longitude },
 })
 }

 if (driverId) {
 await prisma.locationLog.create({
 data: { tenantId: req.tenantId, tripId, driverId, latitude, longitude, speed: 0 },
 })
 }
 }

 // Calculate driving score
 const score = await calculateDrivingScore(tripId)

 return res.json({ ok: true, score })
 } catch (err) {
 console.error('[Tracking] Stop error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── GET /api/tracking/score/:tripId — Get driving score ─────────────────────

router.get('/score/:tripId', async (req, res) => {
 try {
 const score = await prisma.drivingScore.findFirst({
 where: { tripId: req.params.tripId, tenantId: req.tenantId },
 })

 if (!score) {
 return res.status(404).json({ error: 'No driving score for this trip' })
 }

 return res.json(score)
 } catch (err) {
 console.error('[Tracking] Score error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── GET /api/tracking/live/:tripId — Latest location logs for live map ──────

router.get('/live/:tripId', async (req, res) => {
 try {
 const logs = await prisma.locationLog.findMany({
 where: { tripId: req.params.tripId, tenantId: req.tenantId },
 orderBy: { timestamp: 'desc' },
 take: 50,
 select: { latitude: true, longitude: true, speed: true, heading: true, timestamp: true },
 })

 // Also fetch events
 const events = await prisma.drivingEvent.findMany({
 where: { tripId: req.params.tripId, tenantId: req.tenantId },
 orderBy: { timestamp: 'desc' },
 select: { type: true, severity: true, latitude: true, longitude: true, speed: true, timestamp: true },
 })

 return res.json({ logs: logs.reverse(), events })
 } catch (err) {
 console.error('[Tracking] Live error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── GET /api/tracking/trip-info/:tripId — Trip metadata for Mini App ────────

router.get('/trip-info/:tripId', async (req, res) => {
 try {
 const trip = await prisma.trip.findFirst({
 where: { id: req.params.tripId, tenantId: req.tenantId },
 select: {
 id: true,
 loadingLocation: true,
 destination: true,
 createdAt: true,
 vehicle: { select: { vehicleNumber: true } },
 driver: { select: { name: true } },
 },
 })

 if (!trip) return res.status(404).json({ error: 'Trip not found' })
 return res.json(trip)
 } catch (err) {
 console.error('[Tracking] Trip info error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

export default router
