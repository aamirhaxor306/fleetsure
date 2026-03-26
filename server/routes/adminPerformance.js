/**
 * GET /api/admin/performance — cross-tenant aggregates (platform admins only)
 */
import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireOpsAdmin, requireOpsAuth } from '../middleware/opsAuth.js'

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

router.get('/tenants/:tenantId/summary', async (req, res) => {
  const { tenantId } = req.params
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, plan: true, createdAt: true },
    })
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })

    const [
      users,
      vehicles,
      trips,
      drivers,
      documents,
      renewals,
      alerts,
      fuelLogs,
      fastags,
      tyres,
      maintenanceLogs,
      savedRoutes,
      nps,
      opsJobs,
      opsInvoices,
      opsLedger,
      fleetMessages,
    ] = await Promise.all([
      prisma.user.count({ where: { tenantId } }),
      prisma.vehicle.count({ where: { tenantId } }),
      prisma.trip.count({ where: { tenantId } }),
      prisma.driver.count({ where: { tenantId } }),
      prisma.document.count({ where: { tenantId } }),
      prisma.renewalRequest.count({ where: { tenantId } }),
      prisma.alert.count({ where: { tenantId } }),
      prisma.fuelLog.count({ where: { tenantId } }),
      prisma.fasTag.count({ where: { tenantId } }),
      prisma.tyre.count({ where: { tenantId } }),
      prisma.maintenanceLog.count({ where: { tenantId } }),
      prisma.savedRoute.count({ where: { tenantId } }),
      prisma.npsResponse.count({ where: { tenantId } }),
      prisma.serviceJob.count({ where: { tenantId } }),
      prisma.invoice.count({ where: { tenantId } }),
      prisma.fleetLedger.count({ where: { tenantId } }),
      prisma.fleetMessage.count({ where: { tenantId } }),
    ])

    return res.json({
      tenant,
      counts: {
        users,
        vehicles,
        trips,
        drivers,
        documents,
        renewalRequests: renewals,
        alerts,
        fuelLogs,
        fastags,
        tyres,
        maintenanceLogs,
        savedRoutes,
        npsResponses: nps,
        opsJobs,
        opsInvoices,
        opsLedgerEntries: opsLedger,
        fleetMessages,
      },
    })
  } catch (err) {
    console.error('tenant summary error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/tenants/:tenantId', requireOpsAdmin, async (req, res) => {
  const { tenantId } = req.params
  const { confirm } = req.body || {}
  if (confirm !== 'DELETE') {
    return res.status(400).json({ error: 'Confirmation required' })
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    })
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })

    const result = await prisma.$transaction(async (tx) => {
      const out = {}

      // Trip-related
      out.tripExpenses = (await tx.tripExpense.deleteMany({ where: { tenantId } })).count
      out.drivingScores = (await tx.drivingScore.deleteMany({ where: { tenantId } })).count
      out.drivingEvents = (await tx.drivingEvent.deleteMany({ where: { tenantId } })).count
      out.locationLogs = (await tx.locationLog.deleteMany({ where: { tenantId } })).count
      out.trips = (await tx.trip.deleteMany({ where: { tenantId } })).count
      out.monthlyBills = (await tx.monthlyBill.deleteMany({ where: { tenantId } })).count

      // Vehicle-linked logs
      out.fuelLogs = (await tx.fuelLog.deleteMany({ where: { tenantId } })).count
      out.fastagTransactions = (await tx.fasTagTransaction.deleteMany({ where: { tenantId } })).count
      out.fastags = (await tx.fasTag.deleteMany({ where: { tenantId } })).count
      out.tyres = (await tx.tyre.deleteMany({ where: { tenantId } })).count
      out.maintenanceLogs = (await tx.maintenanceLog.deleteMany({ where: { tenantId } })).count
      out.alerts = (await tx.alert.deleteMany({ where: { tenantId } })).count

      // Renewals
      out.renewalQuotes = (await tx.renewalQuote.deleteMany({ where: { tenantId } })).count
      out.platformTransactions = (await tx.platformTransaction.deleteMany({ where: { tenantId } })).count
      out.renewalRequests = (await tx.renewalRequest.deleteMany({ where: { tenantId } })).count
      out.documents = (await tx.document.deleteMany({ where: { tenantId } })).count
      out.renewalPartners = (await tx.renewalPartner.deleteMany({ where: { tenantId } })).count

      // Misc tenant-scoped
      out.savedRoutes = (await tx.savedRoute.deleteMany({ where: { tenantId } })).count
      out.drivers = (await tx.driver.deleteMany({ where: { tenantId } })).count
      out.npsResponses = (await tx.npsResponse.deleteMany({ where: { tenantId } })).count

      // Ops tenant-scoped
      out.opsLedgerEntries = (await tx.fleetLedger.deleteMany({ where: { tenantId } })).count
      out.opsInvoices = (await tx.invoice.deleteMany({ where: { tenantId } })).count
      out.opsJobParts = (await tx.jobParts.deleteMany({ where: { job: { tenantId } } })).count
      out.opsJobLabor = (await tx.jobLabor.deleteMany({ where: { job: { tenantId } } })).count
      out.opsJobs = (await tx.serviceJob.deleteMany({ where: { tenantId } })).count
      out.fleetMessages = (await tx.fleetMessage.deleteMany({ where: { tenantId } })).count

      // Core entities
      out.vehicles = (await tx.vehicle.deleteMany({ where: { tenantId } })).count
      out.users = (await tx.user.deleteMany({ where: { tenantId } })).count
      out.tenants = (await tx.tenant.deleteMany({ where: { id: tenantId } })).count

      return out
    })

    return res.json({
      ok: true,
      deletedTenantId: tenantId,
      deleted: result,
    })
  } catch (err) {
    console.error('tenant delete error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
