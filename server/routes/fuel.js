import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { parseFuelSms } from '../lib/fuelSmsParser.js'

const router = Router()
router.use(requireAuth)

router.post('/parse-sms', async (req, res) => {
 try {
 const { smsText } = req.body
 if (!smsText) return res.status(400).json({ error: 'smsText is required' })

 const parsed = parseFuelSms(smsText)
 if (!parsed) return res.json({ parsed: false, message: 'Could not parse this SMS format' })

 if (parsed.vehicleNumber) {
 const vehicle = await prisma.vehicle.findFirst({
 where: {
 tenantId: req.tenantId,
 vehicleNumber: { contains: parsed.vehicleNumber, mode: 'insensitive' },
 },
 select: { id: true, vehicleNumber: true },
 })
 if (vehicle) parsed.vehicleId = vehicle.id
 }

 return res.json({ parsed: true, data: parsed })
 } catch (err) {
 console.error('Parse SMS error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

router.get('/', async (req, res) => {
 try {
 const where = { tenantId: req.tenantId }
 if (req.query.vehicleId) where.vehicleId = req.query.vehicleId

 const logs = await prisma.fuelLog.findMany({
 where,
 orderBy: { fuelDate: 'desc' },
 take: 200,
 include: {
 vehicle: { select: { id: true, vehicleNumber: true, vehicleType: true } },
 },
 })
 return res.json(logs)
 } catch (err) {
 console.error('List fuel logs error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

router.get('/stats', async (req, res) => {
 try {
 const logs = await prisma.fuelLog.findMany({
 where: { tenantId: req.tenantId },
 select: { litres: true, totalCost: true, vendorName: true, vehicleId: true, fuelDate: true },
 })

 const totalLitres = logs.reduce((s, l) => s + l.litres, 0)
 const totalCost = logs.reduce((s, l) => s + l.totalCost, 0)
 const avgRate = totalLitres > 0 ? totalCost / totalLitres : 0

 const vendorMap = {}
 for (const l of logs) {
 const v = l.vendorName || 'Unknown'
 if (!vendorMap[v]) vendorMap[v] = { name: v, litres: 0, cost: 0, fills: 0 }
 vendorMap[v].litres += l.litres
 vendorMap[v].cost += l.totalCost
 vendorMap[v].fills += 1
 }
 const vendors = Object.values(vendorMap).sort((a, b) => b.fills - a.fills)

 return res.json({ totalLitres, totalCost, avgRate, totalFills: logs.length, vendors })
 } catch (err) {
 console.error('Fuel stats error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

router.post('/', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const { vehicleId, litres, ratePerLitre, odometerKm, vendorName, vendorLocation, fuelType, paymentMode, billNumber, notes, fuelDate } = req.body

 if (!vehicleId || !litres || !ratePerLitre || !fuelDate) {
 return res.status(400).json({ error: 'vehicleId, litres, ratePerLitre, fuelDate are required' })
 }

 const l = parseFloat(litres)
 const r = parseFloat(ratePerLitre)

 const log = await prisma.fuelLog.create({
 data: {
 tenantId: req.tenantId,
 vehicleId,
 litres: l,
 ratePerLitre: r,
 totalCost: Math.round(l * r * 100) / 100,
 odometerKm: odometerKm ? parseInt(odometerKm) : null,
 vendorName: vendorName || null,
 vendorLocation: vendorLocation || null,
 fuelType: fuelType || 'diesel',
 paymentMode: paymentMode || null,
 billNumber: billNumber || null,
 notes: notes || null,
 fuelDate: new Date(fuelDate),
 },
 include: {
 vehicle: { select: { id: true, vehicleNumber: true, vehicleType: true } },
 },
 })
 return res.status(201).json(log)
 } catch (err) {
 console.error('Create fuel log error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

router.delete('/:id', requireRole('owner', 'manager'), async (req, res) => {
 try {
 await prisma.fuelLog.deleteMany({
 where: { id: req.params.id, tenantId: req.tenantId },
 })
 return res.json({ ok: true })
 } catch (err) {
 console.error('Delete fuel log error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

export default router
