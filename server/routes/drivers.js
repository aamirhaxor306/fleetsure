import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { fetchDrivingLicenseText, isSurepassConfigured } from '../services/surepass.js'

const router = Router()

router.use(requireAuth)

// ── POST /api/drivers/verify-license — Verify DL via Surepass ─────────────
router.post('/verify-license', requireRole('owner', 'manager'), async (req, res) => {
  try {
    if (!isSurepassConfigured()) {
      return res.status(200).json({
        provider: 'surepass',
        available: false,
        message: 'Auto verification is not configured. You can continue with manual entry.',
      })
    }

    const { licenseNumber, dob } = req.body
    if (!licenseNumber) {
      return res.status(400).json({ error: 'licenseNumber is required' })
    }

    const data = await fetchDrivingLicenseText(licenseNumber, dob)
    return res.json({ source: 'surepass', ...data })
  } catch (err) {
    console.error('Verify license error:', err)
    return res.status(400).json({ error: err.message || 'License verification failed' })
  }
})

// ── GET /api/drivers — List all drivers ───────────────────────────────────

router.get('/', async (req, res) => {
 try {
 const drivers = await prisma.driver.findMany({
 where: { tenantId: req.tenantId },
 orderBy: { createdAt: 'desc' },
 include: {
 vehicle: { select: { id: true, vehicleNumber: true } },
 _count: { select: { trips: true } },
 },
 })
 return res.json(drivers)
 } catch (err) {
 console.error('List drivers error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── GET /api/drivers/:id — Single driver with trips ──────────────────────

router.get('/:id', async (req, res) => {
 try {
 const driver = await prisma.driver.findFirst({
 where: { id: req.params.id, tenantId: req.tenantId },
 include: {
 vehicle: { select: { id: true, vehicleNumber: true, vehicleType: true } },
 trips: {
 orderBy: { createdAt: 'desc' },
 take: 20,
 include: { vehicle: { select: { vehicleNumber: true } } },
 },
 _count: { select: { trips: true, locationLogs: true } },
 },
 })
 if (!driver) return res.status(404).json({ error: 'Driver not found' })
 return res.json(driver)
 } catch (err) {
 console.error('Get driver error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── POST /api/drivers — Create driver ────────────────────────────────────

router.post('/', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const { name, phone, licenseNumber, vehicleId } = req.body
 if (!name || !phone) {
 return res.status(400).json({ error: 'Name and phone are required' })
 }
 const driver = await prisma.driver.create({
 data: {
 tenantId: req.tenantId,
 name,
 phone,
 licenseNumber: licenseNumber || null,
 vehicleId: vehicleId || null,
 },
 include: {
 vehicle: { select: { id: true, vehicleNumber: true } },
 },
 })
 return res.status(201).json(driver)
 } catch (err) {
 if (err.code === 'P2002') {
 return res.status(400).json({ error: 'Phone number already registered' })
 }
 console.error('Create driver error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── PUT /api/drivers/:id — Update driver ─────────────────────────────────

router.put('/:id', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const { name, phone, licenseNumber, vehicleId, active } = req.body
 const driver = await prisma.driver.update({
 where: { id: req.params.id },
 data: {
 ...(name !== undefined && { name }),
 ...(phone !== undefined && { phone }),
 ...(licenseNumber !== undefined && { licenseNumber }),
 ...(vehicleId !== undefined && { vehicleId: vehicleId || null }),
 ...(active !== undefined && { active }),
 },
 include: {
 vehicle: { select: { id: true, vehicleNumber: true } },
 },
 })
 return res.json(driver)
 } catch (err) {
 console.error('Update driver error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── DELETE /api/drivers/:id — Deactivate driver ──────────────────────────

router.delete('/:id', requireRole('owner'), async (req, res) => {
 try {
 await prisma.driver.update({
 where: { id: req.params.id },
 data: { active: false },
 })
 return res.json({ ok: true })
 } catch (err) {
 console.error('Delete driver error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

export default router
