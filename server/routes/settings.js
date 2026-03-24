/**
 * Fleetsure — Settings API Routes
 * ────────────────────────────────
 * GET /api/settings/profile → current user profile + tenant info
 * PUT /api/settings/profile → update user name
 * PUT /api/settings/company → update tenant/company name (owner only)
 * GET /api/settings/team → list team members for this tenant
 * POST /api/settings/team/invite → invite a new user to the tenant (owner only)
 * PUT /api/settings/team/:id/role → change a team member's role (owner only)
 * DELETE /api/settings/team/:id → remove a team member (owner only)
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
 select: { id: true, email: true, phone: true, name: true, role: true, tenantId: true, whatsappPhone: true },
 })
 if (!user) return res.status(404).json({ error: 'User not found' })

 let tenantName = null
 let plan = 'free'
 let tenantAddress = null
 let tenantCity = null
 let tenantGstin = null
 let tenantPhone = null
 if (user.tenantId) {
 const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } })
 tenantName = tenant?.name || null
 plan = tenant?.plan || 'free'
 tenantAddress = tenant?.address || null
 tenantCity = tenant?.city || null
 tenantGstin = tenant?.gstin || null
 tenantPhone = tenant?.phone || null
 }

 return res.json({ ...user, tenantName, plan, tenantAddress, tenantCity, tenantGstin, tenantPhone })
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
 select: { id: true, email: true, phone: true, name: true, role: true },
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
 const { name, address, city, gstin, phone } = req.body
 if (!name || !name.trim()) {
 return res.status(400).json({ error: 'Company name is required' })
 }

 if (!req.tenantId) {
 return res.status(400).json({ error: 'No tenant linked' })
 }

 const data = { name: name.trim() }
 if (address !== undefined) data.address = address?.trim() || null
 if (city !== undefined) data.city = city?.trim() || null
 if (gstin !== undefined) data.gstin = gstin?.trim() || null
 if (phone !== undefined) data.phone = phone?.trim() || null

 const tenant = await prisma.tenant.update({
 where: { id: req.tenantId },
 data,
 })

 return res.json({ id: tenant.id, name: tenant.name, plan: tenant.plan, address: tenant.address, city: tenant.city, gstin: tenant.gstin, phone: tenant.phone })
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
 select: { id: true, email: true, phone: true, name: true, role: true, createdAt: true },
 orderBy: { createdAt: 'asc' },
 })

 return res.json(users)
 } catch (err) {
 console.error('Settings team error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// ── POST /api/settings/team/invite (owner only) ────────────────────────────

async function sendClerkInvitation(email, tenantName, role) {
 const CLERK_SECRET = process.env.CLERK_SECRET_KEY
 if (!CLERK_SECRET) return { sent: false, reason: 'Clerk not configured' }

 try {
 const res = await fetch('https://api.clerk.com/v1/invitations', {
 method: 'POST',
 headers: {
 Authorization: `Bearer ${CLERK_SECRET}`,
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 email_address: email,
 public_metadata: { role, tenantName },
 redirect_url: process.env.APP_URL || undefined,
 notify: true,
 }),
 })

 const data = await res.json()
 if (!res.ok) {
 const msg = data?.errors?.[0]?.long_message || data?.errors?.[0]?.message || 'Clerk invitation failed'
 return { sent: false, reason: msg }
 }
 return { sent: true, invitationId: data.id }
 } catch (err) {
 return { sent: false, reason: err.message }
 }
}

router.post('/team/invite', requireRole('owner'), async (req, res) => {
 try {
 const { email, role } = req.body
 if (!email || !email.includes('@')) {
 return res.status(400).json({ error: 'Valid email is required' })
 }

 const cleanEmail = email.trim().toLowerCase()
 const allowedRoles = ['manager', 'viewer']
 const assignRole = allowedRoles.includes(role) ? role : 'viewer'

 let user = await prisma.user.findUnique({ where: { email: cleanEmail } })

 if (user) {
 if (user.tenantId === req.tenantId) {
 return res.status(400).json({ error: 'User is already in your team' })
 }
 if (user.tenantId) {
 return res.status(400).json({ error: 'User belongs to another fleet' })
 }
 user = await prisma.user.update({
 where: { id: user.id },
 data: { tenantId: req.tenantId, role: assignRole },
 })
 } else {
 user = await prisma.user.create({
 data: { email: cleanEmail, tenantId: req.tenantId, role: assignRole },
 })
 }

 const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { name: true } })
 const clerkResult = await sendClerkInvitation(cleanEmail, tenant?.name || 'Fleet', assignRole)

 return res.json({
 ok: true,
 user: { id: user.id, email: user.email, role: user.role },
 emailSent: clerkResult.sent,
 emailNote: clerkResult.sent
 ? `Invitation email sent to ${cleanEmail}`
 : `User added but email not sent: ${clerkResult.reason}. Share the login link manually.`,
 })
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
 select: { id: true, email: true, phone: true, name: true, role: true },
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
