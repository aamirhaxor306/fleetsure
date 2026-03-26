import jwt from 'jsonwebtoken'

// Validates `opsToken` (httpOnly cookie) and attaches `req.opsUser`.
export function requireOpsAuth(req, res, next) {
  const token = req.cookies?.opsToken
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const secret = process.env.OPS_JWT_SECRET || process.env.JWT_SECRET
  if (!secret) {
    return res.status(500).json({ error: 'Ops auth not configured' })
  }

  try {
    const payload = jwt.verify(token, secret)
    req.opsUser = {
      opsUserId: payload.opsUserId,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    }
    return next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired ops session' })
  }
}

// Requires ops user to have ADMIN role.
export function requireOpsAdmin(req, res, next) {
  // requireOpsAuth must run before this
  const role = req.opsUser?.role
  if (role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  return next()
}
