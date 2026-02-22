/**
 * Fuel SMS Parser
 *
 * Parses fleet fuel card SMS messages from Indian oil companies:
 * - HPCL (HP Fleet Card)
 * - IOCL (IndianOil Fleet Card)
 * - BPCL (SmartFleet Card)
 * - Generic fuel purchase SMS
 *
 * Returns: { litres, ratePerLitre, totalCost, vendorName, vendorLocation, vehicleNumber, fuelType, billNumber, fuelDate }
 */

const PATTERNS = [
  // HPCL: "Your HPCL Fleet Card ending 1234 used for Rs.5340.00 at HP RETAIL OUTLET PUNE for 59.55 Ltrs of HSD on 15-Feb-2026 Ref:123456"
  {
    provider: 'HPCL',
    regex: /HPCL.*?(?:Rs\.?|INR)\s*([\d,.]+).*?at\s+(.+?)\s+for\s+([\d,.]+)\s*(?:Ltrs?|L)\s*(?:of\s*)?(HSD|MS|Diesel|Petrol|CNG)?.*?on\s+(\d{1,2}[\/\-][A-Za-z]{3}[\/\-]\d{2,4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    extract: (m) => ({
      totalCost: parseNum(m[1]),
      vendorName: cleanVendor(m[2]),
      litres: parseNum(m[3]),
      fuelType: normalizeFuel(m[4]),
      fuelDate: parseDate(m[5]),
    }),
  },
  // IOCL: "IndianOil Fleet Card XXX1234 used at IOCL RO Sharma Fuels DELHI for Rs 4500.00 (50.00 Ltrs HSD) on 15/02/26 Ref 789012"
  {
    provider: 'IOCL',
    regex: /Indian\s*Oil.*?at\s+(.+?)\s+for\s+(?:Rs\.?|INR)\s*([\d,.]+)\s*\(\s*([\d,.]+)\s*(?:Ltrs?|L)\s*(HSD|MS|Diesel|Petrol|CNG)?\s*\).*?on\s+(\d{1,2}[\/\-][A-Za-z]{3}[\/\-]\d{2,4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    extract: (m) => ({
      vendorName: cleanVendor(m[1]),
      totalCost: parseNum(m[2]),
      litres: parseNum(m[3]),
      fuelType: normalizeFuel(m[4]),
      fuelDate: parseDate(m[5]),
    }),
  },
  // BPCL: "BPCL SmartFleet Card XX1234 txn of Rs.3500 at BPCL RO NAME CITY for 39.11L Diesel on 15-Feb-26 Ref:456"
  {
    provider: 'BPCL',
    regex: /BPCL.*?(?:Rs\.?|INR)\s*([\d,.]+).*?at\s+(.+?)\s+for\s+([\d,.]+)\s*(?:Ltrs?|L)\s*(HSD|MS|Diesel|Petrol|CNG)?.*?on\s+(\d{1,2}[\/\-][A-Za-z]{3}[\/\-]\d{2,4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    extract: (m) => ({
      totalCost: parseNum(m[1]),
      vendorName: cleanVendor(m[2]),
      litres: parseNum(m[3]),
      fuelType: normalizeFuel(m[4]),
      fuelDate: parseDate(m[5]),
    }),
  },
  // Reverse HPCL/BPCL pattern: litres before amount
  {
    provider: 'Generic',
    regex: /([\d,.]+)\s*(?:Ltrs?|litre|L)\s*.*?(?:Rs\.?|INR|₹)\s*([\d,.]+).*?at\s+(.+?)(?:\s+on\s+(\d{1,2}[\/\-][A-Za-z]{3}[\/\-]\d{2,4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}))?/i,
    extract: (m) => ({
      litres: parseNum(m[1]),
      totalCost: parseNum(m[2]),
      vendorName: cleanVendor(m[3]),
      fuelDate: m[4] ? parseDate(m[4]) : null,
    }),
  },
  // Amount-first generic: "Rs.5000 for 55L diesel at Pump Name"
  {
    provider: 'Generic',
    regex: /(?:Rs\.?|INR|₹)\s*([\d,.]+).*?for\s+([\d,.]+)\s*(?:Ltrs?|litre|L).*?(?:at|@)\s+(.+)/i,
    extract: (m) => ({
      totalCost: parseNum(m[1]),
      litres: parseNum(m[2]),
      vendorName: cleanVendor(m[3]),
    }),
  },
]

const VEHICLE_REGEX = /\b([A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4})\b/i
const REF_REGEX = /(?:Ref|Txn|Bill)[:\s#]*([A-Z0-9]+)/i

export function parseFuelSms(smsText) {
  if (!smsText || typeof smsText !== 'string') return null

  const text = smsText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

  let result = null

  for (const pattern of PATTERNS) {
    const match = text.match(pattern.regex)
    if (match) {
      result = pattern.extract(match)
      result.provider = pattern.provider
      break
    }
  }

  if (!result) return null

  // Try to extract vehicle number from full text
  const vMatch = text.match(VEHICLE_REGEX)
  if (vMatch) {
    result.vehicleNumber = vMatch[1].replace(/\s+/g, '').toUpperCase()
  }

  // Try to extract bill/ref number
  const refMatch = text.match(REF_REGEX)
  if (refMatch) {
    result.billNumber = refMatch[1]
  }

  // Calculate rate if both litres and total available
  if (result.litres && result.totalCost) {
    result.ratePerLitre = Math.round((result.totalCost / result.litres) * 100) / 100
  }

  // Default fuel type
  if (!result.fuelType) result.fuelType = 'diesel'

  // Default date to today
  if (!result.fuelDate) result.fuelDate = new Date().toISOString().slice(0, 10)

  // Extract location from vendor name (after comma or dash)
  if (result.vendorName) {
    const locMatch = result.vendorName.match(/[,\-–]\s*(.+)$/)
    if (locMatch) {
      result.vendorLocation = locMatch[1].trim()
      result.vendorName = result.vendorName.replace(/[,\-–]\s*.+$/, '').trim()
    }
  }

  return result
}

function parseNum(s) {
  if (!s) return 0
  return parseFloat(s.replace(/,/g, '')) || 0
}

function cleanVendor(s) {
  if (!s) return null
  return s
    .replace(/\s+/g, ' ')
    .replace(/for$/i, '')
    .replace(/\s*Ref\s*.*/i, '')
    .replace(/\s*on\s*\d.*/i, '')
    .trim()
}

function normalizeFuel(s) {
  if (!s) return 'diesel'
  const lower = s.toLowerCase()
  if (lower === 'hsd' || lower === 'diesel') return 'diesel'
  if (lower === 'ms' || lower === 'petrol') return 'petrol'
  if (lower === 'cng') return 'cng'
  return 'diesel'
}

function parseDate(s) {
  if (!s) return null

  // Try DD-MMM-YYYY / DD-MMM-YY
  const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' }
  const mmmMatch = s.match(/(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{2,4})/)
  if (mmmMatch) {
    const day = mmmMatch[1].padStart(2, '0')
    const mon = monthMap[mmmMatch[2].toLowerCase().slice(0, 3)]
    let yr = parseInt(mmmMatch[3])
    if (yr < 100) yr += 2000
    if (mon) return `${yr}-${mon}-${day}`
  }

  // Try DD/MM/YYYY
  const numMatch = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (numMatch) {
    const day = numMatch[1].padStart(2, '0')
    const mon = numMatch[2].padStart(2, '0')
    let yr = parseInt(numMatch[3])
    if (yr < 100) yr += 2000
    return `${yr}-${mon}-${day}`
  }

  return null
}

export default parseFuelSms
