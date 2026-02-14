import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// ── GET /api/renewal-partners — List all partners (auth required) ─────────────

router.get('/', requireAuth, async (req, res) => {
  try {
    const where = { tenantId: req.tenantId }
    if (req.query.type) where.partnerType = req.query.type
    if (req.query.active !== undefined) where.active = req.query.active === 'true'

    const partners = await prisma.renewalPartner.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { quotes: true } },
      },
    })
    return res.json(partners)
  } catch (err) {
    console.error('List partners error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/renewal-partners — Add a partner (auth required) ────────────────

router.post('/', requireAuth, requireRole('owner', 'manager'), async (req, res) => {
  try {
    const { name, partnerType, phone, email, apiEndpoint, commissionPct, serviceArea } = req.body

    if (!name || !partnerType) {
      return res.status(400).json({ error: 'name and partnerType are required' })
    }

    const validTypes = ['insurance_api', 'insurance_broker', 'rto_agent', 'puc_center']
    if (!validTypes.includes(partnerType)) {
      return res.status(400).json({ error: `partnerType must be one of: ${validTypes.join(', ')}` })
    }

    const partner = await prisma.renewalPartner.create({
      data: {
        tenantId: req.tenantId,
        name,
        partnerType,
        phone: phone || null,
        email: email || null,
        apiEndpoint: apiEndpoint || null,
        commissionPct: parseFloat(commissionPct) || 0,
        serviceArea: serviceArea || null,
      },
    })

    return res.status(201).json(partner)
  } catch (err) {
    console.error('Create partner error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── PUT /api/renewal-partners/:id — Update a partner (auth required) ──────────

router.put('/:id', requireAuth, requireRole('owner', 'manager'), async (req, res) => {
  try {
    const partner = await prisma.renewalPartner.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } })
    if (!partner) return res.status(404).json({ error: 'Partner not found' })

    const data = {}
    const fields = ['name', 'partnerType', 'phone', 'email', 'apiEndpoint', 'serviceArea', 'active']
    for (const f of fields) {
      if (req.body[f] !== undefined) data[f] = req.body[f]
    }
    if (req.body.commissionPct !== undefined) data.commissionPct = parseFloat(req.body.commissionPct)

    const updated = await prisma.renewalPartner.update({
      where: { id: req.params.id },
      data,
    })
    return res.json(updated)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Partner not found' })
    console.error('Update partner error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/renewal-partners/:id/submit-quote — Public quote submission ─────
// Partners use this via a unique link (no auth required)

router.post('/:id/submit-quote', async (req, res) => {
  try {
    const { requestId, amount, coverageDetails, validDays, tenantId: bodyTenantId } = req.body

    if (!requestId || !amount) {
      return res.status(400).json({ error: 'requestId and amount are required' })
    }

    // Public route: tenantId may come from body for partner/request lookup
    const tenantId = req.tenantId ?? bodyTenantId
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required (from auth or request body)' })

    const partner = await prisma.renewalPartner.findFirst({ where: { id: req.params.id, tenantId } })
    if (!partner) return res.status(404).json({ error: 'Partner not found' })

    const request = await prisma.renewalRequest.findFirst({ where: { id: requestId, tenantId } })
    if (!request) return res.status(404).json({ error: 'Renewal request not found' })

    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + (parseInt(validDays) || 3))

    const quote = await prisma.renewalQuote.create({
      data: {
        tenantId,
        requestId,
        partnerId: partner.id,
        partnerName: partner.name,
        amount: parseFloat(amount),
        coverageDetails: coverageDetails || null,
        validUntil,
        source: 'manual',
      },
    })

    // Update request status if it was pending
    if (request.status === 'pending') {
      await prisma.renewalRequest.update({
        where: { id: requestId },
        data: { status: 'quotes_received' },
      })
    }

    return res.status(201).json({ ...quote, message: 'Quote submitted successfully.' })
  } catch (err) {
    console.error('Submit quote error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
