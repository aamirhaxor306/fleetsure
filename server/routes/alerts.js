import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { runAlertEngine } from '../services/alertEngine.js'

const router = Router()
router.use(requireAuth)

// GET /api/alerts — Unresolved alerts grouped by severity
router.get('/', async (req, res) => {
 try {
 const showResolved = req.query.resolved === 'true'
 const where = { tenantId: req.tenantId, ...(showResolved ? {} : { resolved: false }) }

 const alerts = await prisma.alert.findMany({
 where,
 orderBy: [
 { severity: 'desc' }, // high first (alphabetical: high > medium > low)
 { createdAt: 'desc' },
 ],
 include: {
 vehicle: { select: { vehicleNumber: true } },
 },
 })

 // Group by severity
 const grouped = { high: [], medium: [], low: [] }
 for (const a of alerts) {
 grouped[a.severity].push(a)
 }

 return res.json({ alerts, grouped, total: alerts.length })
 } catch (err) {
 console.error('List alerts error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// PUT /api/alerts/:id/resolve — Mark alert as resolved
router.put('/:id/resolve', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const existing = await prisma.alert.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } })
 if (!existing) return res.status(404).json({ error: 'Alert not found' })

 const alert = await prisma.alert.update({
 where: { id: req.params.id },
 data: { resolved: true },
 })
 return res.json(alert)
 } catch (err) {
 if (err.code === 'P2025') return res.status(404).json({ error: 'Alert not found' })
 console.error('Resolve alert error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// POST /api/alerts/run — Manually trigger the alert engine
router.post('/run', requireRole('owner'), async (req, res) => {
 try {
 const result = await runAlertEngine()
 return res.json(result)
 } catch (err) {
 console.error('Alert engine error:', err)
 return res.status(500).json({ error: 'Alert engine failed' })
 }
})

export default router
