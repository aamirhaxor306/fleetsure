/**
 * Fleetsure — AI Insights Service
 * ────────────────────────────────
 * Supports Groq (primary, free) and Gemini (fallback).
 * Set GROQ_API_KEY or GEMINI_API_KEY in .env.
 *
 * - collectFleetContext()  — gathers all relevant data from Prisma
 * - generateDailyBrief()  — returns 4-5 bullet insights + 1 action
 * - askQuestion(question)  — answers any fleet question using context
 * - getSuggestedQuestions() — rule-based suggested questions
 */

import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import prisma from '../lib/prisma.js'
import { getRAGContext } from './ragRetriever.js'

// ── In-memory cache for daily brief (6 hour TTL) ────────────────────────────
const cache = new Map()
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() })
}

// ── AI Provider abstraction ──────────────────────────────────────────────────
// Tries Groq first (free, no card), then Gemini as fallback

function getProvider() {
  const groqKey = process.env.GROQ_API_KEY
  if (groqKey) {
    return { type: 'groq', key: groqKey }
  }
  const geminiKey = process.env.GEMINI_API_KEY
  if (geminiKey) {
    return { type: 'gemini', key: geminiKey }
  }
  return null
}

async function callLLM(systemPrompt, userMessage) {
  const provider = getProvider()
  if (!provider) return null

  if (provider.type === 'groq') {
    const groq = new Groq({ apiKey: provider.key })
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 1024,
    })
    return {
      text: completion.choices[0]?.message?.content || '',
      source: 'groq',
    }
  }

  if (provider.type === 'gemini') {
    const genAI = new GoogleGenerativeAI(provider.key)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. Send me the data.' }] },
      ],
    })
    const result = await chat.sendMessage(userMessage)
    return {
      text: result.response.text(),
      source: 'gemini',
    }
  }

  return null
}

// ── SYSTEM PROMPTS ───────────────────────────────────────────────────────────

const SYSTEM_BRIEF = `You are a senior fleet operations analyst with 20+ years of Indian trucking industry experience, working for Fleetsure — an Indian fleet management platform.

You deeply understand Indian commercial vehicle economics, IRDAI insurance regulations, Motor Vehicle Act compliance, regional freight markets, and practical fleet management.

Rules:
- Be concise and direct — fleet owners are busy people running businesses
- Use Indian Rupee (₹) with Indian number formatting (₹1,50,000 not ₹150,000)
- Return exactly 4-5 bullet insights, each 1-2 sentences max
- End with one clear "Recommended Action" that the owner should do TODAY
- Focus on money: where they're losing it, where they can save, what needs attention
- If there are document expiries, always flag them as URGENT — mention ₹ penalty amounts (MV Act 2019: No insurance = ₹2,000-4,000, No FC = ₹5,000, Overloading = ₹20,000+)
- Compare performance: best vs worst vehicles, profitable vs unprofitable routes
- Reference Indian industry benchmarks: healthy margin is 25-35%, fuel should be 35-45% of costs, good utilization is 20-25 trips/month
- If margin is below 25%, flag it and suggest specific actions
- If any vehicle has no trips in 7+ days, flag idle vehicle cost
- Use plain business language an Indian fleet owner would understand
- Do NOT use markdown headers or bold — just plain text with bullet points (•)
- Format your response as:
  • Insight 1
  • Insight 2
  • Insight 3
  • Insight 4
  
  Recommended Action: [what to do today]`

const SYSTEM_CHAT = `You are a senior AI fleet advisor for Fleetsure, an Indian trucking fleet management platform. You have deep expertise in Indian commercial vehicle operations, IRDAI insurance, Motor Vehicle Act 2019, fleet economics, and regional trucking markets.

The fleet owner is asking you questions about their business. Answer using the fleet data provided below, combined with your Indian fleet industry expertise.

Rules:
- Be concise but thorough — answer in 2-5 sentences unless a detailed breakdown is asked
- Use Indian Rupee (₹) with Indian number formatting (₹1,50,000)
- Always ground your answers in the actual data provided
- If you don't have enough data to answer, say so honestly
- Give actionable advice with specific ₹ amounts when relevant
- Use plain language an Indian fleet owner would understand
- Reference Indian industry benchmarks when comparing performance (e.g., "Your 22% margin is below the healthy 25-35% range")
- For insurance questions: always consider NCB impact, IRDAI rules, and fleet discounts
- For compliance questions: cite MV Act 2019 penalty amounts
- For financial questions: factor in GST (5%/12%), TDS (1% on freight), depreciation (30% WDV)
- You can use bullet points (•) for lists
- Do NOT invent fleet-specific data — only use what's provided. But DO apply your Indian trucking expertise.`

// ── DATA COLLECTOR ───────────────────────────────────────────────────────────

export async function collectFleetContext(tenantId) {
  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

  const [
    vehicles,
    allTrips,
    expiringDocs,
    unresolvedAlerts,
    drivers,
    tyresNeedingAttention,
    maintenanceThisMonth,
    maintenanceLastMonth,
  ] = await Promise.all([
    prisma.vehicle.findMany({
      where: { tenantId },
      include: { _count: { select: { trips: true } } },
    }),
    prisma.trip.findMany({
      where: { tenantId },
      include: { vehicle: { select: { vehicleNumber: true } } },
    }),
    prisma.document.findMany({
      where: { tenantId, expiryDate: { lte: thirtyDaysFromNow } },
      include: { vehicle: { select: { vehicleNumber: true } } },
      orderBy: { expiryDate: 'asc' },
    }),
    prisma.alert.findMany({
      where: { tenantId, resolved: false },
      include: { vehicle: { select: { vehicleNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.driver.findMany({
      where: { tenantId, active: true },
      include: { _count: { select: { trips: true } }, vehicle: { select: { vehicleNumber: true } } },
    }),
    prisma.tyre.findMany({
      where: { tenantId, condition: { in: ['warn', 'replace', 'burst'] } },
      include: { vehicle: { select: { vehicleNumber: true } } },
    }),
    prisma.maintenanceLog.findMany({
      where: { tenantId, maintenanceDate: { gte: thisMonthStart } },
    }),
    prisma.maintenanceLog.findMany({
      where: { tenantId, maintenanceDate: { gte: lastMonthStart, lte: lastMonthEnd } },
    }),
  ])

  // ── Fleet P&L ──────────────────────────────────────────────────────────
  const reconciledTrips = allTrips.filter(t => t.status === 'reconciled' && t.freightAmount)
  const pendingTrips = allTrips.filter(t => t.status === 'logged')

  let totalRevenue = 0, totalExpenses = 0
  for (const t of reconciledTrips) {
    totalRevenue += t.freightAmount
    totalExpenses += (t.fuelExpense + t.toll + t.cashExpense)
  }
  const profit = totalRevenue - totalExpenses
  const margin = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : 0

  // ── Per-vehicle profit ─────────────────────────────────────────────────
  const byVehicle = {}
  for (const t of reconciledTrips) {
    const vn = t.vehicle.vehicleNumber
    if (!byVehicle[vn]) byVehicle[vn] = { trips: 0, revenue: 0, expenses: 0 }
    byVehicle[vn].trips++
    byVehicle[vn].revenue += t.freightAmount
    byVehicle[vn].expenses += (t.fuelExpense + t.toll + t.cashExpense)
  }
  const vehicleProfit = Object.entries(byVehicle)
    .map(([vn, d]) => ({
      vehicle: vn,
      trips: d.trips,
      profit: Math.round(d.revenue - d.expenses),
      margin: d.revenue > 0 ? (((d.revenue - d.expenses) / d.revenue) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.profit - a.profit)

  // ── Per-route profit ───────────────────────────────────────────────────
  const byRoute = {}
  for (const t of reconciledTrips) {
    const key = `${shortName(t.loadingLocation)} → ${shortName(t.destination)}`
    if (!byRoute[key]) byRoute[key] = { trips: 0, revenue: 0, expenses: 0 }
    byRoute[key].trips++
    byRoute[key].revenue += t.freightAmount
    byRoute[key].expenses += (t.fuelExpense + t.toll + t.cashExpense)
  }
  const routeProfit = Object.entries(byRoute)
    .map(([route, d]) => ({
      route,
      trips: d.trips,
      avgProfit: Math.round((d.revenue - d.expenses) / d.trips),
      margin: d.revenue > 0 ? (((d.revenue - d.expenses) / d.revenue) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.avgProfit - a.avgProfit)

  // ── Recent trip trends (last 7d vs prev 7d) ───────────────────────────
  const recentTrips = reconciledTrips.filter(t => t.createdAt >= sevenDaysAgo)
  const prevTrips = reconciledTrips.filter(t => t.createdAt >= fourteenDaysAgo && t.createdAt < sevenDaysAgo)

  const recentRevenue = recentTrips.reduce((s, t) => s + t.freightAmount, 0)
  const prevRevenue = prevTrips.reduce((s, t) => s + t.freightAmount, 0)

  // ── Maintenance spend ──────────────────────────────────────────────────
  const maintThisMonth = maintenanceThisMonth.reduce((s, m) => s + m.amount, 0)
  const maintLastMonth = maintenanceLastMonth.reduce((s, m) => s + m.amount, 0)

  // ── Build context string ───────────────────────────────────────────────
  const INR = n => '₹' + Math.round(n).toLocaleString('en-IN')

  let ctx = `FLEET OVERVIEW (as of ${now.toLocaleDateString('en-IN')})\n`
  ctx += `Total vehicles: ${vehicles.length} (${vehicles.filter(v => v.status === 'active').length} active)\n`
  ctx += `Total drivers: ${drivers.length}\n`
  ctx += `Total trips: ${allTrips.length} (${reconciledTrips.length} reconciled, ${pendingTrips.length} pending)\n\n`

  ctx += `FINANCIAL SUMMARY\n`
  ctx += `Revenue: ${INR(totalRevenue)} | Expenses: ${INR(totalExpenses)} | Profit: ${INR(profit)} | Margin: ${margin}%\n\n`

  ctx += `WEEKLY TREND\n`
  ctx += `Last 7 days: ${recentTrips.length} trips, ${INR(recentRevenue)} revenue\n`
  ctx += `Previous 7 days: ${prevTrips.length} trips, ${INR(prevRevenue)} revenue\n\n`

  if (vehicleProfit.length > 0) {
    ctx += `TOP 5 VEHICLES (by profit)\n`
    vehicleProfit.slice(0, 5).forEach(v => {
      ctx += `  ${v.vehicle}: ${INR(v.profit)} profit (${v.trips} trips, ${v.margin}% margin)\n`
    })
    ctx += `BOTTOM 5 VEHICLES (by profit)\n`
    vehicleProfit.slice(-5).reverse().forEach(v => {
      ctx += `  ${v.vehicle}: ${INR(v.profit)} profit (${v.trips} trips, ${v.margin}% margin)\n`
    })
    ctx += '\n'
  }

  if (routeProfit.length > 0) {
    ctx += `TOP 5 ROUTES (by avg profit per trip)\n`
    routeProfit.slice(0, 5).forEach(r => {
      ctx += `  ${r.route}: ${INR(r.avgProfit)}/trip (${r.trips} trips, ${r.margin}% margin)\n`
    })
    const lowRoutes = routeProfit.filter(r => parseFloat(r.margin) < 25)
    if (lowRoutes.length > 0) {
      ctx += `LOW-MARGIN ROUTES (under 25%)\n`
      lowRoutes.forEach(r => {
        ctx += `  ${r.route}: ${r.margin}% margin (${r.trips} trips)\n`
      })
    }
    ctx += '\n'
  }

  if (expiringDocs.length > 0) {
    ctx += `DOCUMENTS EXPIRING (next 30 days)\n`
    expiringDocs.slice(0, 10).forEach(d => {
      const days = Math.ceil((new Date(d.expiryDate) - now) / (1000 * 60 * 60 * 24))
      const status = days <= 0 ? 'EXPIRED' : `${days} days left`
      ctx += `  ${d.vehicle?.vehicleNumber || 'Unknown'}: ${d.documentType} — ${status}\n`
    })
    ctx += '\n'
  }

  if (unresolvedAlerts.length > 0) {
    ctx += `UNRESOLVED ALERTS (${unresolvedAlerts.length})\n`
    unresolvedAlerts.slice(0, 10).forEach(a => {
      ctx += `  [${a.severity.toUpperCase()}] ${a.message}\n`
    })
    ctx += '\n'
  }

  if (tyresNeedingAttention.length > 0) {
    ctx += `TYRES NEEDING ATTENTION (${tyresNeedingAttention.length})\n`
    tyresNeedingAttention.forEach(t => {
      ctx += `  ${t.vehicle?.vehicleNumber || 'Unknown'} pos ${t.position}: ${t.condition} — ${t.brand || ''} ${t.model || ''}\n`
    })
    ctx += '\n'
  }

  ctx += `MAINTENANCE SPEND\n`
  ctx += `This month: ${INR(maintThisMonth)} | Last month: ${INR(maintLastMonth)}\n\n`

  if (pendingTrips.length > 0) {
    ctx += `PENDING RECONCILIATION: ${pendingTrips.length} trips need freight amount from monthly bill\n`
  }

  return {
    text: ctx,
    stats: {
      vehicleCount: vehicles.length,
      activeVehicles: vehicles.filter(v => v.status === 'active').length,
      tripCount: allTrips.length,
      reconciledCount: reconciledTrips.length,
      pendingCount: pendingTrips.length,
      revenue: totalRevenue,
      profit,
      margin: parseFloat(margin),
      expiringDocsCount: expiringDocs.length,
      unresolvedAlertsCount: unresolvedAlerts.length,
      tyresAttentionCount: tyresNeedingAttention.length,
      driverCount: drivers.length,
    },
  }
}

// ── DAILY BRIEF ──────────────────────────────────────────────────────────────

export async function generateDailyBrief(tenantId) {
  // Check cache first (per tenant)
  const cached = getCached(`daily-brief-${tenantId}`)
  if (cached) return cached

  const provider = getProvider()
  const context = await collectFleetContext(tenantId)

  if (!provider) {
    const brief = generateRuleBasedBrief(context.stats)
    const result = { insights: brief, source: 'rules', generatedAt: new Date().toISOString() }
    setCache(`daily-brief-${tenantId}`, result)
    return result
  }

  try {
    // Retrieve relevant fleet knowledge for the daily brief context
    const ragContext = getRAGContext('fleet daily brief insurance compliance maintenance profitability', 3)
    const enrichedContext = context.text + ragContext
    const llmResult = await callLLM(SYSTEM_BRIEF, enrichedContext)
    if (!llmResult) throw new Error('No LLM response')

    const text = llmResult.text

    // Parse into structured format
    const lines = text.split('\n').filter(l => l.trim())
    const insights = []
    let recommendedAction = ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.toLowerCase().startsWith('recommended action:')) {
        recommendedAction = trimmed.replace(/^recommended action:\s*/i, '')
      } else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
        insights.push(trimmed.replace(/^[•\-*]\s*/, ''))
      } else if (insights.length > 0 || trimmed.length > 20) {
        if (!recommendedAction && insights.length > 0) {
          insights.push(trimmed)
        }
      }
    }

    const response = {
      insights: insights.slice(0, 5),
      recommendedAction,
      source: llmResult.source,
      generatedAt: new Date().toISOString(),
    }

    setCache(`daily-brief-${tenantId}`, response)
    return response
  } catch (err) {
    console.error('[AI] Daily brief error:', err.message)
    const brief = generateRuleBasedBrief(context.stats)
    const result = { insights: brief, source: 'rules', generatedAt: new Date().toISOString() }
    setCache(`daily-brief-${tenantId}`, result)
    return result
  }
}

// ── ASK QUESTION ─────────────────────────────────────────────────────────────

export async function askQuestion(question, tenantId) {
  const provider = getProvider()
  if (!provider) {
    return {
      answer: 'AI insights require an API key. Add GROQ_API_KEY (free at console.groq.com) or GEMINI_API_KEY to your .env file.',
      source: 'error',
    }
  }

  const context = await collectFleetContext(tenantId)

  try {
    // Retrieve relevant fleet knowledge for this specific question
    const ragContext = getRAGContext(question, 5)
    const fullPrompt = `${SYSTEM_CHAT}\n\nHere is the current fleet data:\n\n${context.text}${ragContext}`
    const llmResult = await callLLM(fullPrompt, question)
    if (!llmResult) throw new Error('No LLM response')

    return { answer: llmResult.text, source: llmResult.source }
  } catch (err) {
    console.error('[AI] Ask question error:', err.message)
    return {
      answer: `Sorry, I couldn't process your question right now. Error: ${err.message}`,
      source: 'error',
    }
  }
}

// ── SUGGESTED QUESTIONS (rule-based, no LLM call) ───────────────────────────

export async function getSuggestedQuestions(tenantId) {
  const context = await collectFleetContext(tenantId)
  const s = context.stats
  const questions = []

  questions.push('How is my fleet performing this week?')
  questions.push('Which vehicle should I focus on?')

  if (s.pendingCount > 0) {
    questions.push(`I have ${s.pendingCount} unreconciled trips — what should I prioritize?`)
  }

  if (s.expiringDocsCount > 0) {
    questions.push('Which documents are expiring soon?')
  }

  if (s.margin < 30 && s.reconciledCount > 0) {
    questions.push('Which routes are dragging down my margins?')
  }

  if (s.unresolvedAlertsCount > 0) {
    questions.push(`I have ${s.unresolvedAlertsCount} unresolved alerts — what needs urgent attention?`)
  }

  if (s.tyresAttentionCount > 0) {
    questions.push('Which tyres need replacement?')
  }

  if (s.reconciledCount > 10) {
    questions.push('What is my most profitable route?')
    questions.push('Which vehicle earns the least and why?')
  }

  return [...new Set(questions)].slice(0, 6)
}

// ── RULE-BASED FALLBACK BRIEF ────────────────────────────────────────────────

function generateRuleBasedBrief(stats) {
  const s = stats
  const INR = n => '₹' + Math.round(n).toLocaleString('en-IN')
  const insights = []

  if (s.reconciledCount > 0) {
    insights.push(
      `Your fleet of ${s.vehicleCount} vehicles has completed ${s.reconciledCount} reconciled trips with ${INR(s.revenue)} total revenue and ${s.margin}% profit margin.`
    )
  } else {
    insights.push(
      `Your fleet has ${s.vehicleCount} vehicles (${s.activeVehicles} active). No reconciled trips yet — start logging and reconciling trips to see P&L insights.`
    )
  }

  if (s.pendingCount > 0) {
    insights.push(
      `${s.pendingCount} trips are pending reconciliation. Add freight amounts from the monthly bill to unlock accurate profit tracking.`
    )
  }

  if (s.expiringDocsCount > 0) {
    insights.push(
      `${s.expiringDocsCount} document(s) expiring in the next 30 days. Renew them to avoid fines and vehicle downtime.`
    )
  }

  if (s.unresolvedAlertsCount > 0) {
    insights.push(
      `${s.unresolvedAlertsCount} unresolved alert(s) need your attention. Check the Alerts page.`
    )
  }

  if (s.tyresAttentionCount > 0) {
    insights.push(
      `${s.tyresAttentionCount} tyre(s) need inspection or replacement.`
    )
  }

  if (insights.length < 3) {
    insights.push(
      `${s.driverCount} active driver(s) registered. Keep onboarding drivers via Telegram for better trip tracking.`
    )
  }

  return insights.slice(0, 5)
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function shortName(loc) {
  if (!loc) return 'Unknown'
  const parts = loc.split(' - ')
  return parts.length > 1 ? parts.slice(1).join(' - ').trim() : loc
}

export default {
  collectFleetContext,
  generateDailyBrief,
  askQuestion,
  getSuggestedQuestions,
}
