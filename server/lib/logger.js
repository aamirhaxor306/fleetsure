/**
 * Fleetsure — Structured Logger (Pino)
 *
 * Enterprise-grade logging with:
 * - JSON output in production, pretty in dev
 * - Request ID injection
 * - Automatic request/response logging
 */
import pino from 'pino'
import pinoHttp from 'pino-http'
import crypto from 'crypto'

const isDev = process.env.NODE_ENV !== 'production'

// ── Base logger ─────────────────────────────────────────────────────────
export const logger = pino({
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
    ...(isDev && {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
            },
        },
    }),
    // Redact sensitive fields from logs
    redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password', 'req.body.otp'],
        censor: '[REDACTED]',
    },
})

// ── HTTP request logger middleware ──────────────────────────────────────
export const httpLogger = pinoHttp({
    logger,
    genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
    customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error'
        if (res.statusCode >= 400) return 'warn'
        return 'info'
    },
    customSuccessMessage: (req, res) => {
        return `${req.method} ${req.url} ${res.statusCode}`
    },
    customErrorMessage: (req, _res, err) => {
        return `${req.method} ${req.url} ERROR: ${err.message}`
    },
    // Don't log health checks
    autoLogging: {
        ignore: (req) => req.url === '/api/health',
    },
    serializers: {
        req: (req) => ({
            method: req.method,
            url: req.url,
            tenantId: req.raw?.tenantId || undefined,
            userId: req.raw?.userId || undefined,
        }),
        res: (res) => ({
            statusCode: res.statusCode,
        }),
    },
})

export default logger
