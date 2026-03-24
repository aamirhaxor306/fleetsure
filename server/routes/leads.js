/**
 * Fleetsure — Lead Capture API (Public, no auth)
 * ───────────────────────────────────────────────
 * POST /api/leads → store a landing-page form submission
 */
import { Router } from 'express'
import prisma from '../lib/prisma.js'

const router = Router()

// ── Simple in-memory rate limiter (10 submissions per IP per hour) ──────────

const rateMap = new Map()
const RATE_LIMIT = 10
const RATE_WINDOW = 60 * 60 * 1000 // 1 hour

function checkRate(ip) {
 const now = Date.now()
 const entry = rateMap.get(ip)
 if (!entry || now - entry.start > RATE_WINDOW) {
 rateMap.set(ip, { start: now, count: 1 })
 return true
 }
 if (entry.count >= RATE_LIMIT) return false
 entry.count++
 return true
}

// Clean up stale entries every 10 minutes
setInterval(() => {
 const now = Date.now()
 for (const [ip, entry] of rateMap) {
 if (now - entry.start > RATE_WINDOW) rateMap.delete(ip)
 }
}, 10 * 60 * 1000)

// ── POST /api/leads ─────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
 try {
 const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip
 if (!checkRate(ip)) {
 return res.status(429).json({ error: 'Too many submissions. Please try again later.' })
 }

 const { name, fleetSize, phone, city } = req.body

 if (!name || !name.trim()) {
 return res.status(400).json({ error: 'Name is required' })
 }
 if (!phone || phone.replace(/\D/g, '').length < 10) {
 return res.status(400).json({ error: 'Valid phone number is required' })
 }
 if (!city || !city.trim()) {
 return res.status(400).json({ error: 'City is required' })
 }

 const lead = await prisma.lead.create({
 data: {
 name: name.trim(),
 fleetSize: (fleetSize || 'unknown').trim(),
 phone: phone.replace(/\D/g, '').slice(-10),
 city: city.trim(),
 },
 })

 console.log(`[Lead] New: ${lead.name} | ${lead.phone} | ${lead.fleetSize} vehicles | ${lead.city}`)

 return res.json({ ok: true, message: 'Thank you! We will contact you shortly.' })
 } catch (err) {
 console.error('Lead capture error:', err)
 return res.status(500).json({ error: 'Something went wrong. Please try again.' })
 }
})

export default router
