/**
 * Fleetsure — Rate Limiting
 *
 * Three tiers:
 * - General API:  100 req/min per IP
 * - Auth routes:  10 req/min per IP  (brute-force protection)
 * - Heavy routes: 20 req/min per IP  (OCR, AI, PDF generation)
 */
import rateLimit from 'express-rate-limit'

// ── General API limiter ────────────────────────────────────────────────
export const generalLimiter = rateLimit({
    windowMs: 60 * 1000,       // 1 minute
    max: 100,                   // 100 requests per window
    standardHeaders: true,      // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,       // Disable `X-RateLimit-*` headers
    message: { error: 'Too many requests. Please try again later.' },
})

// ── Auth limiter (stricter) ────────────────────────────────────────────
export const authLimiter = rateLimit({
    windowMs: 60 * 1000,       // 1 minute
    max: 10,                    // 10 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Please wait a minute.' },
})

// ── Heavy endpoint limiter ─────────────────────────────────────────────
export const heavyLimiter = rateLimit({
    windowMs: 60 * 1000,       // 1 minute
    max: 20,                    // 20 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded for this operation. Please wait.' },
})
