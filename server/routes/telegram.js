/**
 * Telegram Bot Management Routes
 * ───────────────────────────────
 * API endpoints to check bot status and send test messages.
 */

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getDriverBot } from '../services/driverBot.js'
import { getOwnerBot } from '../services/ownerBot.js'
import prisma from '../lib/prisma.js'

const router = Router()
router.use(requireAuth)

function generateTelegramLinkCode() {
 // 8 chars, uppercase, no confusing chars
 const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
 let s = ''
 for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
 return s
}

// ── GET /api/telegram/status — Bot status ─────────────────────────────────

router.get('/status', async (req, res) => {
 try {
 const driverBot = getDriverBot()
 const ownerBot = getOwnerBot()

 const result = { driverBot: { active: false }, ownerBot: { active: false } }

 if (driverBot) {
 const me = await driverBot.getMe()
 result.driverBot = { active: true, username: me.username, botLink: `https://t.me/${me.username}` }
 }
 if (ownerBot) {
 const me = await ownerBot.getMe()
 result.ownerBot = { active: true, username: me.username, botLink: `https://t.me/${me.username}` }
 }

 return res.json(result)
 } catch (err) {
 console.error('[Telegram API] Status error:', err)
 return res.status(500).json({ error: 'Failed to get bot status' })
 }
})

// ── POST /api/telegram/link-code — Generate one-time code to link Telegram ──

router.post('/link-code', async (req, res) => {
 try {
 if (!req.userId) return res.status(401).json({ error: 'Not authenticated' })
 if (!req.tenantId) return res.status(400).json({ error: 'No tenant linked' })

 // Invalidate any existing unexpired unused codes for this user (keeps UX clean)
 await prisma.telegramLinkCode.updateMany({
 where: {
 userId: req.userId,
 usedAt: null,
 expiresAt: { gt: new Date() },
 },
 data: { expiresAt: new Date() },
 })

 const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

 let created = null
 for (let attempt = 0; attempt < 10; attempt++) {
 const code = generateTelegramLinkCode()
 try {
 created = await prisma.telegramLinkCode.create({
 data: { code, userId: req.userId, tenantId: req.tenantId, expiresAt },
 })
 break
 } catch (err) {
 // Rare unique collision
 if (String(err?.code) === 'P2002') continue
 throw err
 }
 }

 if (!created) return res.status(500).json({ error: 'Failed to generate code' })

 return res.json({
 ok: true,
 code: created.code,
 expiresAt: created.expiresAt,
 instructions: 'Open @fleetsure_manager_bot in Telegram and send: /link <code>',
 })
 } catch (err) {
 console.error('[Telegram API] Link-code error:', err)
 return res.status(500).json({ error: 'Failed to generate link code' })
 }
})

// ── POST /api/telegram/send — Send a message via owner bot ────────────────

router.post('/send', async (req, res) => {
 try {
 const bot = getOwnerBot() || getDriverBot()
 if (!bot) {
 return res.status(400).json({ error: 'No bot running' })
 }

 const { chatId, message } = req.body
 if (!chatId || !message) {
 return res.status(400).json({ error: 'chatId and message are required' })
 }

 await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
 return res.json({ ok: true })
 } catch (err) {
 console.error('[Telegram API] Send error:', err)
 return res.status(500).json({ error: 'Failed to send message' })
 }
})

export default router
