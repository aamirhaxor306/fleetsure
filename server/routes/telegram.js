/**
 * Telegram Bot Management Routes
 * ───────────────────────────────
 * API endpoints to check bot status and send test messages.
 */

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getDriverBot } from '../services/driverBot.js'
import { getOwnerBot } from '../services/ownerBot.js'

const router = Router()
router.use(requireAuth)

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
