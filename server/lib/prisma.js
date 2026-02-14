/**
 * Fleetsure — Singleton PrismaClient
 * ────────────────────────────────────
 * Single shared instance. Import this everywhere instead of `new PrismaClient()`.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default prisma
