import * as XLSX from 'xlsx'

const VALID_AXLES = new Set(['6W', '10W', '12W', '14W'])
const VALID_STATUS = new Set(['active', 'idle'])

/** @type {Record<string, string[]>} */
const FIELD_ALIASES = {
  vehicleNumber: [
    'vehicle number',
    'vehicle no',
    'registration',
    'registration no',
    'registration number',
    'reg no',
    'reg number',
    'reg.',
    'regn no',
    'rc number',
    'rc no',
    'truck no',
    'truck number',
    'number plate',
    'plate',
  ],
  vehicleType: ['vehicle type', 'type', 'body type', 'category', 'vehicle category'],
  purchaseYear: ['purchase year', 'year', 'yom', 'year of manufacture', 'mfg year', 'model year'],
  approxKm: ['approx km', 'km', 'odometer', 'reading', 'current km', 'kms', 'kilometers'],
  axleConfig: ['axle', 'axle config', 'wheels', 'tyre config', 'wheeler', 'size'],
  status: ['status', 'state'],
}

export function normHeader(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[_]+/g, ' ')
}

/**
 * Parse .xlsx / .xls / .csv buffer → header row + data rows (arrays)
 */
export function parseSpreadsheetBuffer(buffer, originalName = '') {
  const name = (originalName || '').toLowerCase()
  const isCsv = name.endsWith('.csv')
  const wb = XLSX.read(buffer, {
    type: 'buffer',
    raw: false,
    codepage: isCsv ? 65001 : undefined,
  })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    return { headers: [], rows: [], error: 'Workbook has no sheets' }
  }
  const sheet = wb.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false })
  if (!matrix.length) {
    return { headers: [], rows: [], error: 'Sheet is empty' }
  }
  const headers = (matrix[0] || []).map((c) => normHeader(c))
  const rows = matrix.slice(1).filter((r) => Array.isArray(r) && r.some((c) => String(c).trim() !== ''))
  return { headers, rows, sheetName }
}

function headerMatchesField(headerNorm, field) {
  const aliases = FIELD_ALIASES[field] || []
  for (const a of aliases) {
    if (headerNorm === a) return true
    if (a.length >= 4 && (headerNorm.includes(a) || a.includes(headerNorm))) return true
  }
  if (field === 'vehicleNumber') {
    if (headerNorm === 'rc' || headerNorm === 'vahan' || headerNorm === 'reg') return true
  }
  return false
}

/**
 * Map each logical field → source column index (or -1)
 */
export function detectColumnMapping(headers) {
  /** @type {Record<string, number>} */
  const mapping = {
    vehicleNumber: -1,
    vehicleType: -1,
    purchaseYear: -1,
    approxKm: -1,
    axleConfig: -1,
    status: -1,
  }
  const fields = Object.keys(mapping)
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]
    if (!h) continue
    for (const field of fields) {
      if (mapping[field] >= 0) continue
      if (headerMatchesField(h, field)) {
        mapping[field] = i
        break
      }
    }
  }
  return mapping
}

function cell(row, idx) {
  if (idx < 0 || !row) return ''
  const v = row[idx]
  if (v == null) return ''
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v > 1e9) return String(Math.round(v))
    return String(v)
  }
  return String(v).trim()
}

function normalizeVehicleType(raw) {
  const t = String(raw || '').toLowerCase()
  if (!t) return 'truck'
  if (t.includes('tanker')) return 'tanker'
  if (t.includes('trailer')) return 'trailer'
  return 'truck'
}

function parseAxleConfig(raw) {
  const s = String(raw || '').trim().toUpperCase()
  if (VALID_AXLES.has(s)) return s
  const m = s.match(/(6|10|12|14)\s*W/i)
  if (m) return `${m[1]}W`
  const d = s.match(/\b(6|10|12|14)\b/)
  if (d) return `${d[1]}W`
  return '6W'
}

function parseYear(raw, fallbackYear) {
  if (raw === '' || raw == null) return fallbackYear
  const n = parseInt(String(raw).replace(/\D/g, '').slice(0, 4), 10)
  if (Number.isFinite(n) && n >= 1980 && n <= fallbackYear + 1) return n
  return fallbackYear
}

function parseKm(raw) {
  const n = parseInt(String(raw).replace(/[, ]/g, ''), 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function parseStatus(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (s === 'idle' || s.includes('idle')) return 'idle'
  if (s === 'active' || s.includes('active') || s.includes('run')) return 'active'
  return 'active'
}

/**
 * Build vehicle payload from one sheet row
 */
export function rowToVehiclePayload(row, mapping, fallbackYear) {
  const vn = cell(row, mapping.vehicleNumber)
  const normalizedNumber = vn.toUpperCase().replace(/\s+/g, '')
  if (!normalizedNumber) return null

  const vehicleType = normalizeVehicleType(cell(row, mapping.vehicleType))
  const purchaseYear = parseYear(cell(row, mapping.purchaseYear), fallbackYear)
  const approxKm = parseKm(cell(row, mapping.approxKm))
  let axleConfig = parseAxleConfig(cell(row, mapping.axleConfig))
  if (!VALID_AXLES.has(axleConfig)) axleConfig = '6W'
  let status = parseStatus(cell(row, mapping.status))
  if (!VALID_STATUS.has(status)) status = 'active'

  return {
    vehicleNumber: normalizedNumber,
    vehicleType,
    purchaseYear,
    approxKm,
    axleConfig,
    status,
  }
}

/**
 * @returns {{ preview: object[], totalRows: number, mappingLabels: Record<string, string|null>, missingVehicleColumn: boolean }}
 */
export function buildPreview(headers, rows, mapping, fallbackYear, previewLimit = 15) {
  const mappingLabels = {}
  for (const key of Object.keys(mapping)) {
    const idx = mapping[key]
    mappingLabels[key] = idx >= 0 ? headers[idx] || `Column ${idx + 1}` : null
  }

  if (mapping.vehicleNumber < 0) {
    return { preview: [], totalRows: rows.length, mappingLabels, missingVehicleColumn: true }
  }

  const preview = []
  for (let i = 0; i < rows.length && preview.length < previewLimit; i++) {
    const payload = rowToVehiclePayload(rows[i], mapping, fallbackYear)
    if (payload) preview.push({ row: i + 2, ...payload })
  }

  return {
    preview,
    totalRows: rows.length,
    mappingLabels,
    missingVehicleColumn: false,
  }
}

/**
 * All normalized payloads (skip blank vehicle rows)
 */
export function allPayloads(rows, mapping, fallbackYear) {
  const out = []
  for (let i = 0; i < rows.length; i++) {
    const payload = rowToVehiclePayload(rows[i], mapping, fallbackYear)
    if (payload) out.push({ sheetRow: i + 2, ...payload })
  }
  return out
}
