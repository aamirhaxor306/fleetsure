/**
 * Public Tracking API — token-based auth for driver tracking links.
 * No login required. Token = tripId:driverId signed simply.
 */

import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { calculateDrivingScore } from '../services/drivingScore.js'
import crypto from 'crypto'

const router = Router()

const SECRET = process.env.TRACKING_SECRET || process.env.TWILIO_AUTH_TOKEN || 'fleetsure-track-2026'

export function generateTrackingToken(tripId, driverId) {
  const payload = `${tripId}:${driverId}`
  const hmac = crypto.createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 16)
  return `${tripId}:${driverId}:${hmac}`
}

function verifyToken(token) {
  if (!token) return null
  const parts = token.split(':')
  if (parts.length < 3) return null
  const tripId = parts[0]
  const driverId = parts[1]
  const hmac = parts[2]
  const expected = crypto.createHmac('sha256', SECRET).update(`${tripId}:${driverId}`).digest('hex').slice(0, 16)
  if (hmac !== expected) return null
  return { tripId, driverId }
}

function authFromToken(req, res, next) {
  const token = req.query.token || req.body?.token || req.headers['x-track-token']
  const parsed = verifyToken(token)
  if (!parsed) return res.status(403).json({ error: 'Invalid tracking token' })
  req.trackTripId = parsed.tripId
  req.trackDriverId = parsed.driverId
  next()
}

// ── GET /api/t/info — Trip metadata ──────────────────────────────────────

router.get('/info', authFromToken, async (req, res) => {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: req.trackTripId },
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
    console.error('[Track] Info error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/t/location — Stream GPS point ─────────────────────────────

router.post('/location', authFromToken, async (req, res) => {
  try {
    const { latitude, longitude, speed, heading } = req.body
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude, longitude required' })
    }

    const trip = await prisma.trip.findUnique({
      where: { id: req.trackTripId },
      select: { tenantId: true, startLat: true },
    })
    if (!trip) return res.status(404).json({ error: 'Trip not found' })

    await prisma.locationLog.create({
      data: {
        tenantId: trip.tenantId,
        tripId: req.trackTripId,
        driverId: req.trackDriverId,
        latitude, longitude,
        speed: speed || null,
        heading: heading || null,
      },
    })

    if (!trip.startLat) {
      await prisma.trip.update({
        where: { id: req.trackTripId },
        data: { startLat: latitude, startLng: longitude },
      })
    }

    return res.json({ ok: true })
  } catch (err) {
    console.error('[Track] Location error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/t/event — Log a driving event ─────────────────────────────

router.post('/event', authFromToken, async (req, res) => {
  try {
    const { type, severity, latitude, longitude, speed } = req.body
    if (!type) return res.status(400).json({ error: 'type required' })

    const trip = await prisma.trip.findUnique({
      where: { id: req.trackTripId },
      select: { tenantId: true },
    })
    if (!trip) return res.status(404).json({ error: 'Trip not found' })

    await prisma.drivingEvent.create({
      data: {
        tenantId: trip.tenantId,
        tripId: req.trackTripId,
        driverId: req.trackDriverId,
        type,
        severity: severity || 0,
        latitude: latitude || 0,
        longitude: longitude || 0,
        speed: speed || null,
      },
    })

    return res.json({ ok: true })
  } catch (err) {
    console.error('[Track] Event error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/t/stop — Stop tracking & compute score ────────────────────

router.post('/stop', authFromToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.body

    const trip = await prisma.trip.findUnique({
      where: { id: req.trackTripId },
      select: { tenantId: true },
    })
    if (!trip) return res.status(404).json({ error: 'Trip not found' })

    if (latitude != null && longitude != null) {
      await prisma.trip.update({
        where: { id: req.trackTripId },
        data: { endLat: latitude, endLng: longitude },
      })
      await prisma.locationLog.create({
        data: {
          tenantId: trip.tenantId,
          tripId: req.trackTripId,
          driverId: req.trackDriverId,
          latitude, longitude, speed: 0,
        },
      })
    }

    const score = await calculateDrivingScore(req.trackTripId, trip.tenantId)
    return res.json({ ok: true, score })
  } catch (err) {
    console.error('[Track] Stop error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
