/**
 * Fleetsure — Auth Middleware
 * ──────────────────────────
 * JWT carries { userId, tenantId, role }.
 * Sets req.user, req.userId, req.tenantId, req.role on every authenticated request.
 */
import jwt from 'jsonwebtoken'

/**
 * Require a valid JWT cookie. Populates req.user / req.userId / req.tenantId / req.role.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.token
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload          // { userId, tenantId, role }
    req.userId = payload.userId
    req.tenantId = payload.tenantId
    req.role = payload.role
    // Legacy compat (some existing code uses req.adminId)
    req.adminId = payload.userId
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

/**
 * Role guard factory. Usage: `requireRole('owner', 'manager')`
 * Must be placed AFTER requireAuth in the chain.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.role || !allowedRoles.includes(req.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    next()
  }
}
