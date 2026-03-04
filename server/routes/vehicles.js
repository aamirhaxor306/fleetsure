import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// GET /api/vehicles — List all vehicles
router.get('/', async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { vehicleNumber: 'asc' },
      include: {
        _count: {
          select: { maintenanceLogs: true, documents: true, alerts: { where: { resolved: false } } },
        },
      },
    })
    return res.json(vehicles)
  } catch (err) {
    console.error('List vehicles error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/vehicles/:id — Vehicle detail with maintenance + documents
router.get('/:id', async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        maintenanceLogs: { orderBy: { maintenanceDate: 'desc' }, take: 20 },
        documents: { orderBy: { expiryDate: 'asc' } },
        alerts: { where: { resolved: false }, orderBy: { createdAt: 'desc' } },
        tyres: { orderBy: { position: 'asc' } },
      },
    })
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' })
    return res.json(vehicle)
  } catch (err) {
    console.error('Get vehicle error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/vehicles — Add vehicle
router.post('/', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const { vehicleNumber, vehicleType, purchaseYear, approxKm, status, axleConfig } = req.body
    if (!vehicleNumber || !vehicleType || !purchaseYear) {
      return res.status(400).json({ error: 'vehicleNumber, vehicleType, purchaseYear are required' })
    }

    const validAxles = ['6W', '10W', '12W', '14W']
    const vehicle = await prisma.vehicle.create({
      data: {
        tenantId: req.tenantId,
        vehicleNumber: vehicleNumber.toUpperCase().replace(/\s+/g, ''),
        vehicleType,
        purchaseYear: parseInt(purchaseYear),
        approxKm: parseInt(approxKm) || 0,
        status: status || 'active',
        axleConfig: validAxles.includes(axleConfig) ? axleConfig : '6W',
      },
    })
    return res.status(201).json(vehicle)
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Vehicle number already exists' })
    }
    console.error('Create vehicle error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/vehicles/:id — Edit vehicle
router.put('/:id', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const existing = await prisma.vehicle.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } })
    if (!existing) return res.status(404).json({ error: 'Vehicle not found' })

    const { vehicleNumber, vehicleType, purchaseYear, approxKm, status, axleConfig } = req.body
    const data = {}
    if (vehicleNumber) data.vehicleNumber = vehicleNumber.toUpperCase().replace(/\s+/g, '')
    if (vehicleType) data.vehicleType = vehicleType
    if (purchaseYear) data.purchaseYear = parseInt(purchaseYear)
    if (approxKm !== undefined) data.approxKm = parseInt(approxKm)
    if (status) data.status = status
    const validAxles = ['6W', '10W', '12W', '14W']
    if (axleConfig && validAxles.includes(axleConfig)) data.axleConfig = axleConfig

    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data,
    })
    return res.json(vehicle)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Vehicle not found' })
    if (err.code === 'P2002') return res.status(409).json({ error: 'Vehicle number already exists' })
    console.error('Update vehicle error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/vehicles/:id — Remove vehicle
router.delete('/:id', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const existing = await prisma.vehicle.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } })
    if (!existing) return res.status(404).json({ error: 'Vehicle not found' })

    await prisma.vehicle.delete({ where: { id: req.params.id } })
    return res.json({ ok: true })
  } catch (err) {
    console.error('Delete vehicle error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
