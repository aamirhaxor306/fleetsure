/**
 * GET /api/admin/performance — cross-tenant aggregates (platform admins only)
 */
import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireOpsAuth } from '../middleware/opsAuth.js'

const router = Router()
router.use(requireOpsAuth)

function mapCounts(rows) {
  const m = new Map()
  for (const r of rows) {
    m.set(r.tenantId, r._count._all)
  }
  return m
}

function mapSumDuration(rows) {
  const m = new Map()
  for (const r of rows) {
    m.set(r.tenantId, r._sum.totalDurationMin ?? 0)
  }
  return m
}

router.get('/', async (_req, res) => {
  try {
    const [
      tenantCount,
      onboardedUserCount,
      usersWithoutTenant,
      vehicleCount,
      tripCount,
      tripByStatus,
      tripDistanceSum,
      txnByStatus,
      tenants,
      userByTenant,
      vehicleByTenant,
      tripByTenant,
      durationByTenant,
      npsAgg,
      npsTotal,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count({ where: { tenantId: { not: null } } }),
      prisma.user.count({ where: { tenantId: null } }),
      prisma.vehicle.count(),
      prisma.trip.count(),
      prisma.trip.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.trip.aggregate({ _sum: { distance: true } }),
      prisma.platformTransaction.groupBy({
        by: ['status'],
        _count: { _all: true },
        _sum: { commissionAmount: true },
      }),
      prisma.tenant.findMany({
        select: { id: true, name: true, plan: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.groupBy({
        by: ['tenantId'],
        where: { tenantId: { not: null } },
        _count: { _all: true },
      }),
      prisma.vehicle.groupBy({
        by: ['tenantId'],
        _count: { _all: true },
      }),
      prisma.trip.groupBy({
        by: ['tenantId'],
        _count: { _all: true },
      }),
      prisma.drivingScore.groupBy({
        by: ['tenantId'],
        _sum: { totalDurationMin: true },
      }),
      prisma.npsResponse.aggregate({
        _avg: { score: true },
        _count: { _all: true },
      }),
      prisma.npsResponse.count(),
    ])

    const usersMap = mapCounts(userByTenant)
    const vehiclesMap = mapCounts(vehicleByTenant)
    const tripsMap = mapCounts(tripByTenant)
    const durationMap = mapSumDuration(durationByTenant)

    const promoters = npsTotal > 0
      ? await prisma.npsResponse.count({ where: { score: { gte: 9 } } })
      : 0
    const detractors = npsTotal > 0
      ? await prisma.npsResponse.count({ where: { score: { lte: 6 } } })
      : 0
    const nps = npsTotal > 0
      ? Math.round(((promoters - detractors) / npsTotal) * 100)
      : null

    const byTenant = tenants.map((t) => ({
      tenantId: t.id,
      name: t.name,
      plan: t.plan,
      createdAt: t.createdAt,
      users: usersMap.get(t.id) ?? 0,
      vehicles: vehiclesMap.get(t.id) ?? 0,
      trips: tripsMap.get(t.id) ?? 0,
      trackedTripMinutes: Math.round((durationMap.get(t.id) ?? 0) * 10) / 10,
    }))

    return res.json({
      generatedAt: new Date().toISOString(),
      overview: {
        tenants: tenantCount,
        usersOnboarded: onboardedUserCount,
        usersPendingOnboarding: usersWithoutTenant,
        vehicles: vehicleCount,
        trips: tripCount,
        totalTripDistanceKm: tripDistanceSum._sum.distance ?? 0,
        tripsByStatus: Object.fromEntries(tripByStatus.map((x) => [x.status, x._count._all])),
        platformTransactionsByStatus: Object.fromEntries(
          txnByStatus.map((x) => [
            x.status,
            { count: x._count._all, commissionInr: x._sum.commissionAmount ?? 0 },
          ]),
        ),
      },
      nps: {
        responses: npsTotal,
        averageScore: npsAgg._avg.score != null ? Math.round(npsAgg._avg.score * 10) / 10 : null,
        npsScore: nps,
      },
      tenants: byTenant,
    })
  } catch (err) {
    console.error('admin performance error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
