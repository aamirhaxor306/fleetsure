/**
 * Fleetsure — Auth Middleware (Clerk JWKS + legacy JWT fallback)
 *
 * ENTERPRISE: Clerk tokens are now verified using JWKS (JSON Web Key Sets)
 * instead of just decoding. This prevents forged tokens.
 */
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import prisma from '../lib/prisma.js'
import logger from '../lib/logger.js'

// ── JWKS client for Clerk token verification ────────────────────────────
function getClerkIssuer() {
  if (process.env.CLERK_ISSUER_URL) return process.env.CLERK_ISSUER_URL
  const pk = process.env.VITE_CLERK_PUBLISHABLE_KEY
  if (!pk) return null
  try {
    // Clerk pk format: pk_test_<base64-encoded-domain>$  or pk_live_<base64-encoded-domain>$
    const encoded = pk.replace(/^pk_(test|live)_/, '').replace(/\$$/, '')
    const domain = Buffer.from(encoded, 'base64').toString('utf8').replace(/\$$/, '')
    if (domain) return `https://${domain}`
  } catch { }
  return null
}

const clerkIssuer = getClerkIssuer()

let jwks = null
function getJwksClient() {
  if (jwks) return jwks
  if (!clerkIssuer) return null
  jwks = jwksClient({
    jwksUri: `${clerkIssuer}/.well-known/jwks.json`,
    cache: true,
    cacheMaxAge: 600000,  // 10 minutes
    rateLimit: true,
    jwksRequestsPerMinute: 10,
  })
  return jwks
}

function getSigningKey(header, callback) {
  const client = getJwksClient()
  if (!client) {
    return callback(null, null)
  }
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err)
    const signingKey = key.getPublicKey()
    callback(null, signingKey)
  })
}

// ── Main auth middleware ────────────────────────────────────────────────
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

async function fetchClerkUser(clerkId) {
  const secret = process.env.CLERK_SECRET_KEY
  if (!secret) return null
  try {
    const r = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

async function verifyClerkToken(req, res, next) {
  try {
    const token = req.headers.authorization.split(' ')[1]

    // Try JWKS verification first
    let payload
    const client = getJwksClient()
    if (client) {
      payload = await new Promise((resolve, reject) => {
        jwt.verify(token, getSigningKey, {
          algorithms: ['RS256'],
          // Clerk tokens use the Clerk instance URL as issuer
        }, (err, decoded) => {
          if (err) reject(err)
          else resolve(decoded)
        })
      })
    } else {
      // Dev fallback when no JWKS configured — decode only
      logger.warn('JWKS not configured — using jwt.decode (NOT SAFE FOR PRODUCTION)')
      payload = jwt.decode(token)
    }

    if (!payload || !payload.sub) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const clerkId = payload.sub
    let user = await prisma.user.findUnique({ where: { clerkId } })

    if (!user) {
      const clerkUser = await fetchClerkUser(clerkId)

      const email = clerkUser?.email_addresses?.[0]?.email_address ||
        payload.email || `clerk_${clerkId}@fleetsure.app`
      const name = clerkUser ? `${clerkUser.first_name || ''} ${clerkUser.last_name || ''}`.trim() : null
      const phone = clerkUser?.phone_numbers?.[0]?.phone_number || null

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
    logger.warn({ err: err.message }, 'Auth token verification failed')
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
