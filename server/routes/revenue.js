import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// ── GET /api/revenue — Platform revenue summary + transaction list ──────────

router.get('/', async (req, res) => {
  try {
    const transactions = await prisma.platformTransaction.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        renewalRequest: {
          select: {
            id: true,
            documentType: true,
            status: true,
            vehicle: { select: { vehicleNumber: true } },
          },
        },
      },
    })

    // Summary stats
    const totalCommission = transactions.reduce((s, t) => s + t.commissionAmount, 0)
    const totalQuoteValue = transactions.reduce((s, t) => s + t.quoteAmount, 0)
    const pendingCommission = transactions
      .filter((t) => t.status === 'pending')
      .reduce((s, t) => s + t.commissionAmount, 0)
    const collectedCommission = transactions
      .filter((t) => t.status === 'collected')
      .reduce((s, t) => s + t.commissionAmount, 0)

    // Group by document type
    const byDocType = {}
    for (const t of transactions) {
      const dt = t.documentType
      if (!byDocType[dt]) {
        byDocType[dt] = { count: 0, totalCommission: 0, totalQuoteValue: 0 }
      }
      byDocType[dt].count++
      byDocType[dt].totalCommission += t.commissionAmount
      byDocType[dt].totalQuoteValue += t.quoteAmount
    }

    // Group by month
    const byMonth = {}
    for (const t of transactions) {
      const d = new Date(t.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!byMonth[key]) {
        byMonth[key] = { count: 0, totalCommission: 0 }
      }
      byMonth[key].count++
      byMonth[key].totalCommission += t.commissionAmount
    }

    return res.json({
      summary: {
        totalTransactions: transactions.length,
        totalQuoteValue: Math.round(totalQuoteValue * 100) / 100,
        totalCommission: Math.round(totalCommission * 100) / 100,
        pendingCommission: Math.round(pendingCommission * 100) / 100,
        collectedCommission: Math.round(collectedCommission * 100) / 100,
        avgCommissionPct:
          transactions.length > 0
            ? Math.round(
                (transactions.reduce((s, t) => s + t.commissionPct, 0) / transactions.length) * 100
              ) / 100
            : 0,
      },
      byDocumentType: byDocType,
      byMonth,
      transactions,
    })
  } catch (err) {
    console.error('Revenue error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── PUT /api/revenue/:id/collect — Mark commission as collected ──────────────

router.put('/:id/collect', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const txn = await prisma.platformTransaction.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    })
    if (!txn) return res.status(404).json({ error: 'Not found' })

    const updated = await prisma.platformTransaction.update({
      where: { id: req.params.id },
      data: { status: 'collected' },
    })
    return res.json(updated)
  } catch (err) {
    console.error('Collect commission error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
