import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// ── GET /api/saved-routes — List all saved routes ─────────────────────────

router.get('/', async (req, res) => {
 try {
 const routes = await prisma.savedRoute.findMany({
 where: { tenantId: req.tenantId },
 orderBy: { shortName: 'asc' },
 })
 return res.json(routes)
 } catch (err) {
 console.error('List saved routes error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── POST /api/saved-routes — Create a saved route ─────────────────────────

router.post('/', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const {
 shortName, loadingLocation, destination, distance,
 ratePerKm, defaultFuelLitres, defaultDieselRate,
 defaultFuelExpense, defaultToll, defaultCash,
 } = req.body

 if (!shortName || !loadingLocation || !destination || !distance) {
 return res.status(400).json({ error: 'shortName, loadingLocation, destination, distance are required' })
 }

 const route = await prisma.savedRoute.create({
 data: {
 tenantId: req.tenantId,
 shortName,
 loadingLocation,
 destination,
 distance: parseInt(distance),
 ratePerKm: parseFloat(ratePerKm) || 0,
 defaultFuelLitres: parseFloat(defaultFuelLitres) || 0,
 defaultDieselRate: parseFloat(defaultDieselRate) || 92.67,
 defaultFuelExpense: parseFloat(defaultFuelExpense) || 0,
 defaultToll: parseFloat(defaultToll) || 0,
 defaultCash: parseFloat(defaultCash) || 2000,
 },
 })
 return res.status(201).json(route)
 } catch (err) {
 if (err.code === 'P2002') {
 return res.status(409).json({ error: 'This loading→destination route already exists' })
 }
 console.error('Create saved route error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── PUT /api/saved-routes/:id — Edit a saved route ────────────────────────

router.put('/:id', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const item = await prisma.savedRoute.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } })
 if (!item) return res.status(404).json({ error: 'Not found' })

 const {
 shortName, loadingLocation, destination, distance,
 ratePerKm, defaultFuelLitres, defaultDieselRate,
 defaultFuelExpense, defaultToll, defaultCash,
 } = req.body

 const data = {}
 if (shortName) data.shortName = shortName
 if (loadingLocation) data.loadingLocation = loadingLocation
 if (destination) data.destination = destination
 if (distance) data.distance = parseInt(distance)
 if (ratePerKm !== undefined) data.ratePerKm = parseFloat(ratePerKm)
 if (defaultFuelLitres !== undefined) data.defaultFuelLitres = parseFloat(defaultFuelLitres)
 if (defaultDieselRate !== undefined) data.defaultDieselRate = parseFloat(defaultDieselRate)
 if (defaultFuelExpense !== undefined) data.defaultFuelExpense = parseFloat(defaultFuelExpense)
 if (defaultToll !== undefined) data.defaultToll = parseFloat(defaultToll)
 if (defaultCash !== undefined) data.defaultCash = parseFloat(defaultCash)

 const route = await prisma.savedRoute.update({
 where: { id: req.params.id },
 data,
 })
 return res.json(route)
 } catch (err) {
 if (err.code === 'P2025') return res.status(404).json({ error: 'Route not found' })
 console.error('Update saved route error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── DELETE /api/saved-routes/:id — Delete a saved route ───────────────────

router.delete('/:id', requireRole('owner'), async (req, res) => {
 try {
 await prisma.savedRoute.delete({ where: { id: req.params.id } })
 return res.json({ ok: true })
 } catch (err) {
 if (err.code === 'P2025') return res.status(404).json({ error: 'Route not found' })
 console.error('Delete saved route error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

export default router
