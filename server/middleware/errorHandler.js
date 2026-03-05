/**
 * Fleetsure — Global Error Handler
 *
 * Catches all unhandled errors and returns sanitized responses.
 * Full details are logged server-side; clients never see stack traces.
 */
import logger from '../lib/logger.js'

// Known Prisma error codes
const PRISMA_ERRORS = {
    P2002: { status: 409, message: 'A record with this value already exists' },
    P2025: { status: 404, message: 'Record not found' },
    P2003: { status: 400, message: 'Invalid reference — related record not found' },
}

/**
 * Express error-handling middleware (4-arg signature)
 */
export function errorHandler(err, req, res, _next) {
    // ── Prisma errors ──
    if (err.code && PRISMA_ERRORS[err.code]) {
        const mapped = PRISMA_ERRORS[err.code]
        logger.warn({ err, reqId: req.id, url: req.url }, `Prisma error ${err.code}`)
        return res.status(mapped.status).json({ error: mapped.message })
    }

    // ── Zod validation errors ──
    if (err.name === 'ZodError') {
        const messages = err.issues.map(i => `${i.path.join('.')}: ${i.message}`)
        return res.status(400).json({ error: 'Validation failed', details: messages })
    }

    // ── JWT errors ──
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // ── Generic errors ──
    const statusCode = err.statusCode || err.status || 500
    const isProd = process.env.NODE_ENV === 'production'

    logger.error({
        err,
        reqId: req.id,
        method: req.method,
        url: req.url,
        tenantId: req.tenantId,
        userId: req.userId,
    }, `Unhandled error: ${err.message}`)

    return res.status(statusCode).json({
        error: isProd ? 'Internal server error' : err.message,
        ...(isProd ? {} : { stack: err.stack }),
    })
}

/**
 * Async route wrapper — catches promise rejections and forwards to error handler
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next)
    }
}
