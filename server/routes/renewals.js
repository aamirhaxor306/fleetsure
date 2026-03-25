import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { fetchInsuranceQuotes, getEstimatedCost } from '../services/insuranceQuoteService.js'

const router = Router()
router.use(requireAuth)

// ── GET /api/renewals — List all renewal requests ─────────────────────────────

router.get('/', async (req, res) => {
 try {
 const where = { tenantId: req.tenantId }
 if (req.query.status) where.status = req.query.status
 if (req.query.vehicleId) where.vehicleId = req.query.vehicleId

 const requests = await prisma.renewalRequest.findMany({
 where,
 orderBy: { requestedAt: 'desc' },
 include: {
 vehicle: { select: { id: true, vehicleNumber: true, vehicleType: true } },
 document: { select: { id: true, documentType: true, expiryDate: true } },
 quotes: {
 include: { partner: { select: { name: true, partnerType: true } } },
 orderBy: { amount: 'asc' },
 },
 },
 })

 return res.json(requests)
 } catch (err) {
 console.error('List renewals error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── GET /api/renewals/expiring — Documents expiring in next 45 days ───────────

router.get('/expiring', async (req, res) => {
 try {
 const now = new Date()
 const cutoff = new Date(now)
 cutoff.setDate(cutoff.getDate() + 45)

 const docs = await prisma.document.findMany({
 where: {
 tenantId: req.tenantId,
 expiryDate: { lte: cutoff },
 },
 orderBy: { expiryDate: 'asc' },
 include: {
 vehicle: { select: { id: true, vehicleNumber: true, vehicleType: true } },
 renewalRequests: {
 where: { status: { notIn: ['cancelled'] } },
 orderBy: { requestedAt: 'desc' },
 take: 1,
 },
 },
 })

 // Annotate each doc with days left and whether a renewal is already started
 const result = docs.map((d) => {
 const daysLeft = Math.ceil((new Date(d.expiryDate) - now) / (1000 * 60 * 60 * 24))
 const activeRenewal = d.renewalRequests?.[0] || null
 const estimate = getEstimatedCost(d.documentType)
 return {
 ...d,
 daysLeft,
 isExpired: daysLeft <= 0,
 activeRenewal,
 estimatedCost: estimate,
 renewalRequests: undefined, // don't leak full array
 }
 })

 return res.json(result)
 } catch (err) {
 console.error('Expiring docs error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── GET /api/renewals/:id — Single request with all quotes ────────────────────

router.get('/:id', async (req, res) => {
 try {
 const renewal = await prisma.renewalRequest.findFirst({
 where: { id: req.params.id, tenantId: req.tenantId },
 include: {
 vehicle: true,
 document: true,
 quotes: {
 include: { partner: { select: { id: true, name: true, partnerType: true, phone: true } } },
 orderBy: { amount: 'asc' },
 },
 },
 })
 if (!renewal) return res.status(404).json({ error: 'Renewal request not found' })
 return res.json(renewal)
 } catch (err) {
 console.error('Get renewal error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── POST /api/renewals — Create a renewal request ─────────────────────────────

router.post('/', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const { vehicleId, documentId, documentType } = req.body

 if (!vehicleId || !documentId || !documentType) {
 return res.status(400).json({ error: 'vehicleId, documentId, documentType are required' })
 }

 // Check if there's already an active (non-cancelled, non-renewed) request
 const existing = await prisma.renewalRequest.findFirst({
 where: {
 tenantId: req.tenantId,
 documentId,
 status: { notIn: ['cancelled', 'renewed'] },
 },
 })
 if (existing) {
 return res.json(existing) // return existing rather than creating duplicate
 }

 // Snapshot vehicle details for the quote
 const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId: req.tenantId } })
 if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' })

 const renewal = await prisma.renewalRequest.create({
 data: {
 tenantId: req.tenantId,
 vehicleId,
 documentId,
 documentType,
 vehicleSnapshot: {
 vehicleNumber: vehicle.vehicleNumber,
 vehicleType: vehicle.vehicleType,
 purchaseYear: vehicle.purchaseYear,
 idv: vehicle.idv,
 policyType: vehicle.policyType,
 ncbPercentage: vehicle.ncbPercentage,
 previousPolicyNumber: vehicle.previousPolicyNumber,
 previousInsurer: vehicle.previousInsurer,
 },
 },
 include: {
 vehicle: { select: { vehicleNumber: true } },
 document: { select: { documentType: true, expiryDate: true } },
 },
 })

 return res.status(201).json(renewal)
 } catch (err) {
 console.error('Create renewal error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── POST /api/renewals/:id/fetch-quotes — Trigger quote fetching ──────────────

router.post('/:id/fetch-quotes', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const renewal = await prisma.renewalRequest.findFirst({
 where: { id: req.params.id, tenantId: req.tenantId },
 include: { vehicle: true, document: true },
 })
 if (!renewal) return res.status(404).json({ error: 'Renewal request not found' })

 if (renewal.documentType === 'insurance') {
 // ── Insurance: call the quote API ─────────────────────────
 const vehicleDetails = {
 vehicleNumber: renewal.vehicle.vehicleNumber,
 vehicleType: renewal.vehicle.vehicleType,
 purchaseYear: renewal.vehicle.purchaseYear,
 idv: renewal.vehicle.idv || (renewal.vehicleSnapshot?.idv),
 policyType: renewal.vehicle.policyType || 'comprehensive',
 ncbPercentage: renewal.vehicle.ncbPercentage || 0,
 }

 // Merge any overrides from the request body (e.g., user provided IDV)
 if (req.body.idv) vehicleDetails.idv = parseInt(req.body.idv)
 if (req.body.policyType) vehicleDetails.policyType = req.body.policyType
 if (req.body.ncbPercentage) vehicleDetails.ncbPercentage = parseInt(req.body.ncbPercentage)

 const apiQuotes = await fetchInsuranceQuotes(vehicleDetails)

 // Find or create an "API" partner for insurance quotes
 let apiPartner = await prisma.renewalPartner.findFirst({
 where: { tenantId: req.tenantId, partnerType: 'insurance_api', active: true },
 })
 if (!apiPartner) {
 apiPartner = await prisma.renewalPartner.create({
 data: {
 tenantId: req.tenantId,
 name: 'Fleetsure Insurance API',
 partnerType: 'insurance_api',
 commissionPct: 5.0,
 active: true,
 },
 })
 }

 // Delete old quotes for this request (re-fetch)
 await prisma.renewalQuote.deleteMany({ where: { requestId: renewal.id, tenantId: req.tenantId } })

 // Create new quotes
 const validUntil = new Date()
 validUntil.setDate(validUntil.getDate() + 7)

 for (const q of apiQuotes) {
 await prisma.renewalQuote.create({
 data: {
 tenantId: req.tenantId,
 requestId: renewal.id,
 partnerId: apiPartner.id,
 partnerName: q.insurer,
 amount: q.premium,
 coverageDetails: {
 coverType: q.coverType,
 idv: q.idv,
 deductible: q.deductible,
 addOns: q.addOns,
 },
 premiumBreakdown: q.premiumBreakdown,
 validUntil,
 source: 'api',
 },
 })
 }

 // Update request status
 await prisma.renewalRequest.update({
 where: { id: renewal.id },
 data: { status: 'quotes_received' },
 })
 } else {
 // ── FC / PUC / Permit: notify service partners ────────────
 const partnerTypeMap = {
 FC: 'rto_agent',
 PUC: 'puc_center',
 permit: 'rto_agent',
 }
 const pType = partnerTypeMap[renewal.documentType] || 'rto_agent'

 const partners = await prisma.renewalPartner.findMany({
 where: { tenantId: req.tenantId, partnerType: pType, active: true },
 })

 if (partners.length === 0) {
 return res.json({
 message: 'No service partners available for this document type yet. We are onboarding partners.',
 quotesGenerated: 0,
 })
 }

 // Delete old quotes (re-fetch)
 await prisma.renewalQuote.deleteMany({ where: { requestId: renewal.id, tenantId: req.tenantId } })

 const estimate = getEstimatedCost(renewal.documentType)
 const validUntil = new Date()
 validUntil.setDate(validUntil.getDate() + 3)

 // Generate estimated quotes from each partner
 for (const partner of partners) {
 const variance = 0.9 + Math.random() * 0.2 // ±10%
 const amount = Math.round(((estimate.min + estimate.max) / 2) * variance)

 await prisma.renewalQuote.create({
 data: {
 tenantId: req.tenantId,
 requestId: renewal.id,
 partnerId: partner.id,
 partnerName: partner.name,
 amount,
 coverageDetails: {
 documentType: renewal.documentType,
 processDays: estimate.processDays,
 includes: renewal.documentType === 'FC'
 ? ['Vehicle inspection', 'Fitness certificate issuance', 'RTO fees']
 : renewal.documentType === 'PUC'
 ? ['Emission test', 'PUC certificate']
 : ['Permit application', 'RTO processing', 'Government fees'],
 },
 validUntil,
 source: 'manual',
 },
 })
 }

 await prisma.renewalRequest.update({
 where: { id: renewal.id },
 data: { status: 'quotes_received' },
 })
 }

 // Return updated request with quotes
 const updated = await prisma.renewalRequest.findFirst({
 where: { id: renewal.id, tenantId: req.tenantId },
 include: {
 vehicle: { select: { vehicleNumber: true } },
 document: { select: { documentType: true, expiryDate: true } },
 quotes: {
 include: { partner: { select: { name: true, partnerType: true } } },
 orderBy: { amount: 'asc' },
 },
 },
 })

 return res.json(updated)
 } catch (err) {
 console.error('Fetch quotes error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── POST /api/renewals/:id/add-quote — Add a manual quote ────────────────────

router.post('/:id/add-quote', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const renewal = await prisma.renewalRequest.findFirst({
 where: { id: req.params.id, tenantId: req.tenantId },
 })
 if (!renewal) return res.status(404).json({ error: 'Renewal request not found' })

 const { partnerName, amount, addOns, notes } = req.body
 if (!partnerName || !amount) {
 return res.status(400).json({ error: 'partnerName and amount are required' })
 }

 let partner = await prisma.renewalPartner.findFirst({
 where: { tenantId: req.tenantId, name: partnerName },
 })
 if (!partner) {
 partner = await prisma.renewalPartner.create({
 data: {
 tenantId: req.tenantId,
 name: partnerName,
 partnerType: renewal.documentType === 'insurance' ? 'insurance_broker' : 'rto_agent',
 commissionPct: 0,
 active: true,
 },
 })
 }

 const validUntil = new Date()
 validUntil.setDate(validUntil.getDate() + 14)

 const addOnsList = addOns
 ? addOns.split(',').map(s => s.trim()).filter(Boolean)
 : []

 await prisma.renewalQuote.create({
 data: {
 tenantId: req.tenantId,
 requestId: renewal.id,
 partnerId: partner.id,
 partnerName,
 amount: parseFloat(amount),
 coverageDetails: {
 addOns: addOnsList,
 notes: notes || null,
 source: 'manual_entry',
 },
 validUntil,
 source: 'manual',
 },
 })

 if (renewal.status === 'pending') {
 await prisma.renewalRequest.update({
 where: { id: renewal.id },
 data: { status: 'quotes_received' },
 })
 }

 const updated = await prisma.renewalRequest.findFirst({
 where: { id: renewal.id, tenantId: req.tenantId },
 include: {
 vehicle: { select: { vehicleNumber: true } },
 document: { select: { documentType: true, expiryDate: true } },
 quotes: {
 include: { partner: { select: { name: true, partnerType: true } } },
 orderBy: { amount: 'asc' },
 },
 },
 })

 return res.json(updated)
 } catch (err) {
 console.error('Add manual quote error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── PUT /api/renewals/:id/select/:quoteId — Select a quote ───────────────────

router.put('/:id/select/:quoteId', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const { id, quoteId } = req.params

 // Verify quote belongs to this request
 const quote = await prisma.renewalQuote.findFirst({
 where: { id: quoteId, requestId: id },
 })
 if (!quote) return res.status(404).json({ error: 'Quote not found for this request' })

 // Deselect all quotes for this request, then select the chosen one
 await prisma.renewalQuote.updateMany({
 where: { requestId: id },
 data: { selected: false },
 })
 await prisma.renewalQuote.update({
 where: { id: quoteId },
 data: { selected: true },
 })

 const renewal = await prisma.renewalRequest.update({
 where: { id },
 data: { selectedQuoteId: quoteId },
 include: {
 vehicle: { select: { vehicleNumber: true } },
 quotes: { orderBy: { amount: 'asc' } },
 },
 })

 return res.json(renewal)
 } catch (err) {
 console.error('Select quote error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── PUT /api/renewals/:id/confirm — Confirm renewal ──────────────────────────

router.put('/:id/confirm', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const renewal = await prisma.renewalRequest.findFirst({
 where: { id: req.params.id, tenantId: req.tenantId },
 include: { quotes: true, vehicle: true },
 })
 if (!renewal) return res.status(404).json({ error: 'Renewal request not found' })
 if (!renewal.selectedQuoteId) {
 return res.status(400).json({ error: 'No quote selected. Select a quote first.' })
 }

 const updated = await prisma.renewalRequest.update({
 where: { id: req.params.id },
 data: { status: 'confirmed' },
 include: {
 vehicle: { select: { vehicleNumber: true } },
 quotes: { where: { selected: true }, include: { partner: true } },
 },
 })

 return res.json({
 ...updated,
 message: `Renewal confirmed for ${updated.vehicle.vehicleNumber}. The partner will contact you shortly.`,
 })
 } catch (err) {
 console.error('Confirm renewal error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── PUT /api/renewals/:id/complete — Mark as renewed + update document + create PlatformTransaction ────────

router.put('/:id/complete', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const { newExpiryDate } = req.body
 if (!newExpiryDate) {
 return res.status(400).json({ error: 'newExpiryDate is required' })
 }

 const renewal = await prisma.renewalRequest.findFirst({
 where: { id: req.params.id, tenantId: req.tenantId },
 include: {
 vehicle: { select: { vehicleNumber: true } },
 quotes: { where: { selected: true }, include: { partner: true } },
 },
 })
 if (!renewal) return res.status(404).json({ error: 'Renewal request not found' })

 // Update the document's expiry date (document belongs to same tenant via renewal)
 const doc = await prisma.document.findFirst({ where: { id: renewal.documentId, tenantId: req.tenantId } })
 if (!doc) return res.status(404).json({ error: 'Document not found' })
 await prisma.document.update({
 where: { id: renewal.documentId },
 data: { expiryDate: new Date(newExpiryDate) },
 })

 // Mark renewal as completed
 const updated = await prisma.renewalRequest.update({
 where: { id: req.params.id },
 data: {
 status: 'renewed',
 renewedAt: new Date(),
 },
 include: {
 vehicle: { select: { vehicleNumber: true } },
 document: { select: { documentType: true, expiryDate: true } },
 },
 })

 // ── Auto-create PlatformTransaction (commission ledger entry) ────────
 const selectedQuote = renewal.quotes?.[0]
 if (selectedQuote) {
 const commissionPct = selectedQuote.partner?.commissionPct || 5.0
 const commissionAmount = Math.round(selectedQuote.amount * (commissionPct / 100) * 100) / 100

 // Only create if one doesn't already exist for this request
 const existingTxn = await prisma.platformTransaction.findFirst({
 where: { renewalRequestId: renewal.id, tenantId: req.tenantId },
 })

 if (!existingTxn) {
 await prisma.platformTransaction.create({
 data: {
 tenantId: req.tenantId,
 renewalRequestId: renewal.id,
 quoteAmount: selectedQuote.amount,
 commissionPct,
 commissionAmount,
 partnerName: selectedQuote.partnerName,
 vehicleNumber: renewal.vehicle.vehicleNumber,
 documentType: renewal.documentType,
 status: 'pending',
 },
 })
 }
 }

 // Resolve any related document expiry alerts
 await prisma.alert.updateMany({
 where: {
 tenantId: req.tenantId,
 vehicleId: renewal.vehicleId,
 alertType: 'document_expiry',
 resolved: false,
 message: { contains: renewal.documentType },
 },
 data: { resolved: true },
 })

 return res.json({
 ...updated,
 message: `Renewal completed. ${renewal.documentType} expiry updated to ${newExpiryDate}.`,
 })
 } catch (err) {
 console.error('Complete renewal error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

export default router
