import { Router } from 'express'
import multer from 'multer'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import {
 parseSpreadsheetBuffer,
 detectColumnMapping,
 buildPreview,
 allPayloads,
} from '../lib/vehicleSheetImport.js'

const router = Router()
router.use(requireAuth)

const importUpload = multer({
 storage: multer.memoryStorage(),
 limits: { fileSize: 5 * 1024 * 1024 },
 fileFilter: (_req, file, cb) => {
 const ok =
 /\.(xlsx|xls|csv)$/i.test(file.originalname || '') ||
 [
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.ms-excel',
 'text/csv',
 'application/csv',
 'text/plain',
 ].includes(file.mimetype)
 if (ok) cb(null, true)
 else cb(new Error('Upload .xlsx, .xls, or .csv'))
 },
})

const currentYear = () => new Date().getFullYear()

// POST /api/vehicles/import — preview (body field mode=preview) or commit (mode=import)
router.post(
 '/import',
 requireRole('owner', 'manager'),
 importUpload.single('file'),
 async (req, res) => {
 try {
 if (!req.file?.buffer) {
 return res.status(400).json({ error: 'No file uploaded (field name: file)' })
 }
 const mode = String(req.body?.mode || 'preview')
 const parsed = parseSpreadsheetBuffer(req.file.buffer, req.file.originalname)
 if (parsed.error) {
 return res.status(400).json({ error: parsed.error })
 }
 const { headers, rows } = parsed
 const mapping = detectColumnMapping(headers)
 const year = currentYear()

 if (mode === 'preview') {
 const previewResult = buildPreview(headers, rows, mapping, year, 15)
 return res.json({
 mode: 'preview',
 sheetName: parsed.sheetName,
 ...previewResult,
 })
 }

 if (mode !== 'import') {
 return res.status(400).json({ error: 'Invalid mode. Use preview or import.' })
 }

 if (mapping.vehicleNumber < 0) {
 return res.status(400).json({
 error: 'Could not find a vehicle number column. Use a header like "Vehicle Number" or "Registration".',
 })
 }

 const payloads = allPayloads(rows, mapping, year)
 const existing = await prisma.vehicle.findMany({
 where: { tenantId: req.tenantId },
 select: { vehicleNumber: true },
 })
 const inDb = new Set(existing.map((v) => v.vehicleNumber))

 /** @type {object[]} */
 const created = []
 /** @type {object[]} */
 const skipped = []
 /** @type {object[]} */
 const errors = []
 const seenInFile = new Set()

 for (const row of payloads) {
 const { sheetRow, ...data } = row
 if (seenInFile.has(data.vehicleNumber)) {
 skipped.push({
 row: sheetRow,
 vehicleNumber: data.vehicleNumber,
 reason: 'Duplicate in file',
 })
 continue
 }
 seenInFile.add(data.vehicleNumber)

 if (inDb.has(data.vehicleNumber)) {
 skipped.push({
 row: sheetRow,
 vehicleNumber: data.vehicleNumber,
 reason: 'Already in fleet',
 })
 continue
 }

 try {
 const v = await prisma.vehicle.create({
 data: {
 tenantId: req.tenantId,
 vehicleNumber: data.vehicleNumber,
 vehicleType: data.vehicleType,
 purchaseYear: data.purchaseYear,
 approxKm: data.approxKm,
 status: data.status,
 axleConfig: data.axleConfig,
 },
 })
 inDb.add(data.vehicleNumber)
 created.push({ row: sheetRow, id: v.id, vehicleNumber: v.vehicleNumber })
 } catch (err) {
 if (err.code === 'P2002') {
 skipped.push({
 row: sheetRow,
 vehicleNumber: data.vehicleNumber,
 reason: 'Already exists',
 })
 } else {
 errors.push({
 row: sheetRow,
 vehicleNumber: data.vehicleNumber,
 message: err.message || 'Create failed',
 })
 }
 }
 }

 return res.json({
 mode: 'import',
 created: created.length,
 skipped: skipped.length,
 errors: errors.length,
 createdRows: created,
 skippedRows: skipped,
 errorRows: errors,
 })
 } catch (err) {
 console.error('Vehicle import error:', err)
 return res.status(500).json({ error: err.message || 'Import failed' })
 }
 }
)

// GET /api/vehicles — List all vehicles
router.get('/', async (req, res) => {
 try {
 const vehicles = await prisma.vehicle.findMany({
 where: { tenantId: req.tenantId },
 orderBy: { vehicleNumber: 'asc' },
 include: {
 _count: {
 select: { maintenanceLogs: true, documents: true, alerts: { where: { resolved: false } } },
 },
 },
 })
 return res.json(vehicles)
 } catch (err) {
 console.error('List vehicles error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// GET /api/vehicles/:id — Vehicle detail with maintenance + documents
router.get('/:id', async (req, res) => {
 try {
 const vehicle = await prisma.vehicle.findFirst({
 where: { id: req.params.id, tenantId: req.tenantId },
 include: {
 maintenanceLogs: { orderBy: { maintenanceDate: 'desc' }, take: 20 },
 documents: { orderBy: { expiryDate: 'asc' } },
 alerts: { where: { resolved: false }, orderBy: { createdAt: 'desc' } },
 tyres: { orderBy: { position: 'asc' } },
 },
 })
 if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' })
 return res.json(vehicle)
 } catch (err) {
 console.error('Get vehicle error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// POST /api/vehicles — Add vehicle
router.post('/', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const { vehicleNumber, vehicleType, purchaseYear, approxKm, status, axleConfig } = req.body
 if (!vehicleNumber || !vehicleType || !purchaseYear) {
 return res.status(400).json({ error: 'vehicleNumber, vehicleType, purchaseYear are required' })
 }

 const validAxles = ['6W', '10W', '12W', '14W']
 const vehicle = await prisma.vehicle.create({
 data: {
 tenantId: req.tenantId,
 vehicleNumber: vehicleNumber.toUpperCase().replace(/\s+/g, ''),
 vehicleType,
 purchaseYear: parseInt(purchaseYear),
 approxKm: parseInt(approxKm) || 0,
 status: status || 'active',
 axleConfig: validAxles.includes(axleConfig) ? axleConfig : '6W',
 },
 })
 return res.status(201).json(vehicle)
 } catch (err) {
 if (err.code === 'P2002') {
 return res.status(409).json({ error: 'Vehicle number already exists' })
 }
 console.error('Create vehicle error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// PUT /api/vehicles/:id — Edit vehicle
router.put('/:id', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const existing = await prisma.vehicle.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } })
 if (!existing) return res.status(404).json({ error: 'Vehicle not found' })

 const { vehicleNumber, vehicleType, purchaseYear, approxKm, status, axleConfig } = req.body
 const data = {}
 if (vehicleNumber) data.vehicleNumber = vehicleNumber.toUpperCase().replace(/\s+/g, '')
 if (vehicleType) data.vehicleType = vehicleType
 if (purchaseYear) data.purchaseYear = parseInt(purchaseYear)
 if (approxKm !== undefined) data.approxKm = parseInt(approxKm)
 if (status) data.status = status
 const validAxles = ['6W', '10W', '12W', '14W']
 if (axleConfig && validAxles.includes(axleConfig)) data.axleConfig = axleConfig

 const vehicle = await prisma.vehicle.update({
 where: { id: req.params.id },
 data,
 })
 return res.json(vehicle)
 } catch (err) {
 if (err.code === 'P2025') return res.status(404).json({ error: 'Vehicle not found' })
 if (err.code === 'P2002') return res.status(409).json({ error: 'Vehicle number already exists' })
 console.error('Update vehicle error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

// DELETE /api/vehicles/:id — Remove vehicle
router.delete('/:id', requireRole('owner', 'manager'), async (req, res) => {
 try {
 const existing = await prisma.vehicle.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } })
 if (!existing) return res.status(404).json({ error: 'Vehicle not found' })

 await prisma.vehicle.delete({ where: { id: req.params.id } })
 return res.json({ ok: true })
 } catch (err) {
 console.error('Delete vehicle error:', err)
 return res.status(500).json({ error: 'Server error' })
 }
})

export default router
