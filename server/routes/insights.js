/**
 * Fleetsure — AI Insights API Routes
 * ────────────────────────────────────
 * GET /api/insights/daily — Daily AI brief (cached 6h)
 * POST /api/insights/chat — Ask a question about fleet data
 * GET /api/insights/suggestions — Contextual suggested questions
 * POST /api/insights/agent — AI Agent conversation turn
 * POST /api/insights/agent/confirm — Confirm/reject pending agent action
 */

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
 generateDailyBrief,
 askQuestion,
 getSuggestedQuestions,
} from '../services/gemini.js'
import { runAgentTurn, confirmAction } from '../services/agentLoop.js'

const router = Router()

router.use(requireAuth)

// ── GET /api/insights/daily — Daily AI brief ─────────────────────────────────

router.get('/daily', async (req, res) => {
 try {
 const brief = await generateDailyBrief(req.tenantId)
 return res.json(brief)
 } catch (err) {
 console.error('[Insights] Daily brief error:', err)
 return res.status(500).json({ error: 'Failed to generate daily brief' })
 }
})

// ── POST /api/insights/chat — Ask a question ─────────────────────────────────

router.post('/chat', async (req, res) => {
 try {
 const { question } = req.body
 if (!question || typeof question !== 'string' || question.trim().length < 3) {
 return res.status(400).json({ error: 'Please provide a question (min 3 characters)' })
 }

 const result = await askQuestion(question.trim(), req.tenantId)

 // Also return fresh suggestions after each answer
 const suggestions = await getSuggestedQuestions(req.tenantId)

 return res.json({ ...result, suggestions })
 } catch (err) {
 console.error('[Insights] Chat error:', err)
 return res.status(500).json({ error: 'Failed to process question' })
 }
})

// ── GET /api/insights/suggestions — Suggested questions ──────────────────────

router.get('/suggestions', async (req, res) => {
 try {
 const suggestions = await getSuggestedQuestions(req.tenantId)
 return res.json({ suggestions })
 } catch (err) {
 console.error('[Insights] Suggestions error:', err)
 return res.status(500).json({ error: 'Failed to generate suggestions' })
 }
})

// ── POST /api/insights/agent — Agent conversation turn ──────────────────────

router.post('/agent', async (req, res) => {
 try {
 const { message, conversationId } = req.body
 if (!message || typeof message !== 'string' || message.trim().length < 2) {
 return res.status(400).json({ error: 'Please provide a message (min 2 characters)' })
 }

 const result = await runAgentTurn(message.trim(), conversationId || null, req.tenantId)
 return res.json(result)
 } catch (err) {
 console.error('[Insights] Agent error:', err)
 return res.status(500).json({ error: 'Agent failed: ' + err.message })
 }
})

// ── POST /api/insights/agent/confirm — Confirm/reject pending action ────────

router.post('/agent/confirm', async (req, res) => {
 try {
 const { conversationId, confirmed } = req.body
 if (!conversationId) {
 return res.status(400).json({ error: 'conversationId is required' })
 }

 const result = await confirmAction(conversationId, !!confirmed)
 return res.json(result)
 } catch (err) {
 console.error('[Insights] Agent confirm error:', err)
 return res.status(500).json({ error: 'Confirm failed: ' + err.message })
 }
})

export default router
