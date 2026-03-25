/**
 * Platform operators (internal) — not fleet roles (owner/manager/viewer).
 * Comma-separated emails in FLEETSURE_PLATFORM_ADMIN_EMAILS (lowercase match).
 */
import prisma from './prisma.js'

function parseAdminEmailSet() {
  const raw = process.env.FLEETSURE_PLATFORM_ADMIN_EMAILS || ''
  return new Set(
    raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
  )
}

let cachedSet = null
function adminEmailSet() {
  if (!cachedSet) cachedSet = parseAdminEmailSet()
  return cachedSet
}

export function isPlatformAdminEmail(email) {
  if (!email || typeof email !== 'string') return false
  return adminEmailSet().has(email.trim().toLowerCase())
}

/** For tests or reload after env change */
export function _resetPlatformAdminCache() {
  cachedSet = null
}

export async function requirePlatformAdmin(req, res, next) {
  try {
    const row = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true },
    })
    if (!row?.email || !isPlatformAdminEmail(row.email)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    next()
  } catch (err) {
    next(err)
  }
}
