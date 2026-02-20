import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'aamirsec6@gmail.com').split(',').map(e => e.trim().toLowerCase())

function requireAdmin(req, res, next) {
  if (!ADMIN_EMAILS.includes(req._adminEmail)) {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

router.use(requireAuth, async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true } })
  req._adminEmail = user?.email?.toLowerCase()
  next()
}, requireAdmin)

router.get('/stats', async (_req, res) => {
  try {
    const [
      tenantCount, userCount, vehicleCount, driverCount,
      tripCount, documentCount, alertCount, leadCount,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.vehicle.count(),
      prisma.driver.count(),
      prisma.trip.count(),
      prisma.document.count(),
      prisma.alert.count(),
      prisma.lead.count(),
    ])

    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, plan: true, city: true, createdAt: true,
        _count: {
          select: { users: true, vehicles: true, drivers: true, trips: true, documents: true },
        },
      },
    })

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [newTenantsMonth, newTenantsWeek, tripsMonth, tripsWeek] = await Promise.all([
      prisma.tenant.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.tenant.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.trip.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.trip.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    ])

    const planBreakdown = await prisma.tenant.groupBy({
      by: ['plan'],
      _count: { id: true },
    })

    const recentLeads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return res.json({
      totals: { tenantCount, userCount, vehicleCount, driverCount, tripCount, documentCount, alertCount, leadCount },
      growth: { newTenantsMonth, newTenantsWeek, tripsMonth, tripsWeek },
      planBreakdown: planBreakdown.map(p => ({ plan: p.plan, count: p._count.id })),
      tenants,
      recentLeads,
    })
  } catch (err) {
    console.error('Admin stats error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
