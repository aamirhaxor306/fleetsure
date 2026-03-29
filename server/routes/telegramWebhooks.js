import { Router } from 'express'
import { processDriverWebhookUpdate } from '../services/driverBot.js'
import { processOwnerWebhookUpdate } from '../services/ownerBot.js'

const router = Router()

router.post('/driver/:secret', async (req, res) => {
  try {
    const expected = process.env.TELEGRAM_DRIVER_WEBHOOK_SECRET || 'driver'
    if (req.params.secret !== expected) return res.status(403).json({ error: 'Forbidden' })
    await processDriverWebhookUpdate(req.body)
    return res.json({ ok: true })
  } catch (err) {
    console.error('[Telegram Webhook] Driver update error:', err)
    return res.status(500).json({ error: 'Webhook handler failed' })
  }
})

router.post('/owner/:secret', async (req, res) => {
  try {
    const expected = process.env.TELEGRAM_OWNER_WEBHOOK_SECRET || 'owner'
    if (req.params.secret !== expected) return res.status(403).json({ error: 'Forbidden' })
    await processOwnerWebhookUpdate(req.body)
    return res.json({ ok: true })
  } catch (err) {
    console.error('[Telegram Webhook] Owner update error:', err)
    return res.status(500).json({ error: 'Webhook handler failed' })
  }
})

export default router

