/**
 * Fleetsure — CRM Agent Tool Definitions
 * ────────────────────────────────────────
 * 37 tools the AI agent can call: 22 read + 15 write.
 * Each tool: { name, description, parameters (JSON Schema), execute, requiresConfirmation? }
 */

import prisma from '../lib/prisma.js'
import { searchKnowledge, getCategories, getChunksByCategory } from './ragRetriever.js'

// ── Helper ──────────────────────────────────────────────────────────────────
const inr = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—'

// ═══════════════════════════════════════════════════════════════════════════════
//  READ TOOLS (22) — auto-executed, no confirmation needed
// ═══════════════════════════════════════════════════════════════════════════════

const readTools = [
  // 1. listVehicles
  {
    name: 'listVehicles',
    description: 'List all fleet vehicles with status, type, km, and trip count.',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(_params, tenantId) {
      const vehicles = await prisma.vehicle.findMany({
        where: { tenantId },
        include: { _count: { select: { trips: true } }, drivers: { where: { active: true }, select: { name: true } } },
        orderBy: { vehicleNumber: 'asc' },
      })
      return vehicles.map(v => ({
        id: v.id, vehicleNumber: v.vehicleNumber, type: v.vehicleType, status: v.status,
        km: v.approxKm, axle: v.axleConfig, trips: v._count.trips,
        driver: v.drivers[0]?.name || null,
      }))
    },
  },

  // 2. getVehicle
  {
    name: 'getVehicle',
    description: 'Get full detail for a single vehicle including maintenance, docs, alerts, tyres.',
    parameters: {
      type: 'object',
      properties: { vehicleId: { type: 'string', description: 'UUID of the vehicle' } },
      required: ['vehicleId'],
    },
    async execute({ vehicleId }, tenantId) {
      const v = await prisma.vehicle.findFirst({
        where: { id: vehicleId, tenantId },
        include: {
          maintenanceLogs: { orderBy: { maintenanceDate: 'desc' }, take: 5 },
          documents: true,
          alerts: { where: { resolved: false } },
          tyres: true,
          drivers: { where: { active: true }, select: { name: true, phone: true } },
          _count: { select: { trips: true } },
        },
      })
      if (!v) return { error: 'Vehicle not found' }
      return v
    },
  },

  // 3. listTrips
  {
    name: 'listTrips',
    description: 'List trips with optional status filter. Returns recent 50.',
    parameters: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['logged', 'reconciled'], description: 'Optional filter' } },
      required: [],
    },
    async execute({ status } = {}, tenantId) {
      const where = { ...(status ? { status } : {}), tenantId }
      const trips = await prisma.trip.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          vehicle: { select: { vehicleNumber: true } },
          driver: { select: { name: true } },
        },
      })
      return trips.map(t => ({
        id: t.id, vehicle: t.vehicle.vehicleNumber, driver: t.driver?.name,
        route: `${t.loadingLocation} → ${t.destination}`, distance: t.distance,
        freight: t.freightAmount, fuel: t.fuelExpense, toll: t.toll, cash: t.cashExpense,
        status: t.status, date: t.tripDate || t.createdAt,
      }))
    },
  },

  // 4. getTripDetail
  {
    name: 'getTripDetail',
    description: 'Get full detail for a single trip: location logs, expenses, driving score.',
    parameters: {
      type: 'object',
      properties: { tripId: { type: 'string', description: 'UUID of the trip' } },
      required: ['tripId'],
    },
    async execute({ tripId }, tenantId) {
      const t = await prisma.trip.findFirst({
        where: { id: tripId, tenantId },
        include: {
          vehicle: { select: { vehicleNumber: true } },
          driver: { select: { name: true, phone: true } },
          expenses: true,
          drivingScore: true,
          drivingEvents: { orderBy: { timestamp: 'desc' }, take: 20 },
          locationLogs: { orderBy: { timestamp: 'desc' }, take: 10, select: { latitude: true, longitude: true, speed: true, timestamp: true } },
        },
      })
      if (!t) return { error: 'Trip not found' }
      return t
    },
  },

  // 5. getTripAnalytics
  {
    name: 'getTripAnalytics',
    description: 'Get fleet P&L, vehicle profitability, route profitability, and insights.',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(_params, tenantId) {
      const trips = await prisma.trip.findMany({ where: { tenantId }, include: { vehicle: { select: { vehicleNumber: true } }, expenses: true } })
      let revenue = 0, expenses = 0
      const vehicleMap = {}, routeMap = {}

      for (const t of trips) {
        const freight = t.freightAmount || 0
        const cost = t.expenses.length > 0
          ? t.expenses.reduce((s, e) => s + e.amount, 0)
          : (t.fuelExpense || 0) + (t.toll || 0) + (t.cashExpense || 0)
        revenue += freight
        expenses += cost

        const vn = t.vehicle.vehicleNumber
        if (!vehicleMap[vn]) vehicleMap[vn] = { revenue: 0, expenses: 0, trips: 0 }
        vehicleMap[vn].revenue += freight
        vehicleMap[vn].expenses += cost
        vehicleMap[vn].trips++

        const route = `${t.loadingLocation} → ${t.destination}`
        if (!routeMap[route]) routeMap[route] = { revenue: 0, expenses: 0, trips: 0 }
        routeMap[route].revenue += freight
        routeMap[route].expenses += cost
        routeMap[route].trips++
      }

      const profit = revenue - expenses
      const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0

      return {
        fleetPnL: { revenue, expenses, profit, margin, tripCount: trips.length },
        vehicleProfit: Object.entries(vehicleMap).map(([vn, d]) => ({ vehicle: vn, ...d, profit: d.revenue - d.expenses })).sort((a, b) => b.profit - a.profit).slice(0, 10),
        routeProfit: Object.entries(routeMap).map(([r, d]) => ({ route: r, ...d, profit: d.revenue - d.expenses })).sort((a, b) => b.profit - a.profit).slice(0, 10),
      }
    },
  },

  // 6. listDrivers
  {
    name: 'listDrivers',
    description: 'List all active drivers with vehicle assignment and trip counts.',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(_params, tenantId) {
      const drivers = await prisma.driver.findMany({
        where: { active: true, tenantId },
        include: { vehicle: { select: { vehicleNumber: true } }, _count: { select: { trips: true } } },
        orderBy: { name: 'asc' },
      })
      return drivers.map(d => ({
        id: d.id, name: d.name, phone: d.phone, vehicle: d.vehicle?.vehicleNumber,
        trips: d._count.trips, verified: !!(d.licensePhotoUrl && d.aadhaarPhotoUrl),
      }))
    },
  },

  // 7. getDriver
  {
    name: 'getDriver',
    description: 'Get detailed info for a single driver including recent trips.',
    parameters: {
      type: 'object',
      properties: { driverId: { type: 'string', description: 'UUID of the driver' } },
      required: ['driverId'],
    },
    async execute({ driverId }, tenantId) {
      const d = await prisma.driver.findFirst({
        where: { id: driverId, tenantId },
        include: {
          vehicle: { select: { vehicleNumber: true } },
          trips: { orderBy: { createdAt: 'desc' }, take: 10, include: { vehicle: { select: { vehicleNumber: true } } } },
          _count: { select: { trips: true, drivingEvents: true } },
        },
      })
      if (!d) return { error: 'Driver not found' }
      return d
    },
  },

  // 8. listAlerts
  {
    name: 'listAlerts',
    description: 'List unresolved fleet alerts sorted by severity.',
    parameters: {
      type: 'object',
      properties: { includeResolved: { type: 'boolean', description: 'If true, include resolved alerts' } },
      required: [],
    },
    async execute({ includeResolved } = {}, tenantId) {
      const where = { ...(includeResolved ? {} : { resolved: false }), tenantId }
      const alerts = await prisma.alert.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        take: 50,
        include: { vehicle: { select: { vehicleNumber: true } } },
      })
      return alerts.map(a => ({
        id: a.id, vehicle: a.vehicle?.vehicleNumber, type: a.alertType,
        severity: a.severity, message: a.message, resolved: a.resolved, date: a.createdAt,
      }))
    },
  },

  // 9. listDocuments
  {
    name: 'listDocuments',
    description: 'List all vehicle documents (insurance, FC, PUC, permit) with expiry status.',
    parameters: {
      type: 'object',
      properties: { vehicleId: { type: 'string', description: 'Optional: filter by vehicle UUID' } },
      required: [],
    },
    async execute({ vehicleId } = {}, tenantId) {
      const where = { ...(vehicleId ? { vehicleId } : {}), tenantId }
      const docs = await prisma.document.findMany({
        where,
        orderBy: { expiryDate: 'asc' },
        include: { vehicle: { select: { vehicleNumber: true } } },
      })
      const now = new Date()
      return docs.map(d => {
        const daysLeft = Math.ceil((new Date(d.expiryDate) - now) / 86400000)
        return {
          id: d.id, vehicle: d.vehicle.vehicleNumber, type: d.documentType,
          expiryDate: d.expiryDate, daysLeft, status: daysLeft < 0 ? 'expired' : daysLeft < 30 ? 'expiring_soon' : 'valid',
        }
      })
    },
  },

  // 10. listMaintenance
  {
    name: 'listMaintenance',
    description: 'List maintenance logs, optionally for a specific vehicle.',
    parameters: {
      type: 'object',
      properties: { vehicleId: { type: 'string', description: 'Optional: filter by vehicle UUID' } },
      required: [],
    },
    async execute({ vehicleId } = {}, tenantId) {
      const where = { ...(vehicleId ? { vehicleId } : {}), tenantId }
      const logs = await prisma.maintenanceLog.findMany({
        where,
        orderBy: { maintenanceDate: 'desc' },
        take: 50,
        include: { vehicle: { select: { vehicleNumber: true } } },
      })
      return logs.map(l => ({
        id: l.id, vehicle: l.vehicle.vehicleNumber, type: l.maintenanceType,
        description: l.description, amount: l.amount, workshop: l.workshopName, date: l.maintenanceDate,
      }))
    },
  },

  // 11. listSavedRoutes
  {
    name: 'listSavedRoutes',
    description: 'List all saved route templates with distances, rates, and default expenses.',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(_params, tenantId) {
      return prisma.savedRoute.findMany({ where: { tenantId }, orderBy: { shortName: 'asc' } })
    },
  },

  // 12. listRenewals
  {
    name: 'listRenewals',
    description: 'List renewal requests with status and vehicle info.',
    parameters: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['pending', 'quotes_received', 'confirmed', 'renewed', 'cancelled'] } },
      required: [],
    },
    async execute({ status } = {}, tenantId) {
      const where = { ...(status ? { status } : {}), tenantId }
      const renewals = await prisma.renewalRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          vehicle: { select: { vehicleNumber: true } },
          quotes: { select: { partnerName: true, amount: true, selected: true } },
        },
      })
      return renewals.map(r => ({
        id: r.id, vehicle: r.vehicle.vehicleNumber, docType: r.documentType,
        status: r.status, quotesCount: r.quotes.length,
        selectedQuote: r.quotes.find(q => q.selected),
        requestedAt: r.requestedAt,
      }))
    },
  },

  // 13. getRenewal
  {
    name: 'getRenewal',
    description: 'Get full detail for a single renewal request with all quotes.',
    parameters: {
      type: 'object',
      properties: { renewalId: { type: 'string', description: 'UUID of the renewal request' } },
      required: ['renewalId'],
    },
    async execute({ renewalId }, tenantId) {
      const r = await prisma.renewalRequest.findFirst({
        where: { id: renewalId, tenantId },
        include: { vehicle: true, document: true, quotes: { include: { partner: true } }, platformTransaction: true },
      })
      if (!r) return { error: 'Renewal not found' }
      return r
    },
  },

  // 14. getExpiringDocuments
  {
    name: 'getExpiringDocuments',
    description: 'Get documents expiring within the next 45 days.',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(_params, tenantId) {
      const now = new Date()
      const futureDate = new Date(now.getTime() + 45 * 86400000)
      const docs = await prisma.document.findMany({
        where: { tenantId, expiryDate: { lte: futureDate } },
        orderBy: { expiryDate: 'asc' },
        include: { vehicle: { select: { vehicleNumber: true } } },
      })
      return docs.map(d => {
        const daysLeft = Math.ceil((new Date(d.expiryDate) - now) / 86400000)
        return {
          id: d.id, vehicle: d.vehicle.vehicleNumber, type: d.documentType,
          expiryDate: d.expiryDate, daysLeft, status: daysLeft < 0 ? 'expired' : 'expiring_soon',
        }
      })
    },
  },

  // 15. getRevenueSummary
  {
    name: 'getRevenueSummary',
    description: 'Get platform revenue from completed renewals (commission earned).',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(_params, tenantId) {
      const transactions = await prisma.platformTransaction.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      })
      const total = transactions.reduce((s, t) => s + t.commissionAmount, 0)
      return { totalCommission: total, transactionCount: transactions.length, transactions: transactions.slice(0, 20) }
    },
  },

  // 16. listMonthlyBills
  {
    name: 'listMonthlyBills',
    description: 'List monthly bills for freight reconciliation.',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(_params, tenantId) {
      return prisma.monthlyBill.findMany({
        where: { tenantId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        include: { _count: { select: { trips: true } } },
      })
    },
  },

  // 17. getMonthlyBill
  {
    name: 'getMonthlyBill',
    description: 'Get detail for a single monthly bill with linked trips.',
    parameters: {
      type: 'object',
      properties: { billId: { type: 'string', description: 'UUID of the monthly bill' } },
      required: ['billId'],
    },
    async execute({ billId }, tenantId) {
      const bill = await prisma.monthlyBill.findFirst({
        where: { id: billId, tenantId },
        include: { trips: { include: { vehicle: { select: { vehicleNumber: true } } } } },
      })
      if (!bill) return { error: 'Bill not found' }
      return bill
    },
  },

  // 18. listTyres
  {
    name: 'listTyres',
    description: 'List tyres for a vehicle with condition and life remaining.',
    parameters: {
      type: 'object',
      properties: { vehicleId: { type: 'string', description: 'UUID of the vehicle' } },
      required: ['vehicleId'],
    },
    async execute({ vehicleId }, tenantId) {
      const tyres = await prisma.tyre.findMany({
        where: { vehicleId, tenantId },
        orderBy: { position: 'asc' },
      })
      return tyres.map(t => ({
        id: t.id, position: t.position, brand: t.brand, model: t.model,
        condition: t.condition, installedKm: t.installedKm,
        expectedLife: t.expectedLifeKm, serialNumber: t.serialNumber,
      }))
    },
  },

  // 19. getFleetHealth
  {
    name: 'getFleetHealth',
    description: 'Get overall fleet health score with document, maintenance, alert, and tyre sub-scores.',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(_params, tenantId) {
      // Reuse fleet health logic
      const [vehicles, docs, alerts, tyres, maintenanceLogs] = await Promise.all([
        prisma.vehicle.count({ where: { tenantId } }),
        prisma.document.findMany({ where: { tenantId } }),
        prisma.alert.findMany({ where: { tenantId, resolved: false } }),
        prisma.tyre.findMany({ where: { tenantId } }),
        prisma.maintenanceLog.findMany({ where: { tenantId }, orderBy: { maintenanceDate: 'desc' } }),
      ])

      const now = new Date()
      const expired = docs.filter(d => new Date(d.expiryDate) <= now).length
      const expiringSoon = docs.filter(d => { const e = new Date(d.expiryDate); return e > now && e <= new Date(now.getTime() + 30 * 86400000) }).length
      const valid = docs.filter(d => new Date(d.expiryDate) > new Date(now.getTime() + 30 * 86400000)).length

      return {
        totalVehicles: vehicles,
        documents: { total: docs.length, expired, expiringSoon, valid },
        alerts: { unresolved: alerts.length, high: alerts.filter(a => a.severity === 'high').length },
        tyres: { total: tyres.length, needReplacement: tyres.filter(t => t.condition === 'replace' || t.condition === 'burst').length },
        maintenance: { totalLogs: maintenanceLogs.length },
      }
    },
  },

  // 20. getInsuranceOptimizer
  {
    name: 'getInsuranceOptimizer',
    description: 'Get insurance optimizer data: fleet spend, savings, coverage gaps, NCB.',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(_params, tenantId) {
      const vehicles = await prisma.vehicle.findMany({
        where: { tenantId },
        include: { documents: { where: { documentType: 'insurance' } }, renewalRequests: { include: { quotes: true, platformTransaction: true } } },
      })
      let totalSpend = 0, totalSavings = 0, coverageGaps = 0

      for (const v of vehicles) {
        const insuranceDoc = v.documents[0]
        if (!insuranceDoc || new Date(insuranceDoc.expiryDate) <= new Date()) coverageGaps++
        if (v.idv) totalSpend += v.idv * 0.03 // rough premium estimate

        for (const r of v.renewalRequests) {
          if (r.platformTransaction) totalSavings += r.platformTransaction.commissionAmount
        }
      }

      return { totalVehicles: vehicles.length, totalSpend: Math.round(totalSpend), totalSavings: Math.round(totalSavings), coverageGaps }
    },
  },

  // 21. getTelegramStatus
  {
    name: 'getTelegramStatus',
    description: 'Get Telegram bot status: connected drivers, owner chat ID.',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(_params, tenantId) {
      const connectedDrivers = await prisma.driver.count({ where: { tenantId, telegramChatId: { not: null } } })
      const totalDrivers = await prisma.driver.count({ where: { tenantId, active: true } })
      return {
        driverBot: { connectedDrivers, totalDrivers },
        ownerBot: { chatIdSet: !!process.env.OWNER_TELEGRAM_CHAT_ID },
      }
    },
  },

  // 22. getWeeklySummary
  {
    name: 'getWeeklySummary',
    description: 'Get a weekly fleet summary: trips, revenue, expenses, top vehicle.',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(_params, tenantId) {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      weekAgo.setHours(0, 0, 0, 0)

      const trips = await prisma.trip.findMany({
        where: { tenantId, createdAt: { gte: weekAgo } },
        include: { vehicle: { select: { vehicleNumber: true } }, expenses: true },
      })

      let revenue = 0, expenses = 0
      const vehicleMap = {}
      for (const t of trips) {
        const freight = t.freightAmount || 0
        const cost = t.expenses.length > 0
          ? t.expenses.reduce((s, e) => s + e.amount, 0)
          : (t.fuelExpense || 0) + (t.toll || 0) + (t.cashExpense || 0)
        revenue += freight
        expenses += cost
        const vn = t.vehicle.vehicleNumber
        if (!vehicleMap[vn]) vehicleMap[vn] = { revenue: 0, expenses: 0, trips: 0 }
        vehicleMap[vn].revenue += freight
        vehicleMap[vn].expenses += cost
        vehicleMap[vn].trips++
      }

      const sorted = Object.entries(vehicleMap).sort((a, b) => (b[1].revenue - b[1].expenses) - (a[1].revenue - a[1].expenses))

      return {
        period: 'Last 7 Days',
        tripCount: trips.length,
        revenue, expenses, profit: revenue - expenses,
        topVehicle: sorted[0] ? { vehicle: sorted[0][0], ...sorted[0][1] } : null,
        bottomVehicle: sorted.length > 1 ? { vehicle: sorted[sorted.length - 1][0], ...sorted[sorted.length - 1][1] } : null,
      }
    },
  },

  // 23. searchFleetKnowledge
  {
    name: 'searchFleetKnowledge',
    description: 'Search the Indian fleet industry knowledge base for regulations, benchmarks, best practices, insurance rules, MV Act compliance, maintenance schedules, financial advice, and more. Use this when the user asks about industry knowledge, regulations, or best practices.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query about Indian fleet industry (e.g., "NCB rules for commercial vehicles", "overloading penalties", "fuel efficiency benchmarks")' },
        category: { type: 'string', description: 'Optional: filter by category (insurance, motor-vehicle-act, state-rto, fuel-optimization, route-economics, maintenance, driver-management, financial, industry-benchmarks)' },
      },
      required: ['query'],
    },
    async execute({ query, category }) {
      if (category) {
        const chunks = getChunksByCategory(category, 5)
        if (chunks.length > 0) return { results: chunks, source: 'knowledge-base', category }
      }
      const results = searchKnowledge(query, 5)
      return { results, source: 'knowledge-base', query }
    },
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
//  WRITE TOOLS (15) — require user confirmation before execution
// ═══════════════════════════════════════════════════════════════════════════════

const writeTools = [
  // 1. createTrip
  {
    name: 'createTrip',
    description: 'Log a new trip for a vehicle.',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        vehicleId: { type: 'string' },
        loadingLocation: { type: 'string' },
        destination: { type: 'string' },
        distance: { type: 'number' },
        ratePerKm: { type: 'number' },
        fuelLitres: { type: 'number' },
        dieselRate: { type: 'number' },
        fuelExpense: { type: 'number' },
        toll: { type: 'number' },
        cashExpense: { type: 'number' },
        freightAmount: { type: 'number' },
      },
      required: ['vehicleId', 'loadingLocation', 'destination', 'distance', 'ratePerKm', 'fuelLitres', 'dieselRate', 'fuelExpense', 'toll', 'cashExpense'],
    },
    async execute(params, tenantId) {
      const trip = await prisma.trip.create({ data: { ...params, tenantId } })
      return { success: true, tripId: trip.id, message: `Trip logged: ${params.loadingLocation} → ${params.destination}` }
    },
  },

  // 2. resolveAlert
  {
    name: 'resolveAlert',
    description: 'Mark a fleet alert as resolved.',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: { alertId: { type: 'string', description: 'UUID of the alert to resolve' } },
      required: ['alertId'],
    },
    async execute({ alertId }, tenantId) {
      const existing = await prisma.alert.findFirst({ where: { id: alertId, tenantId } })
      if (!existing) return { success: false, message: 'Alert not found or access denied' }
      const alert = await prisma.alert.update({ where: { id: alertId, tenantId }, data: { resolved: true } })
      return { success: true, message: `Alert resolved: ${alert.message}` }
    },
  },

  // 3. runAlertEngine
  {
    name: 'runAlertEngine',
    description: 'Trigger the alert engine to scan for new issues across the fleet.',
    requiresConfirmation: true,
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(_params, tenantId) {
      try {
        const { runAlertEngine } = await import('../services/alertEngine.js')
        const result = await runAlertEngine()
        return { success: true, message: `Alert engine ran. ${result?.created || 0} new alerts generated.` }
      } catch (e) {
        return { success: false, message: 'Alert engine failed: ' + e.message }
      }
    },
  },

  // 4. createDocument
  {
    name: 'createDocument',
    description: 'Add a new document (insurance/FC/PUC/permit) for a vehicle.',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        vehicleId: { type: 'string' },
        documentType: { type: 'string', enum: ['insurance', 'FC', 'PUC', 'permit'] },
        expiryDate: { type: 'string', description: 'ISO date string' },
        reminderDays: { type: 'number' },
      },
      required: ['vehicleId', 'documentType', 'expiryDate'],
    },
    async execute(params, tenantId) {
      const doc = await prisma.document.create({
        data: { ...params, tenantId, expiryDate: new Date(params.expiryDate), reminderDays: params.reminderDays || 30 },
      })
      return { success: true, docId: doc.id, message: `${params.documentType} document added.` }
    },
  },

  // 5. updateDocument
  {
    name: 'updateDocument',
    description: 'Update a document expiry date.',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        documentId: { type: 'string' },
        expiryDate: { type: 'string', description: 'New ISO date' },
      },
      required: ['documentId', 'expiryDate'],
    },
    async execute({ documentId, expiryDate }, tenantId) {
      const existing = await prisma.document.findFirst({ where: { id: documentId, tenantId } })
      if (!existing) return { success: false, message: 'Document not found or access denied' }
      const doc = await prisma.document.update({ where: { id: documentId, tenantId }, data: { expiryDate: new Date(expiryDate) } })
      return { success: true, message: `Document updated. New expiry: ${expiryDate}` }
    },
  },

  // 6. createMaintenance
  {
    name: 'createMaintenance',
    description: 'Log a maintenance expense for a vehicle.',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        vehicleId: { type: 'string' },
        maintenanceType: { type: 'string', enum: ['engine', 'tyre', 'brake', 'clutch', 'general'] },
        amount: { type: 'number' },
        description: { type: 'string' },
        workshopName: { type: 'string' },
        maintenanceDate: { type: 'string', description: 'ISO date' },
      },
      required: ['vehicleId', 'maintenanceType', 'amount', 'maintenanceDate'],
    },
    async execute(params, tenantId) {
      const log = await prisma.maintenanceLog.create({
        data: { ...params, tenantId, maintenanceDate: new Date(params.maintenanceDate) },
      })
      return { success: true, message: `Maintenance logged: ${params.maintenanceType} — ${inr(params.amount)}` }
    },
  },

  // 7. createDriver
  {
    name: 'createDriver',
    description: 'Register a new driver.',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' }, phone: { type: 'string' },
        licenseNumber: { type: 'string' }, vehicleId: { type: 'string' },
      },
      required: ['name', 'phone'],
    },
    async execute(params, tenantId) {
      const driver = await prisma.driver.create({ data: { ...params, tenantId } })
      return { success: true, driverId: driver.id, message: `Driver ${params.name} registered.` }
    },
  },

  // 8. updateDriver
  {
    name: 'updateDriver',
    description: 'Update driver info (name, phone, vehicle assignment, active status).',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        driverId: { type: 'string' }, name: { type: 'string' }, phone: { type: 'string' },
        vehicleId: { type: 'string' }, active: { type: 'boolean' },
      },
      required: ['driverId'],
    },
    async execute({ driverId, ...data }, tenantId) {
      const existing = await prisma.driver.findFirst({ where: { id: driverId, tenantId } })
      if (!existing) return { success: false, message: 'Driver not found or access denied' }
      const cleaned = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
      const driver = await prisma.driver.update({ where: { id: driverId, tenantId }, data: cleaned })
      return { success: true, message: `Driver ${driver.name} updated.` }
    },
  },

  // 9. updateVehicle
  {
    name: 'updateVehicle',
    description: 'Update vehicle info (status, km, axle config, insurance fields).',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        vehicleId: { type: 'string' }, status: { type: 'string', enum: ['active', 'idle'] },
        approxKm: { type: 'number' }, axleConfig: { type: 'string' },
      },
      required: ['vehicleId'],
    },
    async execute({ vehicleId, ...data }, tenantId) {
      const existing = await prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId } })
      if (!existing) return { success: false, message: 'Vehicle not found or access denied' }
      const cleaned = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
      const v = await prisma.vehicle.update({ where: { id: vehicleId, tenantId }, data: cleaned })
      return { success: true, message: `Vehicle ${v.vehicleNumber} updated.` }
    },
  },

  // 10. createRenewal
  {
    name: 'createRenewal',
    description: 'Create a renewal request for a document.',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        vehicleId: { type: 'string' }, documentId: { type: 'string' },
        documentType: { type: 'string', enum: ['insurance', 'FC', 'PUC', 'permit'] },
      },
      required: ['vehicleId', 'documentId', 'documentType'],
    },
    async execute(params, tenantId) {
      const r = await prisma.renewalRequest.create({ data: { ...params, tenantId } })
      return { success: true, renewalId: r.id, message: `Renewal request created for ${params.documentType}.` }
    },
  },

  // 11. confirmRenewal
  {
    name: 'confirmRenewal',
    description: 'Confirm a renewal request (mark as confirmed).',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: { renewalId: { type: 'string' } },
      required: ['renewalId'],
    },
    async execute({ renewalId }, tenantId) {
      const existing = await prisma.renewalRequest.findFirst({ where: { id: renewalId, tenantId } })
      if (!existing) return { success: false, message: 'Renewal not found or access denied' }
      const r = await prisma.renewalRequest.update({ where: { id: renewalId, tenantId }, data: { status: 'confirmed' } })
      return { success: true, message: `Renewal ${renewalId} confirmed.` }
    },
  },

  // 12. createSavedRoute
  {
    name: 'createSavedRoute',
    description: 'Create a new saved route template.',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        shortName: { type: 'string' }, loadingLocation: { type: 'string' },
        destination: { type: 'string' }, distance: { type: 'number' },
        ratePerKm: { type: 'number' }, defaultFuelLitres: { type: 'number' },
        defaultFuelExpense: { type: 'number' }, defaultToll: { type: 'number' },
        defaultCash: { type: 'number' },
      },
      required: ['shortName', 'loadingLocation', 'destination', 'distance', 'ratePerKm', 'defaultFuelLitres', 'defaultFuelExpense', 'defaultToll'],
    },
    async execute(params, tenantId) {
      const route = await prisma.savedRoute.create({ data: { ...params, tenantId } })
      return { success: true, routeId: route.id, message: `Route saved: ${params.shortName}` }
    },
  },

  // 13. updateSavedRoute
  {
    name: 'updateSavedRoute',
    description: 'Update an existing saved route template.',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        routeId: { type: 'string' }, shortName: { type: 'string' },
        distance: { type: 'number' }, ratePerKm: { type: 'number' },
        defaultFuelLitres: { type: 'number' }, defaultFuelExpense: { type: 'number' },
        defaultToll: { type: 'number' }, defaultCash: { type: 'number' },
      },
      required: ['routeId'],
    },
    async execute({ routeId, ...data }, tenantId) {
      const existing = await prisma.savedRoute.findFirst({ where: { id: routeId, tenantId } })
      if (!existing) return { success: false, message: 'Route not found or access denied' }
      const cleaned = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
      await prisma.savedRoute.update({ where: { id: routeId, tenantId }, data: cleaned })
      return { success: true, message: `Route updated.` }
    },
  },

  // 14. deleteSavedRoute
  {
    name: 'deleteSavedRoute',
    description: 'Delete a saved route template.',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: { routeId: { type: 'string' } },
      required: ['routeId'],
    },
    async execute({ routeId }, tenantId) {
      const existing = await prisma.savedRoute.findFirst({ where: { id: routeId, tenantId } })
      if (!existing) return { success: false, message: 'Route not found or access denied' }
      await prisma.savedRoute.delete({ where: { id: routeId, tenantId } })
      return { success: true, message: 'Route deleted.' }
    },
  },

  // 15. reconcileBill
  {
    name: 'reconcileBill',
    description: 'Reconcile a monthly bill with trips (update freight amounts).',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        billId: { type: 'string' },
        tripFreightMap: { type: 'object', description: 'Object mapping tripId → freightAmount' },
      },
      required: ['billId', 'tripFreightMap'],
    },
    async execute({ billId, tripFreightMap }, tenantId) {
      const bill = await prisma.monthlyBill.findFirst({ where: { id: billId, tenantId } })
      if (!bill) return { success: false, message: 'Bill not found or access denied' }
      let updated = 0
      for (const [tripId, freight] of Object.entries(tripFreightMap)) {
        const trip = await prisma.trip.findFirst({ where: { id: tripId, tenantId } })
        if (!trip) continue
        await prisma.trip.update({
          where: { id: tripId, tenantId },
          data: { freightAmount: Number(freight), status: 'reconciled', monthlyBillId: billId },
        })
        updated++
      }
      await prisma.monthlyBill.update({ where: { id: billId, tenantId }, data: { reconciledAt: new Date() } })
      return { success: true, message: `${updated} trips reconciled.` }
    },
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const ALL_TOOLS = [...readTools, ...writeTools]

// Map for quick lookup
export const TOOL_MAP = Object.fromEntries(ALL_TOOLS.map(t => [t.name, t]))

// Groq-compatible tool definitions (OpenAI format)
export const TOOL_DEFINITIONS = ALL_TOOLS.map(t => ({
  type: 'function',
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  },
}))

export default { ALL_TOOLS, TOOL_MAP, TOOL_DEFINITIONS }
