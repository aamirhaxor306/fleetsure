/**
 * Fleetsure — Auth Routes (Phone + OTP)
 * ──────────────────────────────────────
 * POST /api/auth/request-otp   → send OTP to phone (console-logged in dev)
 * POST /api/auth/verify-otp    → verify OTP, return JWT
 * POST /api/auth/onboard       → first-time user sets fleet name + owner name
 * GET  /api/auth/me            → current user + tenant info
 * POST /api/auth/logout        → clear cookie
 */
import { Router } from 'express'
import prisma from '../lib/prisma.js'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// ── helpers ──────────────────────────────────────────────────────────────────

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)) // 6 digits
}

function signToken(user) {
  return jwt.sign(
    { userId: user.id, tenantId: user.tenantId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  )
}

function setCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  })
}

// ── POST /api/auth/request-otp ──────────────────────────────────────────────

router.post('/request-otp', async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Valid phone number is required' })
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10) // keep last 10 digits
    const otp = generateOtp()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 min

    // Upsert user — create if first time, update OTP if existing
    await prisma.user.upsert({
      where: { phone: cleanPhone },
      update: { otpCode: otp, otpExpiresAt: expiresAt },
      create: { phone: cleanPhone, otpCode: otp, otpExpiresAt: expiresAt },
    })

    // ── DEV: Console-logged OTP ──
    console.log(`\n📱 OTP for ${cleanPhone}: ${otp}\n`)

    return res.json({ ok: true, message: 'OTP sent' })
  } catch (err) {
    console.error('Request OTP error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/auth/verify-otp ───────────────────────────────────────────────

router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP are required' })
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10)

    const user = await prisma.user.findUnique({ where: { phone: cleanPhone } })
    if (!user) {
      return res.status(401).json({ error: 'Phone not found' })
    }

    if (user.otpCode !== otp) {
      return res.status(401).json({ error: 'Invalid OTP' })
    }

    if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
      return res.status(401).json({ error: 'OTP expired' })
    }

    // Clear OTP after successful verification
    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: null, otpExpiresAt: null },
    })

    // If user doesn't have a tenant yet, mark as needs-onboarding
    if (!user.tenantId) {
      // Issue a temporary token for the onboarding step
      const tempToken = jwt.sign(
        { userId: user.id, tenantId: null, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' },
      )
      setCookie(res, tempToken)
      return res.json({ ok: true, needsOnboarding: true })
    }

    // Existing user with tenant — issue full token
    const token = signToken(user)
    setCookie(res, token)

    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } })

    return res.json({
      ok: true,
      needsOnboarding: false,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenantName: tenant?.name || null,
      },
    })
  } catch (err) {
    console.error('Verify OTP error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/auth/onboard ──────────────────────────────────────────────────

router.post('/onboard', requireAuth, async (req, res) => {
  try {
    const { fleetName, ownerName } = req.body
    if (!fleetName || !ownerName) {
      return res.status(400).json({ error: 'Fleet name and owner name are required' })
    }

    // If user already has a tenant, reject
    const existing = await prisma.user.findUnique({ where: { id: req.userId } })
    if (existing?.tenantId) {
      return res.status(400).json({ error: 'Already onboarded' })
    }

    // Create tenant + link user
    const tenant = await prisma.tenant.create({
      data: { name: fleetName.trim() },
    })

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { tenantId: tenant.id, name: ownerName.trim(), role: 'owner' },
    })

    // Re-issue full token with tenantId
    const token = signToken(user)
    setCookie(res, token)

    return res.json({
      ok: true,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        tenantId: tenant.id,
        tenantName: tenant.name,
      },
    })
  } catch (err) {
    console.error('Onboard error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/auth/me ────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, phone: true, name: true, role: true, tenantId: true },
    })
    if (!user) return res.status(401).json({ error: 'Not found' })

    let tenantName = null
    if (user.tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } })
      tenantName = tenant?.name || null
    }

    return res.json({
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantName,
    })
  } catch (err) {
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/auth/logout ───────────────────────────────────────────────────

router.post('/logout', (req, res) => {
  res.clearCookie('token')
  return res.json({ ok: true })
})

export default router
