import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { generateWeeklySummary } from '../services/weeklySummary.js'

const router = Router()

router.use(requireAuth)

// GET /api/summary/weekly — Plain-text weekly summary
router.get('/weekly', async (req, res) => {
 try {
 const tenantId = req.tenantId || null
 const summary = await generateWeeklySummary(tenantId)
 return res.json(summary)
 } catch (err) {
 console.error('Weekly summary error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

export default router
