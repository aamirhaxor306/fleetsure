/**
 * Fleetsure — Auth Routes (Firebase Phone Auth)
 * ──────────────────────────────────────────────
 * POST /api/auth/firebase-login  → verify Firebase ID token, issue JWT
 * POST /api/auth/onboard         → first-time user sets fleet name + owner name
 * GET  /api/auth/me              → current user + tenant info
 * POST /api/auth/logout          → clear cookie
 */
import { Router } from 'express'
import prisma from '../lib/prisma.js'
import jwt from 'jsonwebtoken'
import admin from 'firebase-admin'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// ── Initialize Firebase Admin ───────────────────────────────────────────────

if (!admin.apps.length) {
  // Use service account if provided, otherwise just project ID for token verification
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
    } catch {
      admin.initializeApp({
        projectId: 'fleetsure-70abb',
      })
    }
  } else {
    admin.initializeApp({
      projectId: 'fleetsure-70abb',
    })
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

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
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

// ── POST /api/auth/firebase-login ───────────────────────────────────────────

router.post('/firebase-login', async (req, res) => {
  try {
    const { firebaseIdToken } = req.body
    if (!firebaseIdToken) {
      return res.status(400).json({ error: 'Firebase ID token is required' })
    }

    // Verify the Firebase ID token
    const decoded = await admin.auth().verifyIdToken(firebaseIdToken)
    const phoneNumber = decoded.phone_number // e.g. "+919876543210"

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number not found in token' })
    }

    // Extract last 10 digits (Indian phone)
    const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10)

    // Find or create user
    let user = await prisma.user.findUnique({ where: { phone: cleanPhone } })

    if (!user) {
      user = await prisma.user.create({
        data: { phone: cleanPhone },
      })
    }

    // If user doesn't have a tenant yet → needs onboarding
    if (!user.tenantId) {
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
    console.error('Firebase login error:', err)
    if (err.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired. Please login again.' })
    }
    return res.status(401).json({ error: 'Invalid Firebase token' })
  }
})

// ── POST /api/auth/onboard ──────────────────────────────────────────────────

router.post('/onboard', requireAuth, async (req, res) => {
  try {
    const { fleetName, ownerName } = req.body
    if (!fleetName || !ownerName) {
      return res.status(400).json({ error: 'Fleet name and owner name are required' })
    }

    const existing = await prisma.user.findUnique({ where: { id: req.userId } })
    if (existing?.tenantId) {
      return res.status(400).json({ error: 'Already onboarded' })
    }

    const tenant = await prisma.tenant.create({
      data: { name: fleetName.trim() },
    })

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { tenantId: tenant.id, name: ownerName.trim(), role: 'owner' },
    })

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
