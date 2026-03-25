import { Router } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import prisma from '../lib/prisma.js'

const router = Router()

function setOpsCookie(res, token) {
  res.cookie('opsToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
  })
}

function clearOpsCookie(res) {
  res.clearCookie('opsToken')
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const cleanEmail = String(email).trim().toLowerCase()

    const user = await prisma.opsUser.findUnique({
      where: { email: cleanEmail },
      select: { id: true, email: true, name: true, role: true, isActive: true, passwordHash: true },
    })

    if (!user || !user.isActive) {
      return res.status(403).json({ error: 'Invalid credentials' })
    }

    const ok = await bcrypt.compare(String(password), user.passwordHash)
    if (!ok) {
      return res.status(403).json({ error: 'Invalid credentials' })
    }

    const secret = process.env.OPS_JWT_SECRET || process.env.JWT_SECRET
    if (!secret) {
      return res.status(500).json({ error: 'Ops auth not configured' })
    }

    const token = jwt.sign(
      { opsUserId: user.id, email: user.email, role: user.role, name: user.name },
      secret,
      { expiresIn: '7d' },
    )

    setOpsCookie(res, token)

    return res.json({
      ok: true,
      me: { id: user.id, email: user.email, name: user.name, role: user.role },
    })
  } catch (err) {
    console.error('ops login error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

router.post('/logout', async (req, res) => {
  clearOpsCookie(res)
  return res.json({ ok: true })
})

router.get('/me', async (req, res) => {
  const token = req.cookies?.opsToken
  if (!token) return res.json({ loggedIn: false })

  const secret = process.env.OPS_JWT_SECRET || process.env.JWT_SECRET
  if (!secret) return res.json({ loggedIn: false })

  try {
    const payload = jwt.verify(token, secret)
    return res.json({
      loggedIn: true,
      me: {
        id: payload.opsUserId,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      },
    })
  } catch {
    return res.json({ loggedIn: false })
  }
})

export default router
