/**
 * Fleetsure — Auth Routes (Email OTP via Resend)
 * ──────────────────────────────────────────────
 * POST /api/auth/request-otp   → send 6-digit OTP to email
 * POST /api/auth/verify-otp    → verify OTP, issue JWT
 * POST /api/auth/onboard       → first-time user sets fleet name + owner name
 * GET  /api/auth/me            → current user + tenant info
 * POST /api/auth/logout        → clear cookie
 */
import { Router } from 'express'
import prisma from '../lib/prisma.js'
import jwt from 'jsonwebtoken'
import { Resend } from 'resend'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// ── Initialize Resend (optional — falls back to console OTP if no key) ──────

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// ── helpers ─────────────────────────────────────────────────────────────────

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString()
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
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

// ── POST /api/auth/request-otp ──────────────────────────────────────────────

router.post('/request-otp', async (req, res) => {
  try {
    const { email } = req.body
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' })
    }

    const cleanEmail = email.trim().toLowerCase()
    const otp = generateOtp()
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 mins

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } })

    if (!user) {
      user = await prisma.user.create({
        data: { email: cleanEmail, otpCode: otp, otpExpiresAt },
      })
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode: otp, otpExpiresAt },
      })
    }

    // Send OTP email via Resend
    if (resend) {
      try {
        await resend.emails.send({
          from: 'Fleetsure <onboarding@resend.dev>',
          to: [cleanEmail],
          subject: `${otp} — Your Fleetsure Login Code`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 32px 24px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 48px; height: 48px; background: #2563eb; border-radius: 12px; line-height: 48px; color: white; font-weight: bold; font-size: 20px;">F</div>
              </div>
              <h2 style="margin: 0 0 8px; font-size: 20px; color: #0f172a; text-align: center;">Your Login Code</h2>
              <p style="margin: 0 0 24px; color: #64748b; font-size: 14px; text-align: center;">Enter this code to sign in to Fleetsure</p>
              <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0f172a;">${otp}</span>
              </div>
              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">Code expires in 10 minutes. If you didn't request this, ignore this email.</p>
            </div>
          `,
        })
      } catch (emailErr) {
        console.error('Resend email error:', emailErr)
        // Fall through — OTP is still in DB, log it for dev
        console.log(`[DEV OTP] ${cleanEmail} → ${otp}`)
      }
    } else {
      // No Resend key → log to console (dev mode)
      console.log(`[DEV OTP] ${cleanEmail} → ${otp}`)
    }

    return res.json({ ok: true, message: 'OTP sent to your email' })
  } catch (err) {
    console.error('Request OTP error:', err)
    return res.status(500).json({ error: 'Failed to send OTP' })
  }
})

// ── POST /api/auth/verify-otp ───────────────────────────────────────────────

router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' })
    }

    const cleanEmail = email.trim().toLowerCase()
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } })

    if (!user || !user.otpCode) {
      return res.status(400).json({ error: 'No OTP found. Please request a new one.' })
    }

    if (user.otpCode !== otp) {
      return res.status(400).json({ error: 'Wrong OTP. Please check and try again.' })
    }

    if (user.otpExpiresAt && new Date() > user.otpExpiresAt) {
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' })
    }

    // Clear OTP
    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: null, otpExpiresAt: null },
    })

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
        email: user.email,
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
        email: user.email,
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
      select: { id: true, email: true, phone: true, name: true, role: true, tenantId: true },
    })
    if (!user) return res.status(401).json({ error: 'Not found' })

    let tenantName = null
    if (user.tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } })
      tenantName = tenant?.name || null
    }

    return res.json({
      id: user.id,
      email: user.email,
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
