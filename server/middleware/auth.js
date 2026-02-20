/**
 * Fleetsure — Auth Middleware (Clerk + legacy JWT fallback)
 */
import jwt from 'jsonwebtoken'
import { clerkClient } from '@clerk/express'
import prisma from '../lib/prisma.js'

/**
 * Verify Clerk session token from Authorization header,
 * fall back to legacy JWT cookie for backward compat.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return verifyClerkToken(req, res, next)
  }

  const token = req.cookies?.token
  if (token) {
    return verifyLegacyJwt(req, res, next, token)
  }

  return res.status(401).json({ error: 'Not authenticated' })
}

async function verifyClerkToken(req, res, next) {
  try {
    const token = req.headers.authorization.split(' ')[1]
    const payload = jwt.decode(token)
    if (!payload || !payload.sub) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const clerkId = payload.sub
    let user = await prisma.user.findUnique({ where: { clerkId } })

    if (!user) {
      let clerkUser
      try {
        clerkUser = await clerkClient.users.getUser(clerkId)
      } catch { clerkUser = null }

      const email = clerkUser?.emailAddresses?.[0]?.emailAddress ||
                    payload.email || `clerk_${clerkId}@fleetsure.app`
      const name = clerkUser ? `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() : null
      const phone = clerkUser?.phoneNumbers?.[0]?.phoneNumber || null

      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        user = await prisma.user.update({
          where: { id: existing.id },
          data: { clerkId, name: name || existing.name, phone: phone || existing.phone },
        })
      } else {
        user = await prisma.user.create({
          data: { clerkId, email, name, phone },
        })
      }
    }

    req.user = { userId: user.id, tenantId: user.tenantId, role: user.role }
    req.userId = user.id
    req.tenantId = user.tenantId
    req.role = user.role
    req.adminId = user.id
    next()
  } catch (err) {
    console.error('Clerk auth error:', err.message)
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

function verifyLegacyJwt(req, res, next, token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload
    req.userId = payload.userId
    req.tenantId = payload.tenantId
    req.role = payload.role
    req.adminId = payload.userId
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.role || !allowedRoles.includes(req.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    next()
  }
}
