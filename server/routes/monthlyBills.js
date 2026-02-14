import { Router } from 'express'
import prisma from '../lib/prisma.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { parseBillPDF } from '../services/pdfBillParser.js'

const router = Router()
router.use(requireAuth)

// ── File upload config ──────────────────────────────────────────────────────

const uploadsDir = path.resolve('uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Only PDF files are accepted'), false)
    }
  },
})

// ── GET /api/monthly-bills — List all monthly bills ─────────────────────────

router.get('/', async (req, res) => {
  try {
    const bills = await prisma.monthlyBill.findMany({
      where: { tenantId: req.tenantId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        _count: { select: { trips: true } },
      },
    })
    return res.json(bills)
  } catch (err) {
    console.error('List monthly bills error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/monthly-bills/:id — Single bill with trips ─────────────────────

router.get('/:id', async (req, res) => {
  try {
    const bill = await prisma.monthlyBill.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        trips: {
          include: {
            vehicle: { select: { vehicleNumber: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!bill) return res.status(404).json({ error: 'Monthly bill not found' })
    return res.json(bill)
  } catch (err) {
    console.error('Get monthly bill error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/monthly-bills/parse-pdf — Upload + extract data ───────────────

router.post('/parse-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' })
    }

    const parsed = await parseBillPDF(req.file.path)

    // Clean up uploaded file
    fs.unlinkSync(req.file.path)

    return res.json({
      ...parsed,
      filename: req.file.originalname,
    })
  } catch (err) {
    console.error('Parse PDF error:', err)
    // Clean up file if it exists
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    return res.status(500).json({ error: err.message || 'Failed to parse PDF' })
  }
})

// ── POST /api/monthly-bills — Create bill + auto-distribute freight ─────────

router.post('/', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const { month, year, totalAmount, sourceFile } = req.body

    if (!month || !year || !totalAmount) {
      return res.status(400).json({ error: 'month, year, and totalAmount are required' })
    }

    // Check if bill already exists for this month (compound unique: tenantId, month, year)
    const existing = await prisma.monthlyBill.findFirst({
      where: { tenantId: req.tenantId, month: parseInt(month), year: parseInt(year) },
    })
    if (existing) {
      return res.status(400).json({ error: `Bill for ${month}/${year} already exists` })
    }

    // Find all logged trips (no freight yet) — optionally filter by month if trips have tripDate
    const loggedTrips = await prisma.trip.findMany({
      where: { tenantId: req.tenantId, status: 'logged', freightAmount: null },
      include: { vehicle: { select: { vehicleNumber: true } } },
      orderBy: { createdAt: 'asc' },
    })

    if (loggedTrips.length === 0) {
      return res.status(400).json({ error: 'No logged trips found to reconcile' })
    }

    // Auto-distribute freight proportionally based on distance (longer route = more freight)
    const totalDistance = loggedTrips.reduce((sum, t) => sum + t.distance, 0)
    const distributions = loggedTrips.map((t) => ({
      tripId: t.id,
      vehicleNumber: t.vehicle.vehicleNumber,
      loadingLocation: t.loadingLocation,
      destination: t.destination,
      distance: t.distance,
      currentCost: t.fuelExpense + t.toll + t.cashExpense,
      suggestedFreight: Math.round((t.distance / totalDistance) * parseFloat(totalAmount) * 100) / 100,
    }))

    // Create the bill (not yet reconciled — user reviews first)
    const bill = await prisma.monthlyBill.create({
      data: {
        tenantId: req.tenantId,
        month: parseInt(month),
        year: parseInt(year),
        totalAmount: parseFloat(totalAmount),
        tripCount: loggedTrips.length,
        sourceFile: sourceFile || null,
      },
    })

    return res.status(201).json({
      bill,
      distributions,
      message: `Bill created. ${loggedTrips.length} trips ready for reconciliation.`,
    })
  } catch (err) {
    console.error('Create monthly bill error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── PUT /api/monthly-bills/:id/reconcile — Finalize reconciliation ──────────
// Body: { tripFreights: [{ tripId, freightAmount }, ...] }

router.put('/:id/reconcile', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const { tripFreights } = req.body

    if (!tripFreights || !Array.isArray(tripFreights) || tripFreights.length === 0) {
      return res.status(400).json({ error: 'tripFreights array is required' })
    }

    const bill = await prisma.monthlyBill.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } })
    if (!bill) return res.status(404).json({ error: 'Monthly bill not found' })
    if (bill.reconciledAt) return res.status(400).json({ error: 'Bill already reconciled' })

    // Update each trip with freight amount, link to bill, mark as reconciled (trips must belong to tenant)
    const updates = []
    for (const { tripId, freightAmount } of tripFreights) {
      if (!tripId || !freightAmount) continue
      const trip = await prisma.trip.findFirst({ where: { id: tripId, tenantId: req.tenantId } })
      if (!trip) continue
      updates.push(
        prisma.trip.update({
          where: { id: tripId },
          data: {
            freightAmount: parseFloat(freightAmount),
            status: 'reconciled',
            monthlyBillId: bill.id,
          },
        })
      )
    }

    await prisma.$transaction(updates)

    // Mark bill as reconciled
    const updated = await prisma.monthlyBill.update({
      where: { id: bill.id },
      data: {
        reconciledAt: new Date(),
        tripCount: tripFreights.length,
      },
      include: {
        trips: {
          include: { vehicle: { select: { vehicleNumber: true } } },
        },
      },
    })

    return res.json({
      ...updated,
      message: `Reconciled ${tripFreights.length} trips with freight amounts.`,
    })
  } catch (err) {
    console.error('Reconcile bill error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
