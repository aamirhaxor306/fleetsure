/**
 * WhatsApp Webhook & Management Routes
 * ─────────────────────────────────────
 * POST /api/whatsapp/webhook  — Twilio incoming message webhook (public, no auth)
 * GET  /api/whatsapp/status   — Check Twilio connectivity (requires auth)
 * POST /api/whatsapp/send     — Send test message (requires auth)
 */

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { validateTwilioSignature, sendWhatsApp, getTwilioClient } from '../services/twilioClient.js'
import { handleOwnerMessage } from '../services/ownerWhatsApp.js'
import { handleDriverMessage } from '../services/driverWhatsApp.js'
import prisma from '../lib/prisma.js'

const router = Router()

// ── POST /api/whatsapp/webhook — Twilio sends incoming messages here ─────────
// This must be PUBLIC (no auth) — Twilio calls it directly.

router.post('/webhook', async (req, res) => {
  // Validate Twilio signature in production
  if (!validateTwilioSignature(req)) {
    console.warn('[WhatsApp Webhook] Invalid signature')
    return res.status(403).send('Forbidden')
  }

  const from = req.body.From || req.body.from || ''
  const body = (req.body.Body || req.body.body || '').trim()
  const numMedia = parseInt(req.body.NumMedia || '0', 10)
  const mediaUrl = req.body.MediaUrl0 || null
  const mediaType = req.body.MediaContentType0 || null
  const latitude = req.body.Latitude ? parseFloat(req.body.Latitude) : null
  const longitude = req.body.Longitude ? parseFloat(req.body.Longitude) : null

  const phone = from.replace('whatsapp:', '').replace('+', '')

  if (!phone) {
    return res.status(200).send('<Response></Response>')
  }

  console.log(`[WhatsApp] Message from ${phone}: "${body.substring(0, 50)}"`)

  try {
    // Determine if this is an owner or a driver
    const ownerUser = await prisma.user.findFirst({
      where: { whatsappPhone: phone },
    })

    const ctx = { numMedia, mediaUrl, mediaType, latitude, longitude }

    if (ownerUser) {
      await handleOwnerMessage(phone, body, { ...ctx, user: ownerUser })
    } else {
      await handleDriverMessage(phone, body, ctx)
    }
  } catch (err) {
    console.error('[WhatsApp Webhook] Error:', err)
    // Still send 200 so Twilio doesn't retry
  }

  // Twilio expects TwiML response or 200
  res.status(200).send('<Response></Response>')
})

// ── Protected routes (require auth) ──────────────────────────────────────────

router.use(requireAuth)

// ── GET /api/whatsapp/status — Check connectivity ────────────────────────────

router.get('/status', async (req, res) => {
  try {
    const client = getTwilioClient()
    if (!client) {
      return res.json({ active: false, message: 'Twilio client not initialized' })
    }

    const waNumber = process.env.TWILIO_WHATSAPP_NUMBER || ''
    return res.json({
      active: true,
      whatsappNumber: waNumber,
      message: 'WhatsApp integration active',
    })
  } catch (err) {
    console.error('[WhatsApp API] Status error:', err)
    return res.status(500).json({ error: 'Failed to get WhatsApp status' })
  }
})

// ── POST /api/whatsapp/send — Send a test message ────────────────────────────

router.post('/send', async (req, res) => {
  try {
    const { phone, message } = req.body
    if (!phone || !message) {
      return res.status(400).json({ error: 'phone and message are required' })
    }

    const sid = await sendWhatsApp(phone, message)
    if (!sid) {
      return res.status(400).json({ error: 'Failed to send message' })
    }

    return res.json({ ok: true, sid })
  } catch (err) {
    console.error('[WhatsApp API] Send error:', err)
    return res.status(500).json({ error: 'Failed to send message' })
  }
})

// ── POST /api/whatsapp/connect — Save owner's WhatsApp phone ─────────────────

router.post('/connect', async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone) return res.status(400).json({ error: 'phone is required' })

    const clean = phone.replace(/[\s\-+()]/g, '').replace(/^91/, '')
    if (!/^\d{10}$/.test(clean)) {
      return res.status(400).json({ error: 'Invalid phone number (10 digits required)' })
    }

    const fullPhone = `91${clean}`

    await prisma.user.update({
      where: { id: req.user.id },
      data: { whatsappPhone: fullPhone },
    })

    // Send welcome message
    await sendWhatsApp(fullPhone,
      `🏢 *Fleetsure Connected!*\n\n` +
      `Hi ${req.user.name || 'there'}! Your WhatsApp is now linked to Fleetsure.\n\n` +
      `You'll receive:\n` +
      `📦 Trip start/end notifications\n` +
      `📊 Daily fleet summary (9 PM)\n` +
      `🔴 Fuel anomaly alerts\n\n` +
      `Reply *menu* anytime to see options.`
    )

    return res.json({ ok: true, phone: fullPhone })
  } catch (err) {
    console.error('[WhatsApp API] Connect error:', err)
    return res.status(500).json({ error: 'Failed to connect WhatsApp' })
  }
})

// ── POST /api/whatsapp/disconnect — Remove owner's WhatsApp phone ────────────

router.post('/disconnect', async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { whatsappPhone: null },
    })
    return res.json({ ok: true })
  } catch (err) {
    console.error('[WhatsApp API] Disconnect error:', err)
    return res.status(500).json({ error: 'Failed to disconnect' })
  }
})

export default router
