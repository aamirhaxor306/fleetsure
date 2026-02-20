/**
 * Fleetsure Driver WhatsApp Service — v3 (Full Features)
 * ──────────────────────────────────────────────────────
 * Natural language + Photo OCR + Location + Doc Upload
 *
 * DRIVER CAN:
 *   📷 Send loading slip photo   → OCR auto-creates trip
 *   "Indore Mumbai"              → starts trip
 *   "diesel 40 3800"             → logs 40L diesel ₹3800
 *   "toll 350"                   → logs ₹350 toll
 *   "khana 200"                  → logs ₹200 food
 *   📍 Send location             → logs start/end/mid-trip GPS
 *   "done" / "pahunch gaya"      → ends trip
 *   📷 Send license/aadhaar photo → saves to profile
 */

import prisma from '../lib/prisma.js'
import { sendWhatsApp, inr } from './twilioClient.js'
import { sendOwnerNotification } from './ownerWhatsApp.js'
import { generateTrackingToken } from '../routes/trackingPublic.js'
import sharp from 'sharp'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdtemp, writeFile, unlink, mkdir } from 'fs/promises'
import { tmpdir } from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ── Per-phone state ──────────────────────────────────────────────────────
const chatState = new Map()

function getState(phone) {
  return chatState.get(phone) || { state: 'idle', data: {} }
}
function setState(phone, state, extra = {}) {
  const current = chatState.get(phone) || { state: 'idle', data: {} }
  chatState.set(phone, { ...current, state, data: { ...current.data, ...extra } })
}
function clearState(phone) {
  chatState.set(phone, { state: 'idle', data: {} })
}

async function findDriver(phone) {
  return prisma.driver.findUnique({
    where: { whatsappPhone: phone },
    include: {
      vehicle: { select: { vehicleNumber: true } },
      _count: { select: { trips: true } },
    },
  })
}

async function getTenantIdForDriver(phone) {
  const driver = await prisma.driver.findFirst({ where: { whatsappPhone: phone } })
  return driver?.tenantId || null
}

// ═══════════════════════════════════════════════════════════════════════════
// NATURAL LANGUAGE PARSER
// ═══════════════════════════════════════════════════════════════════════════

function parseExpense(text) {
  const lower = text.toLowerCase().replace(/₹|rs\.?|rupees?/gi, '').trim()

  const fuelMatch = lower.match(/(?:diesel|fuel|petrol|disel)\s+(\d+)\s*l?\s+(\d+)/)
  if (fuelMatch) return { type: 'fuel', litres: parseFloat(fuelMatch[1]), amount: parseFloat(fuelMatch[2]) }

  const fuelAmountOnly = lower.match(/(?:diesel|fuel|petrol|disel)\s+(\d+)/)
  if (fuelAmountOnly) return { type: 'fuel', litres: null, amount: parseFloat(fuelAmountOnly[1]) }

  const tollMatch = lower.match(/toll\s*(?:ka)?\s*(\d+)/)
  if (tollMatch) return { type: 'toll', amount: parseFloat(tollMatch[1]) }

  const foodMatch = lower.match(/(?:khana|food|nashta|chai)\s*(?:ka)?\s*(\d+)/)
  if (foodMatch) return { type: 'food', amount: parseFloat(foodMatch[1]) }

  const repairMatch = lower.match(/(?:repair|puncture|mechanic|garage)\s*(?:ka)?\s*(\d+)/)
  if (repairMatch) return { type: 'repair', amount: parseFloat(repairMatch[1]) }

  const parkingMatch = lower.match(/(?:parking|park)\s*(?:ka)?\s*(\d+)/)
  if (parkingMatch) return { type: 'parking', amount: parseFloat(parkingMatch[1]) }

  const roomMatch = lower.match(/(?:room|hotel|lodge|stay)\s*(?:ka)?\s*(\d+)/)
  if (roomMatch) return { type: 'room', amount: parseFloat(roomMatch[1]) }

  return null
}

function isRoute(text) {
  const parts = text.trim().split(/\s+to\s+|\s+se\s+|\s+→\s+|\s+–\s+|\s+-\s+|\s+/i)
  if (parts.length >= 2) {
    const allAlpha = parts.every(p => /^[a-zA-Z\u0900-\u097F]+$/.test(p.trim()))
    if (allAlpha && parts[0].length >= 2 && parts[1].length >= 2) return parts
  }
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// INCOMING MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function handleDriverMessage(phone, body, context = {}) {
  const text = body.trim()
  const lower = text.toLowerCase()
  const { state, data } = getState(phone)
  const driver = await findDriver(phone)
  const { numMedia, mediaUrl, mediaType, latitude, longitude } = context

  // ── LOCATION RECEIVED ──────────────────────────────────────────
  if (latitude != null && longitude != null) {
    if (driver && data.activeTripId) {
      return handleLocation(phone, latitude, longitude, driver)
    }
    if (driver) {
      return sendWhatsApp(phone, '📍 Location mila! Pehle trip shuru karo — route likho.')
    }
  }

  // ── PHOTO RECEIVED ─────────────────────────────────────────────
  if (numMedia > 0 && mediaUrl && mediaType?.startsWith('image/')) {
    // Doc upload states
    if (state === 'uploading_license' && driver) {
      return handleDocUpload(phone, mediaUrl, 'license', driver)
    }
    if (state === 'uploading_aadhaar' && driver) {
      return handleDocUpload(phone, mediaUrl, 'aadhaar', driver)
    }

    // Registered driver: loading slip OCR or receipt
    if (driver) {
      return handlePhoto(phone, mediaUrl, driver)
    }

    return sendWhatsApp(phone, 'Pehle register karo. *Hi* bhejo.')
  }

  // ── ONBOARDING ─────────────────────────────────────────────────
  if (state === 'onboarding_name') {
    if (text.length < 2) return sendWhatsApp(phone, 'Naam chhota hai. Poora naam likho.')
    setState(phone, 'onboarding_phone', { name: text })
    return sendWhatsApp(phone, `${text} ji, aapka phone number? (10 digit)`)
  }

  if (state === 'onboarding_phone') {
    const phn = text.replace(/[\s\-+]/g, '').replace(/^91/, '')
    if (!/^\d{10}$/.test(phn)) return sendWhatsApp(phone, '10 digit number daalo.')
    setState(phone, 'onboarding_code', { phone: phn })
    const code = process.env.FLEET_INVITE_CODE || 'FLEET-7X2K'
    return sendWhatsApp(phone, `Fleet code daalo (owner se lo):\ne.g. *${code}*`)
  }

  if (state === 'onboarding_code') {
    const expected = (process.env.FLEET_INVITE_CODE || 'FLEET-7X2K').toUpperCase()
    if (text.toUpperCase() !== expected) {
      return sendWhatsApp(phone, 'Galat code. Owner se sahi code lo.')
    }
    setState(phone, 'onboarding_vehicle')
    return sendVehicleSelection(phone)
  }

  if (state === 'onboarding_vehicle') {
    const num = parseInt(text)
    const vehicles = data.vehicleList || []
    if (lower === 'skip' || text === '0') return completeOnboarding(phone, null)
    if (num >= 1 && num <= vehicles.length) return completeOnboarding(phone, vehicles[num - 1].id)
    return sendWhatsApp(phone, 'Number daalo ya *skip* likho.')
  }

  // ── NOT REGISTERED ──────────────────────────────────────────────
  if (!driver) {
    setState(phone, 'onboarding_name')
    return sendWhatsApp(phone, `🚛 *Fleetsure*\n\nAapka naam batao:`)
  }

  // ── TRIP END CONFIRMATION ──────────────────────────────────────
  if (state === 'trip_confirming') {
    if (lower === 'ha' || lower === 'haan' || lower === 'yes' || lower === 'y' || text === '1') {
      return showTripSummary(phone, data.activeTripId, driver)
    }
    setState(phone, 'trip_active')
    return sendWhatsApp(phone, 'Ok, trip active hai. Kharcha log karo ya *done* likho.')
  }

  // ── ACTIVE TRIP: natural text parsing ──────────────────────────
  if (data.activeTripId) {
    if (lower === 'done' || lower === 'khatam' || lower === 'pahunch gaya' || lower === 'end' || lower === 'pahuncha' || lower === 'deliver') {
      return handleTripEnd(phone, data.activeTripId)
    }

    if (lower.includes('gps') || lower.includes('location') || lower.includes('track') || lower === 'loc') {
      const token = generateTrackingToken(data.activeTripId, driver?.id || '')
      const url = getTrackingUrl(token)
      if (url) {
        return sendWhatsApp(phone, `📍 *GPS Tracking:*\n${url}`)
      }
      return sendWhatsApp(phone, `📍 GPS tracking link trip start pe mila tha. Woh link kholo.`)
    }

    const expense = parseExpense(text)
    if (expense) {
      if (expense.type === 'fuel') return saveFuelExpense(phone, expense.litres, expense.amount)
      if (expense.type === 'toll') return saveTollExpense(phone, expense.amount)
      return saveCashExpense(phone, expense.type, expense.amount)
    }

    const justNumber = parseFloat(text)
    if (!isNaN(justNumber) && justNumber > 0) {
      return saveCashExpense(phone, 'other', justNumber)
    }
  }

  // ── DOC UPLOAD COMMANDS ────────────────────────────────────────
  if (lower === 'license' || lower === 'licence') {
    setState(phone, 'uploading_license')
    return sendWhatsApp(phone, '📷 License ki photo bhejo.')
  }
  if (lower === 'aadhaar' || lower === 'aadhar') {
    setState(phone, 'uploading_aadhaar')
    return sendWhatsApp(phone, '📷 Aadhaar ki photo bhejo.')
  }

  // ── MENU / GREETING ────────────────────────────────────────────
  if (lower === 'hi' || lower === 'hello' || lower === 'menu' || lower === 'start' || lower === 'helo') {
    if (data.activeTripId) return sendTripStatus(phone, data.activeTripId, driver)
    return sendHomeMenu(phone, driver)
  }

  if (lower === 'status') return handleMyStatus(phone, driver)
  if (lower === 'profile') return handleMyProfile(phone, driver)
  if (lower === 'help') return sendHelp(phone)
  if (lower === 'cancel') {
    if (state !== 'idle') { clearState(phone); return sendWhatsApp(phone, 'Cancel.') }
    return sendWhatsApp(phone, 'Kuch cancel karne ko nahi hai.')
  }

  // ── TRY ROUTE DETECTION ────────────────────────────────────────
  const routeParts = isRoute(text)
  if (routeParts && !data.activeTripId) {
    const from = capitalize(routeParts[0])
    const to = capitalize(routeParts.slice(1).join(' '))
    return startTrip(phone, from, to)
  }

  // ── FALLBACK ───────────────────────────────────────────────────
  if (data.activeTripId) {
    return sendWhatsApp(phone,
      `Trip active hai.\n\n` +
      `⛽ *diesel 40 3800*\n` +
      `🛣️ *toll 350*\n` +
      `🍽️ *khana 200*\n` +
      `🏁 *done* — trip khatam`
    )
  }

  return sendWhatsApp(phone,
    `Trip shuru karo:\n📷 Slip ki photo bhejo\nYa route likho: *Indore Mumbai*`
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PHOTO HANDLER — OCR or Receipt
// ═══════════════════════════════════════════════════════════════════════════

async function handlePhoto(phone, mediaUrl, driver) {
  const { state, data } = getState(phone)

  // If trip is active, treat photo as a receipt
  if (data.activeTripId && state === 'trip_active') {
    try {
      await downloadAndSaveMedia(mediaUrl, 'receipt', phone)
    } catch {}
    return sendWhatsApp(phone, '📷 Receipt saved!')
  }

  // Otherwise: loading slip OCR
  return handleLoadingSlipOCR(phone, mediaUrl, driver)
}

async function handleLoadingSlipOCR(phone, mediaUrl, driver) {
  await sendWhatsApp(phone, '🔍 Slip padh rahe hain...')

  let tempDir = null, processedPath = null
  try {
    const imageBuffer = await downloadTwilioMedia(mediaUrl)

    // Save original
    const uploadsDir = join(__dirname, '..', '..', 'uploads', 'loading-slips')
    await mkdir(uploadsDir, { recursive: true })
    const slipFilename = `slip-${Date.now()}.jpg`
    await writeFile(join(uploadsDir, slipFilename), imageBuffer)
    const slipImageUrl = `/uploads/loading-slips/${slipFilename}`

    // Preprocess for OCR
    tempDir = await mkdtemp(join(tmpdir(), 'fleetsure-wa-'))
    processedPath = join(tempDir, 'processed.jpg')
    await sharp(imageBuffer).grayscale().normalize().sharpen({ sigma: 1.5 }).jpeg({ quality: 95 }).toFile(processedPath)

    const pythonScript = join(__dirname, '..', 'ocr', 'process_loading_slip.py')
    const ocrResult = await runPythonOCR(pythonScript, processedPath)

    if (ocrResult.error) {
      return sendWhatsApp(phone, `Slip padh nahi paaye. Route seedha likho:\ne.g. *Indore Mumbai*`)
    }

    const tenantId = driver.tenantId || (await getTenantIdForDriver(phone))

    // Find vehicle from OCR result
    let vehicle = null
    if (ocrResult.vehicleNumber) {
      vehicle = await prisma.vehicle.findFirst({
        where: { vehicleNumber: { contains: ocrResult.vehicleNumber, mode: 'insensitive' }, ...(tenantId && { tenantId }) },
      })
      if (!vehicle) {
        const cleanNum = ocrResult.vehicleNumber.replace(/[\s\-.]/g, '').toUpperCase()
        vehicle = await prisma.vehicle.findFirst({
          where: { vehicleNumber: cleanNum, ...(tenantId && { tenantId }) },
        })
      }
    }
    if (!vehicle && driver.vehicleId) {
      vehicle = await prisma.vehicle.findFirst({
        where: { id: driver.vehicleId, ...(tenantId && { tenantId }) },
      })
    }
    if (!vehicle) {
      vehicle = await prisma.vehicle.findFirst({
        where: { status: 'active', ...(tenantId && { tenantId }) },
      })
    }

    if (!vehicle) {
      return sendWhatsApp(phone,
        `📋 Slip scan hua par vehicle nahi mila.\n` +
        `🛣️ ${ocrResult.originPlant || '?'} → ${ocrResult.destinationPlant || '?'}\n\n` +
        `Owner se vehicle register karwao.`
      )
    }

    const tripData = {
      vehicleId: vehicle.id,
      driverId: driver.id,
      loadingLocation: ocrResult.originPlant || 'Unknown',
      destination: ocrResult.destinationPlant || 'Unknown',
      freightAmount: null,
      distance: 0, ratePerKm: 0, fuelLitres: 0, dieselRate: 0,
      fuelExpense: 0, toll: 0, cashExpense: 0,
      status: 'logged',
      tripDate: ocrResult.tripDate ? new Date(ocrResult.tripDate) : new Date(),
      loadingSlipNumber: ocrResult.loadingSlipNumber || null,
      loadingSlipImageUrl: slipImageUrl,
    }
    if (tenantId) tripData.tenantId = tenantId
    const trip = await prisma.trip.create({ data: tripData })

    setState(phone, 'trip_active', { activeTripId: trip.id })
    await sendOwnerNotification('trip_start', { trip, vehicle, driver })

    const token = generateTrackingToken(trip.id, driver.id)
    const trackUrl = getTrackingUrl(token)

    let msg = `✅ *Slip se trip bana!*\n` +
      `🚛 ${vehicle.vehicleNumber}\n` +
      `🛣️ ${ocrResult.originPlant || '?'} → ${ocrResult.destinationPlant || '?'}\n` +
      (ocrResult.loadingSlipNumber ? `📄 Slip: ${ocrResult.loadingSlipNumber}\n` : '')

    if (trackUrl) msg += `\n📍 *GPS Tracking:*\n${trackUrl}\n`
    msg += `\nKharcha likho: *diesel/toll/khana*`

    return sendWhatsApp(phone, msg)
  } catch (err) {
    console.error('[DriverWhatsApp] OCR error:', err)
    return sendWhatsApp(phone, `Slip padh nahi paaye. Route seedha likho:\ne.g. *Indore Mumbai*`)
  } finally {
    try {
      if (processedPath) await unlink(processedPath).catch(() => {})
      if (tempDir) { const { rmdir } = await import('fs/promises'); await rmdir(tempDir).catch(() => {}) }
    } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOCATION HANDLER
// ═══════════════════════════════════════════════════════════════════════════

async function handleLocation(phone, latitude, longitude, driver) {
  const { data } = getState(phone)
  const tripId = data.activeTripId
  if (!tripId) return sendWhatsApp(phone, '📍 Location mila! Trip shuru karo pehle.')

  const trip = await prisma.trip.findUnique({ where: { id: tripId } })
  if (!trip) return

  // If no start location yet, save as start
  if (!trip.startLat) {
    await prisma.trip.update({
      where: { id: tripId },
      data: { startLat: latitude, startLng: longitude },
    })
    await prisma.locationLog.create({
      data: { tenantId: driver.tenantId, driverId: driver.id, tripId, latitude, longitude },
    })
    return sendWhatsApp(phone,
      `📍 Start location saved!\nSafe trip, ${driver.name} ji! 🙏\n\n` +
      `Kharcha likho ya aur location bhejte raho.`
    )
  }

  // Mid-trip location log
  await prisma.locationLog.create({
    data: { tenantId: driver.tenantId, driverId: driver.id, tripId, latitude, longitude },
  })

  const logCount = await prisma.locationLog.count({ where: { tripId } })

  // Don't spam confirmation for every location update
  if (logCount <= 3 || logCount % 5 === 0) {
    return sendWhatsApp(phone, `📍 Location logged! (${logCount} points)`)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENT UPLOAD (license / aadhaar)
// ═══════════════════════════════════════════════════════════════════════════

async function handleDocUpload(phone, mediaUrl, docType, driver) {
  try {
    const url = await downloadAndSaveMedia(mediaUrl, docType, phone)
    if (!url) throw new Error('Download failed')

    const updateData = docType === 'license' ? { licensePhotoUrl: url } : { aadhaarPhotoUrl: url }
    await prisma.driver.update({ where: { id: driver.id }, data: updateData })

    clearState(phone)
    const label = docType === 'license' ? 'License' : 'Aadhaar'
    return sendWhatsApp(phone, `✅ ${label} photo saved!`)
  } catch (err) {
    console.error(`[DriverWhatsApp] ${docType} upload error:`, err)
    clearState(phone)
    return sendWhatsApp(phone, 'Photo save nahi ho payi. Dobara try karo.')
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TRIP START
// ═══════════════════════════════════════════════════════════════════════════

async function startTrip(phone, from, to) {
  const driver = await findDriver(phone)
  if (!driver) return

  const { data } = getState(phone)
  if (data.activeTripId) {
    return sendWhatsApp(phone, `Trip already active hai. Pehle *done* likho.`)
  }

  const tenantId = driver.tenantId || (await getTenantIdForDriver(phone))
  let vehicle = null
  if (driver.vehicleId) {
    vehicle = await prisma.vehicle.findFirst({
      where: { id: driver.vehicleId, ...(tenantId && { tenantId }) },
    })
  }
  if (!vehicle) {
    vehicle = await prisma.vehicle.findFirst({
      where: { status: 'active', ...(tenantId && { tenantId }) },
    })
  }
  if (!vehicle) {
    return sendWhatsApp(phone, 'Vehicle nahi mila. Owner se baat karo.')
  }

  const tripData = {
    vehicleId: vehicle.id,
    driverId: driver.id,
    loadingLocation: from,
    destination: to,
    freightAmount: null,
    distance: 0, ratePerKm: 0, fuelLitres: 0, dieselRate: 0,
    fuelExpense: 0, toll: 0, cashExpense: 0,
    status: 'logged',
    tripDate: new Date(),
  }
  if (tenantId) tripData.tenantId = tenantId
  const trip = await prisma.trip.create({ data: tripData })

  setState(phone, 'trip_active', { activeTripId: trip.id })
  await sendOwnerNotification('trip_start', { trip, vehicle, driver })

  const token = generateTrackingToken(trip.id, driver.id)
  const trackUrl = getTrackingUrl(token)

  let msg = `✅ *Trip shuru!*\n` +
    `🚛 ${vehicle.vehicleNumber}\n` +
    `🛣️ ${from} → ${to}\n\n`

  if (trackUrl) {
    msg += `📍 *GPS Tracking:*\n${trackUrl}\n\n`
  }

  msg += `⛽ *diesel 40 3800*\n` +
    `🛣️ *toll 350*\n` +
    `🍽️ *khana 200*\n` +
    `🏁 *done* — pahunch gaye`

  return sendWhatsApp(phone, msg)
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPENSE LOGGING (one-shot)
// ═══════════════════════════════════════════════════════════════════════════

async function saveFuelExpense(phone, litres, amount) {
  const { data } = getState(phone)
  const tripId = data.activeTripId
  if (!tripId) return

  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { tenantId: true } })
  if (!trip) return
  const rate = litres ? Math.round((amount / litres) * 100) / 100 : 0

  await prisma.tripExpense.create({
    data: { tripId, tenantId: trip.tenantId, type: 'fuel', amount, quantity: litres || 0, rate },
  })

  const allFuel = await prisma.tripExpense.findMany({ where: { tripId, type: 'fuel' } })
  const totalFuel = allFuel.reduce((s, e) => s + e.amount, 0)
  const totalLitres = allFuel.reduce((s, e) => s + (e.quantity || 0), 0)
  await prisma.trip.update({
    where: { id: tripId },
    data: { fuelExpense: totalFuel, fuelLitres: totalLitres, dieselRate: rate },
  })

  const tripTotal = await getTripExpenseTotal(tripId)
  const litreText = litres ? `${litres}L — ` : ''
  return sendWhatsApp(phone, `⛽ ${litreText}${inr(amount)} saved!\nTotal: *${inr(tripTotal)}*`)
}

async function saveTollExpense(phone, amount) {
  const { data } = getState(phone)
  const tripId = data.activeTripId
  if (!tripId) return

  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { tenantId: true } })
  if (!trip) return

  await prisma.tripExpense.create({ data: { tripId, tenantId: trip.tenantId, type: 'toll', amount } })

  const allToll = await prisma.tripExpense.findMany({ where: { tripId, type: 'toll' } })
  const totalToll = allToll.reduce((s, e) => s + e.amount, 0)
  await prisma.trip.update({ where: { id: tripId }, data: { toll: totalToll } })

  const tripTotal = await getTripExpenseTotal(tripId)
  return sendWhatsApp(phone, `🛣️ Toll ${inr(amount)} saved!\nTotal: *${inr(tripTotal)}*`)
}

async function saveCashExpense(phone, type, amount) {
  const { data } = getState(phone)
  const tripId = data.activeTripId
  if (!tripId) return

  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { tenantId: true } })
  if (!trip) return

  const labels = { food: 'Khana', repair: 'Repair', parking: 'Parking', room: 'Room', other: 'Kharcha' }

  await prisma.tripExpense.create({
    data: { tripId, tenantId: trip.tenantId, type, amount, description: labels[type] || type },
  })

  const cashTypes = ['food', 'repair', 'parking', 'room', 'other']
  const allCash = await prisma.tripExpense.findMany({ where: { tripId, type: { in: cashTypes } } })
  const totalCash = allCash.reduce((s, e) => s + e.amount, 0)
  await prisma.trip.update({ where: { id: tripId }, data: { cashExpense: totalCash } })

  const tripTotal = await getTripExpenseTotal(tripId)
  return sendWhatsApp(phone, `${labels[type]} ${inr(amount)} saved!\nTotal: *${inr(tripTotal)}*`)
}

async function getTripExpenseTotal(tripId) {
  const expenses = await prisma.tripExpense.findMany({ where: { tripId } })
  return expenses.reduce((s, e) => s + e.amount, 0)
}

// ═══════════════════════════════════════════════════════════════════════════
// TRIP END & SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

async function handleTripEnd(phone, tripId) {
  setState(phone, 'trip_confirming')
  return sendWhatsApp(phone, `Deliver ho gaya? *ha* ya *nahi*`)
}

async function sendTripStatus(phone, tripId, driver) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { vehicle: { select: { vehicleNumber: true } }, expenses: true },
  })
  if (!trip) return sendWhatsApp(phone, 'Trip nahi mila.')

  const total = trip.expenses.reduce((s, e) => s + e.amount, 0)
  const locCount = await prisma.locationLog.count({ where: { tripId } })

  return sendWhatsApp(phone,
    `🚛 *Trip Active*\n` +
    `${trip.vehicle?.vehicleNumber} | ${trip.loadingLocation} → ${trip.destination}\n` +
    `💰 Kharcha: ${inr(total)}\n` +
    (locCount > 0 ? `📍 ${locCount} GPS points\n` : '') +
    `\n*diesel/toll/khana* + amount likho\n` +
    `📍 GPS: + button → Location\n` +
    `🏁 *done* — trip khatam`
  )
}

async function showTripSummary(phone, tripId, driver) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { vehicle: { select: { vehicleNumber: true } }, expenses: true },
  })
  if (!trip) { clearState(phone); return sendWhatsApp(phone, 'Trip nahi mila.') }

  const durationMs = new Date() - trip.createdAt
  const hours = Math.floor(durationMs / 3600000)
  const mins = Math.floor((durationMs % 3600000) / 60000)

  const fuel = trip.expenses.filter(e => e.type === 'fuel')
  const tolls = trip.expenses.filter(e => e.type === 'toll')
  const cashTypes = ['food', 'repair', 'parking', 'room', 'other']
  const cash = trip.expenses.filter(e => cashTypes.includes(e.type))

  const fuelTotal = fuel.reduce((s, e) => s + e.amount, 0)
  const fuelLitres = fuel.reduce((s, e) => s + (e.quantity || 0), 0)
  const tollTotal = tolls.reduce((s, e) => s + e.amount, 0)
  const cashTotal = cash.reduce((s, e) => s + e.amount, 0)
  const grandTotal = fuelTotal + tollTotal + cashTotal

  let msg = `✅ *Trip Done!*\n\n`
  msg += `🚛 ${trip.vehicle.vehicleNumber}\n`
  msg += `🛣️ ${trip.loadingLocation} → ${trip.destination}\n`
  msg += `⏱️ ${hours}h ${mins}m\n\n`
  if (fuelTotal > 0) msg += `⛽ Diesel: ${inr(fuelTotal)} (${fuelLitres}L)\n`
  if (tollTotal > 0) msg += `🛣️ Toll: ${inr(tollTotal)}\n`
  if (cashTotal > 0) {
    for (const c of cash) msg += `${c.description}: ${inr(c.amount)}\n`
  }
  msg += `\n*Total: ${inr(grandTotal)}*`

  // Driving score from GPS data
  let drivingScore = null
  try {
    const { calculateDrivingScore } = await import('./drivingScore.js')
    drivingScore = await calculateDrivingScore(tripId, trip.tenantId)
  } catch {}

  if (drivingScore && drivingScore.totalDistanceKm > 0) {
    const sc = drivingScore
    const emoji = sc.overallScore >= 80 ? '🟢' : sc.overallScore >= 60 ? '🟡' : '🔴'
    msg += `\n\n${emoji} *Driving Score: ${sc.overallScore}/100*`
    msg += `\n⚡ Avg: ${Math.round(sc.avgSpeed)} km/h | Max: ${Math.round(sc.maxSpeed)} km/h`
    const events = sc.harshBrakeCount + sc.harshAccelCount + sc.sharpTurnCount
    if (events > 0) msg += `\n⚠️ ${events} harsh events`
  }

  // GPS distance
  const locCount = await prisma.locationLog.count({ where: { tripId } })
  if (locCount > 0) msg += `\n📍 ${locCount} GPS points tracked`

  await sendOwnerNotification('trip_complete', { trip, fuelTotal, tollTotal, cashTotal, grandTotal, hours, mins, fuelLitres, drivingScore })

  if (fuelLitres > 0 && trip.startLat && trip.endLat) {
    const dist = haversine(trip.startLat, trip.startLng, trip.endLat, trip.endLng)
    const kmPerL = dist / fuelLitres
    if (kmPerL < 2.0 && dist > 10) {
      await sendOwnerNotification('fuel_anomaly', {
        trip, vehicle: trip.vehicle, driver, fuelLitres, dist: Math.round(dist), kmPerL: kmPerL.toFixed(1),
      })
    }
  }

  // Save end location if we have start
  if (trip.startLat && !trip.endLat) {
    const lastLoc = await prisma.locationLog.findFirst({
      where: { tripId },
      orderBy: { createdAt: 'desc' },
    })
    if (lastLoc) {
      await prisma.trip.update({
        where: { id: tripId },
        data: { endLat: lastLoc.latitude, endLng: lastLoc.longitude },
      })
    }
  }

  clearState(phone)

  // Progressive doc collection
  await checkDocPrompt(phone, driver)

  msg += `\n\nNaya trip? Route likho ya slip photo bhejo.`
  return sendWhatsApp(phone, msg)
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS, PROFILE, HELP
// ═══════════════════════════════════════════════════════════════════════════

async function handleMyStatus(phone, driver) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayTrips = await prisma.trip.findMany({
    where: { driverId: driver.id, createdAt: { gte: today } },
    include: { expenses: true },
  })

  const totalExp = todayTrips.reduce((s, t) => s + t.expenses.reduce((se, e) => se + e.amount, 0), 0)

  return sendWhatsApp(phone,
    `📊 *${driver.name}*\n\n` +
    `Aaj: ${todayTrips.length} trips\n` +
    `Kharcha: ${inr(totalExp)}`
  )
}

async function handleMyProfile(phone, driver) {
  const verified = driver.licensePhotoUrl && driver.aadhaarPhotoUrl
  return sendWhatsApp(phone,
    `👤 *${driver.name}*\n` +
    `📱 ${driver.phone}\n` +
    (driver.vehicle ? `🚛 ${driver.vehicle.vehicleNumber}\n` : '') +
    `📦 ${driver._count.trips} trips\n` +
    (verified ? `✅ Verified` : `⚪ Unverified — *license* ya *aadhaar* likho photo bhejne ke liye`)
  )
}

function sendHomeMenu(phone, driver) {
  return sendWhatsApp(phone,
    `🚛 *${driver.name}* ji!\n\n` +
    `Trip shuru karo:\n` +
    `📷 Slip ki photo bhejo\n` +
    `Ya route likho: *Indore Mumbai*\n\n` +
    `📊 *status* — aaj ka summary\n` +
    `👤 *profile* — meri profile\n` +
    `📷 *license* / *aadhaar* — document upload`
  )
}

function sendHelp(phone) {
  return sendWhatsApp(phone,
    `*Trip shuru:*\n📷 Slip photo bhejo\nYa route likho: Indore Mumbai\n\n` +
    `*Kharcha:*\ndiesel 40 3800\ntoll 350\nkhana 200\n\n` +
    `*GPS:* Trip start pe link milega\n` +
    `*Trip khatam:* done\n` +
    `*Documents:* license / aadhaar\n` +
    `*Cancel:* cancel`
  )
}

// After every 5th trip, nudge for missing docs
async function checkDocPrompt(phone, driver) {
  const tripCount = driver._count?.trips || 0
  if (tripCount >= 5 && tripCount % 5 === 0) {
    if (!driver.licensePhotoUrl) {
      return sendWhatsApp(phone, '📄 License photo dena bhool gaye? *license* likho aur photo bhejo.')
    }
    if (!driver.aadhaarPhotoUrl) {
      return sendWhatsApp(phone, '📄 Aadhaar photo dena bhool gaye? *aadhaar* likho aur photo bhejo.')
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════

async function sendVehicleSelection(phone) {
  const first = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } })
  const tenantId = first?.id
  const vehicles = await prisma.vehicle.findMany({
    where: { status: 'active', ...(tenantId && { tenantId }) },
    orderBy: { vehicleNumber: 'asc' },
    take: 20,
  })

  if (vehicles.length === 0) return completeOnboarding(phone, null)

  let msg = `Gaadi kaunsi hai?\n\n`
  for (let i = 0; i < vehicles.length; i++) {
    msg += `*${i + 1}.* ${vehicles[i].vehicleNumber}\n`
  }
  msg += `\n*0* = skip`

  setState(phone, 'onboarding_vehicle', { vehicleList: vehicles })
  return sendWhatsApp(phone, msg)
}

async function completeOnboarding(phone, vehicleId) {
  const { data } = getState(phone)
  try {
    const first = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } })
    const tenantId = first?.id

    const driverData = {
      name: data.name,
      phone: data.phone || phone.replace(/^91/, ''),
      vehicleId: vehicleId || null,
      whatsappPhone: phone,
    }
    if (tenantId) driverData.tenantId = tenantId

    const driver = await prisma.driver.create({
      data: driverData,
      include: { vehicle: { select: { vehicleNumber: true } } },
    })

    clearState(phone)

    let msg = `✅ *${driver.name}*, registration done!`
    if (driver.vehicle) msg += `\n🚛 ${driver.vehicle.vehicleNumber}`
    msg += `\n\nTrip shuru karo:\n📷 Slip ki photo bhejo\nYa route likho: *Indore Mumbai*`

    await sendWhatsApp(phone, msg)
    await sendOwnerNotification('new_driver', { driver })
  } catch (err) {
    console.error('[DriverWhatsApp] Registration error:', err)
    clearState(phone)
    if (err.code === 'P2002') {
      return sendWhatsApp(phone, 'Yeh number pehle se registered hai.')
    }
    return sendWhatsApp(phone, 'Error. *Hi* bhejo dobara try karo.')
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUSH MESSAGES (called from cron)
// ═══════════════════════════════════════════════════════════════════════════

export async function sendMorningBrief() {
  const drivers = await prisma.driver.findMany({
    where: { active: true, whatsappPhone: { not: null } },
    include: { vehicle: { select: { vehicleNumber: true } } },
  })

  for (const d of drivers) {
    try {
      await sendWhatsApp(d.whatsappPhone,
        `🌅 *Namaste ${d.name} ji!*\n` +
        (d.vehicle ? `🚛 ${d.vehicle.vehicleNumber}\n` : '') +
        `Route likho ya slip photo bhejo.`
      )
    } catch (err) {
      console.error(`[DriverWhatsApp] Morning msg failed for ${d.name}:`, err.message)
    }
  }
}

export async function sendEveningSummary() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const drivers = await prisma.driver.findMany({
    where: { active: true, whatsappPhone: { not: null } },
  })

  for (const d of drivers) {
    try {
      const trips = await prisma.trip.findMany({
        where: { driverId: d.id, createdAt: { gte: today } },
        include: { expenses: true },
      })
      if (trips.length === 0) continue

      const totalExp = trips.reduce((s, t) => s + t.expenses.reduce((se, e) => se + e.amount, 0), 0)

      await sendWhatsApp(d.whatsappPhone,
        `📊 *${d.name} ji — aaj:*\n` +
        `${trips.length} trips | ${inr(totalExp)} kharcha\n` +
        `Safe driving! 🙏`
      )
    } catch (err) {
      console.error(`[DriverWhatsApp] Evening msg failed for ${d.name}:`, err.message)
    }
  }
}

export async function sendWeeklyReport() {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  weekAgo.setHours(0, 0, 0, 0)

  const drivers = await prisma.driver.findMany({
    where: { active: true, whatsappPhone: { not: null } },
  })

  const driverStats = []
  for (const d of drivers) {
    const count = await prisma.trip.count({ where: { driverId: d.id, createdAt: { gte: weekAgo } } })
    driverStats.push({ ...d, weekTrips: count })
  }
  driverStats.sort((a, b) => b.weekTrips - a.weekTrips)

  for (let i = 0; i < driverStats.length; i++) {
    const d = driverStats[i]
    if (d.weekTrips === 0) continue
    try {
      const expenses = await prisma.tripExpense.findMany({
        where: { trip: { driverId: d.id, createdAt: { gte: weekAgo } } },
      })
      const totalExp = expenses.reduce((s, e) => s + e.amount, 0)

      await sendWhatsApp(d.whatsappPhone,
        `📊 *${d.name} ji — hafta:*\n` +
        `${d.weekTrips} trips | ${inr(totalExp)} kharcha\n` +
        `🏆 Rank: #${i + 1}`
      )
    } catch (err) {
      console.error(`[DriverWhatsApp] Weekly msg failed for ${d.name}:`, err.message)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function downloadTwilioMedia(mediaUrl) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  const res = await fetch(mediaUrl, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
    },
  })

  if (!res.ok) throw new Error(`Media download failed: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function downloadAndSaveMedia(mediaUrl, type, phone) {
  const imageBuffer = await downloadTwilioMedia(mediaUrl)
  const dir = join(__dirname, '..', '..', 'uploads', 'drivers')
  await mkdir(dir, { recursive: true })
  const filename = `${type}-${phone}-${Date.now()}.jpg`
  await writeFile(join(dir, filename), imageBuffer)
  return `/uploads/drivers/${filename}`
}

function runPythonOCR(scriptPath, imagePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [scriptPath, imagePath], {
      env: { ...process.env, PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True' },
      timeout: 60000,
    })
    let stdout = '', stderr = ''
    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('[DriverWhatsApp OCR] stderr:', stderr)
        try { reject(new Error(JSON.parse(stdout).error || 'OCR failed')) }
        catch { reject(new Error(`OCR exited with code ${code}`)) }
        return
      }
      try {
        const r = JSON.parse(stdout)
        r.error ? reject(new Error(r.error)) : resolve(r)
      } catch { reject(new Error('Failed to parse OCR output')) }
    })
    proc.on('error', (err) => reject(new Error(`Python: ${err.message}`)))
  })
}

function getTrackingUrl(token) {
  const appUrl = process.env.APP_URL
  if (appUrl) return `${appUrl}/track.html?token=${token}`
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN
  if (railwayDomain) return `https://${railwayDomain}/track.html?token=${token}`
  return null
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s
}

export default { handleDriverMessage, sendMorningBrief, sendEveningSummary, sendWeeklyReport }
