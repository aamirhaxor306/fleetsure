/**
 * Fleetsure — FASTag Routes
 * ─────────────────────────
 * GET /api/fastag/providers — List FASTag bank providers (cached)
 * GET /api/fastag/vehicles — All vehicles with FASTag data
 * POST /api/fastag/link — Link a FASTag to a vehicle
 * DELETE /api/fastag/link/:id — Unlink a FASTag
 * POST /api/fastag/balance — Check live balance for one vehicle
 * POST /api/fastag/balance/all — Bulk refresh all linked vehicles
 * POST /api/fastag/recharge — Recharge a FASTag
 * GET /api/fastag/transactions — Transaction history
 * GET /api/fastag/transactions/:txnId/status — Check txn status
 */

import { Router } from 'express'
import { randomUUID } from 'crypto'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import {
 listFastagProviders,
 verifyFastag,
 listFastagBillers,
 fetchBill,
 payBill,
 checkTxnStatus,
 listTransactions,
 isConfigured,
} from '../services/bulkpe.js'

const router = Router()
router.use(requireAuth)

const LOW_BALANCE_THRESHOLD = 200

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRef() {
 return `FS-${Date.now()}-${randomUUID().slice(0, 8)}`
}

async function createLowBalanceAlert(tenantId, vehicleId, vehicleNumber, balance) {
 const existing = await prisma.alert.findFirst({
 where: {
 tenantId,
 vehicleId,
 alertType: 'fastag_low_balance',
 resolved: false,
 },
 })
 if (existing) return

 await prisma.alert.create({
 data: {
 tenantId,
 vehicleId,
 alertType: 'fastag_low_balance',
 severity: 'high',
 message: `FASTag low balance: ${vehicleNumber} has only ₹${Math.round(balance)}. Recharge immediately to avoid toll issues.`,
 },
 })
}

async function resolveLowBalanceAlerts(tenantId, vehicleId) {
 await prisma.alert.updateMany({
 where: {
 tenantId,
 vehicleId,
 alertType: 'fastag_low_balance',
 resolved: false,
 },
 data: { resolved: true },
 })
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /providers — list FASTag bank providers
// ═══════════════════════════════════════════════════════════════════════════

router.get('/providers', async (req, res) => {
 try {
 if (!isConfigured()) {
 return res.json({ providers: [], configured: false })
 }

 const [fastagProviders, bbpsBillers] = await Promise.allSettled([
 listFastagProviders(),
 listFastagBillers(),
 ])

 const providers = fastagProviders.status === 'fulfilled' ? fastagProviders.value : []
 const billers = bbpsBillers.status === 'fulfilled' ? (bbpsBillers.value?.data || []) : []

 return res.json({ providers, billers, configured: true })
 } catch (err) {
 console.error('[FASTag] providers error:', err.message)
 return res.status(500).json({ error: err.message })
 }
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /vehicles — all vehicles with their FASTag data
// ═══════════════════════════════════════════════════════════════════════════

router.get('/vehicles', async (req, res) => {
 try {
 const vehicles = await prisma.vehicle.findMany({
 where: { tenantId: req.tenantId },
 select: {
 id: true,
 vehicleNumber: true,
 vehicleType: true,
 status: true,
 fastag: {
 select: {
 id: true,
 fastagId: true,
 provider: true,
 providerName: true,
 customerName: true,
 balance: true,
 rechargeLimit: true,
 tagStatus: true,
 vehicleClass: true,
 lastCheckedAt: true,
 },
 },
 },
 orderBy: { vehicleNumber: 'asc' },
 })

 const summary = {
 totalVehicles: vehicles.length,
 linkedVehicles: vehicles.filter(v => v.fastag).length,
 totalBalance: vehicles.reduce((s, v) => s + (v.fastag?.balance || 0), 0),
 lowBalanceCount: vehicles.filter(v => v.fastag && v.fastag.balance < LOW_BALANCE_THRESHOLD).length,
 }

 return res.json({ vehicles, summary, configured: isConfigured() })
 } catch (err) {
 console.error('[FASTag] vehicles error:', err.message)
 return res.status(500).json({ error: err.message })
 }
})

// ═══════════════════════════════════════════════════════════════════════════
// POST /link — link a FASTag to a vehicle
// ═══════════════════════════════════════════════════════════════════════════

router.post('/link', async (req, res) => {
 try {
 const { vehicleId, provider, providerName, fastagId } = req.body
 if (!vehicleId || !provider || !providerName) {
 return res.status(400).json({ error: 'vehicleId, provider, and providerName are required' })
 }

 const vehicle = await prisma.vehicle.findFirst({
 where: { id: vehicleId, tenantId: req.tenantId },
 })
 if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' })

 const existing = await prisma.fasTag.findUnique({
 where: { vehicleId },
 })
 if (existing) {
 return res.status(400).json({ error: 'This vehicle already has a FASTag linked. Unlink first.' })
 }

 const fastag = await prisma.fasTag.create({
 data: {
 tenantId: req.tenantId,
 vehicleId,
 fastagId: fastagId || null,
 provider,
 providerName,
 },
 })

 return res.json(fastag)
 } catch (err) {
 console.error('[FASTag] link error:', err.message)
 return res.status(500).json({ error: err.message })
 }
})

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /link/:id — unlink a FASTag
// ═══════════════════════════════════════════════════════════════════════════

router.delete('/link/:id', async (req, res) => {
 try {
 const fastag = await prisma.fasTag.findFirst({
 where: { id: req.params.id, tenantId: req.tenantId },
 })
 if (!fastag) return res.status(404).json({ error: 'FASTag not found' })

 await prisma.fasTag.delete({ where: { id: req.params.id } })
 await resolveLowBalanceAlerts(req.tenantId, fastag.vehicleId)

 return res.json({ success: true })
 } catch (err) {
 console.error('[FASTag] unlink error:', err.message)
 return res.status(500).json({ error: err.message })
 }
})

// ═══════════════════════════════════════════════════════════════════════════
// POST /balance — check live balance for one vehicle
// ═══════════════════════════════════════════════════════════════════════════

router.post('/balance', async (req, res) => {
 try {
 const { fastagId } = req.body
 if (!fastagId) return res.status(400).json({ error: 'fastagId is required' })

 const fastag = await prisma.fasTag.findFirst({
 where: { id: fastagId, tenantId: req.tenantId },
 include: { vehicle: { select: { vehicleNumber: true } } },
 })
 if (!fastag) return res.status(404).json({ error: 'FASTag not found' })

 if (!isConfigured()) {
 return res.status(400).json({ error: 'BulkPe API key not configured. Add BULKPE_API_KEY to Settings.' })
 }

 const vrn = fastag.vehicle.vehicleNumber.replace(/[-\s]/g, '')
 const ref = makeRef()
 const result = await verifyFastag(vrn, fastag.provider, ref)

 const balanceData = result.data || result
 const balance = Number(balanceData.availableBalance || balanceData.balance || 0)
 const rechargeLimit = Number(balanceData.availableRechargeLimit || balanceData.rechargeLimit || 0)
 const tagStatus = balanceData.tagStatus || balanceData.status || fastag.tagStatus
 const customerName = balanceData.customerName || fastag.customerName
 const vehicleClass = balanceData.vehicleClassDescription || balanceData.vehicleClass || fastag.vehicleClass

 const updated = await prisma.fasTag.update({
 where: { id: fastagId },
 data: {
 balance,
 rechargeLimit,
 tagStatus,
 customerName,
 vehicleClass,
 lastCheckedAt: new Date(),
 },
 })

 if (balance < LOW_BALANCE_THRESHOLD) {
 await createLowBalanceAlert(req.tenantId, fastag.vehicleId, fastag.vehicle.vehicleNumber, balance)
 } else {
 await resolveLowBalanceAlerts(req.tenantId, fastag.vehicleId)
 }

 return res.json(updated)
 } catch (err) {
 console.error('[FASTag] balance check error:', err.message)
 return res.status(500).json({ error: err.message })
 }
})

// ═══════════════════════════════════════════════════════════════════════════
// POST /balance/all — bulk refresh all linked vehicles
// ═══════════════════════════════════════════════════════════════════════════

router.post('/balance/all', async (req, res) => {
 try {
 if (!isConfigured()) {
 return res.status(400).json({ error: 'BulkPe API key not configured' })
 }

 const fastags = await prisma.fasTag.findMany({
 where: { tenantId: req.tenantId },
 include: { vehicle: { select: { vehicleNumber: true } } },
 })

 const results = []
 for (const ft of fastags) {
 try {
 const vrn = ft.vehicle.vehicleNumber.replace(/[-\s]/g, '')
 const ref = makeRef()
 const result = await verifyFastag(vrn, ft.provider, ref)
 const balanceData = result.data || result
 const balance = Number(balanceData.availableBalance || balanceData.balance || 0)

 await prisma.fasTag.update({
 where: { id: ft.id },
 data: {
 balance,
 rechargeLimit: Number(balanceData.availableRechargeLimit || 0),
 tagStatus: balanceData.tagStatus || ft.tagStatus,
 customerName: balanceData.customerName || ft.customerName,
 vehicleClass: balanceData.vehicleClassDescription || ft.vehicleClass,
 lastCheckedAt: new Date(),
 },
 })

 if (balance < LOW_BALANCE_THRESHOLD) {
 await createLowBalanceAlert(req.tenantId, ft.vehicleId, ft.vehicle.vehicleNumber, balance)
 } else {
 await resolveLowBalanceAlerts(req.tenantId, ft.vehicleId)
 }

 results.push({ vehicleNumber: ft.vehicle.vehicleNumber, balance, status: 'ok' })
 } catch (err) {
 results.push({ vehicleNumber: ft.vehicle.vehicleNumber, error: err.message, status: 'error' })
 }
 }

 return res.json({ results, total: fastags.length })
 } catch (err) {
 console.error('[FASTag] bulk balance error:', err.message)
 return res.status(500).json({ error: err.message })
 }
})

// ═══════════════════════════════════════════════════════════════════════════
// POST /recharge — recharge a FASTag
// ═══════════════════════════════════════════════════════════════════════════

router.post('/recharge', async (req, res) => {
 try {
 const { fastagId, amount } = req.body
 if (!fastagId || !amount) return res.status(400).json({ error: 'fastagId and amount are required' })
 if (Number(amount) < 100) return res.status(400).json({ error: 'Minimum recharge amount is ₹100' })

 if (!isConfigured()) {
 return res.status(400).json({ error: 'BulkPe API key not configured' })
 }

 const fastag = await prisma.fasTag.findFirst({
 where: { id: fastagId, tenantId: req.tenantId },
 include: { vehicle: { select: { vehicleNumber: true } } },
 })
 if (!fastag) return res.status(404).json({ error: 'FASTag not found' })

 const fetchRef = makeRef()
 const payRef = makeRef()

 // Step 1: Fetch bill (pre-recharge)
 const vrn = fastag.vehicle.vehicleNumber.replace(/[-\s]/g, '')
 const fetchResult = await fetchBill(
 fastag.provider,
 [{ name: 'Vehicle Number', value: vrn }],
 fetchRef,
 )

 const fetchData = fetchResult.data || fetchResult
 const fetchId = fetchData.fetchId
 if (!fetchId) {
 return res.status(400).json({ error: 'Could not fetch bill for this FASTag. Please check provider settings.' })
 }

 // Step 2: Execute payment
 const payResult = await payBill(fetchId, amount, payRef)
 const payData = payResult.data || payResult

 // Save transaction
 const txn = await prisma.fasTagTransaction.create({
 data: {
 tenantId: req.tenantId,
 fastagId: fastag.id,
 type: 'recharge',
 amount: Number(amount),
 charge: Number(payData.charge || 0),
 gst: Number(payData.gst || 0),
 totalAmount: Number(payData.totalCharge || amount),
 reference: payRef,
 bulkpeTxnId: payData.transactionId || null,
 npciRef: payData.npciRef || null,
 status: payData.status || 'PENDING',
 billerName: payData.billerName || fastag.providerName,
 vehicleNumber: fastag.vehicle.vehicleNumber,
 message: payData.message || null,
 },
 })

 // If successful, refresh balance
 if (payData.status === 'SUCCESS') {
 await prisma.fasTag.update({
 where: { id: fastagId },
 data: {
 balance: { increment: Number(amount) },
 lastCheckedAt: new Date(),
 },
 })
 await resolveLowBalanceAlerts(req.tenantId, fastag.vehicleId)
 }

 return res.json({ transaction: txn, paymentStatus: payData.status })
 } catch (err) {
 console.error('[FASTag] recharge error:', err.message)
 return res.status(500).json({ error: err.message })
 }
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /transactions — transaction history
// ═══════════════════════════════════════════════════════════════════════════

router.get('/transactions', async (req, res) => {
 try {
 const { vehicleId, status, page = 1, limit = 50 } = req.query
 const where = { tenantId: req.tenantId }
 if (status) where.status = status

 if (vehicleId) {
 const fastag = await prisma.fasTag.findUnique({ where: { vehicleId } })
 if (fastag) where.fastagId = fastag.id
 }

 const [transactions, total] = await Promise.all([
 prisma.fasTagTransaction.findMany({
 where,
 orderBy: { createdAt: 'desc' },
 take: Number(limit),
 skip: (Number(page) - 1) * Number(limit),
 }),
 prisma.fasTagTransaction.count({ where }),
 ])

 const totalSpent = await prisma.fasTagTransaction.aggregate({
 where: { tenantId: req.tenantId, status: 'SUCCESS' },
 _sum: { amount: true },
 })

 return res.json({
 transactions,
 total,
 page: Number(page),
 totalSpent: totalSpent._sum.amount || 0,
 })
 } catch (err) {
 console.error('[FASTag] transactions error:', err.message)
 return res.status(500).json({ error: err.message })
 }
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /transactions/:txnId/status — check txn status
// ═══════════════════════════════════════════════════════════════════════════

router.get('/transactions/:txnId/status', async (req, res) => {
 try {
 const txn = await prisma.fasTagTransaction.findFirst({
 where: { id: req.params.txnId, tenantId: req.tenantId },
 })
 if (!txn) return res.status(404).json({ error: 'Transaction not found' })

 if (!txn.bulkpeTxnId || !isConfigured()) {
 return res.json(txn)
 }

 // Check live status from BulkPe
 try {
 const statusResult = await checkTxnStatus(txn.bulkpeTxnId)
 const statusData = statusResult.data || statusResult
 const newStatus = statusData.status || txn.status

 if (newStatus !== txn.status) {
 await prisma.fasTagTransaction.update({
 where: { id: txn.id },
 data: {
 status: newStatus,
 message: statusData.message || txn.message,
 },
 })
 }

 return res.json({ ...txn, status: newStatus, message: statusData.message || txn.message })
 } catch {
 return res.json(txn)
 }
 } catch (err) {
 console.error('[FASTag] txn status error:', err.message)
 return res.status(500).json({ error: err.message })
 }
})

export default router
