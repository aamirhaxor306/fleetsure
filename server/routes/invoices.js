import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// GET /api/invoices
router.get('/', async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId: req.tenantId },
      include: {
        job: {
          include: {
            vehicle: { select: { vehicleNumber: true } }
          }
        },
        tenant: { select: { name: true, city: true, address: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return res.json(invoices)
  } catch (err) {
    console.error('Fetch invoices error:', err)
    return res.status(500).json({ error: 'Failed to fetch invoices' })
  }
})

// GET /api/invoices/:id
router.get('/:id', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        job: {
          include: {
            vehicle: { select: { vehicleNumber: true, vehicleType: true } },
            workshop: true,
            partsUsed: { include: { sku: true } },
            laborItems: true
          }
        },
        tenant: true
      }
    })

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

    return res.json(invoice)
  } catch (err) {
    console.error('Fetch invoice error:', err)
    return res.status(500).json({ error: 'Failed to fetch invoice details' })
  }
})

// PATCH /api/invoices/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const { paymentStatus } = req.body
    if (!['PENDING', 'PAID'].includes(paymentStatus)) {
      return res.status(400).json({ error: 'Invalid payment status' })
    }

    const updated = await prisma.invoice.update({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: { paymentStatus }
    })

    return res.json(updated)
  } catch (err) {
    console.error('Update invoice error:', err)
    return res.status(500).json({ error: 'Failed to update invoice' })
  }
})

export default router
