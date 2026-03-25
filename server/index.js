import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
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
import ocrRoutes from './routes/ocr.js'
import tyreRoutes from './routes/tyres.js'
import driverRoutes from './routes/drivers.js'
import insightsRoutes from './routes/insights.js'
import fleetHealthRoutes from './routes/fleetHealth.js'
import trackingRoutes from './routes/tracking.js'
import trackingPublicRoutes from './routes/trackingPublic.js'
import insuranceRoutes from './routes/insurance.js'
import settingsRoutes from './routes/settings.js'
import pdfRoutes from './routes/pdfDocuments.js'
import fastagRoutes from './routes/fastag.js'
import fuelRoutes from './routes/fuel.js'
import moneyLostRoutes from './routes/moneyLost.js'
import adminPerformanceRoutes from './routes/adminPerformance.js'
import adminOpsAuthRoutes from './routes/adminOpsAuth.js'
import leadRoutes from './routes/leads.js'
import prisma from './lib/prisma.js'
import logger, { httpLogger } from './lib/logger.js'
import { generalLimiter, authLimiter, heavyLimiter } from './middleware/rateLimiter.js'
import { errorHandler } from './middleware/errorHandler.js'
import { isTelegramPollingEnabled } from './lib/telegramPolling.js'
import { runAlertEngine } from './services/alertEngine.js'
import { startDriverBot, sendMorningBrief, sendEveningSummary, sendWeeklyReport } from './services/driverBot.js'
import { startOwnerBot, sendDailyFleetSummary } from './services/ownerBot.js'

const app = express()
const PORT = process.env.PORT || 4000

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Behind Railway / other reverse proxies (correct client IP for rate limits)
app.set('trust proxy', 1)

// ── Health (before rate limits & heavy middleware — deploy probes must always pass)
app.get('/health', (_req, res) => {
  res.status(200).type('text/plain').send('ok')
})
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: Date.now() })
})

// ── Security & Middleware ───────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: false,  // CSP handled by Vite in dev
  crossOriginEmbedderPolicy: false,
}))
app.use(express.json({ limit: '1mb' }))  // Prevent payload bombs
app.use(express.urlencoded({ extended: false, limit: '1mb' }))
app.use(cookieParser())
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  credentials: true,
}))
app.use(httpLogger)           // Structured request logging
app.use(generalLimiter)       // 100 req/min per IP

// ── Static uploads ──────────────────────────────────────────────────────────

app.use('/uploads', express.static(join(__dirname, '..', 'uploads')))

// ── Public API (no auth) ─────────────────────────────────────────────────────

app.use('/api/leads', leadRoutes)

// ── Public tracking API (token-auth, no login needed) ───────────────────────

app.use('/api/t', trackingPublicRoutes)

// ── Serve public/ for Landing Page ──────────────────────────────────────────

// Marketing landing: single source at repo root public/landing.html (not client/public — avoids drift)
app.use(express.static(join(__dirname, '..', 'public')))

// ── API Routes ─────────────────────────────────────────────────────────────

app.use('/api/auth', authLimiter, authRoutes)  // Stricter: 10 req/min
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
app.use('/api/ocr', heavyLimiter, ocrRoutes)       // Heavy: 20 req/min
app.use('/api/tyres', tyreRoutes)
app.use('/api/drivers', driverRoutes)
app.use('/api/insights', heavyLimiter, insightsRoutes) // Heavy: 20 req/min
app.use('/api/fleet-health', fleetHealthRoutes)
app.use('/api/tracking', trackingRoutes)
app.use('/api/insurance', insuranceRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/pdf', pdfRoutes)
app.use('/api/fastag', fastagRoutes)
app.use('/api/fuel', fuelRoutes)
app.use('/api/money-lost', moneyLostRoutes)
app.use('/api/admin/ops', authLimiter, adminOpsAuthRoutes)

app.use('/api/admin/performance', heavyLimiter, adminPerformanceRoutes)

// ── Global error handler (MUST be after all routes) ────────────────────────

app.use(errorHandler)

// ── Serve client build in production ───────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  const clientDist = join(__dirname, '..', 'client', 'dist')
  const publicDir = join(__dirname, '..', 'public')

  // Landing page at root for visitors
  app.get('/', (_req, res) => {
    res.sendFile(join(publicDir, 'landing.html'))
  })

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

// ── Telegram: Driver morning brief (7 AM IST = 01:30 UTC) ───────────────────

cron.schedule('30 1 * * *', async () => {
  console.log('[CRON] Sending driver morning briefs...')
  try {
    await sendMorningBrief()
    console.log('[CRON] Morning briefs sent')
  } catch (err) {
    console.error('[CRON] Morning brief error:', err)
  }
})

// ── Telegram: Driver evening summary (8 PM IST = 14:30 UTC) ─────────────────

cron.schedule('30 14 * * *', async () => {
  console.log('[CRON] Sending driver evening summaries...')
  try {
    await sendEveningSummary()
    console.log('[CRON] Evening summaries sent')
  } catch (err) {
    console.error('[CRON] Evening summary error:', err)
  }
})

// ── Telegram: Owner daily fleet summary (9 PM IST = 15:30 UTC) ──────────────

cron.schedule('30 15 * * *', async () => {
  console.log('[CRON] Sending owner daily fleet summary...')
  try {
    await sendDailyFleetSummary()
    console.log('[CRON] Owner daily summary sent')
  } catch (err) {
    console.error('[CRON] Owner daily summary error:', err)
  }
})

// ── Telegram: Driver weekly report (Monday 9 AM IST = 03:30 UTC) ────────────

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

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Fleetsure server listening')

  // Never throw from listen callback — unhandled rejections can kill the process during deploy healthchecks
  void (async () => {
    try {
      if (isTelegramPollingEnabled()) {
        await startDriverBot()
        await startOwnerBot()
      } else {
        logger.info(
          'Telegram polling off (not production or TELEGRAM_POLLING=false). ' +
          'Set TELEGRAM_POLLING=true locally to test bots without Railway running.'
        )
      }
    } catch (err) {
      logger.error({ err }, 'Telegram bot startup failed — server continues')
    }
  })()
})
