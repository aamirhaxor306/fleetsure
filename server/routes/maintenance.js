import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res) => {
 try {
 const where = { tenantId: req.tenantId }
 if (req.query.vehicleId) where.vehicleId = req.query.vehicleId
 if (req.query.type) where.maintenanceType = req.query.type

 const logs = await prisma.maintenanceLog.findMany({
 where,
 orderBy: { maintenanceDate: 'desc' },
 take: 200,
 include: {
 vehicle: { select: { id: true, vehicleNumber: true, vehicleType: true } },
 },
 })
 return res.json(logs)
 } catch (err) {
 console.error('List maintenance error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

router.get('/stats', async (req, res) => {
 try {
 const logs = await prisma.maintenanceLog.findMany({
 where: { tenantId: req.tenantId },
 select: { amount: true, maintenanceType: true, workshopName: true },
 })

 const totalSpend = logs.reduce((s, l) => s + l.amount, 0)

 const byType = {}
 for (const l of logs) {
 if (!byType[l.maintenanceType]) byType[l.maintenanceType] = { type: l.maintenanceType, count: 0, cost: 0 }
 byType[l.maintenanceType].count += 1
 byType[l.maintenanceType].cost += l.amount
 }

 const workshopMap = {}
 for (const l of logs) {
 const w = l.workshopName || 'Unknown'
 if (!workshopMap[w]) workshopMap[w] = { name: w, visits: 0, cost: 0 }
 workshopMap[w].visits += 1
 workshopMap[w].cost += l.amount
 }

 return res.json({
 totalSpend,
 totalServices: logs.length,
 byType: Object.values(byType).sort((a, b) => b.cost - a.cost),
 workshops: Object.values(workshopMap).sort((a, b) => b.visits - a.visits),
 })
 } catch (err) {
 console.error('Maintenance stats error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

router.post('/', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const { vehicleId, maintenanceType, description, amount, workshopName, maintenanceDate } = req.body

 if (!vehicleId || !maintenanceType || !amount || !maintenanceDate) {
 return res.status(400).json({ error: 'vehicleId, maintenanceType, amount, maintenanceDate are required' })
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
 include: {
 vehicle: { select: { id: true, vehicleNumber: true, vehicleType: true } },
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

router.delete('/:id', requireRole('owner', 'manager'), async (req, res) => {
 try {
 await prisma.maintenanceLog.deleteMany({
 where: { id: req.params.id, tenantId: req.tenantId },
 })
 return res.json({ ok: true })
 } catch (err) {
 console.error('Delete maintenance error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

export default router
