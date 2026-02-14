import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// POST /api/maintenance — Add maintenance log
router.post('/', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const { vehicleId, maintenanceType, description, amount, workshopName, maintenanceDate } = req.body

    if (!vehicleId || !maintenanceType || !amount || !maintenanceDate) {
      return res.status(400).json({ error: 'vehicleId, maintenanceType, amount, maintenanceDate are required' })
    }

    const validTypes = ['engine', 'tyre', 'brake', 'clutch', 'general']
    if (!validTypes.includes(maintenanceType)) {
      return res.status(400).json({ error: `maintenanceType must be one of: ${validTypes.join(', ')}` })
    }

    const log = await prisma.maintenanceLog.create({
      data: {
        tenantId: req.tenantId,
        vehicleId,
        maintenanceType,
        description: description || null,
        amount: parseInt(amount),
        workshopName: workshopName || null,
        maintenanceDate: new Date(maintenanceDate),
      },
    })
    return res.status(201).json(log)
  } catch (err) {
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'Vehicle not found' })
    }
    console.error('Create maintenance error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/maintenance — List maintenance logs (optional ?vehicleId=)
router.get('/', async (req, res) => {
  try {
    const where = { tenantId: req.tenantId }
    if (req.query.vehicleId) where.vehicleId = req.query.vehicleId

    const logs = await prisma.maintenanceLog.findMany({
      where,
      orderBy: { maintenanceDate: 'desc' },
      take: 100,
      include: {
        vehicle: { select: { vehicleNumber: true } },
      },
    })
    return res.json(logs)
  } catch (err) {
    console.error('List maintenance error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
