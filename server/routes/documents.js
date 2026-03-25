import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// POST /api/documents — Add document
router.post('/', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const { vehicleId, documentType, expiryDate, reminderDays } = req.body

 if (!vehicleId || !documentType || !expiryDate) {
 return res.status(400).json({ error: 'vehicleId, documentType, expiryDate are required' })
 }

 const validTypes = ['insurance', 'FC', 'permit', 'PUC']
 if (!validTypes.includes(documentType)) {
 return res.status(400).json({ error: `documentType must be one of: ${validTypes.join(', ')}` })
 }

 const doc = await prisma.document.create({
 data: {
 tenantId: req.tenantId,
 vehicleId,
 documentType,
 expiryDate: new Date(expiryDate),
 reminderDays: parseInt(reminderDays) || 30,
 },
 })
 return res.status(201).json(doc)
 } catch (err) {
 if (err.code === 'P2003') {
 return res.status(400).json({ error: 'Vehicle not found' })
 }
 console.error('Create document error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// PUT /api/documents/:id — Edit document (typically to update expiry)
router.put('/:id', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const existing = await prisma.document.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } })
 if (!existing) return res.status(404).json({ error: 'Document not found' })

 const { documentType, expiryDate, reminderDays } = req.body
 const data = {}
 if (documentType) data.documentType = documentType
 if (expiryDate) data.expiryDate = new Date(expiryDate)
 if (reminderDays !== undefined) data.reminderDays = parseInt(reminderDays)

 const doc = await prisma.document.update({
 where: { id: req.params.id },
 data,
 })
 return res.json(doc)
 } catch (err) {
 if (err.code === 'P2025') return res.status(404).json({ error: 'Document not found' })
 console.error('Update document error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// GET /api/documents — List documents (optional ?vehicleId=)
router.get('/', async (req, res) => {
 try {
 const where = { tenantId: req.tenantId }
 if (req.query.vehicleId) where.vehicleId = req.query.vehicleId

 const docs = await prisma.document.findMany({
 where,
 orderBy: { expiryDate: 'asc' },
 include: {
 vehicle: { select: { vehicleNumber: true } },
 },
 })
 return res.json(docs)
 } catch (err) {
 console.error('List documents error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

export default router
