/**
 * Fleetsure — Settings API Routes
 * ────────────────────────────────
 * GET  /api/settings/profile         → current user profile + tenant info
 * PUT  /api/settings/profile         → update user name
 * PUT  /api/settings/company         → update tenant/company name (owner only)
 * GET  /api/settings/team            → list team members for this tenant
 * POST /api/settings/team/invite     → invite a new user to the tenant (owner only)
 * PUT  /api/settings/team/:id/role   → change a team member's role (owner only)
 * DELETE /api/settings/team/:id      → remove a team member (owner only)
 */
import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// ── GET /api/settings/profile ───────────────────────────────────────────────

router.get('/profile', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, phone: true, name: true, role: true, tenantId: true },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })

    let tenantName = null
    let plan = 'free'
    if (user.tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } })
      tenantName = tenant?.name || null
      plan = tenant?.plan || 'free'
    }

    return res.json({ ...user, tenantName, plan })
  } catch (err) {
    console.error('Settings profile error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── PUT /api/settings/profile ───────────────────────────────────────────────

router.put('/profile', async (req, res) => {
  try {
    const { name } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' })
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name: name.trim() },
      select: { id: true, phone: true, name: true, role: true },
    })

    return res.json(user)
  } catch (err) {
    console.error('Settings update profile error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── PUT /api/settings/company (owner only) ──────────────────────────────────

router.put('/company', requireRole('owner'), async (req, res) => {
  try {
    const { name } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Company name is required' })
    }

    if (!req.tenantId) {
      return res.status(400).json({ error: 'No tenant linked' })
    }

    const tenant = await prisma.tenant.update({
      where: { id: req.tenantId },
      data: { name: name.trim() },
    })

    return res.json({ id: tenant.id, name: tenant.name, plan: tenant.plan })
  } catch (err) {
    console.error('Settings update company error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/settings/team ──────────────────────────────────────────────────

router.get('/team', async (req, res) => {
  try {
    if (!req.tenantId) return res.json([])

    const users = await prisma.user.findMany({
      where: { tenantId: req.tenantId },
      select: { id: true, phone: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    return res.json(users)
  } catch (err) {
    console.error('Settings team error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/settings/team/invite (owner only) ────────────────────────────

router.post('/team/invite', requireRole('owner'), async (req, res) => {
  try {
    const { phone, role } = req.body
    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Valid phone number is required' })
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10)
    const allowedRoles = ['manager', 'viewer']
    const assignRole = allowedRoles.includes(role) ? role : 'viewer'

    // Check if user already exists
    let user = await prisma.user.findUnique({ where: { phone: cleanPhone } })

    if (user) {
      if (user.tenantId === req.tenantId) {
        return res.status(400).json({ error: 'User is already in your team' })
      }
      if (user.tenantId) {
        return res.status(400).json({ error: 'User belongs to another fleet' })
      }
      // User exists but has no tenant — link them
      user = await prisma.user.update({
        where: { id: user.id },
        data: { tenantId: req.tenantId, role: assignRole },
      })
    } else {
      // Create new user linked to this tenant
      user = await prisma.user.create({
        data: { phone: cleanPhone, tenantId: req.tenantId, role: assignRole },
      })
    }

    return res.json({ ok: true, user: { id: user.id, phone: user.phone, role: user.role } })
  } catch (err) {
    console.error('Settings invite error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── PUT /api/settings/team/:id/role (owner only) ───────────────────────────

router.put('/team/:id/role', requireRole('owner'), async (req, res) => {
  try {
    const { role } = req.body
    const allowedRoles = ['manager', 'viewer']
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    // Verify user belongs to this tenant
    const member = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    })
    if (!member) return res.status(404).json({ error: 'User not found' })

    // Can't change own role
    if (member.id === req.userId) {
      return res.status(400).json({ error: 'Cannot change your own role' })
    }

    const updated = await prisma.user.update({
      where: { id: member.id },
      data: { role },
      select: { id: true, phone: true, name: true, role: true },
    })

    return res.json(updated)
  } catch (err) {
    console.error('Settings role update error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── DELETE /api/settings/team/:id (owner only) ─────────────────────────────

router.delete('/team/:id', requireRole('owner'), async (req, res) => {
  try {
    const member = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    })
    if (!member) return res.status(404).json({ error: 'User not found' })

    // Can't remove yourself
    if (member.id === req.userId) {
      return res.status(400).json({ error: 'Cannot remove yourself' })
    }

    // Unlink from tenant (don't delete — they might have Firebase auth)
    await prisma.user.update({
      where: { id: member.id },
      data: { tenantId: null, role: 'owner' },
    })

    return res.json({ ok: true })
  } catch (err) {
    console.error('Settings remove user error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
