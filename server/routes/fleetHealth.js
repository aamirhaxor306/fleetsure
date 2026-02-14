import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)

// ── GET /api/fleet-health — Fleet Health Score (0-100) with breakdown ────────

router.get('/', async (req, res) => {
  try {
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // 1. Documents score: % valid (not expired)
    const allDocs = await prisma.document.findMany({ where: { tenantId: req.tenantId }, select: { expiryDate: true } })
    const validDocs = allDocs.filter(d => new Date(d.expiryDate) > now)
    const expiringSoon = allDocs.filter(d => {
      const exp = new Date(d.expiryDate)
      return exp > now && exp <= thirtyDaysFromNow
    })
    const expiredDocs = allDocs.filter(d => new Date(d.expiryDate) <= now)
    const docScore = allDocs.length > 0 ? Math.round((validDocs.length / allDocs.length) * 100) : 100

    // 2. Alerts score: % resolved
    const allAlerts = await prisma.alert.findMany({ where: { tenantId: req.tenantId }, select: { resolved: true, severity: true } })
    const resolvedAlerts = allAlerts.filter(a => a.resolved)
    const unresolvedHigh = allAlerts.filter(a => !a.resolved && a.severity === 'high').length
    const unresolvedMedium = allAlerts.filter(a => !a.resolved && a.severity === 'medium').length
    const unresolvedLow = allAlerts.filter(a => !a.resolved && a.severity === 'low').length
    const alertScore = allAlerts.length > 0 ? Math.round((resolvedAlerts.length / allAlerts.length) * 100) : 100

    // 3. Maintenance score: % of vehicles serviced in last 30 days
    const allVehicles = await prisma.vehicle.findMany({ select: { id: true, status: true } })
    const recentMaintenance = await prisma.maintenanceLog.findMany({
      where: { maintenanceDate: { gte: thirtyDaysAgo } },
      select: { vehicleId: true },
      distinct: ['vehicleId'],
    })
    const maintainedVehicleIds = new Set(recentMaintenance.map(m => m.vehicleId))
    const maintScore = allVehicles.length > 0 ? Math.round((maintainedVehicleIds.size / allVehicles.length) * 100) : 100

    // 4. Tyres score: % in good condition
    const allTyres = await prisma.tyre.findMany({ select: { condition: true } })
    const goodTyres = allTyres.filter(t => t.condition === 'good')
    const tyreScore = allTyres.length > 0 ? Math.round((goodTyres.length / allTyres.length) * 100) : 100

    // Overall: weighted average
    const overall = Math.round(docScore * 0.35 + alertScore * 0.25 + maintScore * 0.2 + tyreScore * 0.2)

    return res.json({
      overall,
      documents: { score: docScore, total: allDocs.length, valid: validDocs.length, expiringSoon: expiringSoon.length, expired: expiredDocs.length },
      alerts: { score: alertScore, total: allAlerts.length, resolved: resolvedAlerts.length, unresolvedHigh, unresolvedMedium, unresolvedLow },
      maintenance: { score: maintScore, totalVehicles: allVehicles.length, recentlyServiced: maintainedVehicleIds.size },
      tyres: { score: tyreScore, total: allTyres.length, good: goodTyres.length },
    })
  } catch (err) {
    console.error('Fleet health error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
