/**
 * Fleetsure — PDF Document Routes
 * ─────────────────────────────────
 * POST /api/pdf/generate                  → Generate any PDF template
 * POST /api/pdf/generate/trip-invoice/:id → Auto-generate invoice from a trip
 * POST /api/pdf/generate/statement        → Auto-generate monthly statement from date range
 */
import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import {
  generatePaymentReceipt,
  generateFreightInvoice,
  generateLetterhead,
  generateMonthlyStatement,
} from '../services/pdfGenerator.js'

const router = Router()
router.use(requireAuth)

// ── Helper: get tenant info for PDF headers ─────────────────────────────────

async function getTenantInfo(tenantId) {
  if (!tenantId) return { name: 'Fleet Company' }
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, address: true, city: true, gstin: true, phone: true },
  })
  return tenant || { name: 'Fleet Company' }
}

// ── POST /api/pdf/generate ──────────────────────────────────────────────────

router.post('/generate', async (req, res) => {
  try {
    const { template, data } = req.body

    if (!template || !data) {
      return res.status(400).json({ error: 'template and data are required' })
    }

    const tenantInfo = await getTenantInfo(req.tenantId)
    let pdfBuffer
    let filename

    switch (template) {
      case 'payment-receipt':
        pdfBuffer = await generatePaymentReceipt(data, tenantInfo)
        filename = `PaymentReceipt_${data.receiptNumber || Date.now()}.pdf`
        break

      case 'freight-invoice':
        pdfBuffer = await generateFreightInvoice(data, tenantInfo)
        filename = `FreightInvoice_${data.invoiceNumber || Date.now()}.pdf`
        break

      case 'letterhead':
        pdfBuffer = await generateLetterhead(data, tenantInfo)
        filename = `Letter_${data.referenceNumber || Date.now()}.pdf`
        break

      case 'monthly-statement':
        pdfBuffer = await generateMonthlyStatement(data, tenantInfo)
        filename = `Statement_${Date.now()}.pdf`
        break

      default:
        return res.status(400).json({ error: `Unknown template: ${template}` })
    }

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', pdfBuffer.length)
    return res.send(pdfBuffer)
  } catch (err) {
    console.error('[PDF] Generate error:', err)
    return res.status(500).json({ error: 'Failed to generate PDF' })
  }
})

// ── POST /api/pdf/generate/trip-invoice/:tripId ─────────────────────────────

router.post('/generate/trip-invoice/:tripId', async (req, res) => {
  try {
    const trip = await prisma.trip.findFirst({
      where: { id: req.params.tripId, tenantId: req.tenantId },
      include: {
        vehicle: { select: { registrationNumber: true } },
        expenses: true,
      },
    })

    if (!trip) return res.status(404).json({ error: 'Trip not found' })

    const tenantInfo = await getTenantInfo(req.tenantId)
    const totalExpenses = trip.expenses.reduce((s, e) => s + (e.amount || 0), 0)

    const data = {
      invoiceNumber: `FI-${trip.id.slice(0, 8).toUpperCase()}`,
      date: trip.startDate || new Date(),
      billTo: req.body.billTo || trip.partyName || '-',
      billToAddress: req.body.billToAddress || '',
      origin: trip.origin,
      destination: trip.destination,
      vehicleNumber: trip.vehicle?.registrationNumber || trip.vehicleId,
      distance: trip.distance,
      freightRate: trip.distance ? Math.round((trip.freightAmount || 0) / trip.distance) : null,
      freightAmount: trip.freightAmount || 0,
      gstPercent: req.body.gstPercent || 0,
      notes: req.body.notes || `Trip ID: ${trip.id}`,
    }

    const pdfBuffer = await generateFreightInvoice(data, tenantInfo)
    const filename = `FreightInvoice_${data.invoiceNumber}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', pdfBuffer.length)
    return res.send(pdfBuffer)
  } catch (err) {
    console.error('[PDF] Trip invoice error:', err)
    return res.status(500).json({ error: 'Failed to generate trip invoice' })
  }
})

// ── POST /api/pdf/generate/statement ────────────────────────────────────────

router.post('/generate/statement', async (req, res) => {
  try {
    const { startDate, endDate, vehicleId } = req.body

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    const tenantInfo = await getTenantInfo(req.tenantId)

    // Fetch trips in date range
    const tripWhere = {
      tenantId: req.tenantId,
      startDate: { gte: start, lte: end },
    }
    if (vehicleId) tripWhere.vehicleId = vehicleId

    const trips = await prisma.trip.findMany({
      where: tripWhere,
      include: {
        vehicle: { select: { registrationNumber: true } },
        expenses: true,
      },
      orderBy: { startDate: 'asc' },
    })

    // Also fetch monthly bills in the range
    const bills = await prisma.monthlyBill.findMany({
      where: {
        tenantId: req.tenantId,
        month: { gte: start, lte: end },
      },
    })

    const totalRevenue = trips.reduce((s, t) => s + (t.freightAmount || 0), 0)
    const tripExpenses = trips.reduce((s, t) => s + t.expenses.reduce((es, e) => es + (e.amount || 0), 0), 0)
    const billExpenses = bills.reduce((s, b) => s + (b.amount || 0), 0)
    const totalExpenses = tripExpenses + billExpenses

    // Vehicle-wise breakdown
    const vehicleMap = {}
    trips.forEach(t => {
      const vNum = t.vehicle?.registrationNumber || t.vehicleId
      if (!vehicleMap[vNum]) vehicleMap[vNum] = { vehicle: vNum, trips: 0, distance: 0, revenue: 0, expenses: 0, profit: 0 }
      vehicleMap[vNum].trips++
      vehicleMap[vNum].distance += (t.distance || 0)
      vehicleMap[vNum].revenue += (t.freightAmount || 0)
      const tExp = t.expenses.reduce((es, e) => es + (e.amount || 0), 0)
      vehicleMap[vNum].expenses += tExp
      vehicleMap[vNum].profit += (t.freightAmount || 0) - tExp
    })

    const vehicleBreakdown = Object.values(vehicleMap).map(v => ({
      ...v,
      distance: `${v.distance} km`,
      revenue: `₹${v.revenue.toLocaleString('en-IN')}`,
      expenses: `₹${v.expenses.toLocaleString('en-IN')}`,
      profit: `₹${v.profit.toLocaleString('en-IN')}`,
    }))

    const statementData = {
      startDate,
      endDate,
      totalTrips: trips.length,
      totalRevenue,
      totalExpenses,
      trips: trips.map(t => ({
        startDate: t.startDate,
        vehicleNumber: t.vehicle?.registrationNumber || t.vehicleId,
        origin: t.origin,
        destination: t.destination,
        distance: t.distance,
        freightAmount: t.freightAmount || 0,
        totalExpenses: t.expenses.reduce((es, e) => es + (e.amount || 0), 0),
      })),
      vehicleBreakdown,
    }

    const pdfBuffer = await generateMonthlyStatement(statementData, tenantInfo)
    const filename = `Statement_${startDate}_to_${endDate}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', pdfBuffer.length)
    return res.send(pdfBuffer)
  } catch (err) {
    console.error('[PDF] Statement error:', err)
    return res.status(500).json({ error: 'Failed to generate statement' })
  }
})

export default router
