/**
 * Fleetsure — Zod Validation Middleware
 *
 * Usage:
 *   import { validate } from '../middleware/validate.js'
 *   import { createVehicleSchema } from '../middleware/schemas.js'
 *   router.post('/', validate(createVehicleSchema), async (req, res) => { ... })
 *
 * The validated & typed data replaces req.body.
 */

/**
 * Returns Express middleware that validates req.body against the given Zod schema.
 * On success: req.body is replaced with the parsed (and coerced) data.
 * On failure: returns 400 with human-readable error messages.
 */
export function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body)
        if (!result.success) {
            const messages = result.error.issues.map(i => {
                const path = i.path.length ? `${i.path.join('.')}: ` : ''
                return `${path}${i.message}`
            })
            return res.status(400).json({
                error: 'Validation failed',
                details: messages,
            })
        }
        req.body = result.data
        next()
    }
}

/**
 * Validates req.query against a Zod schema.
 */
export function validateQuery(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.query)
        if (!result.success) {
            const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
            return res.status(400).json({ error: 'Invalid query parameters', details: messages })
        }
        req.query = result.data
        next()
    }
}

/**
 * Validates req.params against a Zod schema.
 */
export function validateParams(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.params)
        if (!result.success) {
            const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
            return res.status(400).json({ error: 'Invalid parameters', details: messages })
        }
        req.params = result.data
        next()
    }
}
