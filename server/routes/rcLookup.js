import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { fetchRCDetails, isSurepassConfigured } from '../services/surepass.js'

const router = Router()

router.use(requireAuth)

router.get('/fetch-rc/status', requireRole('owner', 'manager'), async (_req, res) => {
  return res.json({
    provider: 'surepass',
    available: isSurepassConfigured(),
    message: isSurepassConfigured()
      ? 'Auto-fetch is available'
      : 'Auto-fetch is not configured. You can continue with manual entry.',
    supported: ['RC', 'insurance', 'FC', 'PUC', 'permit'],
  })
})

/**
 * POST /api/vehicles/fetch-rc
 * Fetch vehicle RC data from Vahan via Surepass, upsert the vehicle,
 * and auto-create/update document entries with real expiry dates.
 *
 * Body: { vehicleNumber: "MP09AB1234" }
 */
router.post('/fetch-rc', requireRole('owner', 'manager'), async (req, res) => {
  try {
    if (!isSurepassConfigured()) {
      return res.status(200).json({
        provider: 'surepass',
        available: false,
        message: 'Auto-fetch is not configured. You can continue with manual entry.',
        supported: ['RC', 'insurance', 'FC', 'PUC', 'permit'],
      })
    }

    const { vehicleNumber } = req.body
    if (!vehicleNumber) {
      return res.status(400).json({ error: 'vehicleNumber is required' })
    }

    // ── Fetch from Surepass ──────────────────────────────────────────
    const rc = await fetchRCDetails(vehicleNumber)

    // ── Upsert vehicle ───────────────────────────────────────────────
    const regYear = rc.registrationDate
      ? new Date(rc.registrationDate).getFullYear()
      : new Date().getFullYear()

    const vehicle = await prisma.vehicle.upsert({
      where: {
        tenantId_vehicleNumber: { tenantId: req.tenantId, vehicleNumber: rc.vehicleNumber },
      },
      update: {
        vehicleType: rc.vehicleType,
      },
      create: {
        tenantId: req.tenantId,
        vehicleNumber: rc.vehicleNumber,
        vehicleType: rc.vehicleType,
        purchaseYear: regYear,
        approxKm: 0,
        status: 'active',
      },
    })

    // ── Upsert documents (insurance, FC, PUC, permit) ────────────────
    const docEntries = [
      { type: 'insurance', expiry: rc.insuranceExpiry },
      { type: 'FC', expiry: rc.fitnessExpiry },
      { type: 'PUC', expiry: rc.pucExpiry },
      { type: 'permit', expiry: rc.permitExpiry },
    ]

    const upsertedDocs = []

    for (const entry of docEntries) {
      if (!entry.expiry) continue

      // Check if a document of this type already exists for this vehicle
      const existing = await prisma.document.findFirst({
        where: {
          tenantId: req.tenantId,
          vehicleId: vehicle.id,
          documentType: entry.type,
        },
      })

      if (existing) {
        const updated = await prisma.document.update({
          where: { id: existing.id },
          data: { expiryDate: new Date(entry.expiry) },
        })
        upsertedDocs.push(updated)
      } else {
        const created = await prisma.document.create({
          data: {
            tenantId: req.tenantId,
            vehicleId: vehicle.id,
            documentType: entry.type,
            expiryDate: new Date(entry.expiry),
            reminderDays: entry.type === 'PUC' ? 15 : 30,
          },
        })
        upsertedDocs.push(created)
      }
    }

    // ── Return combined result ────────────────────────────────────────
    return res.json({
      source: 'vahan',
      vehicle,
      documents: upsertedDocs,
      rcDetails: {
        ownerName: rc.ownerName,
        fatherName: rc.fatherName,
        manufacturer: rc.manufacturer,
        model: rc.model,
        fuelType: rc.fuelType,
        color: rc.color,
        chassisNumber: rc.chassisNumber,
        engineNumber: rc.engineNumber,
        registrationDate: rc.registrationDate,
        registrationAuthority: rc.registrationAuthority,
        financier: rc.financier,
        insuranceCompany: rc.insuranceCompany,
        permitNumber: rc.permitNumber,
        permitType: rc.permitType,
      },
    })
  } catch (err) {
    console.error('RC lookup error:', err)
    const status = err.message.includes('not configured') ? 200 : 400
    if (status === 200) {
      return res.status(200).json({
        provider: 'surepass',
        available: false,
        message: 'Auto-fetch is not configured. You can continue with manual entry.',
        supported: ['RC', 'insurance', 'FC', 'PUC', 'permit'],
      })
    }
    return res.status(status).json({ error: err.message })
  }
})

export default router
