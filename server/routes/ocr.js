import express from 'express'
import multer from 'multer'
import sharp from 'sharp'
import Tesseract from 'tesseract.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

const upload = multer({
 storage: multer.memoryStorage(),
 limits: { fileSize: 10 * 1024 * 1024 },
 fileFilter: (req, file, cb) => {
 if (file.mimetype.startsWith('image/')) cb(null, true)
 else cb(new Error('Only image files allowed'), false)
 },
})

router.post(
 '/loading-slip',
 requireAuth,
 upload.single('image'),
 async (req, res) => {
 if (!req.file) {
 return res.status(400).json({ error: 'No image file provided' })
 }

 try {
 const processed = await sharp(req.file.buffer)
 .grayscale()
 .normalize()
 .sharpen({ sigma: 1.5 })
 .resize({ width: 2000, withoutEnlargement: true })
 .jpeg({ quality: 95 })
 .toBuffer()

 const { data } = await Tesseract.recognize(processed, 'eng', {
 logger: () => {},
 })

 const rawLines = data.text.split('\n').map(l => l.trim()).filter(Boolean)
 const fullText = rawLines.join('\n')

 const result = extractFields(rawLines, fullText)
 result.rawLines = rawLines
 result.ocrConfidence = Math.round((data.confidence || 0) / 100 * 1000) / 1000

 res.json(result)
 } catch (err) {
 console.error('[OCR] Error:', err.message)
 res.status(500).json({ error: err.message || 'OCR processing failed' })
 }
 }
)

function extractFields(lines, fullText) {
 const result = {
 vehicleNumber: null,
 loadingSlipNumber: null,
 tripDate: null,
 originPlant: null,
 destinationPlant: null,
 transporterName: null,
 }

 // 1. Loading slip number
 for (const line of lines) {
 const m = line.match(/loading\s*slip\s*no[.\s:]*(.*)/i)
 if (m) {
 let slip = m[1].trim().replace(/[|\\]/g, '/').replace(/\s+/g, '')
 if (slip.length > 5) { result.loadingSlipNumber = slip; break }
 }
 }
 if (!result.loadingSlipNumber) {
 const m = fullText.match(/LPG[/|\\]?\d{3,4}[/|\\]?[A-Z]{2}[/|\\]?\d{5,6}[/|\\]?\d{3,4}/i)
 if (m) result.loadingSlipNumber = m[0].replace(/[|\\]/g, '/').replace(/\s+/g, '')
 }

 // 2. Date
 for (const line of lines) {
 const m = line.match(/^Date[:\s]+(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})\s*$/i)
 if (m) { const d = parseDate(m[1]); if (d) { result.tripDate = d; break } }
 }
 if (!result.tripDate) {
 for (const line of lines) {
 if (/date\s*of\s*unloading|last\s*invoice|STO/i.test(line)) continue
 const m = line.match(/(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})/)
 if (m) { const d = parseDate(m[1]); if (d) { result.tripDate = d; break } }
 }
 }

 // 3. Vehicle number
 for (const line of lines) {
 const m = line.match(/(?:report\s*your\s*)?vehicle\s*no[.\s:]*\s*([A-Z0-9]{6,12})/i)
 if (m) {
 const cleaned = cleanVehicleNumber(m[1])
 if (isValidVehicleNumber(cleaned)) { result.vehicleNumber = cleaned; break }
 }
 }
 if (!result.vehicleNumber) {
 let foundLabel = false
 for (const line of lines) {
 if (/vehicle\s*no/i.test(line)) { foundLabel = true; continue }
 if (foundLabel) {
 const cleaned = cleanVehicleNumber(line.trim())
 if (isValidVehicleNumber(cleaned)) result.vehicleNumber = cleaned
 break
 }
 }
 }
 if (!result.vehicleNumber) {
 for (const line of lines) {
 const matches = line.toUpperCase().match(/\b([A-Z]{2}\d{2}[A-Z]{1,3}\d{3,4})\b/g)
 if (matches) {
 for (const m of matches) {
 if (!['LP', 'ST', 'DU', 'BP'].includes(m.slice(0, 2))) {
 result.vehicleNumber = m; break
 }
 }
 if (result.vehicleNumber) break
 }
 }
 }

 // 4. Issuing plant (origin)
 for (let i = 0; i < lines.length; i++) {
 const m = lines[i].match(/issuing\s*plant[:\s]*(.*)/i)
 if (m) {
 const val = m[1].trim()
 if (val.length > 2) { result.originPlant = cleanPlantName(val); break }
 if (i + 1 < lines.length) { result.originPlant = cleanPlantName(lines[i + 1].trim()); break }
 }
 }

 // 5. Destination
 for (let i = 0; i < lines.length; i++) {
 if (/next\s*loading\s*location/i.test(lines[i])) {
 const destParts = []
 if (i > 0) {
 const prev = lines[i - 1].trim()
 if (!isFieldLabel(prev) && prev.length > 2 && /LPG|DU|plant|terminal|depot/i.test(prev)) {
 destParts.push(prev)
 }
 }
 for (let j = 1; j <= 6 && i + j < lines.length; j++) {
 const next = lines[i + j].trim()
 if (isFieldLabel(next)) break
 if (isValidVehicleNumber(cleanVehicleNumber(next))) break
 if (next.length > 1) destParts.push(next)
 }
 if (destParts.length) result.destinationPlant = cleanPlantName(destParts.join(' '))
 break
 }
 }

 // 6. Transporter name
 for (let i = 0; i < lines.length; i++) {
 if (/name\s*of\s*transporter/i.test(lines[i])) {
 const m = lines[i].match(/name\s*of\s*transporter[:\s]+(.{3,})/i)
 if (m) { result.transporterName = cleanName(m[1].trim()); break }
 for (let k = 1; k <= 3 && i - k >= 0; k++) {
 const prev = lines[i - k].trim()
 if (['-', '–', '—', ''].includes(prev)) continue
 if (isValidVehicleNumber(cleanVehicleNumber(prev))) continue
 if (isFieldLabel(prev)) continue
 if (prev.length > 2) { result.transporterName = cleanName(prev); break }
 }
 break
 }
 }

 return result
}

function cleanVehicleNumber(s) { return s.replace(/[\s\-.]/g, '').toUpperCase() }
function isValidVehicleNumber(s) { return /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{3,4}$/.test(s) }
function cleanPlantName(s) {
 return s.replace(/\(\s*\d+\s*\)/g, '').replace(/\b\d{6}\b/g, '').replace(/C\/[Oo]\s+/g, '')
 .replace(/M\/[Ss]\s+/g, '').replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim()
}
function cleanName(s) { return s.replace(/\(\s*\d+\s*\)/g, '').replace(/\s+/g, ' ').trim() }
function isFieldLabel(line) {
 const lower = line.toLowerCase().trim()
 const labels = ['vehicle no', 'next loading', 'issuing plant', 'name of transporter',
 'date of unloading', 'last invoice', 'remarks', 'loading slip', 'report your', 'driver', 'signature', 'check list']
 return labels.some(l => lower.includes(l))
}
function parseDate(s) {
 const m = s.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/)
 if (!m) return null
 let [, day, month, year] = m.map(Number)
 if (year < 100) year += 2000
 if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2020 && year <= 2030) {
 return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
 }
 return null
}

export default router
