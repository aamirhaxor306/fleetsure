import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import cron from 'node-cron'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

dotenv.config()

import authRoutes from './routes/auth.js'
import vehicleRoutes from './routes/vehicles.js'
import maintenanceRoutes from './routes/maintenance.js'
import documentRoutes from './routes/documents.js'
import alertRoutes from './routes/alerts.js'
import summaryRoutes from './routes/summary.js'
import rcLookupRoutes from './routes/rcLookup.js'
import tripRoutes from './routes/trips.js'
import savedRouteRoutes from './routes/savedRoutes.js'
import renewalRoutes from './routes/renewals.js'
import renewalPartnerRoutes from './routes/renewalPartners.js'
import monthlyBillRoutes from './routes/monthlyBills.js'
import revenueRoutes from './routes/revenue.js'
import ocrRoutes from './routes/ocr.js'
import tyreRoutes from './routes/tyres.js'
import driverRoutes from './routes/drivers.js'
import telegramRoutes from './routes/telegram.js'
import insightsRoutes from './routes/insights.js'
import fleetHealthRoutes from './routes/fleetHealth.js'
import trackingRoutes from './routes/tracking.js'
import insuranceRoutes from './routes/insurance.js'
import settingsRoutes from './routes/settings.js'
import pdfRoutes from './routes/pdfDocuments.js'
import fastagRoutes from './routes/fastag.js'
import leadRoutes from './routes/leads.js'
import prisma from './lib/prisma.js'
import { runAlertEngine } from './services/alertEngine.js'
import { startDriverBot, sendMorningBrief, sendEveningSummary, sendWeeklyReport } from './services/driverBot.js'
import { startOwnerBot, sendDailyFleetSummary } from './services/ownerBot.js'

const app = express()
const PORT = process.env.PORT || 4000

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ── Middleware ──────────────────────────────────────────────────────────────

app.use(express.json())
app.use(cookieParser())
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  credentials: true,
}))

// ── Static uploads ──────────────────────────────────────────────────────────

app.use('/uploads', express.static(join(__dirname, '..', 'uploads')))

// ── Health check (for Railway) ────────────────────────────────────────────────

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }))

// ── Public API (no auth) ─────────────────────────────────────────────────────

app.use('/api/leads', leadRoutes)

// ── Serve public/ for Telegram Mini App & Landing Page ──────────────────────

app.use(express.static(join(__dirname, '..', 'public')))

// ── API Routes ─────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes)
app.use('/api/vehicles', vehicleRoutes)
app.use('/api/maintenance', maintenanceRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/alerts', alertRoutes)
app.use('/api/summary', summaryRoutes)
app.use('/api/vehicles', rcLookupRoutes)
app.use('/api/trips', tripRoutes)
app.use('/api/saved-routes', savedRouteRoutes)
app.use('/api/renewals', renewalRoutes)
app.use('/api/renewal-partners', renewalPartnerRoutes)
app.use('/api/monthly-bills', monthlyBillRoutes)
app.use('/api/revenue', revenueRoutes)
app.use('/api/ocr', ocrRoutes)
app.use('/api/tyres', tyreRoutes)
app.use('/api/drivers', driverRoutes)
app.use('/api/telegram', telegramRoutes)
app.use('/api/insights', insightsRoutes)
app.use('/api/fleet-health', fleetHealthRoutes)
app.use('/api/tracking', trackingRoutes)
app.use('/api/insurance', insuranceRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/pdf', pdfRoutes)
app.use('/api/fastag', fastagRoutes)

// ── Serve client build in production ───────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  const clientDist = join(__dirname, '..', 'client', 'dist')
  app.use(express.static(clientDist))
  app.get('*', (req, res) => {
    res.sendFile(join(clientDist, 'index.html'))
  })
}

// ── Helper: run a function for every tenant ───────────────────────────────

async function forEachTenant(fn) {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } })
  for (const t of tenants) {
    try {
      await fn(t.id, t.name)
    } catch (err) {
      console.error(`[CRON] Error for tenant ${t.name}:`, err.message)
    }
  }
}

// ── Daily alert engine cron (runs at 6 AM IST = 00:30 UTC) ────────────────

cron.schedule('30 0 * * *', async () => {
  console.log('[CRON] Running daily alert engine...')
  await forEachTenant(async (tenantId, name) => {
    const result = await runAlertEngine(tenantId)
    console.log(`[CRON] Alert engine for ${name}: ${result.created} alerts created`)
  })
})

// ── Driver Bot: Morning brief (7 AM IST = 01:30 UTC) ───────────────────────

cron.schedule('30 1 * * *', async () => {
  console.log('[CRON] Sending driver morning briefs...')
  try {
    await sendMorningBrief()
    console.log('[CRON] Morning briefs sent')
  } catch (err) {
    console.error('[CRON] Morning brief error:', err)
  }
})

// ── Driver Bot: Evening summary (8 PM IST = 14:30 UTC) ─────────────────────

cron.schedule('30 14 * * *', async () => {
  console.log('[CRON] Sending driver evening summaries...')
  try {
    await sendEveningSummary()
    console.log('[CRON] Evening summaries sent')
  } catch (err) {
    console.error('[CRON] Evening summary error:', err)
  }
})

// ── Owner Bot: Daily fleet summary (9 PM IST = 15:30 UTC) ──────────────────

cron.schedule('30 15 * * *', async () => {
  console.log('[CRON] Sending owner daily fleet summary...')
  try {
    await sendDailyFleetSummary()
    console.log('[CRON] Owner daily summary sent')
  } catch (err) {
    console.error('[CRON] Owner daily summary error:', err)
  }
})

// ── Driver Bot: Weekly report (Monday 9 AM IST = 03:30 UTC) ────────────────

cron.schedule('30 3 * * 1', async () => {
  console.log('[CRON] Sending driver weekly reports...')
  try {
    await sendWeeklyReport()
    console.log('[CRON] Weekly reports sent')
  } catch (err) {
    console.error('[CRON] Weekly report error:', err)
  }
})

// ── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log(`Fleetsure server running on http://localhost:${PORT}`)

  // Start both Telegram bots (non-blocking)
  startDriverBot().catch(err => {
    console.error('[DriverBot] Startup failed:', err.message)
  })
  startOwnerBot().catch(err => {
    console.error('[OwnerBot] Startup failed:', err.message)
  })
})
