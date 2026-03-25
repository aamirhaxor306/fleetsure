/**
 * Fleetsure Owner / Manager Bot — @fleetsure_manager_bot
 * ──────────────────────────────────────────────────────
 * English-primary bot for fleet owners and managers.
 *
 * Features:
 * Dashboard — live fleet overview
 * Fleet Status — where each truck is right now
 * P&L Report — today / week / month financials
 * Alerts — unresolved fleet alerts
 * Drivers — driver list + ranking
 * AI Insights — AI-powered fleet analysis
 * Push Notifs — trip start/end, fuel anomaly, daily summary
 */

import TelegramBot from 'node-telegram-bot-api'
import prisma from '../lib/prisma.js'

let bot = null
let ownerChatId = null // Saved after first /start

/**
 * Resolve tenantId for the owner by Telegram chat ID.
 * TODO: Production — map chatId to User (e.g. User.telegramChatId or owner table) then return User.tenantId.
 * For now: use first tenant for dev/testing.
 */
async function getTenantIdForOwner(chatId) {
 const first = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } })
 return first?.id ?? null
}

// ═══════════════════════════════════════════════════════════════════════════
// KEYBOARDS
// ═══════════════════════════════════════════════════════════════════════════

const HOME_KEYBOARD = {
 keyboard: [
 [{ text: 'Dashboard' }, { text: 'Fleet Status' }],
 [{ text: 'P&L Report' }, { text: 'Alerts' }],
 [{ text: 'Drivers' }, { text: 'AI Insights' }],
 ],
 resize_keyboard: true,
}

// ═══════════════════════════════════════════════════════════════════════════
// START BOT
// ═══════════════════════════════════════════════════════════════════════════

export async function startOwnerBot() {
 const token = process.env.TELEGRAM_OWNER_BOT_TOKEN
 if (!token) {
 console.log('[OwnerBot] No TELEGRAM_OWNER_BOT_TOKEN — disabled')
 return null
 }

 try {
 bot = new TelegramBot(token, { polling: true })
 const me = await bot.getMe()
 console.log(`[OwnerBot] Started: @${me.username}`)

 // Load saved owner chat ID
 ownerChatId = process.env.OWNER_TELEGRAM_CHAT_ID || null

 // Command handlers
 bot.onText(/\/start/, onStart)
 bot.onText(/\/help/, onHelp)
 bot.onText(/\/ask (.+)/, onAsk)

 // Callback queries
 bot.on('callback_query', onCallbackQuery)

 // Generic text (button presses)
 bot.on('message', onMessage)

 bot.on('polling_error', (err) => {
 console.error('[OwnerBot] Polling error:', err.message)
 })

 return bot
 } catch (err) {
 console.error('[OwnerBot] Failed to start:', err.message)
 return null
 }
}

export function getOwnerBot() { return bot }

// ═══════════════════════════════════════════════════════════════════════════
// /start
// ═══════════════════════════════════════════════════════════════════════════

async function onStart(msg) {
 const chatId = msg.chat.id

 // Save owner chat ID for push notifications
 ownerChatId = String(chatId)

 const tenantId = await getTenantIdForOwner(chatId)
 const [vehicleCount, driverCount, tripCount] = await Promise.all([
 prisma.vehicle.count({ where: tenantId ? { tenantId } : undefined }),
 prisma.driver.count({ where: { active: true, ...(tenantId && { tenantId }) } }),
 prisma.trip.count({ where: tenantId ? { tenantId } : undefined }),
 ])

 const code = process.env.FLEET_INVITE_CODE || 'FLEET-7X2K'

 return bot.sendMessage(chatId,
 `*Welcome to Fleetsure Fleet Manager!*\n\n`+
 `Fleet Summary:\n`+
 `Vehicles: *${vehicleCount}*\n`+
 `Drivers: *${driverCount}*\n`+
 `Total Trips: *${tripCount}*\n\n`+
 `*Fleet Invite Code:* \`${code}\`\n`+
 `Share this with drivers so they can join via @fleetsure\\_driver\\_bot\n\n`+
 `Neeche buttons se fleet manage karo:`,
 { parse_mode: 'Markdown', reply_markup: HOME_KEYBOARD })
}

// ═══════════════════════════════════════════════════════════════════════════
// /help
// ═══════════════════════════════════════════════════════════════════════════

async function onHelp(msg) {
 return bot.sendMessage(msg.chat.id,
 `*Fleetsure Manager Bot — Help*\n\n`+
 `*Dashboard* — Fleet overview, active/idle trucks, today's P&L\n`+
 `*Fleet Status* — Where each truck is right now\n`+
 `*P&L Report* — Financial report (today/week/month)\n`+
 `*Alerts* — Unresolved fleet alerts\n`+
 `*Drivers* — Driver list, ranking, invite code\n`+
 `*AI Insights* — AI analysis of your fleet\n\n`+
 `*AI Questions:*\n`+
 `/ask <question> — Ask anything about your fleet\n`+
 `e.g. \`/ask Which vehicle earns the most?\`\n`+
 `e.g. \`/ask What documents expire this month?\`\n\n`+
 `*Auto Notifications:*\n`+
 `Trip start/complete alerts\n`+
 `Fuel anomaly warnings\n`+
 `Daily fleet summary (9 PM)`,
 { parse_mode: 'Markdown', reply_markup: HOME_KEYBOARD })
}

// ═══════════════════════════════════════════════════════════════════════════
// AI Agent Ask (upgraded from simple Q&A to full agent with tool calling)
// ═══════════════════════════════════════════════════════════════════════════

// Per-chat conversation state for multi-turn agent
const chatConversations = new Map()

async function onAsk(msg, match) {
 const chatId = msg.chat.id
 const question = match[1]?.trim()
 if (!question || question.length < 3) {
 return bot.sendMessage(chatId, 'Please provide a question.\n\nExample: `/ask Which vehicle earns the most?`', { parse_mode: 'Markdown' })
 }

 const waitMsg = await bot.sendMessage(chatId, 'Agent is analyzing...')

 try {
 const tenantId = await getTenantIdForOwner(chatId)
 const { runAgentTurn } = await import('./agentLoop.js')
 const convId = chatConversations.get(chatId) || null
 const result = await runAgentTurn(question, convId, tenantId)

 // Save conversation ID for multi-turn
 if (result.conversationId) chatConversations.set(chatId, result.conversationId)

 // Build response text
 let text = ''

 // Tool chips
 if (result.toolsUsed && result.toolsUsed.length > 0) {
 text += `_${result.toolsUsed.map(t => t.replace(/([A-Z])/g, ' $1').trim()).join(' → ')}_\n\n`
 }

 text += `*Answer:*\n\n${result.response}`

 // If there's a pending action, show approval buttons
 if (result.pendingAction) {
 text += `\n\n *Action Required:*\n${result.pendingAction.humanReadable}`

 await bot.editMessageText(text, {
 chat_id: chatId,
 message_id: waitMsg.message_id,
 parse_mode: 'Markdown',
 reply_markup: {
 inline_keyboard: [[
 { text: 'Approve', callback_data: `agent_approve:${result.conversationId}`},
 { text: 'Reject', callback_data: `agent_reject:${result.conversationId}`},
 ]],
 },
 })
 } else {
 await bot.editMessageText(text, {
 chat_id: chatId,
 message_id: waitMsg.message_id,
 parse_mode: 'Markdown',
 })
 }
 } catch (err) {
 console.error('[OwnerBot] Agent ask error:', err)
 try {
 await bot.editMessageText('Could not process. Try again.', { chat_id: chatId, message_id: waitMsg.message_id })
 } catch {}
 }
}

// ═══════════════════════════════════════════════════════════════════════════
// CALLBACK QUERY
// ═══════════════════════════════════════════════════════════════════════════

async function onCallbackQuery(query) {
 const chatId = query.message.chat.id
 const data = query.data

 try {
 // Agent approval/rejection
 if (data.startsWith('agent_approve:') || data.startsWith('agent_reject:')) {
 const confirmed = data.startsWith('agent_approve:')
 const convId = data.split(':')[1]
 await bot.answerCallbackQuery(query.id, { text: confirmed ? 'Approved' : 'Rejected' })

 const waitMsg = await bot.sendMessage(chatId, confirmed ? 'Executing action...' : 'Action cancelled.')

 try {
 const { confirmAction } = await import('./agentLoop.js')
 const result = await confirmAction(convId, confirmed)

 let text = ''
 if (result.toolsUsed && result.toolsUsed.length > 0) {
 text += `_${result.toolsUsed.map(t => t.replace(/([A-Z])/g, ' $1').trim()).join(' → ')}_\n\n`
 }
 text += ` ${result.response}`

 if (result.pendingAction) {
 text += `\n\n *Next Action:*\n${result.pendingAction.humanReadable}`
 await bot.editMessageText(text, {
 chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'Markdown',
 reply_markup: {
 inline_keyboard: [[
 { text: 'Approve', callback_data: `agent_approve:${convId}`},
 { text: 'Reject', callback_data: `agent_reject:${convId}`},
 ]],
 },
 })
 } else {
 await bot.editMessageText(text, { chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'Markdown' })
 }
 } catch (err) {
 console.error('[OwnerBot] Agent confirm error:', err)
 try { await bot.editMessageText('Failed to process action.', { chat_id: chatId, message_id: waitMsg.message_id }) } catch {}
 }
 return
 }

 // P&L period selection
 if (data.startsWith('pnl:')) {
 const period = data.split(':')[1]
 await bot.answerCallbackQuery(query.id, { text: 'OK' })
 return sendPnlReport(chatId, period)
 }

 // Resolve alert
 if (data.startsWith('resolve_alert:')) {
 const alertId = data.split(':')[1]
 const tenantId = await getTenantIdForOwner(chatId)
 await prisma.alert.update({
 where: { id: alertId, ...(tenantId && { tenantId }) },
 data: { resolved: true },
 })
 await bot.answerCallbackQuery(query.id, { text: 'Resolved!' })
 return bot.sendMessage(chatId, 'Alert resolved.')
 }

 // Vehicle detail
 if (data.startsWith('vehicle_detail:')) {
 const vehicleId = data.split(':')[1]
 await bot.answerCallbackQuery(query.id, { text: 'OK' })
 return sendVehicleDetail(chatId, vehicleId)
 }

 // Driver detail
 if (data.startsWith('driver_detail:')) {
 const driverId = data.split(':')[1]
 await bot.answerCallbackQuery(query.id, { text: 'OK' })
 return sendDriverDetail(chatId, driverId)
 }

 await bot.answerCallbackQuery(query.id)
 } catch (err) {
 console.error('[OwnerBot] Callback error:', err)
 try { await bot.answerCallbackQuery(query.id, { text: 'Error' }) } catch {}
 }
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER (buttons)
// ═══════════════════════════════════════════════════════════════════════════

async function onMessage(msg) {
 const chatId = msg.chat.id
 if (!msg.text || msg.text.startsWith('/')) return

 const text = msg.text.trim()

 if (text === 'Dashboard') return sendDashboard(chatId)
 if (text === 'Fleet Status') return sendFleetStatus(chatId)
 if (text === 'P&L Report') return sendPnlSelector(chatId)
 if (text === 'Alerts') return sendAlerts(chatId)
 if (text === 'Drivers') return sendDriverList(chatId)
 if (text === 'AI Insights') return sendAIInsights(chatId)
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

async function sendDashboard(chatId) {
 const today = new Date()
 today.setHours(0, 0, 0, 0)
 const tenantId = await getTenantIdForOwner(chatId)

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

 // Today's financials
 const revenue = todayTrips.reduce((s, t) => s + (t.freightAmount || 0), 0)
 const expenses = todayTrips.reduce((s, t) => s + t.expenses.reduce((se, e) => se + e.amount, 0), 0)
 const tripsWithOldExpenses = todayTrips.reduce((s, t) => s + (t.fuelExpense || 0) + (t.toll || 0) + (t.cashExpense || 0), 0)
 const totalExpenses = expenses > 0 ? expenses : tripsWithOldExpenses
 const profit = revenue - totalExpenses

 // Active trips (logged but not reconciled today)
 const activeTrips = todayTrips.filter(t => t.status === 'logged').length
 const completedTrips = todayTrips.length

 let text = `*Fleet Dashboard* — ${new Date().toLocaleDateString('en-IN')}\n\n`

 text += `*Vehicles:* ${vehicles.length}\n`
 text += `├ Active: ${activeVehicles}\n`
 text += `└ Idle: ${idleVehicles}\n\n`

 text += `*Drivers:* ${drivers.length}\n\n`

 text += `*Today:*\n`
 text += `├ Trips: ${completedTrips} (${activeTrips} active)\n`
 if (revenue > 0) text += `├ Revenue: ₹${revenue.toLocaleString('en-IN')}\n`
 text += `├ Expenses: ₹${totalExpenses.toLocaleString('en-IN')}\n`
 if (revenue > 0) text += `└ Profit: ₹${profit.toLocaleString('en-IN')}\n`
 else text += `└ Profit: Revenue pending reconciliation\n`

 if (unresolvedAlerts > 0) {
 text += `\n *${unresolvedAlerts} unresolved alerts*`
 }

 return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: HOME_KEYBOARD })
}

// ═══════════════════════════════════════════════════════════════════════════
// FLEET STATUS
// ═══════════════════════════════════════════════════════════════════════════

async function sendFleetStatus(chatId) {
 const tenantId = await getTenantIdForOwner(chatId)
 const vehicles = await prisma.vehicle.findMany({
 where: tenantId ? { tenantId } : undefined,
 orderBy: { vehicleNumber: 'asc' },
 include: {
 drivers: { where: { active: true }, select: { id: true, name: true, telegramChatId: true } },
 trips: {
 where: { status: 'logged' },
 orderBy: { createdAt: 'desc' },
 take: 1,
 include: { expenses: true },
 },
 },
 })

 if (vehicles.length === 0) {
 return bot.sendMessage(chatId, 'No vehicles registered yet.', { reply_markup: HOME_KEYBOARD })
 }

 let text = `*Fleet Status — Live*\n\n`
 const buttons = []

 for (const v of vehicles) {
 const driver = v.drivers[0]
 const activeTrip = v.trips[0]

 if (activeTrip) {
 const tripExpenses = activeTrip.expenses.reduce((s, e) => s + e.amount, 0)
 const fallbackExp = (activeTrip.fuelExpense || 0) + (activeTrip.toll || 0) + (activeTrip.cashExpense || 0)
 const exp = tripExpenses > 0 ? tripExpenses : fallbackExp

 text += `*${v.vehicleNumber}*`
 if (driver) text += `— ${driver.name}`
 text += `\n`
 text += ` ${activeTrip.loadingLocation} → ${activeTrip.destination}\n`
 if (exp > 0) text += `₹${exp.toLocaleString('en-IN')}\n`
 text += `\n`
 } else {
 text += `*${v.vehicleNumber}*`
 if (driver) text += `— ${driver.name}`
 text += `— IDLE\n\n`
 }

 buttons.push({ text: v.vehicleNumber, callback_data: `vehicle_detail:${v.id}`})
 }

 // Build rows of 3
 const keyboard = []
 for (let i = 0; i < buttons.length; i += 3) {
 keyboard.push(buttons.slice(i, i + 3))
 }

 return bot.sendMessage(chatId, text, {
 parse_mode: 'Markdown',
 reply_markup: { inline_keyboard: keyboard },
 })
}

async function sendVehicleDetail(chatId, vehicleId) {
 const tenantId = await getTenantIdForOwner(chatId)
 const vehicle = await prisma.vehicle.findFirst({
 where: { id: vehicleId, ...(tenantId && { tenantId }) },
 include: {
 drivers: { where: { active: true }, select: { name: true, phone: true } },
 trips: {
 orderBy: { createdAt: 'desc' },
 take: 10,
 include: { expenses: true },
 },
 documents: { select: { documentType: true, expiryDate: true } },
 },
 })

 if (!vehicle) return bot.sendMessage(chatId, 'Vehicle not found.', { reply_markup: HOME_KEYBOARD })

 const driver = vehicle.drivers[0]
 const now = new Date()
 const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
 const monthTrips = vehicle.trips.filter(t => new Date(t.createdAt) >= monthStart)

 const monthRevenue = monthTrips.reduce((s, t) => s + (t.freightAmount || 0), 0)
 const monthExpenses = monthTrips.reduce((s, t) => s + t.expenses.reduce((se, e) => se + e.amount, 0), 0)
 const fallbackExpenses = monthTrips.reduce((s, t) => s + (t.fuelExpense || 0) + (t.toll || 0) + (t.cashExpense || 0), 0)
 const totalExp = monthExpenses > 0 ? monthExpenses : fallbackExpenses
 const profit = monthRevenue - totalExp

 let text = `*${vehicle.vehicleNumber}*\n\n`
 if (driver) text += `Driver: ${driver.name} ( ${driver.phone})\n`
 text += `Status: ${vehicle.status === 'active' ? 'Active' : 'Idle'}\n\n`

 text += `*This Month:*\n`
 text += `├ Trips: ${monthTrips.length}\n`
 if (monthRevenue > 0) text += `├ Revenue: ₹${monthRevenue.toLocaleString('en-IN')}\n`
 text += `├ Expenses: ₹${totalExp.toLocaleString('en-IN')}\n`
 if (monthRevenue > 0) {
 const margin = monthRevenue > 0 ? Math.round((profit / monthRevenue) * 100) : 0
 text += `└ Profit: ₹${profit.toLocaleString('en-IN')} (${margin}%)\n`
 }

 // Documents
 text += `\n *Documents:*\n`
 for (const doc of vehicle.documents) {
 const exp = new Date(doc.expiryDate)
 const daysLeft = Math.ceil((exp - now) / 86400000)
 const icon = daysLeft < 0 ? '' : daysLeft < 30 ? '' : ''
 text += `${icon} ${doc.documentType}: ${daysLeft < 0 ? 'EXPIRED' : daysLeft < 30 ? `${daysLeft} days left`: `Valid (${exp.toLocaleDateString('en-IN')})`}\n`
 }

 return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: HOME_KEYBOARD })
}

// ═══════════════════════════════════════════════════════════════════════════
// P&L REPORT
// ═══════════════════════════════════════════════════════════════════════════

async function sendPnlSelector(chatId) {
 return bot.sendMessage(chatId, ' *P&L Report*\n\nKaunsa period?', {
 parse_mode: 'Markdown',
 reply_markup: {
 inline_keyboard: [
 [{ text: 'Today', callback_data: 'pnl:today' },
 { text: 'This Week', callback_data: 'pnl:week' },
 { text: 'This Month', callback_data: 'pnl:month' }],
 ],
 },
 })
}

async function sendPnlReport(chatId, period) {
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

 const tenantId = await getTenantIdForOwner(chatId)
 const trips = await prisma.trip.findMany({
 where: { createdAt: { gte: since }, ...(tenantId && { tenantId }) },
 include: {
 expenses: true,
 vehicle: { select: { vehicleNumber: true } },
 },
 })

 const revenue = trips.reduce((s, t) => s + (t.freightAmount || 0), 0)

 // Expenses from TripExpense (new) or from trip fields (legacy)
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

 let text = `*P&L Report — ${label}*\n\n`

 if (revenue > 0) {
 text += `*Revenue:*\n`
 text += `└ Freight: ₹${revenue.toLocaleString('en-IN')} (${trips.length} trips)\n\n`
 } else {
 text += ` ${trips.length} trips logged\n\n`
 }

 text += `*Expenses:*\n`
 if (fuelTotal > 0) text += `├ Diesel: ₹${fuelTotal.toLocaleString('en-IN')} (${totalExpenses > 0 ? Math.round(fuelTotal / totalExpenses * 100) : 0}%)\n`
 if (tollTotal > 0) text += `├ Tolls: ₹${tollTotal.toLocaleString('en-IN')} (${totalExpenses > 0 ? Math.round(tollTotal / totalExpenses * 100) : 0}%)\n`
 if (cashTotal > 0) text += `├ Cash: ₹${cashTotal.toLocaleString('en-IN')} (${totalExpenses > 0 ? Math.round(cashTotal / totalExpenses * 100) : 0}%)\n`
 text += `└ *Total: ₹${totalExpenses.toLocaleString('en-IN')}*\n\n`

 if (revenue > 0) {
 text += `─────────────────\n`
 text += `*Profit: ₹${profit.toLocaleString('en-IN')}*\n`
 const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0
 text += `Margin: ${margin}%\n`
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
 text += `\n *Best:* ${bestVn} — ${bestData.trips} trips`
 if (bestProfit > 0) text += `, ₹${bestProfit.toLocaleString('en-IN')} profit`
 text += `\n`

 if (sorted.length > 1) {
 const [worstVn, worstData] = sorted[sorted.length - 1]
 text += `*Lowest:* ${worstVn} — ${worstData.trips} trips\n`
 }
 }
 }

 return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: HOME_KEYBOARD })
}

// ═══════════════════════════════════════════════════════════════════════════
// ALERTS
// ═══════════════════════════════════════════════════════════════════════════

async function sendAlerts(chatId) {
 const tenantId = await getTenantIdForOwner(chatId)
 const alerts = await prisma.alert.findMany({
 where: { resolved: false, ...(tenantId && { tenantId }) },
 orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
 take: 10,
 include: { vehicle: { select: { vehicleNumber: true } } },
 })

 if (alerts.length === 0) {
 return bot.sendMessage(chatId, ' *No unresolved alerts!*\n\nSab theek chal raha hai.', { parse_mode: 'Markdown', reply_markup: HOME_KEYBOARD })
 }

 let text = `*${alerts.length} Unresolved Alerts*\n\n`

 for (const a of alerts) {
 const icon = a.severity === 'high' ? '' : a.severity === 'medium' ? '' : ''
 text += `${icon} *${a.severity.toUpperCase()}* — ${a.alertType.replace(/_/g, ' ')}\n`
 if (a.vehicle) text += ` ${a.vehicle.vehicleNumber}\n`
 text += `${a.message}\n`
 text += ` ${new Date(a.createdAt).toLocaleDateString('en-IN')}\n\n`
 }

 // Resolve buttons
 const keyboard = alerts.slice(0, 5).map(a => ([{
 text: `Resolve: ${a.vehicle?.vehicleNumber || 'Alert'} — ${a.alertType.replace(/_/g, ' ')}`,
 callback_data: `resolve_alert:${a.id}`,
 }]))

 return bot.sendMessage(chatId, text, {
 parse_mode: 'Markdown',
 reply_markup: { inline_keyboard: keyboard },
 })
}

// ═══════════════════════════════════════════════════════════════════════════
// DRIVERS
// ═══════════════════════════════════════════════════════════════════════════

async function sendDriverList(chatId) {
 const tenantId = await getTenantIdForOwner(chatId)
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
 return bot.sendMessage(chatId,
 `*No drivers registered yet.*\n\nShare this invite code with your drivers:\n \`${code}\`\n\nThey should open @fleetsure\\_driver\\_bot and use /start`,
 { parse_mode: 'Markdown', reply_markup: HOME_KEYBOARD })
 }

 // Get this month's trip counts for ranking
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

 let text = `*Drivers (${drivers.length})*\n\n`

 for (let i = 0; i < driverStats.length; i++) {
 const d = driverStats[i]
 const medal = i === 0 ? '' : i === 1 ? '' : i === 2 ? '' : `#${i + 1}`
 const verified = d.licensePhotoUrl ? '' : ''

 text += `${medal} ${verified} *${d.name}*\n`
 if (d.vehicle) text += ` ${d.vehicle.vehicleNumber}\n`
 text += ` ${d.monthTrips} trips this month (${d._count.trips} total)\n\n`
 }

 const code = process.env.FLEET_INVITE_CODE || 'FLEET-7X2K'
 text += `\n Fleet invite code: \`${code}\`\n`
 text += `Share with new drivers → @fleetsure\\_driver\\_bot`

 // Detail buttons
 const buttons = driverStats.slice(0, 6).map(d => ({
 text: d.name, callback_data: `driver_detail:${d.id}`,
 }))
 const keyboard = []
 for (let i = 0; i < buttons.length; i += 3) {
 keyboard.push(buttons.slice(i, i + 3))
 }

 return bot.sendMessage(chatId, text, {
 parse_mode: 'Markdown',
 reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : HOME_KEYBOARD,
 })
}

async function sendDriverDetail(chatId, driverId) {
 const tenantId = await getTenantIdForOwner(chatId)
 const driver = await prisma.driver.findFirst({
 where: { id: driverId, ...(tenantId && { tenantId }) },
 include: {
 vehicle: { select: { vehicleNumber: true } },
 trips: {
 orderBy: { createdAt: 'desc' },
 take: 5,
 include: { expenses: true, vehicle: { select: { vehicleNumber: true } } },
 },
 _count: { select: { trips: true } },
 },
 })

 if (!driver) return bot.sendMessage(chatId, 'Driver not found.', { reply_markup: HOME_KEYBOARD })

 let text = `*${driver.name}*\n\n`
 text += `Phone: ${driver.phone}\n`
 if (driver.licenseNumber) text += `License: ${driver.licenseNumber}\n`
 if (driver.vehicle) text += `Vehicle: ${driver.vehicle.vehicleNumber}\n`
 text += `Total trips: ${driver._count.trips}\n`
 text += `Status: ${driver.active ? 'Active' : 'Inactive'}\n`

 const verified = driver.licensePhotoUrl && driver.aadhaarPhotoUrl
 text += verified ? `Verified\n`: `Unverified\n`

 if (driver.trips.length > 0) {
 text += `\n *Recent Trips:*\n`
 for (const t of driver.trips) {
 const exp = t.expenses.length > 0
 ? t.expenses.reduce((s, e) => s + e.amount, 0)
 : (t.fuelExpense || 0) + (t.toll || 0) + (t.cashExpense || 0)
 const date = new Date(t.createdAt).toLocaleDateString('en-IN')
 text += `${t.status === 'reconciled' ? '' : ''} ${date} — ${t.vehicle.vehicleNumber}\n`
 text += ` ${t.loadingLocation} → ${t.destination}`
 if (exp > 0) text += `| ₹${exp.toLocaleString('en-IN')}`
 text += `\n`
 }
 }

 return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: HOME_KEYBOARD })
}

// ═══════════════════════════════════════════════════════════════════════════
// AI INSIGHTS
// ═══════════════════════════════════════════════════════════════════════════

async function sendAIInsights(chatId) {
 const waitMsg = await bot.sendMessage(chatId, 'Analyzing your fleet data...')

 try {
 const { generateDailyBrief } = await import('./gemini.js')
 const brief = await generateDailyBrief()

 let text = `*AI Fleet Brief*\n\n`
 for (const insight of (brief.insights || [])) {
 text += `• ${insight}\n\n`
 }
 if (brief.recommendedAction) {
 text += `*Action:* ${brief.recommendedAction}\n`
 }
 text += `\n_Use /ask <question> to ask anything_`

 await bot.editMessageText(text, {
 chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'Markdown',
 })
 } catch (err) {
 console.error('[OwnerBot] Insights error:', err)
 try {
 await bot.editMessageText('Could not generate insights. Try again later.', {
 chat_id: chatId, message_id: waitMsg.message_id,
 })
 } catch {}
 }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS TO OWNER (called from driverBot)
// ═══════════════════════════════════════════════════════════════════════════

export async function sendOwnerNotification(event, payload) {
 if (!bot || !ownerChatId) return

 try {
 let text = ''

 switch (event) {
 case 'trip_start': {
 const { trip, vehicle, driver } = payload
 text = `*Trip Started*\n\n`
 text += ` ${vehicle.vehicleNumber}`
 if (driver) text += `| ${driver.name}`
 text += `\n ${trip.loadingLocation} → ${trip.destination}\n`
 text += ` ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
 break
 }

 case 'trip_complete': {
 const { trip, fuelTotal, tollTotal, cashTotal, grandTotal, hours, mins, fuelLitres, drivingScore } = payload
 text = `*Trip Delivered*\n\n`
 text += ` ${trip.vehicle.vehicleNumber}\n`
 text += ` ${trip.loadingLocation} → ${trip.destination}\n`
 text += ` ${hours}h ${mins}min\n\n`
 text += `Expenses: ₹${grandTotal.toLocaleString('en-IN')}\n`
 if (fuelTotal > 0) text += `├ ₹${fuelTotal.toLocaleString('en-IN')} (${fuelLitres}L)\n`
 if (tollTotal > 0) text += `├ ₹${tollTotal.toLocaleString('en-IN')}\n`
 if (cashTotal > 0) text += `└ ₹${cashTotal.toLocaleString('en-IN')}\n`
 if (drivingScore && drivingScore.totalDistanceKm > 0) {
 const sc = drivingScore
 const emoji = sc.overallScore >= 80 ? '' : sc.overallScore >= 60 ? '' : ''
 text += `\n *Driving Score: ${emoji} ${sc.overallScore}/100*\n`
 text += `├ Speed: ${sc.speedScore} | Braking: ${sc.brakingScore}\n`
 text += `├ Avg: ${Math.round(sc.avgSpeed)} km/h | Max: ${Math.round(sc.maxSpeed)} km/h\n`
 const totalEvents = sc.harshBrakeCount + sc.harshAccelCount + sc.sharpTurnCount
 if (totalEvents > 0) {
 text += `└ ${totalEvents} harsh events (${sc.harshBrakeCount} brakes, ${sc.harshAccelCount} accel, ${sc.sharpTurnCount} turns)\n`
 }
 }
 break
 }

 case 'fuel_anomaly': {
 const { trip, vehicle, driver, fuelLitres, dist, kmPerL } = payload
 text = `*FUEL ALERT*\n\n`
 text += ` ${vehicle.vehicleNumber}`
 if (driver) text += `— ${driver.name}`
 text += `\n ${fuelLitres}L diesel but only ${dist} km driven\n`
 text += `Expected: ~3.5 km/L\nActual: ${kmPerL} km/L \n\n`
 text += `Possible fuel theft or vehicle issue.`
 break
 }

 case 'new_driver': {
 const { driver } = payload
 text = `*New Driver Registered*\n\n`
 text += `Name: ${driver.name}\n`
 text += `Phone: ${driver.phone}\n`
 if (driver.vehicle) text += `Vehicle: ${driver.vehicle.vehicleNumber}\n`
 text += `Via @fleetsure\\_driver\\_bot`
 break
 }

 default:
 return
 }

 if (text) {
 await bot.sendMessage(ownerChatId, text, { parse_mode: 'Markdown' })
 }
 } catch (err) {
 console.error(`[OwnerBot] Push notification failed (${event}):`, err.message)
 }
}

// ═══════════════════════════════════════════════════════════════════════════
// DAILY FLEET SUMMARY (called from cron at 9 PM)
// ═══════════════════════════════════════════════════════════════════════════

export async function sendDailyFleetSummary() {
 if (!bot || !ownerChatId) return

 try {
 const today = new Date()
 today.setHours(0, 0, 0, 0)
 const tenantId = await getTenantIdForOwner(ownerChatId)

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

 let text = `*Daily Fleet Report — ${new Date().toLocaleDateString('en-IN')}*\n\n`
 text += ` ${activeVehicles}/${vehicles.length} vehicles active\n`
 text += ` ${trips.length} trips\n`
 if (revenue > 0) text += `Revenue: ₹${revenue.toLocaleString('en-IN')}\n`
 text += `Expenses: ₹${expenses.toLocaleString('en-IN')}\n`
 if (revenue > 0) {
 text += `Profit: ₹${profit.toLocaleString('en-IN')} (${revenue > 0 ? Math.round((profit / revenue) * 100) : 0}%)\n`
 }
 if (unresolvedAlerts > 0) text += `\n ${unresolvedAlerts} unresolved alerts`
 if (expiringDocs > 0) text += `\n ${expiringDocs} documents expiring this week`

 await bot.sendMessage(ownerChatId, text, { parse_mode: 'Markdown' })
 } catch (err) {
 console.error('[OwnerBot] Daily summary failed:', err)
 }
}

export default { startOwnerBot, getOwnerBot, sendOwnerNotification, sendDailyFleetSummary }
