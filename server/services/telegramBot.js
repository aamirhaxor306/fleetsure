/**
 * Fleetsure Telegram Bot Service
 * ──────────────────────────────
 * Features:
 *   📷 Send a loading slip photo  →  OCR → auto-log trip
 *   💬 Send quick text             →  parse → log trip
 *   📋 Commands: /start, /help, /status, /trips, /vehicles, /mychatid
 *   🆕 /register — multi-step driver onboarding
 *   👤 /profile  — driver info
 *   📍 Location tracking — start/end + live location
 *   ✅ /done     — mark trip as delivered + capture end location
 *
 * Uses long-polling (no webhook needed — works locally for testing).
 */

import TelegramBot from 'node-telegram-bot-api'
import prisma from '../lib/prisma.js'
import sharp from 'sharp'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdtemp, unlink, writeFile, mkdir } from 'fs/promises'
import { tmpdir } from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let bot = null
let botInfo = null

// ── State machines for multi-step flows ───────────────────────────────────
// Registration: chatId -> { step, data }
const registerState = new Map()
// Active trips per driver (for location tracking): chatId -> tripId
const activeTrips = new Map()

// ── Authorized chat IDs (loaded from env) ─────────────────────────────────
function getAllowedChats() {
  const raw = process.env.TELEGRAM_ALLOWED_CHATS || ''
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

// ── Start the bot ─────────────────────────────────────────────────────────

export async function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.log('[Telegram] No TELEGRAM_BOT_TOKEN set — bot disabled')
    return null
  }

  try {
    bot = new TelegramBot(token, { polling: true })
    botInfo = await bot.getMe()
    console.log(`[Telegram] Bot started: @${botInfo.username}`)

    // Register command handlers
    bot.onText(/\/start/, handleStart)
    bot.onText(/\/help/, handleHelp)
    bot.onText(/\/status/, handleStatus)
    bot.onText(/\/trips/, handleTrips)
    bot.onText(/\/vehicles/, handleVehicles)
    bot.onText(/\/mychatid/, handleMyChatId)
    bot.onText(/\/register/, handleRegisterStart)
    bot.onText(/\/profile/, handleProfile)
    bot.onText(/\/done/, handleDone)
    bot.onText(/\/cancel/, handleCancel)
    bot.onText(/\/insights/, handleInsights)
    bot.onText(/\/ask (.+)/, handleAsk)

    // Photo handler
    bot.on('photo', handlePhoto)
    // Location handler (both one-time and live)
    bot.on('location', handleLocation)
    // Edited message for live location updates
    bot.on('edited_message', handleEditedMessage)
    // Callback query for inline keyboards
    bot.on('callback_query', handleCallbackQuery)
    // Generic text message handler (must be last)
    bot.on('message', handleTextMessage)

    bot.on('polling_error', (err) => {
      console.error('[Telegram] Polling error:', err.message)
    })

    return bot
  } catch (err) {
    console.error('[Telegram] Failed to start bot:', err.message)
    return null
  }
}

export function getTelegramBot() {
  return bot
}

// ── Authorization ─────────────────────────────────────────────────────────

function isAuthorized(chatId) {
  const allowed = getAllowedChats()
  if (allowed.length === 0) return true
  return allowed.includes(String(chatId))
}

// ═══════════════════════════════════════════════════════════════════════════
// BASIC COMMANDS
// ═══════════════════════════════════════════════════════════════════════════

async function handleStart(msg) {
  const chatId = msg.chat.id
  if (!isAuthorized(chatId)) {
    return bot.sendMessage(chatId, '⛔ You are not authorized. Send /mychatid and share it with the admin.')
  }

  const driver = await findDriverByChatId(chatId)
  const name = driver ? driver.name : 'there'

  const welcome = `🚛 *Welcome to Fleetsure, ${name}!*

*What I can do:*
📷 Send a *loading slip photo* → auto-log trip via OCR
💬 Send *text*: \`MP04HE9634 Bhopal Indore\`
📍 Share *location* after logging a trip
✅ Send /done when trip is delivered

*Commands:*
/register — Register as a driver
/profile — Your driver info
/status — Fleet summary
/trips — Recent trips
/vehicles — Vehicle list
/done — Mark current trip as delivered
/insights — AI fleet analysis
/ask <question> — Ask AI about your fleet
/help — Full help
/mychatid — Your chat ID`

  return bot.sendMessage(chatId, welcome, { parse_mode: 'Markdown' })
}

async function handleHelp(msg) {
  const chatId = msg.chat.id
  if (!isAuthorized(chatId)) return

  const help = `📋 *Fleetsure Bot — Full Help*

*Log a trip:*
📷 Send a loading slip photo → OCR auto-logs it
💬 Text: \`MP04HE9634 Bhopal Indore\`
💬 Short: \`9634 Bhopal Indore\` (last 4 digits)

*Location tracking:*
📍 After logging a trip, share your start location
📍 Share *Live Location* for GPS tracking during the trip
✅ /done — mark delivered + share end location

*Driver:*
/register — Register yourself (name, phone, license, docs)
/profile — View your profile & assigned vehicle

*Fleet info:*
/status — Fleet overview
/trips — Last 10 trips
/vehicles — All vehicles

*AI Insights:*
/insights — AI-powered fleet analysis & recommendations
/ask <question> — Ask anything about your fleet data
  e.g. \`/ask Which vehicle earns the most?\`
  e.g. \`/ask What documents expire this month?\`

*Other:*
/cancel — Cancel current registration
/mychatid — Show your chat ID`

  return bot.sendMessage(chatId, help, { parse_mode: 'Markdown' })
}

async function handleMyChatId(msg) {
  return bot.sendMessage(msg.chat.id, `Your chat ID: \`${msg.chat.id}\`\n\nShare this with the fleet owner to get authorized.`, { parse_mode: 'Markdown' })
}

async function handleStatus(msg) {
  const chatId = msg.chat.id
  if (!isAuthorized(chatId)) return

  try {
    const [vehicleCount, tripCount, pendingTrips, driverCount] = await Promise.all([
      prisma.vehicle.count(),
      prisma.trip.count(),
      prisma.trip.count({ where: { status: 'logged' } }),
      prisma.driver.count({ where: { active: true } }),
    ])

    let status = `📊 *Fleet Status*\n\n`
    status += `🚛 Vehicles: *${vehicleCount}*\n`
    status += `👷 Drivers: *${driverCount}*\n`
    status += `📦 Total Trips: *${tripCount}*\n`
    status += `⏳ Pending Reconciliation: *${pendingTrips}*\n`

    return bot.sendMessage(chatId, status, { parse_mode: 'Markdown' })
  } catch (err) {
    console.error('[Telegram] Status error:', err)
    return bot.sendMessage(chatId, '❌ Error fetching status.')
  }
}

async function handleTrips(msg) {
  const chatId = msg.chat.id
  if (!isAuthorized(chatId)) return

  try {
    const trips = await prisma.trip.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        vehicle: { select: { vehicleNumber: true } },
        driver: { select: { name: true } },
      },
    })

    if (trips.length === 0) {
      return bot.sendMessage(chatId, '📭 No trips yet. Send a loading slip photo to log one!')
    }

    let text = `📦 *Last ${trips.length} Trips*\n\n`
    for (const t of trips) {
      const icon = t.status === 'reconciled' ? '✅' : '⏳'
      const date = t.tripDate ? new Date(t.tripDate).toLocaleDateString('en-IN') : new Date(t.createdAt).toLocaleDateString('en-IN')
      const driver = t.driver ? ` (${t.driver.name})` : ''
      text += `${icon} *${t.vehicle.vehicleNumber}*${driver}\n`
      text += `   ${shortName(t.loadingLocation)} → ${shortName(t.destination)}\n`
      text += `   ${date}${t.loadingSlipNumber ? ` | #${t.loadingSlipNumber}` : ''}\n\n`
    }

    return bot.sendMessage(chatId, text, { parse_mode: 'Markdown' })
  } catch (err) {
    console.error('[Telegram] Trips error:', err)
    return bot.sendMessage(chatId, '❌ Error fetching trips.')
  }
}

async function handleVehicles(msg) {
  const chatId = msg.chat.id
  if (!isAuthorized(chatId)) return

  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { vehicleNumber: 'asc' },
      include: { _count: { select: { trips: true } } },
    })

    if (vehicles.length === 0) {
      return bot.sendMessage(chatId, '🚛 No vehicles registered.')
    }

    let text = `🚛 *Vehicles (${vehicles.length})*\n\n`
    for (const v of vehicles) {
      text += `${v.status === 'active' ? '🟢' : '🔴'} \`${v.vehicleNumber}\` — ${v._count.trips} trips\n`
    }

    return bot.sendMessage(chatId, text, { parse_mode: 'Markdown' })
  } catch (err) {
    console.error('[Telegram] Vehicles error:', err)
    return bot.sendMessage(chatId, '❌ Error fetching vehicles.')
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AI INSIGHTS
// ═══════════════════════════════════════════════════════════════════════════

async function handleInsights(msg) {
  const chatId = msg.chat.id
  if (!isAuthorized(chatId)) return

  const waitMsg = await bot.sendMessage(chatId, '🤖 Analyzing your fleet data... please wait')

  try {
    const { generateDailyBrief } = await import('./gemini.js')
    const brief = await generateDailyBrief()

    let text = `🤖 *AI Fleet Brief*\n\n`
    for (const insight of (brief.insights || [])) {
      text += `• ${insight}\n\n`
    }
    if (brief.recommendedAction) {
      text += `💡 *Action:* ${brief.recommendedAction}\n`
    }
    text += `\n_Powered by ${brief.source === 'gemini' ? 'Gemini AI' : 'rule-based analysis'}_`

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: waitMsg.message_id,
      parse_mode: 'Markdown',
    })
  } catch (err) {
    console.error('[Telegram] Insights error:', err)
    try {
      await bot.editMessageText('❌ Could not generate insights. Try again later.', {
        chat_id: chatId,
        message_id: waitMsg.message_id,
      })
    } catch {}
  }
}

async function handleAsk(msg, match) {
  const chatId = msg.chat.id
  if (!isAuthorized(chatId)) return

  const question = match[1]?.trim()
  if (!question || question.length < 3) {
    return bot.sendMessage(chatId, '❓ Please provide a question after /ask\n\nExample: `/ask Which vehicle earns the most?`', { parse_mode: 'Markdown' })
  }

  const waitMsg = await bot.sendMessage(chatId, '🤖 Thinking...')

  try {
    const { askQuestion } = await import('./gemini.js')
    const result = await askQuestion(question)

    let text = `🤖 *Answer:*\n\n${result.answer}`
    if (result.source === 'error') {
      text = `❌ ${result.answer}`
    }

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: waitMsg.message_id,
      parse_mode: 'Markdown',
    })
  } catch (err) {
    console.error('[Telegram] Ask error:', err)
    try {
      await bot.editMessageText('❌ Could not process your question. Try again later.', {
        chat_id: chatId,
        message_id: waitMsg.message_id,
      })
    } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DRIVER REGISTRATION (multi-step conversational flow)
// ═══════════════════════════════════════════════════════════════════════════

async function handleRegisterStart(msg) {
  const chatId = msg.chat.id
  if (!isAuthorized(chatId)) return

  // Check if already registered
  const existing = await findDriverByChatId(chatId)
  if (existing) {
    return bot.sendMessage(chatId, `✅ You're already registered as *${existing.name}*.\n\nUse /profile to see your info.`, { parse_mode: 'Markdown' })
  }

  registerState.set(chatId, { step: 'name', data: {} })
  return bot.sendMessage(chatId, '👤 *Driver Registration*\n\nLet\'s get you set up! What\'s your *full name*?', { parse_mode: 'Markdown' })
}

async function handleCancel(msg) {
  const chatId = msg.chat.id
  if (registerState.has(chatId)) {
    registerState.delete(chatId)
    return bot.sendMessage(chatId, '❌ Registration cancelled.')
  }
  return bot.sendMessage(chatId, 'Nothing to cancel.')
}

async function handleRegistrationStep(msg) {
  const chatId = msg.chat.id
  const state = registerState.get(chatId)
  if (!state) return false // Not in registration flow

  const text = msg.text?.trim()

  switch (state.step) {
    case 'name':
      if (!text || text.length < 2) {
        await bot.sendMessage(chatId, '❌ Please enter a valid name.')
        return true
      }
      state.data.name = text
      state.step = 'phone'
      await bot.sendMessage(chatId, `Great, *${text}*! Now send your *phone number* (10 digits).`, { parse_mode: 'Markdown' })
      return true

    case 'phone':
      const phone = text?.replace(/[\s\-+]/g, '').replace(/^91/, '')
      if (!phone || !/^\d{10}$/.test(phone)) {
        await bot.sendMessage(chatId, '❌ Enter a valid 10-digit phone number.')
        return true
      }
      state.data.phone = phone
      state.step = 'license'
      await bot.sendMessage(chatId, '📄 Enter your *driving license number* (or type "skip"):', { parse_mode: 'Markdown' })
      return true

    case 'license':
      state.data.licenseNumber = text?.toLowerCase() === 'skip' ? null : text
      state.step = 'license_photo'
      if (state.data.licenseNumber) {
        await bot.sendMessage(chatId, '📷 Now send a *photo of your driving license* (or type "skip"):', { parse_mode: 'Markdown' })
      } else {
        state.step = 'aadhaar'
        await bot.sendMessage(chatId, '🆔 Enter your *Aadhaar number* (12 digits, or type "skip"):', { parse_mode: 'Markdown' })
      }
      return true

    case 'license_photo':
      // Text "skip" handled here
      if (text?.toLowerCase() === 'skip') {
        state.step = 'aadhaar'
        await bot.sendMessage(chatId, '🆔 Enter your *Aadhaar number* (12 digits, or type "skip"):', { parse_mode: 'Markdown' })
        return true
      }
      await bot.sendMessage(chatId, '📷 Please send a *photo* of your license, or type "skip".', { parse_mode: 'Markdown' })
      return true

    case 'aadhaar':
      const aadhaar = text?.replace(/[\s\-]/g, '')
      if (text?.toLowerCase() === 'skip') {
        state.data.aadhaarNumber = null
        state.step = 'aadhaar_photo'
        // Skip aadhaar photo too
        state.step = 'vehicle'
        await sendVehicleSelection(chatId)
      } else if (aadhaar && /^\d{12}$/.test(aadhaar)) {
        state.data.aadhaarNumber = aadhaar
        state.step = 'aadhaar_photo'
        await bot.sendMessage(chatId, '📷 Send a *photo of your Aadhaar card* (or type "skip"):', { parse_mode: 'Markdown' })
      } else {
        await bot.sendMessage(chatId, '❌ Enter a valid 12-digit Aadhaar number, or type "skip".')
      }
      return true

    case 'aadhaar_photo':
      if (text?.toLowerCase() === 'skip') {
        state.step = 'vehicle'
        await sendVehicleSelection(chatId)
        return true
      }
      await bot.sendMessage(chatId, '📷 Please send a *photo* of your Aadhaar, or type "skip".', { parse_mode: 'Markdown' })
      return true

    case 'vehicle':
      // Vehicle selection is handled by callback_query
      await bot.sendMessage(chatId, '👆 Please tap a vehicle button above, or type "skip".')
      if (text?.toLowerCase() === 'skip') {
        state.data.vehicleId = null
        await completeRegistration(chatId)
      }
      return true

    default:
      return false
  }
}

async function handleRegistrationPhoto(msg) {
  const chatId = msg.chat.id
  const state = registerState.get(chatId)
  if (!state) return false

  if (state.step === 'license_photo') {
    const url = await savePhotoFromTelegram(msg, 'license')
    state.data.licensePhotoUrl = url
    state.step = 'aadhaar'
    await bot.sendMessage(chatId, '✅ License photo saved!\n\n🆔 Enter your *Aadhaar number* (12 digits, or type "skip"):', { parse_mode: 'Markdown' })
    return true
  }

  if (state.step === 'aadhaar_photo') {
    const url = await savePhotoFromTelegram(msg, 'aadhaar')
    state.data.aadhaarPhotoUrl = url
    state.step = 'vehicle'
    await sendVehicleSelection(chatId)
    return true
  }

  return false
}

async function sendVehicleSelection(chatId) {
  const vehicles = await prisma.vehicle.findMany({
    where: { status: 'active' },
    orderBy: { vehicleNumber: 'asc' },
    take: 50,
  })

  if (vehicles.length === 0) {
    registerState.get(chatId).data.vehicleId = null
    await completeRegistration(chatId)
    return
  }

  // Build inline keyboard rows (2 per row)
  const keyboard = []
  for (let i = 0; i < vehicles.length; i += 2) {
    const row = [{ text: vehicles[i].vehicleNumber, callback_data: `reg_vehicle:${vehicles[i].id}` }]
    if (vehicles[i + 1]) {
      row.push({ text: vehicles[i + 1].vehicleNumber, callback_data: `reg_vehicle:${vehicles[i + 1].id}` })
    }
    keyboard.push(row)
  }
  keyboard.push([{ text: '⏩ Skip (no vehicle)', callback_data: 'reg_vehicle:skip' }])

  await bot.sendMessage(chatId, '🚛 *Which vehicle do you drive?*\n\nTap to select:', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard },
  })
}

async function completeRegistration(chatId) {
  const state = registerState.get(chatId)
  if (!state) return

  try {
    const data = state.data
    const driver = await prisma.driver.create({
      data: {
        name: data.name,
        phone: data.phone,
        licenseNumber: data.licenseNumber || null,
        licensePhotoUrl: data.licensePhotoUrl || null,
        aadhaarNumber: data.aadhaarNumber || null,
        aadhaarPhotoUrl: data.aadhaarPhotoUrl || null,
        vehicleId: data.vehicleId || null,
        telegramChatId: String(chatId),
      },
      include: { vehicle: { select: { vehicleNumber: true } } },
    })

    registerState.delete(chatId)

    let text = `✅ *Registration Complete!*\n\n`
    text += `👤 Name: *${driver.name}*\n`
    text += `📱 Phone: ${driver.phone}\n`
    if (driver.licenseNumber) text += `📄 License: ${driver.licenseNumber}\n`
    if (driver.vehicle) text += `🚛 Vehicle: \`${driver.vehicle.vehicleNumber}\`\n`
    text += `\n_You can now log trips by sending loading slip photos!_`

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' })
  } catch (err) {
    console.error('[Telegram] Registration error:', err)
    registerState.delete(chatId)
    if (err.code === 'P2002') {
      await bot.sendMessage(chatId, '❌ This phone number is already registered. Contact the fleet owner.')
    } else {
      await bot.sendMessage(chatId, '❌ Registration failed. Please try /register again.')
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DRIVER PROFILE
// ═══════════════════════════════════════════════════════════════════════════

async function handleProfile(msg) {
  const chatId = msg.chat.id
  if (!isAuthorized(chatId)) return

  const driver = await findDriverByChatId(chatId)
  if (!driver) {
    return bot.sendMessage(chatId, '❌ You\'re not registered yet. Use /register to sign up.')
  }

  let text = `👤 *Your Profile*\n\n`
  text += `Name: *${driver.name}*\n`
  text += `Phone: ${driver.phone}\n`
  if (driver.licenseNumber) text += `License: ${driver.licenseNumber}\n`
  if (driver.aadhaarNumber) text += `Aadhaar: ${driver.aadhaarNumber.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3')}\n`
  if (driver.vehicle) text += `Vehicle: \`${driver.vehicle.vehicleNumber}\`\n`
  text += `Status: ${driver.active ? '🟢 Active' : '🔴 Inactive'}\n`
  text += `Trips: ${driver._count.trips}`

  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown' })
}

// ═══════════════════════════════════════════════════════════════════════════
// PHOTO HANDLER (loading slip OCR + registration photos)
// ═══════════════════════════════════════════════════════════════════════════

async function handlePhoto(msg) {
  const chatId = msg.chat.id
  if (!isAuthorized(chatId)) return
  if (msg.caption && msg.caption.startsWith('/')) return

  // Check if we're in registration flow needing a photo
  const handledByReg = await handleRegistrationPhoto(msg)
  if (handledByReg) return

  // Otherwise treat as loading slip OCR
  const processingMsg = await bot.sendMessage(chatId, '🔍 Processing loading slip... please wait')

  let tempDir = null
  let processedPath = null

  try {
    const photo = msg.photo[msg.photo.length - 1]
    const file = await bot.getFile(photo.file_id)
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`

    const response = await fetch(fileUrl)
    const imageBuffer = Buffer.from(await response.arrayBuffer())

    // Save the original image for the trip detail page
    const uploadsDir = join(__dirname, '..', '..', 'uploads', 'loading-slips')
    await mkdir(uploadsDir, { recursive: true })
    const slipFilename = `slip-${Date.now()}.jpg`
    const slipPath = join(uploadsDir, slipFilename)
    await writeFile(slipPath, imageBuffer)
    const slipImageUrl = `/uploads/loading-slips/${slipFilename}`

    // Preprocess for OCR
    tempDir = await mkdtemp(join(tmpdir(), 'fleetsure-tg-'))
    processedPath = join(tempDir, 'processed.jpg')

    await sharp(imageBuffer)
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1.5 })
      .jpeg({ quality: 95 })
      .toFile(processedPath)

    const pythonScript = join(__dirname, '..', 'ocr', 'process_loading_slip.py')
    const ocrResult = await runPythonOCR(pythonScript, processedPath)

    if (ocrResult.error) {
      await bot.editMessageText(`❌ OCR Error: ${ocrResult.error}`, { chat_id: chatId, message_id: processingMsg.message_id })
      return
    }

    // Match vehicle
    let vehicle = null
    if (ocrResult.vehicleNumber) {
      vehicle = await prisma.vehicle.findFirst({
        where: { vehicleNumber: { contains: ocrResult.vehicleNumber, mode: 'insensitive' } },
      })
      if (!vehicle) {
        const cleanNum = ocrResult.vehicleNumber.replace(/[\s\-.]/g, '').toUpperCase()
        vehicle = await prisma.vehicle.findFirst({ where: { vehicleNumber: cleanNum } })
      }
    }

    if (!vehicle) {
      let text = `📋 *Loading Slip Scanned*\n\n`
      text += `🔤 Vehicle: \`${ocrResult.vehicleNumber || 'Not detected'}\`\n`
      text += `📄 Slip #: ${ocrResult.loadingSlipNumber || 'Not detected'}\n`
      text += `📅 Date: ${ocrResult.tripDate || 'Not detected'}\n`
      text += `🏭 From: ${ocrResult.originPlant || 'Not detected'}\n`
      text += `📍 To: ${ocrResult.destinationPlant || 'Not detected'}\n`
      text += `\n⚠️ *Vehicle not found.* Register it in Fleetsure first.`

      await bot.editMessageText(text, { chat_id: chatId, message_id: processingMsg.message_id, parse_mode: 'Markdown' })
      return
    }

    // Find driver by chat ID
    const driver = await findDriverByChatId(chatId)

    // Create the trip
    const trip = await prisma.trip.create({
      data: {
        vehicleId: vehicle.id,
        driverId: driver?.id || null,
        loadingLocation: ocrResult.originPlant || 'Unknown',
        destination: ocrResult.destinationPlant || 'Unknown',
        freightAmount: null,
        distance: 0, ratePerKm: 0, fuelLitres: 0, dieselRate: 0,
        fuelExpense: 0, toll: 0, cashExpense: 0,
        status: 'logged',
        tripDate: ocrResult.tripDate ? new Date(ocrResult.tripDate) : null,
        loadingSlipNumber: ocrResult.loadingSlipNumber || null,
        loadingSlipImageUrl: slipImageUrl,
      },
    })

    // Set as active trip for this driver (for location tracking)
    activeTrips.set(chatId, trip.id)

    let text = `✅ *Trip Logged!*\n\n`
    text += `🚛 Vehicle: \`${vehicle.vehicleNumber}\`\n`
    text += `🏭 From: ${ocrResult.originPlant || 'Unknown'}\n`
    text += `📍 To: ${ocrResult.destinationPlant || 'Unknown'}\n`
    text += `📄 Slip: ${ocrResult.loadingSlipNumber || '—'}\n`
    text += `📅 Date: ${ocrResult.tripDate || '—'}\n`
    text += `🔍 Confidence: ${Math.round((ocrResult.ocrConfidence || 0) * 100)}%\n`

    await bot.editMessageText(text, { chat_id: chatId, message_id: processingMsg.message_id, parse_mode: 'Markdown' })

    // Ask for start location
    await bot.sendMessage(chatId, '📍 *Share your current location* to record the start point of this trip.\n\nYou can also share *Live Location* for GPS tracking during the trip.', {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [[{ text: '📍 Share Location', request_location: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    })
  } catch (err) {
    console.error('[Telegram] Photo error:', err)
    try {
      await bot.editMessageText(`❌ Error: ${err.message}`, { chat_id: chatId, message_id: processingMsg.message_id })
    } catch {}
  } finally {
    try {
      if (processedPath) await unlink(processedPath).catch(() => {})
      if (tempDir) { const { rmdir } = await import('fs/promises'); await rmdir(tempDir).catch(() => {}) }
    } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOCATION HANDLING
// ═══════════════════════════════════════════════════════════════════════════

async function handleLocation(msg) {
  const chatId = msg.chat.id
  if (!isAuthorized(chatId)) return
  if (!msg.location) return

  const { latitude, longitude } = msg.location
  const rawTripId = activeTrips.get(chatId)
  const driver = await findDriverByChatId(chatId)

  if (!rawTripId) {
    await bot.sendMessage(chatId, '📍 Location received but no active trip.\nLog a trip first, then share location.', {
      reply_markup: { remove_keyboard: true },
    })
    return
  }

  // Check if this is an end-location capture (after /done)
  const isDone = typeof rawTripId === 'string' && rawTripId.startsWith('done:')
  const tripId = isDone ? rawTripId.replace('done:', '') : rawTripId

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { vehicle: { select: { vehicleNumber: true } } },
  })
  if (!trip) {
    activeTrips.delete(chatId)
    return
  }

  if (isDone) {
    // Save as end location
    await prisma.trip.update({
      where: { id: tripId },
      data: { endLat: latitude, endLng: longitude },
    })

    if (driver) {
      await prisma.locationLog.create({
        data: { driverId: driver.id, tripId, latitude, longitude },
      })
    }

    activeTrips.delete(chatId)

    await bot.sendMessage(chatId, `🏁 *Trip Delivered!*\n\n🚛 ${trip.vehicle.vehicleNumber}\n${shortName(trip.loadingLocation)} → ${shortName(trip.destination)}\n📍 End: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}\n\n✅ Trip complete. Send another loading slip to start a new trip.`, {
      parse_mode: 'Markdown',
      reply_markup: { remove_keyboard: true },
    })
    return
  }

  // If trip has no start location, save as start
  if (!trip.startLat) {
    await prisma.trip.update({
      where: { id: tripId },
      data: { startLat: latitude, startLng: longitude },
    })

    if (driver) {
      await prisma.locationLog.create({
        data: { driverId: driver.id, tripId, latitude, longitude },
      })
    }

    await bot.sendMessage(chatId, `✅ *Start location recorded!*\n📍 ${latitude.toFixed(4)}, ${longitude.toFixed(4)}\n\n💡 Tip: Share *Live Location* for continuous GPS tracking.\nSend /done when you arrive at the destination.`, {
      parse_mode: 'Markdown',
      reply_markup: { remove_keyboard: true },
    })
  } else {
    // Subsequent location — save as location log point
    if (driver) {
      await prisma.locationLog.create({
        data: { driverId: driver.id, tripId, latitude, longitude },
      })
    }
    await bot.sendMessage(chatId, `📍 Location logged: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, {
      reply_markup: { remove_keyboard: true },
    })
  }
}

async function handleEditedMessage(msg) {
  // Live location updates come as edited_message with location
  if (!msg.location) return

  const chatId = msg.chat.id
  const { latitude, longitude } = msg.location
  const tripId = activeTrips.get(chatId)
  const driver = await findDriverByChatId(chatId)

  if (!tripId || !driver) return

  // Silently log the location (no message to driver for live updates)
  try {
    await prisma.locationLog.create({
      data: { driverId: driver.id, tripId, latitude, longitude },
    })
  } catch (err) {
    console.error('[Telegram] Live location log error:', err.message)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// /done — Mark trip as delivered
// ═══════════════════════════════════════════════════════════════════════════

async function handleDone(msg) {
  const chatId = msg.chat.id
  if (!isAuthorized(chatId)) return

  const tripId = activeTrips.get(chatId)
  if (!tripId) {
    return bot.sendMessage(chatId, '❌ No active trip. Log a trip first by sending a loading slip photo.')
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { vehicle: { select: { vehicleNumber: true } } },
  })

  if (!trip) {
    activeTrips.delete(chatId)
    return bot.sendMessage(chatId, '❌ Trip not found.')
  }

  // Ask for delivery location
  await bot.sendMessage(chatId, `🏁 *Trip Complete!*\n\n🚛 ${trip.vehicle.vehicleNumber}\n${shortName(trip.loadingLocation)} → ${shortName(trip.destination)}\n\n📍 Share your *delivery location* to finish:`, {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [[{ text: '📍 Share Delivery Location', request_location: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  })

  // Set a flag that the next location is the end location
  // We'll check in handleLocation if trip already has startLat but no endLat
  // Actually let's just save the end location when they share it
  // We mark the trip done now - location handler will save endLat/endLng
  activeTrips.set(chatId, `done:${tripId}`)
}

// ═══════════════════════════════════════════════════════════════════════════
// CALLBACK QUERY (inline keyboard buttons)
// ═══════════════════════════════════════════════════════════════════════════

async function handleCallbackQuery(query) {
  const chatId = query.message.chat.id
  const data = query.data

  // Vehicle selection during registration
  if (data.startsWith('reg_vehicle:')) {
    const vehicleId = data.split(':')[1]
    const state = registerState.get(chatId)
    if (!state) {
      await bot.answerCallbackQuery(query.id, { text: 'Registration expired. Start again with /register' })
      return
    }

    state.data.vehicleId = vehicleId === 'skip' ? null : vehicleId
    await bot.answerCallbackQuery(query.id, { text: '✅ Selected!' })
    await completeRegistration(chatId)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEXT MESSAGE HANDLER (quick trip + registration steps)
// ═══════════════════════════════════════════════════════════════════════════

async function handleTextMessage(msg) {
  const chatId = msg.chat.id
  if (!isAuthorized(chatId)) return
  if (!msg.text || msg.text.startsWith('/')) return
  if (msg.photo || msg.location) return

  // Check if in registration flow
  const handledByReg = await handleRegistrationStep(msg)
  if (handledByReg) return

  const text = msg.text.trim()
  const parts = text.split(/\s+/)

  if (parts.length < 3) {
    return bot.sendMessage(chatId,
      `💡 To log a trip:\n\`VEHICLE_NUMBER FROM TO\`\n\nExample: \`MP04HE9634 Bhopal Indore\`\n\nOr send a 📷 loading slip photo.\nType /help for all commands.`,
      { parse_mode: 'Markdown' }
    )
  }

  const vehicleInput = parts[0].toUpperCase()
  const from = parts[1]
  const to = parts.slice(2).join(' ')

  try {
    let vehicle = await prisma.vehicle.findFirst({
      where: { vehicleNumber: { contains: vehicleInput, mode: 'insensitive' } },
    })

    if (!vehicle && /^\d{4}$/.test(vehicleInput)) {
      vehicle = await prisma.vehicle.findFirst({
        where: { vehicleNumber: { endsWith: vehicleInput } },
      })
    }

    if (!vehicle) {
      return bot.sendMessage(chatId, `⚠️ Vehicle \`${vehicleInput}\` not found. Check /vehicles.`, { parse_mode: 'Markdown' })
    }

    const driver = await findDriverByChatId(chatId)

    const trip = await prisma.trip.create({
      data: {
        vehicleId: vehicle.id,
        driverId: driver?.id || null,
        loadingLocation: capitalize(from),
        destination: capitalize(to),
        freightAmount: null,
        distance: 0, ratePerKm: 0, fuelLitres: 0, dieselRate: 0,
        fuelExpense: 0, toll: 0, cashExpense: 0,
        status: 'logged',
        tripDate: new Date(),
      },
    })

    activeTrips.set(chatId, trip.id)

    let reply = `✅ *Quick Trip Logged!*\n\n`
    reply += `🚛 Vehicle: \`${vehicle.vehicleNumber}\`\n`
    reply += `🏭 From: ${capitalize(from)}\n`
    reply += `📍 To: ${capitalize(to)}\n`
    reply += `📅 Date: ${new Date().toLocaleDateString('en-IN')}\n`

    await bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' })

    // Ask for location
    await bot.sendMessage(chatId, '📍 Share your *start location*:', {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [[{ text: '📍 Share Location', request_location: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    })
  } catch (err) {
    console.error('[Telegram] Text trip error:', err)
    return bot.sendMessage(chatId, '❌ Error logging trip.')
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function findDriverByChatId(chatId) {
  return prisma.driver.findUnique({
    where: { telegramChatId: String(chatId) },
    include: {
      vehicle: { select: { vehicleNumber: true } },
      _count: { select: { trips: true } },
    },
  })
}

async function savePhotoFromTelegram(msg, type) {
  try {
    const photo = msg.photo[msg.photo.length - 1]
    const file = await bot.getFile(photo.file_id)
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`

    const response = await fetch(fileUrl)
    const buffer = Buffer.from(await response.arrayBuffer())

    const dir = join(__dirname, '..', '..', 'uploads', 'drivers')
    await mkdir(dir, { recursive: true })
    const filename = `${type}-${msg.chat.id}-${Date.now()}.jpg`
    await writeFile(join(dir, filename), buffer)

    return `/uploads/drivers/${filename}`
  } catch (err) {
    console.error('[Telegram] Save photo error:', err)
    return null
  }
}

function runPythonOCR(scriptPath, imagePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [scriptPath, imagePath], {
      env: { ...process.env, PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True' },
      timeout: 60000,
    })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('[Telegram OCR] stderr:', stderr)
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

function shortName(loc) {
  if (!loc) return 'Unknown'
  const parts = loc.split(' - ')
  return parts.length > 1 ? parts.slice(1).join(' - ').trim() : loc
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s
}

export default { startTelegramBot, getTelegramBot }
