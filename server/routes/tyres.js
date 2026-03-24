import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)

// ── GET /api/tyres/vehicle/:vehicleId — All tyres for a vehicle ─────────────

router.get('/vehicle/:vehicleId', async (req, res) => {
 try {
 const tyres = await prisma.tyre.findMany({
 where: { vehicleId: req.params.vehicleId, tenantId: req.tenantId },
 orderBy: { position: 'asc' },
 })
 return res.json(tyres)
 } catch (err) {
 console.error('List tyres error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── POST /api/tyres — Install a tyre at a position ─────────────────────────

router.post('/', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const { vehicleId, position, brand, model, serialNumber, installedDate, installedKm, expectedLifeKm, condition, notes } = req.body

 if (!vehicleId || !position || !installedDate || installedKm === undefined) {
 return res.status(400).json({ error: 'vehicleId, position, installedDate, and installedKm are required' })
 }

 // Check if position is already occupied
 const existing = await prisma.tyre.findFirst({
 where: { vehicleId_position: { vehicleId, position }, tenantId: req.tenantId },
 })

 if (existing) {
 return res.status(409).json({ error: `Position ${position} already has a tyre installed. Remove it first.` })
 }

 const tyre = await prisma.tyre.create({
 data: {
 tenantId: req.tenantId,
 vehicleId,
 position,
 brand: brand || null,
 model: model || null,
 serialNumber: serialNumber || null,
 installedDate: new Date(installedDate),
 installedKm: parseInt(installedKm),
 expectedLifeKm: parseInt(expectedLifeKm) || 80000,
 condition: condition || 'good',
 notes: notes || null,
 },
 })

 return res.status(201).json(tyre)
 } catch (err) {
 console.error('Create tyre error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── PUT /api/tyres/:id — Update a tyre (condition, km, notes, inspection) ──

router.put('/:id', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const item = await prisma.tyre.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } })
 if (!item) return res.status(404).json({ error: 'Not found' })

 const { condition, notes, lastInspectedAt, installedKm, expectedLifeKm, brand, model, serialNumber } = req.body

 const updateData = {}
 if (condition !== undefined) updateData.condition = condition
 if (notes !== undefined) updateData.notes = notes
 if (lastInspectedAt !== undefined) updateData.lastInspectedAt = new Date(lastInspectedAt)
 if (installedKm !== undefined) updateData.installedKm = parseInt(installedKm)
 if (expectedLifeKm !== undefined) updateData.expectedLifeKm = parseInt(expectedLifeKm)
 if (brand !== undefined) updateData.brand = brand
 if (model !== undefined) updateData.model = model
 if (serialNumber !== undefined) updateData.serialNumber = serialNumber

 const tyre = await prisma.tyre.update({
 where: { id: req.params.id },
 data: updateData,
 })

 return res.json(tyre)
 } catch (err) {
 console.error('Update tyre error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── DELETE /api/tyres/:id — Remove a tyre ───────────────────────────────────

router.delete('/:id', requireRole('owner'), async (req, res) => {
 try {
 const item = await prisma.tyre.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } })
 if (!item) return res.status(404).json({ error: 'Not found' })
 await prisma.tyre.delete({ where: { id: req.params.id } })
 return res.json({ success: true })
 } catch (err) {
 console.error('Delete tyre error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

export default router
