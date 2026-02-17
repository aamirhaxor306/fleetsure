import fs from 'fs'

/**
 * Parse a monthly bill PDF from BPCL/IOCL/HPCL.
 * Extracts: total amount, trip count, date range, and per-trip breakdown if available.
 *
 * @param {string} filePath — path to the uploaded PDF file
 * @returns {Promise<Object>} parsed bill data
 */
export async function parseBillPDF(filePath) {
  // Lazy-load pdf-parse to avoid crashing on platforms where canvas polyfills fail
  const { createRequire } = await import('module')
  const require = createRequire(import.meta.url)
  const pdf = require('pdf-parse')

  const dataBuffer = fs.readFileSync(filePath)
  const data = await pdf(dataBuffer)
  const text = data.text

  const result = {
    totalAmount: null,
    tripCount: null,
    month: null,
    year: null,
    tripBreakdown: [],      // per-trip rows if found
    rawText: text.slice(0, 2000), // first 2000 chars for debugging
  }

  // 1. Try to find total amount
  const totalPatterns = [
    /total\s*(?:amount|payable|bill)[:\s]*(?:Rs\.?|₹)?\s*([\d,]+\.?\d*)/i,
    /grand\s*total[:\s]*(?:Rs\.?|₹)?\s*([\d,]+\.?\d*)/i,
    /net\s*(?:amount|payable)[:\s]*(?:Rs\.?|₹)?\s*([\d,]+\.?\d*)/i,
    /(?:Rs\.?|₹)\s*([\d,]+\.?\d*)\s*(?:total|payable)/i,
  ]

  for (const pattern of totalPatterns) {
    const match = text.match(pattern)
    if (match) {
      result.totalAmount = parseFloat(match[1].replace(/,/g, ''))
      break
    }
  }

  // If no explicit total found, try finding the largest number in the document
  if (!result.totalAmount) {
    const allNumbers = text.match(/[\d,]+\.?\d*/g) || []
    const nums = allNumbers
      .map((n) => parseFloat(n.replace(/,/g, '')))
      .filter((n) => n >= 10000 && n <= 50000000) // reasonable range for monthly bills
      .sort((a, b) => b - a)

    if (nums.length > 0) {
      result.totalAmount = nums[0]
    }
  }

  // 2. Try to find date/month/year
  const monthNames = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
    nov: 11, november: 11, dec: 12, december: 12,
  }

  // "November 2025" or "Nov 2025"
  const monthYearPattern = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*[,\-]?\s*(\d{4})\b/i
  const myMatch = text.match(monthYearPattern)
  if (myMatch) {
    result.month = monthNames[myMatch[1].toLowerCase()]
    result.year = parseInt(myMatch[2])
  }

  // Try MM/YYYY or MM-YYYY
  if (!result.month) {
    const mmYYYY = text.match(/\b(\d{1,2})[\/\-](\d{4})\b/)
    if (mmYYYY) {
      const m = parseInt(mmYYYY[1])
      const y = parseInt(mmYYYY[2])
      if (m >= 1 && m <= 12 && y >= 2020) {
        result.month = m
        result.year = y
      }
    }
  }

  // 3. Try to find trip count
  const tripCountPattern = /(\d+)\s*(?:trips?|deliveries|consignments|orders)/i
  const tcMatch = text.match(tripCountPattern)
  if (tcMatch) {
    result.tripCount = parseInt(tcMatch[1])
  }

  // 4. Try to find per-trip breakdown (vehicle number + amount on same line)
  const lines = text.split('\n')
  for (const line of lines) {
    const vehicleMatch = line.match(/\b([A-Z]{2}\s*\d{2}\s*[A-Z]{1,2}\s*\d{4})\b/)
    const amountMatch = line.match(/(?:Rs\.?|₹)?\s*([\d,]+\.?\d*)/)

    if (vehicleMatch && amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''))
      if (amount >= 10000 && amount <= 200000) {
        result.tripBreakdown.push({
          vehicleNumber: vehicleMatch[1].replace(/\s/g, ''),
          amount,
          rawLine: line.trim(),
        })
      }
    }
  }

  return result
}
