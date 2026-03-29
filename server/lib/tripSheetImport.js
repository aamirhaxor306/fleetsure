import { parseSpreadsheetBuffer, normHeader } from './vehicleSheetImport.js'

export { parseSpreadsheetBuffer, normHeader }

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
    'rc number',
    'rc no',
    'truck no',
    'truck number',
    'truck',
    'plate',
    'number plate',
  ],
  loadingLocation: [
    'loading',
    'loading location',
    'from',
    'origin',
    'source',
    'pickup',
    'load point',
    'start',
  ],
  destination: [
    'destination',
    'dest',
    'to',
    'drop',
    'delivery',
    'end',
    'unload',
  ],
  distance: ['distance', 'dist', 'km', 'kms', 'kilometers', 'route km', 'route distance'],
  ratePerKm: [
    'rate per km',
    'rate/km',
    'rpm',
    'freight rate',
    'per km rate',
    'rate',
  ],
  fuelLitres: [
    'fuel litres',
    'fuel liters',
    'fuel',
    'diesel litres',
    'litres',
    'liters',
    'fuel qty',
  ],
  dieselRate: [
    'diesel rate',
    'diesel price',
    'rate per litre',
    'rate per liter',
    'diesel per litre',
    'diesel per liter',
  ],
  fuelExpense: [
    'fuel expense',
    'fuel cost',
    'fuel exp',
    'fuelexp',
    'diesel expense',
    'diesel cost',
  ],
  toll: ['toll', 'tolls', 'highway'],
  cashExpense: ['cash expense', 'cash', 'misc', 'miscellaneous', 'other expense'],
  freightAmount: ['freight', 'freight amount', 'amount', 'revenue', 'earning', 'payment'],
  tripDate: ['trip date', 'date', 'journey date', 'dispatch date'],
  loadingSlipNumber: ['loading slip', 'slip no', 'slip number', 'slip', 'lr number', 'lr no'],
}

function headerMatchesField(headerNorm, field) {
  const aliases = FIELD_ALIASES[field] || []
  for (const a of aliases) {
    if (headerNorm === a) return true
    if (a.length >= 3 && (headerNorm.includes(a) || a.includes(headerNorm))) return true
  }
  if (field === 'vehicleNumber') {
    if (headerNorm === 'rc' || headerNorm === 'vahan' || headerNorm === 'reg') return true
  }
  return false
}

/** Field order: earlier fields win per header cell — put specific headers before short aliases (e.g. fuel expense before fuel). */
const TRIP_FIELDS = [
  'vehicleNumber',
  'loadingLocation',
  'destination',
  'distance',
  'freightAmount',
  'dieselRate',
  'fuelExpense',
  'fuelLitres',
  'ratePerKm',
  'toll',
  'cashExpense',
  'tripDate',
  'loadingSlipNumber',
]

/**
 * Map each logical field → source column index (or -1)
 */
export function detectTripColumnMapping(headers) {
  /** @type {Record<string, number>} */
  const mapping = {}
  for (const f of TRIP_FIELDS) mapping[f] = -1

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]
    if (!h) continue
    for (const field of TRIP_FIELDS) {
      if (mapping[field] >= 0) continue
      if (headerMatchesField(h, field)) {
        mapping[field] = i
        break
      }
    }
  }
  return mapping
}

function cellString(row, idx) {
  if (idx < 0 || !row) return ''
  const v = row[idx]
  if (v == null) return ''
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v > 1e9) return String(Math.round(v))
    return String(v)
  }
  return String(v).trim()
}

/**
 * @param {unknown} row
 * @param {number} idx
 * @returns {Date | null}
 */
export function parseTripDateCell(row, idx) {
  if (idx < 0 || !row) return null
  const v = row[idx]
  if (v == null || v === '') return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v
  if (typeof v === 'number' && Number.isFinite(v)) {
    const whole = Math.floor(v)
    if (whole >= 20000 && whole <= 65000) {
      const ms = (whole - 25569) * 86400 * 1000
      const d = new Date(ms)
      if (!Number.isNaN(d.getTime())) return d
    }
    return null
  }
  const s = String(v).trim()
  if (!s) return null
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d
  return null
}

function parseFloatCell(row, idx) {
  const s = cellString(row, idx).replace(/[,₹\s]/g, '')
  if (s === '') return 0
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function parseIntCell(row, idx) {
  const s = cellString(row, idx).replace(/[, ]/g, '')
  if (s === '') return 0
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : 0
}

function parseOptionalFloat(row, idx) {
  const s = cellString(row, idx).replace(/[,₹\s]/g, '')
  if (s === '') return null
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

/**
 * @returns {{ vehicleNumber: string, loadingLocation: string, destination: string, distance: number, ratePerKm: number, fuelLitres: number, dieselRate: number, fuelExpense: number, toll: number, cashExpense: number, freightAmount: number | null, tripDate: Date | null, loadingSlipNumber: string | null } | null}
 */
export function rowToTripImportPayload(row, mapping) {
  const vn = cellString(row, mapping.vehicleNumber).toUpperCase().replace(/\s+/g, '')
  if (!vn) return null

  const loadingLocation = cellString(row, mapping.loadingLocation) || 'Unknown'
  const destination = cellString(row, mapping.destination) || 'Unknown'
  const slip = cellString(row, mapping.loadingSlipNumber)
  const tripDate = parseTripDateCell(row, mapping.tripDate)

  return {
    vehicleNumber: vn,
    loadingLocation,
    destination,
    distance: parseIntCell(row, mapping.distance),
    ratePerKm: parseFloatCell(row, mapping.ratePerKm),
    fuelLitres: parseFloatCell(row, mapping.fuelLitres),
    dieselRate: parseFloatCell(row, mapping.dieselRate),
    fuelExpense: parseFloatCell(row, mapping.fuelExpense),
    toll: parseFloatCell(row, mapping.toll),
    cashExpense: parseFloatCell(row, mapping.cashExpense),
    freightAmount: parseOptionalFloat(row, mapping.freightAmount),
    tripDate,
    loadingSlipNumber: slip || null,
  }
}

/**
 * @returns {{ preview: object[], totalRows: number, mappingLabels: Record<string, string|null>, missingVehicleColumn: boolean }}
 */
export function buildTripPreview(headers, rows, mapping, previewLimit = 15) {
  const mappingLabels = {}
  for (const key of TRIP_FIELDS) {
    const idx = mapping[key]
    mappingLabels[key] = idx >= 0 ? headers[idx] || `Column ${idx + 1}` : null
  }

  if (mapping.vehicleNumber < 0) {
    return { preview: [], totalRows: rows.length, mappingLabels, missingVehicleColumn: true }
  }

  const preview = []
  for (let i = 0; i < rows.length && preview.length < previewLimit; i++) {
    const payload = rowToTripImportPayload(rows[i], mapping)
    if (!payload) continue
    preview.push({
      row: i + 2,
      vehicleNumber: payload.vehicleNumber,
      loadingLocation: payload.loadingLocation,
      destination: payload.destination,
      distance: payload.distance,
      ratePerKm: payload.ratePerKm,
      fuelLitres: payload.fuelLitres,
      dieselRate: payload.dieselRate,
      fuelExpense: payload.fuelExpense,
      toll: payload.toll,
      cashExpense: payload.cashExpense,
      freightAmount: payload.freightAmount,
      tripDate: payload.tripDate ? payload.tripDate.toISOString().slice(0, 10) : '',
      loadingSlipNumber: payload.loadingSlipNumber || '',
    })
  }

  return {
    preview,
    totalRows: rows.length,
    mappingLabels,
    missingVehicleColumn: false,
  }
}

/**
 * @returns {{ sheetRow: number, vehicleNumber: string, loadingLocation: string, destination: string, distance: number, ratePerKm: number, fuelLitres: number, dieselRate: number, fuelExpense: number, toll: number, cashExpense: number, freightAmount: number | null, tripDate: Date | null, loadingSlipNumber: string | null }[]}
 */
export function allTripPayloads(rows, mapping) {
  const out = []
  for (let i = 0; i < rows.length; i++) {
    const payload = rowToTripImportPayload(rows[i], mapping)
    if (!payload) continue
    out.push({ sheetRow: i + 2, ...payload })
  }
  return out
}
