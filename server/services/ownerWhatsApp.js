/**
 * Fleetsure Owner WhatsApp Service
 * ─────────────────────────────────
 * Replaces ownerBot.js (Telegram) with WhatsApp via Twilio.
 *
 * Features:
 *   📊 Dashboard     — live fleet overview
 *   🚛 Fleet Status  — where each truck is right now
 *   💰 P&L Report    — today / week / month financials
 *   ⚠️ Alerts        — unresolved fleet alerts
 *   👷 Drivers       — driver list + ranking
 *   🔔 Push Notifs   — trip start/end, fuel anomaly, daily summary
 */

import prisma from '../lib/prisma.js'
import { sendWhatsApp, sendWhatsAppWithButtons, inr } from './twilioClient.js'

// Per-phone conversation state (for multi-step flows like P&L period selection)
const ownerState = new Map()

/**
 * Resolve tenantId for an owner by their User record.
 */
async function getTenantId(phone) {
  const user = await prisma.user.findFirst({ where: { whatsappPhone: phone } })
  return user?.tenantId ?? null
}

// ═══════════════════════════════════════════════════════════════════════════
// INCOMING MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function handleOwnerMessage(phone, body, context = {}) {
  const text = body.toLowerCase().trim()
  const state = ownerState.get(phone) || null

  // P&L period selection (state-based)
  if (state === 'pnl_select') {
    ownerState.delete(phone)
    if (text === '1' || text.includes('today')) return sendPnlReport(phone, 'today')
    if (text === '2' || text.includes('week')) return sendPnlReport(phone, 'week')
    if (text === '3' || text.includes('month')) return sendPnlReport(phone, 'month')
    return sendWhatsApp(phone, '❌ Invalid choice. Reply *menu* to see options.')
  }

  // Menu / command routing
  if (text === 'hi' || text === 'hello' || text === 'menu' || text === 'start') return sendMenu(phone)
  if (text === '1' || text === 'dashboard') return sendDashboard(phone)
  if (text === '2' || text === 'fleet' || text === 'fleet status') return sendFleetStatus(phone)
  if (text === '3' || text === 'pnl' || text === 'p&l' || text === 'profit') return sendPnlSelector(phone)
  if (text === '4' || text === 'alerts') return sendAlerts(phone)
  if (text === '5' || text === 'drivers') return sendDriverList(phone)
  if (text === 'help') return sendHelp(phone)

  // Fallback
  return sendWhatsApp(phone,
    `👋 Reply *menu* to see all options.\n\nOr reply with a number:\n` +
    `*1.* Dashboard\n*2.* Fleet Status\n*3.* P&L Report\n*4.* Alerts\n*5.* Drivers`
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MENU
// ═══════════════════════════════════════════════════════════════════════════

async function sendMenu(phone) {
  const tenantId = await getTenantId(phone)
  const [vehicleCount, driverCount, tripCount] = await Promise.all([
    prisma.vehicle.count({ where: tenantId ? { tenantId } : undefined }),
    prisma.driver.count({ where: { active: true, ...(tenantId && { tenantId }) } }),
    prisma.trip.count({ where: tenantId ? { tenantId } : undefined }),
  ])

  const code = process.env.FLEET_INVITE_CODE || 'FLEET-7X2K'

  let msg = `🏢 *Fleetsure Fleet Manager*\n\n`
  msg += `📊 Fleet: ${vehicleCount} vehicles | ${driverCount} drivers | ${tripCount} trips\n`
  msg += `🔑 Invite Code: ${code}\n\n`
  msg += `Reply with a number:\n\n`
  msg += `*1.* 📊 Dashboard\n`
  msg += `*2.* 🚛 Fleet Status\n`
  msg += `*3.* 💰 P&L Report\n`
  msg += `*4.* ⚠️ Alerts\n`
  msg += `*5.* 👷 Drivers\n\n`
  msg += `Or type *help* for more info.`

  return sendWhatsApp(phone, msg)
}

async function sendHelp(phone) {
  return sendWhatsApp(phone,
    `📋 *Fleetsure Manager — Help*\n\n` +
    `📊 *Dashboard* — Fleet overview, active/idle trucks, today's P&L\n` +
    `🚛 *Fleet Status* — Where each truck is right now\n` +
    `💰 *P&L Report* — Financial report (today/week/month)\n` +
    `⚠️ *Alerts* — Unresolved fleet alerts\n` +
    `👷 *Drivers* — Driver list, ranking, invite code\n\n` +
    `*Auto Notifications:*\n` +
    `🔔 Trip start/complete alerts\n` +
    `🔴 Fuel anomaly warnings\n` +
    `📊 Daily fleet summary (9 PM)\n\n` +
    `Reply *menu* to see options.`
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 📊 DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

async function sendDashboard(phone) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tenantId = await getTenantId(phone)

  const [vehicles, drivers, todayTrips, unresolvedAlerts] = await Promise.all([
    prisma.vehicle.findMany({
      where: tenantId ? { tenantId } : undefined,
      select: { id: true, status: true },
    }),
    prisma.driver.findMany({ where: { active: true, ...(tenantId && { tenantId }) } }),
    prisma.trip.findMany({
      where: { createdAt: { gte: today }, ...(tenantId && { tenantId }) },
      include: { expenses: true },
    }),
    prisma.alert.count({ where: { resolved: false, ...(tenantId && { tenantId }) } }),
  ])

  const activeVehicles = vehicles.filter(v => v.status === 'active').length
  const idleVehicles = vehicles.filter(v => v.status === 'idle').length

  const revenue = todayTrips.reduce((s, t) => s + (t.freightAmount || 0), 0)
  const expenses = todayTrips.reduce((s, t) => s + t.expenses.reduce((se, e) => se + e.amount, 0), 0)
  const tripsWithOldExpenses = todayTrips.reduce((s, t) => s + (t.fuelExpense || 0) + (t.toll || 0) + (t.cashExpense || 0), 0)
  const totalExpenses = expenses > 0 ? expenses : tripsWithOldExpenses
  const profit = revenue - totalExpenses

  const activeTrips = todayTrips.filter(t => t.status === 'logged').length

  let msg = `📊 *Fleet Dashboard* — ${new Date().toLocaleDateString('en-IN')}\n\n`
  msg += `🚛 *Vehicles:* ${vehicles.length}\n`
  msg += `├ 🟢 Active: ${activeVehicles}\n`
  msg += `└ 🟡 Idle: ${idleVehicles}\n\n`
  msg += `👷 *Drivers:* ${drivers.length}\n\n`
  msg += `📅 *Today:*\n`
  msg += `├ 📦 Trips: ${todayTrips.length} (${activeTrips} active)\n`
  if (revenue > 0) msg += `├ 💵 Revenue: ${inr(revenue)}\n`
  msg += `├ 💸 Expenses: ${inr(totalExpenses)}\n`
  if (revenue > 0) msg += `└ 💰 Profit: ${inr(profit)}\n`
  else msg += `└ 💰 Profit: Revenue pending\n`

  if (unresolvedAlerts > 0) msg += `\n⚠️ *${unresolvedAlerts} unresolved alerts* — reply *4* to view`

  msg += `\n\nReply *menu* for options.`
  return sendWhatsApp(phone, msg)
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚛 FLEET STATUS
// ═══════════════════════════════════════════════════════════════════════════

async function sendFleetStatus(phone) {
  const tenantId = await getTenantId(phone)
  const vehicles = await prisma.vehicle.findMany({
    where: tenantId ? { tenantId } : undefined,
    orderBy: { vehicleNumber: 'asc' },
    include: {
      drivers: { where: { active: true }, select: { id: true, name: true } },
      trips: {
        where: { status: 'logged' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { expenses: true },
      },
    },
  })

  if (vehicles.length === 0) {
    return sendWhatsApp(phone, '🚛 No vehicles registered yet.\n\nReply *menu* for options.')
  }

  let msg = `🚛 *Fleet Status — Live*\n\n`

  for (const v of vehicles) {
    const driver = v.drivers[0]
    const activeTrip = v.trips[0]

    if (activeTrip) {
      const tripExpenses = activeTrip.expenses.reduce((s, e) => s + e.amount, 0)
      const fallbackExp = (activeTrip.fuelExpense || 0) + (activeTrip.toll || 0) + (activeTrip.cashExpense || 0)
      const exp = tripExpenses > 0 ? tripExpenses : fallbackExp

      msg += `🟢 *${v.vehicleNumber}*`
      if (driver) msg += ` — ${driver.name}`
      msg += `\n   ${activeTrip.loadingLocation} → ${activeTrip.destination}\n`
      if (exp > 0) msg += `   💸 ${inr(exp)}\n`
      msg += `\n`
    } else {
      msg += `🟡 *${v.vehicleNumber}*`
      if (driver) msg += ` — ${driver.name}`
      msg += ` — IDLE\n\n`
    }
  }

  msg += `Reply *menu* for options.`
  return sendWhatsApp(phone, msg)
}

// ═══════════════════════════════════════════════════════════════════════════
// 💰 P&L REPORT
// ═══════════════════════════════════════════════════════════════════════════

async function sendPnlSelector(phone) {
  ownerState.set(phone, 'pnl_select')
  return sendWhatsApp(phone,
    `💰 *P&L Report*\n\nWhich period?\n\n` +
    `*1.* 📅 Today\n` +
    `*2.* 📅 This Week\n` +
    `*3.* 📅 This Month`
  )
}

async function sendPnlReport(phone, period) {
  const now = new Date()
  let since = new Date()
  let label = ''

  if (period === 'today') {
    since.setHours(0, 0, 0, 0)
    label = now.toLocaleDateString('en-IN')
  } else if (period === 'week') {
    since.setDate(since.getDate() - 7)
    since.setHours(0, 0, 0, 0)
    label = 'Last 7 Days'
  } else {
    since = new Date(now.getFullYear(), now.getMonth(), 1)
    label = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  }

  const tenantId = await getTenantId(phone)
  const trips = await prisma.trip.findMany({
    where: { createdAt: { gte: since }, ...(tenantId && { tenantId }) },
    include: {
      expenses: true,
      vehicle: { select: { vehicleNumber: true } },
    },
  })

  const revenue = trips.reduce((s, t) => s + (t.freightAmount || 0), 0)

  let fuelTotal = 0, tollTotal = 0, cashTotal = 0
  for (const t of trips) {
    if (t.expenses.length > 0) {
      fuelTotal += t.expenses.filter(e => e.type === 'fuel').reduce((s, e) => s + e.amount, 0)
      tollTotal += t.expenses.filter(e => e.type === 'toll').reduce((s, e) => s + e.amount, 0)
      const cashTypes = ['food', 'repair', 'parking', 'room', 'other']
      cashTotal += t.expenses.filter(e => cashTypes.includes(e.type)).reduce((s, e) => s + e.amount, 0)
    } else {
      fuelTotal += t.fuelExpense || 0
      tollTotal += t.toll || 0
      cashTotal += t.cashExpense || 0
    }
  }

  const totalExpenses = fuelTotal + tollTotal + cashTotal
  const profit = revenue - totalExpenses

  let msg = `💰 *P&L Report — ${label}*\n\n`
  if (revenue > 0) {
    msg += `📊 *Revenue:*\n└ Freight: ${inr(revenue)} (${trips.length} trips)\n\n`
  } else {
    msg += `📦 ${trips.length} trips logged\n\n`
  }

  msg += `💸 *Expenses:*\n`
  if (fuelTotal > 0) msg += `├ ⛽ Diesel: ${inr(fuelTotal)} (${totalExpenses > 0 ? Math.round(fuelTotal / totalExpenses * 100) : 0}%)\n`
  if (tollTotal > 0) msg += `├ 🛣️ Tolls: ${inr(tollTotal)} (${totalExpenses > 0 ? Math.round(tollTotal / totalExpenses * 100) : 0}%)\n`
  if (cashTotal > 0) msg += `├ 💰 Cash: ${inr(cashTotal)} (${totalExpenses > 0 ? Math.round(cashTotal / totalExpenses * 100) : 0}%)\n`
  msg += `└ *Total: ${inr(totalExpenses)}*\n\n`

  if (revenue > 0) {
    msg += `─────────────────\n`
    msg += `💰 *Profit: ${inr(profit)}*\n`
    const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0
    msg += `📈 Margin: ${margin}%\n`
  }

  // Top/bottom vehicles
  if (trips.length > 0) {
    const vehicleMap = {}
    for (const t of trips) {
      const vn = t.vehicle.vehicleNumber
      if (!vehicleMap[vn]) vehicleMap[vn] = { revenue: 0, expenses: 0, trips: 0 }
      vehicleMap[vn].revenue += t.freightAmount || 0
      const tExp = t.expenses.length > 0
        ? t.expenses.reduce((s, e) => s + e.amount, 0)
        : (t.fuelExpense || 0) + (t.toll || 0) + (t.cashExpense || 0)
      vehicleMap[vn].expenses += tExp
      vehicleMap[vn].trips++
    }

    const sorted = Object.entries(vehicleMap).sort((a, b) => (b[1].revenue - b[1].expenses) - (a[1].revenue - a[1].expenses))
    if (sorted.length > 0) {
      const [bestVn, bestData] = sorted[0]
      const bestProfit = bestData.revenue - bestData.expenses
      msg += `\n🏆 *Best:* ${bestVn} — ${bestData.trips} trips`
      if (bestProfit > 0) msg += `, ${inr(bestProfit)} profit`
      msg += `\n`
      if (sorted.length > 1) {
        const [worstVn, worstData] = sorted[sorted.length - 1]
        msg += `⚠️ *Lowest:* ${worstVn} — ${worstData.trips} trips\n`
      }
    }
  }

  msg += `\nReply *menu* for options.`
  return sendWhatsApp(phone, msg)
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ ALERTS
// ═══════════════════════════════════════════════════════════════════════════

async function sendAlerts(phone) {
  const tenantId = await getTenantId(phone)
  const alerts = await prisma.alert.findMany({
    where: { resolved: false, ...(tenantId && { tenantId }) },
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    take: 10,
    include: { vehicle: { select: { vehicleNumber: true } } },
  })

  if (alerts.length === 0) {
    return sendWhatsApp(phone, '✅ *No unresolved alerts!*\n\nAll good.\n\nReply *menu* for options.')
  }

  let msg = `⚠️ *${alerts.length} Unresolved Alerts*\n\n`

  for (const a of alerts) {
    const icon = a.severity === 'high' ? '🔴' : a.severity === 'medium' ? '🟡' : '🟢'
    msg += `${icon} *${a.severity.toUpperCase()}* — ${a.alertType.replace(/_/g, ' ')}\n`
    if (a.vehicle) msg += `🚛 ${a.vehicle.vehicleNumber}\n`
    msg += `${a.message}\n`
    msg += `📅 ${new Date(a.createdAt).toLocaleDateString('en-IN')}\n\n`
  }

  msg += `_Resolve alerts from the web dashboard._\n\nReply *menu* for options.`
  return sendWhatsApp(phone, msg)
}

// ═══════════════════════════════════════════════════════════════════════════
// 👷 DRIVERS
// ═══════════════════════════════════════════════════════════════════════════

async function sendDriverList(phone) {
  const tenantId = await getTenantId(phone)
  const drivers = await prisma.driver.findMany({
    where: { active: true, ...(tenantId && { tenantId }) },
    include: {
      vehicle: { select: { vehicleNumber: true } },
      _count: { select: { trips: true } },
    },
    orderBy: { name: 'asc' },
  })

  if (drivers.length === 0) {
    const code = process.env.FLEET_INVITE_CODE || 'FLEET-7X2K'
    const waNumber = process.env.TWILIO_WHATSAPP_NUMBER || ''
    return sendWhatsApp(phone,
      `👷 *No drivers registered yet.*\n\n` +
      `Share this with your drivers:\n` +
      `📱 WhatsApp number: ${waNumber}\n` +
      `🔑 Fleet code: ${code}\n\n` +
      `They should send "Hi" to get started.\n\nReply *menu* for options.`
    )
  }

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const driverStats = []
  for (const d of drivers) {
    const monthTrips = await prisma.trip.count({
      where: { driverId: d.id, createdAt: { gte: monthStart }, ...(tenantId && { tenantId }) },
    })
    driverStats.push({ ...d, monthTrips })
  }
  driverStats.sort((a, b) => b.monthTrips - a.monthTrips)

  let msg = `👷 *Drivers (${drivers.length})*\n\n`

  for (let i = 0; i < driverStats.length; i++) {
    const d = driverStats[i]
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`
    const verified = d.licensePhotoUrl ? '✅' : '⚪'

    msg += `${medal} ${verified} *${d.name}*\n`
    if (d.vehicle) msg += `   🚛 ${d.vehicle.vehicleNumber}\n`
    msg += `   📦 ${d.monthTrips} trips this month (${d._count.trips} total)\n\n`
  }

  const code = process.env.FLEET_INVITE_CODE || 'FLEET-7X2K'
  msg += `🔑 Fleet invite code: ${code}`
  msg += `\n\nReply *menu* for options.`

  return sendWhatsApp(phone, msg)
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔔 PUSH NOTIFICATIONS TO OWNER (called from driverWhatsApp)
// ═══════════════════════════════════════════════════════════════════════════

export async function sendOwnerNotification(event, payload) {
  // Find all owners with WhatsApp connected
  const owners = await prisma.user.findMany({
    where: {
      whatsappPhone: { not: null },
      role: { in: ['owner', 'manager'] },
    },
    select: { whatsappPhone: true },
  })

  if (owners.length === 0) return

  let msg = ''

  switch (event) {
    case 'trip_start': {
      const { trip, vehicle, driver } = payload
      msg = `🚀 *Trip Started*\n\n`
      msg += `🚛 ${vehicle.vehicleNumber}`
      if (driver) msg += ` | ${driver.name}`
      msg += `\n🛣️ ${trip.loadingLocation} → ${trip.destination}\n`
      msg += `📅 ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
      break
    }

    case 'trip_complete': {
      const { trip, fuelTotal, tollTotal, cashTotal, grandTotal, hours, mins, fuelLitres, drivingScore } = payload
      msg = `✅ *Trip Delivered*\n\n`
      msg += `🚛 ${trip.vehicle.vehicleNumber}\n`
      msg += `🛣️ ${trip.loadingLocation} → ${trip.destination}\n`
      msg += `⏱️ ${hours}h ${mins}min\n\n`
      msg += `💰 Expenses: ${inr(grandTotal)}\n`
      if (fuelTotal > 0) msg += `├ ⛽ ${inr(fuelTotal)} (${fuelLitres}L)\n`
      if (tollTotal > 0) msg += `├ 🛣️ ${inr(tollTotal)}\n`
      if (cashTotal > 0) msg += `└ 💰 ${inr(cashTotal)}\n`
      if (drivingScore && drivingScore.totalDistanceKm > 0) {
        const sc = drivingScore
        const emoji = sc.overallScore >= 80 ? '🟢' : sc.overallScore >= 60 ? '🟡' : '🔴'
        msg += `\n🏆 *Driving Score: ${emoji} ${sc.overallScore}/100*\n`
        msg += `├ Speed: ${sc.speedScore} | Braking: ${sc.brakingScore}\n`
        msg += `├ Avg: ${Math.round(sc.avgSpeed)} km/h | Max: ${Math.round(sc.maxSpeed)} km/h\n`
        const totalEvents = sc.harshBrakeCount + sc.harshAccelCount + sc.sharpTurnCount
        if (totalEvents > 0) {
          msg += `└ ⚠️ ${totalEvents} harsh events\n`
        }
      }
      break
    }

    case 'fuel_anomaly': {
      const { vehicle, driver, fuelLitres, dist, kmPerL } = payload
      msg = `🔴 *FUEL ALERT*\n\n`
      msg += `🚛 ${vehicle.vehicleNumber}`
      if (driver) msg += ` — ${driver.name}`
      msg += `\n⛽ ${fuelLitres}L diesel but only ${dist} km driven\n`
      msg += `Expected: ~3.5 km/L\nActual: ${kmPerL} km/L ❌\n\n`
      msg += `Possible fuel theft or vehicle issue.`
      break
    }

    case 'new_driver': {
      const { driver } = payload
      msg = `👷 *New Driver Registered*\n\n`
      msg += `Name: ${driver.name}\n`
      msg += `Phone: ${driver.phone}\n`
      if (driver.vehicle) msg += `Vehicle: ${driver.vehicle.vehicleNumber}\n`
      msg += `Via WhatsApp`
      break
    }

    default:
      return
  }

  if (!msg) return

  for (const owner of owners) {
    try {
      await sendWhatsApp(owner.whatsappPhone, msg)
    } catch (err) {
      console.error(`[OwnerWhatsApp] Push failed to ${owner.whatsappPhone}:`, err.message)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DAILY FLEET SUMMARY (called from cron at 9 PM)
// ═══════════════════════════════════════════════════════════════════════════

export async function sendDailyFleetSummary() {
  const owners = await prisma.user.findMany({
    where: {
      whatsappPhone: { not: null },
      role: { in: ['owner', 'manager'] },
    },
    select: { whatsappPhone: true, tenantId: true },
  })

  for (const owner of owners) {
    try {
      const tenantId = owner.tenantId
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [vehicles, trips, unresolvedAlerts, expiringDocs] = await Promise.all([
        prisma.vehicle.findMany({
          where: tenantId ? { tenantId } : undefined,
          select: { status: true },
        }),
        prisma.trip.findMany({
          where: { createdAt: { gte: today }, ...(tenantId && { tenantId }) },
          include: { expenses: true },
        }),
        prisma.alert.count({ where: { resolved: false, ...(tenantId && { tenantId }) } }),
        prisma.document.count({
          where: {
            ...(tenantId && { tenantId }),
            expiryDate: {
              lte: new Date(Date.now() + 7 * 86400000),
              gte: new Date(),
            },
          },
        }),
      ])

      const activeVehicles = vehicles.filter(v => v.status === 'active').length
      const revenue = trips.reduce((s, t) => s + (t.freightAmount || 0), 0)
      const expenses = trips.reduce((s, t) => {
        if (t.expenses.length > 0) return s + t.expenses.reduce((se, e) => se + e.amount, 0)
        return s + (t.fuelExpense || 0) + (t.toll || 0) + (t.cashExpense || 0)
      }, 0)
      const profit = revenue - expenses

      let msg = `📊 *Daily Fleet Report — ${new Date().toLocaleDateString('en-IN')}*\n\n`
      msg += `✅ ${activeVehicles}/${vehicles.length} vehicles active\n`
      msg += `📦 ${trips.length} trips\n`
      if (revenue > 0) msg += `💵 Revenue: ${inr(revenue)}\n`
      msg += `💸 Expenses: ${inr(expenses)}\n`
      if (revenue > 0) {
        msg += `📈 Profit: ${inr(profit)} (${revenue > 0 ? Math.round((profit / revenue) * 100) : 0}%)\n`
      }
      if (unresolvedAlerts > 0) msg += `\n⚠️ ${unresolvedAlerts} unresolved alerts`
      if (expiringDocs > 0) msg += `\n📄 ${expiringDocs} documents expiring this week`

      msg += `\n\nReply *menu* for details.`
      await sendWhatsApp(owner.whatsappPhone, msg)
    } catch (err) {
      console.error(`[OwnerWhatsApp] Daily summary failed:`, err.message)
    }
  }
}

export default { handleOwnerMessage, sendOwnerNotification, sendDailyFleetSummary }
