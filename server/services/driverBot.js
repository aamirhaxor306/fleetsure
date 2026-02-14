/**
 * Fleetsure Driver Bot — @fleetsure_driver_bot
 * ─────────────────────────────────────────────
 * Hindi-first conversational bot for truck drivers.
 *
 * Flows:
 *   1. Onboarding  — name, phone, fleet code, vehicle (60 sec)
 *   2. Trip start  — photo OCR / saved route / text
 *   3. Expenses    — ⛽ fuel, 🛣️ toll, 💰 cash (buttons during trip)
 *   4. Trip end    — delivery confirm + location + summary
 *   5. Push msgs   — morning assignment, evening summary, doc alerts
 *   6. Progressive — license/aadhaar after 5/10 trips
 *
 * State machine per chat:
 *   idle → onboarding_* → idle
 *   idle → trip_active → logging_fuel|logging_toll|logging_cash → trip_active
 *   trip_active → trip_ending → idle
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

// ── Per-chat state ────────────────────────────────────────────────────────
// chatId → { state, data }
const chatState = new Map()

function getState(chatId) {
  return chatState.get(chatId) || { state: 'idle', data: {} }
}
function setState(chatId, state, extra = {}) {
  const current = chatState.get(chatId) || { state: 'idle', data: {} }
  chatState.set(chatId, { ...current, state, data: { ...current.data, ...extra } })
}
function clearState(chatId) {
  chatState.set(chatId, { state: 'idle', data: {} })
}

/** Resolve tenantId for a driver by their Telegram chat ID. Returns null if driver unknown (e.g. during onboarding). */
async function getTenantIdForDriver(chatId) {
  const driver = await prisma.driver.findFirst({
    where: { telegramChatId: String(chatId) },
  })
  return driver?.tenantId || null
}

// ═══════════════════════════════════════════════════════════════════════════
// KEYBOARDS
// ═══════════════════════════════════════════════════════════════════════════

const HOME_KEYBOARD = {
  keyboard: [
    [{ text: '🚀 Naya Trip Shuru Karo' }],
    [{ text: '📊 Mera Status' }, { text: '👤 Meri Profile' }],
    [{ text: '📞 Help' }],
  ],
  resize_keyboard: true,
}

const ACTIVE_TRIP_KEYBOARD = {
  keyboard: [
    [{ text: '⛽ Diesel Bhara' }, { text: '🛣️ Toll Diya' }],
    [{ text: '💰 Cash Kharcha' }],
    [{ text: '🏁 Pahunch Gaya — Trip Khatam' }],
  ],
  resize_keyboard: true,
}

const LOCATION_KEYBOARD = {
  keyboard: [[{ text: '📍 Location Bhejo', request_location: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
}

// ═══════════════════════════════════════════════════════════════════════════
// START BOT
// ═══════════════════════════════════════════════════════════════════════════

export async function startDriverBot() {
  const token = process.env.TELEGRAM_DRIVER_BOT_TOKEN
  if (!token) {
    console.log('[DriverBot] No TELEGRAM_DRIVER_BOT_TOKEN — disabled')
    return null
  }

  try {
    bot = new TelegramBot(token, { polling: true })
    const me = await bot.getMe()
    console.log(`[DriverBot] Started: @${me.username}`)

    // Command handlers
    bot.onText(/\/start/, onStart)
    bot.onText(/\/help/, onHelp)
    bot.onText(/\/cancel/, onCancel)

    // Media handlers
    bot.on('photo', onPhoto)
    bot.on('location', onLocation)
    bot.on('edited_message', onEditedMessage)
    bot.on('callback_query', onCallbackQuery)

    // Generic text — must be last
    bot.on('message', onMessage)

    bot.on('polling_error', (err) => {
      console.error('[DriverBot] Polling error:', err.message)
    })

    return bot
  } catch (err) {
    console.error('[DriverBot] Failed to start:', err.message)
    return null
  }
}

export function getDriverBot() { return bot }

// ═══════════════════════════════════════════════════════════════════════════
// /start — ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════

async function onStart(msg) {
  const chatId = msg.chat.id

  // Already registered?
  const driver = await findDriver(chatId)
  if (driver) {
    return bot.sendMessage(chatId,
      `🚛 Swagat hai wapas, *${driver.name}* ji!\n\nTrip shuru karne ke liye neeche button dabao.`,
      { parse_mode: 'Markdown', reply_markup: HOME_KEYBOARD })
  }

  // Start onboarding
  setState(chatId, 'onboarding_name')
  return bot.sendMessage(chatId,
    `🚛 *Fleetsure mein aapka swagat hai!*\n\n` +
    `Yeh app aapke fleet owner ne bheja hai.\n` +
    `Isse aap trip log kar sakte ho, kharcha track\n` +
    `kar sakte ho, aur location share kar sakte ho.\n\n` +
    `Shuru karte hain! *Aapka naam batayiye:*`,
    { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } })
}

// ═══════════════════════════════════════════════════════════════════════════
// /help
// ═══════════════════════════════════════════════════════════════════════════

async function onHelp(msg) {
  const chatId = msg.chat.id
  const driver = await findDriver(chatId)
  const kb = driver ? (getState(chatId).data.activeTripId ? ACTIVE_TRIP_KEYBOARD : HOME_KEYBOARD) : undefined

  return bot.sendMessage(chatId,
    `📋 *Fleetsure Driver Bot — Help*\n\n` +
    `*Trip kaise log kare:*\n` +
    `🚀 "Naya Trip" button dabao\n` +
    `📷 Loading slip ki photo bhejo\n` +
    `✏️ Ya likhke bhejo: \`Bhopal Indore\`\n\n` +
    `*Trip ke dauran:*\n` +
    `⛽ Diesel Bhara — fuel log karo\n` +
    `🛣️ Toll Diya — toll amount daalo\n` +
    `💰 Cash Kharcha — khana/repair etc.\n` +
    `🏁 Pahunch Gaya — trip khatam karo\n\n` +
    `*Other:*\n` +
    `📊 Mera Status — aaj/hafte ka summary\n` +
    `👤 Meri Profile — aapki jaankari\n` +
    `📍 Live Location share karo — GPS tracking\n\n` +
    `/cancel — current action cancel karo`,
    { parse_mode: 'Markdown', reply_markup: kb })
}

async function onCancel(msg) {
  const chatId = msg.chat.id
  const { state } = getState(chatId)
  if (state === 'idle') {
    return bot.sendMessage(chatId, 'Kuch cancel karne ko nahi hai.')
  }
  clearState(chatId)
  const driver = await findDriver(chatId)
  return bot.sendMessage(chatId, '❌ Cancel ho gaya.',
    { reply_markup: driver ? HOME_KEYBOARD : { remove_keyboard: true } })
}

// ═══════════════════════════════════════════════════════════════════════════
// CALLBACK QUERY (inline keyboard buttons)
// ═══════════════════════════════════════════════════════════════════════════

async function onCallbackQuery(query) {
  const chatId = query.message.chat.id
  const data = query.data

  try {
    // Vehicle selection during onboarding
    if (data.startsWith('ob_vehicle:')) {
      const vehicleId = data.split(':')[1]
      const { state } = getState(chatId)
      if (state !== 'onboarding_vehicle') {
        return bot.answerCallbackQuery(query.id, { text: 'Expired. /start se shuru karo.' })
      }
      await bot.answerCallbackQuery(query.id, { text: '✅ Selected!' })
      await completeOnboarding(chatId, vehicleId === 'skip' ? null : vehicleId)
      return
    }

    // Saved route selection for new trip
    if (data.startsWith('route:')) {
      const routeId = data.split(':')[1]
      const { state } = getState(chatId)
      if (state !== 'trip_select_route') {
        return bot.answerCallbackQuery(query.id, { text: 'Expired.' })
      }
      await bot.answerCallbackQuery(query.id, { text: '✅' })

      if (routeId === 'custom') {
        setState(chatId, 'trip_custom_route')
        return bot.sendMessage(chatId, '✏️ Route likho (e.g. `Bhopal Indore`):', { parse_mode: 'Markdown' })
      }

      const tenantId = await getTenantIdForDriver(chatId)
      const route = await prisma.savedRoute.findFirst({
        where: { id: routeId, ...(tenantId && { tenantId }) },
      })
      if (!route) {
        return bot.sendMessage(chatId, '❌ Route nahi mila.')
      }
      await startTrip(chatId, route.loadingLocation, route.destination)
      return
    }

    // Fuel litre selection
    if (data.startsWith('fuel_l:')) {
      const litres = data.split(':')[1]
      const { state } = getState(chatId)
      if (state !== 'logging_fuel_litres') {
        return bot.answerCallbackQuery(query.id, { text: 'Expired.' })
      }
      await bot.answerCallbackQuery(query.id, { text: `${litres}L ✅` })

      if (litres === 'other') {
        setState(chatId, 'logging_fuel_litres_custom')
        return bot.sendMessage(chatId, '⛽ Kitne litre bhara? Number likho:')
      }

      setState(chatId, 'logging_fuel_amount', { fuelLitres: parseFloat(litres) })
      return bot.sendMessage(chatId, `💰 ${litres}L ka total kitna hua? (₹ mein likho)`)
    }

    // Toll amount selection
    if (data.startsWith('toll:')) {
      const amt = data.split(':')[1]
      const { state } = getState(chatId)
      if (state !== 'logging_toll') {
        return bot.answerCallbackQuery(query.id, { text: 'Expired.' })
      }
      await bot.answerCallbackQuery(query.id, { text: `₹${amt} ✅` })

      if (amt === 'other') {
        setState(chatId, 'logging_toll_custom')
        return bot.sendMessage(chatId, '🛣️ Toll kitna laga? (₹ mein likho)')
      }

      await saveTollExpense(chatId, parseFloat(amt))
      return
    }

    // Cash expense type
    if (data.startsWith('cash_type:')) {
      const type = data.split(':')[1]
      const { state } = getState(chatId)
      if (state !== 'logging_cash_type') {
        return bot.answerCallbackQuery(query.id, { text: 'Expired.' })
      }
      await bot.answerCallbackQuery(query.id, { text: '✅' })
      setState(chatId, 'logging_cash_amount', { cashType: type })
      const labels = { food: '🍽️ Khana', repair: '🔧 Repair', parking: '🅿️ Parking', room: '🏨 Room', other: '📝 Other' }
      return bot.sendMessage(chatId, `${labels[type] || type} — kitna kharcha? (₹ mein likho)`)
    }

    // Delivery confirmation
    if (data === 'delivered_yes') {
      await bot.answerCallbackQuery(query.id, { text: '✅' })
      setState(chatId, 'trip_end_location')
      return bot.sendMessage(chatId, '📍 Delivery location bhejo:', { reply_markup: LOCATION_KEYBOARD })
    }
    if (data === 'delivered_no') {
      await bot.answerCallbackQuery(query.id, { text: '↩️' })
      // Keep trip active, driver is returning
      const { data: d } = getState(chatId)
      setState(chatId, 'trip_active')
      return bot.sendMessage(chatId,
        '↩️ Theek hai, wapas ja rahe ho. Trip abhi active hai.\n\nPahunchne pe "🏁 Pahunch Gaya" dabao.',
        { reply_markup: ACTIVE_TRIP_KEYBOARD })
    }

    // Skip receipt photo
    if (data === 'skip_receipt') {
      await bot.answerCallbackQuery(query.id, { text: '⏩' })
      clearState(chatId)
      return bot.sendMessage(chatId,
        '✅ Trip complete! Naya trip shuru karne ke liye button dabao.',
        { reply_markup: HOME_KEYBOARD })
    }
  } catch (err) {
    console.error('[DriverBot] Callback error:', err)
    try { await bot.answerCallbackQuery(query.id, { text: '❌ Error' }) } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PHOTO HANDLER
// ═══════════════════════════════════════════════════════════════════════════

async function onPhoto(msg) {
  const chatId = msg.chat.id
  const { state, data } = getState(chatId)
  const driver = await findDriver(chatId)
  if (!driver) return

  // Receipt photo after trip (tenantId from driver)
  if (state === 'trip_receipt') {
    try {
      await savePhotoFromTelegram(msg, 'receipt')
      clearState(chatId)
      return bot.sendMessage(chatId, '✅ Receipt saved! Naya trip shuru karo.',
        { reply_markup: HOME_KEYBOARD })
    } catch {
      return bot.sendMessage(chatId, '❌ Photo save nahi ho payi. Skip karo.',
        { reply_markup: HOME_KEYBOARD })
    }
  }

  // Document upload (progressive)
  if (state === 'uploading_license') {
    const url = await savePhotoFromTelegram(msg, 'license')
    if (url) {
      await prisma.driver.update({ where: { id: driver.id }, data: { licensePhotoUrl: url } })
    }
    clearState(chatId)
    return bot.sendMessage(chatId, '✅ License photo saved! Dhanyavaad 🙏',
      { reply_markup: data.activeTripId ? ACTIVE_TRIP_KEYBOARD : HOME_KEYBOARD })
  }
  if (state === 'uploading_aadhaar') {
    const url = await savePhotoFromTelegram(msg, 'aadhaar')
    if (url) {
      await prisma.driver.update({ where: { id: driver.id }, data: { aadhaarPhotoUrl: url } })
    }
    clearState(chatId)
    return bot.sendMessage(chatId, '✅ Aadhaar photo saved! Aap verified ho ✅🙏',
      { reply_markup: data.activeTripId ? ACTIVE_TRIP_KEYBOARD : HOME_KEYBOARD })
  }

  // Loading slip OCR → auto-log trip
  if (state === 'idle' || state === 'trip_select_route') {
    await handleLoadingSlipOCR(chatId, msg, driver)
    return
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOCATION HANDLER
// ═══════════════════════════════════════════════════════════════════════════

async function onLocation(msg) {
  const chatId = msg.chat.id
  if (!msg.location) return
  const driver = await findDriver(chatId)
  if (!driver) return

  const { latitude, longitude } = msg.location
  const { state, data } = getState(chatId)
  const tripId = data.activeTripId

  // Start location for new trip
  if (state === 'trip_start_location' && tripId) {
    await prisma.trip.update({
      where: { id: tripId },
      data: { startLat: latitude, startLng: longitude },
    })
    await prisma.locationLog.create({
      data: { tenantId: driver.tenantId, driverId: driver.id, tripId, latitude, longitude },
    })

    setState(chatId, 'trip_active')
    await bot.sendMessage(chatId,
      `✅ Start location saved!\n🛣️ Safe trip, ${driver.name} ji! 🙏\n\n` +
      `Trip ke dauran kharcha log karo:`,
      { reply_markup: ACTIVE_TRIP_KEYBOARD })

    // Send GPS tracking Mini App button
    const trackUrl = `${process.env.MINI_APP_URL || 'https://fleetsure.local'}/track.html?tripId=${tripId}&driverId=${driver.id}`
    await bot.sendMessage(chatId,
      `🛰️ *Live GPS Tracking* — speed aur driving behavior track karo:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{
            text: '🛰️ GPS Tracking Shuru Karo',
            web_app: { url: trackUrl },
          }]],
        },
      })
    return
  }

  // End location after delivery
  if (state === 'trip_end_location' && tripId) {
    await prisma.trip.update({
      where: { id: tripId },
      data: { endLat: latitude, endLng: longitude },
    })
    await prisma.locationLog.create({
      data: { tenantId: driver.tenantId, driverId: driver.id, tripId, latitude, longitude },
    })

    await showTripSummary(chatId, tripId, driver)
    return
  }

  // Mid-trip location point
  if (state === 'trip_active' && tripId) {
    await prisma.locationLog.create({
      data: { tenantId: driver.tenantId, driverId: driver.id, tripId, latitude, longitude },
    })
    return bot.sendMessage(chatId, `📍 Location logged!`, { reply_markup: ACTIVE_TRIP_KEYBOARD })
  }
}

async function onEditedMessage(msg) {
  // Live location updates
  if (!msg.location) return
  const chatId = msg.chat.id
  const driver = await findDriver(chatId)
  if (!driver) return
  const { data } = getState(chatId)
  if (!data.activeTripId) return

  try {
    await prisma.locationLog.create({
      data: {
        tenantId: driver.tenantId,
        driverId: driver.id,
        tripId: data.activeTripId,
        latitude: msg.location.latitude,
        longitude: msg.location.longitude,
      },
    })
  } catch (err) {
    console.error('[DriverBot] Live location error:', err.message)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERIC MESSAGE HANDLER (text + button presses)
// ═══════════════════════════════════════════════════════════════════════════

async function onMessage(msg) {
  const chatId = msg.chat.id
  if (!msg.text) return
  if (msg.text.startsWith('/')) return
  if (msg.photo || msg.location) return

  const text = msg.text.trim()
  const { state, data } = getState(chatId)
  const driver = await findDriver(chatId)

  // ── ONBOARDING STEPS ──────────────────────────────────────────────
  if (state === 'onboarding_name') {
    if (text.length < 2) return bot.sendMessage(chatId, '❌ Sahi naam likho (kam se kam 2 akshar)')
    setState(chatId, 'onboarding_phone', { name: text })
    return bot.sendMessage(chatId, `📱 *${text}* ji, aapka phone number bhejiye (10 digit):`, { parse_mode: 'Markdown' })
  }

  if (state === 'onboarding_phone') {
    const phone = text.replace(/[\s\-+]/g, '').replace(/^91/, '')
    if (!/^\d{10}$/.test(phone)) return bot.sendMessage(chatId, '❌ 10 digit ka sahi phone number daalo.')
    setState(chatId, 'onboarding_code', { phone })
    const code = process.env.FLEET_INVITE_CODE || 'FLEET-7X2K'
    return bot.sendMessage(chatId,
      `🔑 Fleet owner ne ek code diya hoga.\nWoh code bhejiye:\n_(e.g. ${code})_`,
      { parse_mode: 'Markdown' })
  }

  if (state === 'onboarding_code') {
    const expected = (process.env.FLEET_INVITE_CODE || 'FLEET-7X2K').toUpperCase()
    if (text.toUpperCase() !== expected) {
      return bot.sendMessage(chatId, '❌ Galat code. Fleet owner se sahi code lo aur dobara bhejo.')
    }
    setState(chatId, 'onboarding_vehicle')
    await sendVehicleSelection(chatId)
    return
  }

  if (state === 'onboarding_vehicle') {
    if (text.toLowerCase() === 'skip') {
      return completeOnboarding(chatId, null)
    }
    return bot.sendMessage(chatId, '👆 Upar se gaadi chuno ya "skip" likho.')
  }

  // ── NOT REGISTERED ────────────────────────────────────────────────
  if (!driver) {
    return bot.sendMessage(chatId,
      '🚛 Pehle register karo!\n/start bhejo shuru karne ke liye.',
      { reply_markup: { remove_keyboard: true } })
  }

  // ── HOME BUTTONS ──────────────────────────────────────────────────
  if (text === '🚀 Naya Trip Shuru Karo') {
    return handleNewTrip(chatId, driver)
  }
  if (text === '📊 Mera Status') {
    return handleMyStatus(chatId, driver)
  }
  if (text === '👤 Meri Profile') {
    return handleMyProfile(chatId, driver)
  }
  if (text === '📞 Help') {
    return onHelp(msg)
  }

  // ── ACTIVE TRIP BUTTONS ───────────────────────────────────────────
  if (text === '⛽ Diesel Bhara') {
    if (!data.activeTripId) return bot.sendMessage(chatId, 'Pehle trip shuru karo!', { reply_markup: HOME_KEYBOARD })
    setState(chatId, 'logging_fuel_litres')
    return bot.sendMessage(chatId, '⛽ Kitne litre bhara?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '20L', callback_data: 'fuel_l:20' }, { text: '30L', callback_data: 'fuel_l:30' }, { text: '40L', callback_data: 'fuel_l:40' }],
          [{ text: '50L', callback_data: 'fuel_l:50' }, { text: '60L', callback_data: 'fuel_l:60' }, { text: 'Other', callback_data: 'fuel_l:other' }],
        ],
      },
    })
  }

  if (text === '🛣️ Toll Diya') {
    if (!data.activeTripId) return bot.sendMessage(chatId, 'Pehle trip shuru karo!', { reply_markup: HOME_KEYBOARD })
    setState(chatId, 'logging_toll')
    return bot.sendMessage(chatId, '🛣️ Toll kitna laga?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '₹100', callback_data: 'toll:100' }, { text: '₹200', callback_data: 'toll:200' }, { text: '₹350', callback_data: 'toll:350' }],
          [{ text: '₹500', callback_data: 'toll:500' }, { text: '₹750', callback_data: 'toll:750' }, { text: 'Other', callback_data: 'toll:other' }],
        ],
      },
    })
  }

  if (text === '💰 Cash Kharcha') {
    if (!data.activeTripId) return bot.sendMessage(chatId, 'Pehle trip shuru karo!', { reply_markup: HOME_KEYBOARD })
    setState(chatId, 'logging_cash_type')
    return bot.sendMessage(chatId, 'Kya kharcha hua?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🍽️ Khana', callback_data: 'cash_type:food' }, { text: '🔧 Repair', callback_data: 'cash_type:repair' }],
          [{ text: '🅿️ Parking', callback_data: 'cash_type:parking' }, { text: '🏨 Room', callback_data: 'cash_type:room' }],
          [{ text: '📝 Other', callback_data: 'cash_type:other' }],
        ],
      },
    })
  }

  if (text === '🏁 Pahunch Gaya — Trip Khatam') {
    if (!data.activeTripId) return bot.sendMessage(chatId, 'Koi active trip nahi hai.', { reply_markup: HOME_KEYBOARD })
    return handleTripEnd(chatId, data.activeTripId)
  }

  // ── MID-FLOW TEXT INPUTS ──────────────────────────────────────────
  if (state === 'logging_fuel_litres_custom') {
    const litres = parseFloat(text)
    if (isNaN(litres) || litres <= 0) return bot.sendMessage(chatId, '❌ Sahi number daalo (e.g. 35)')
    setState(chatId, 'logging_fuel_amount', { fuelLitres: litres })
    return bot.sendMessage(chatId, `💰 ${litres}L ka total kitna hua? (₹ mein likho)`)
  }

  if (state === 'logging_fuel_amount') {
    const amount = parseFloat(text)
    if (isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, '❌ Sahi amount daalo (e.g. 3720)')
    await saveFuelExpense(chatId, data.fuelLitres, amount)
    return
  }

  if (state === 'logging_toll_custom') {
    const amount = parseFloat(text)
    if (isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, '❌ Sahi amount daalo (e.g. 350)')
    await saveTollExpense(chatId, amount)
    return
  }

  if (state === 'logging_cash_amount') {
    const amount = parseFloat(text)
    if (isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, '❌ Sahi amount daalo (e.g. 250)')
    await saveCashExpense(chatId, data.cashType, amount)
    return
  }

  if (state === 'trip_custom_route') {
    const parts = text.split(/\s+/)
    if (parts.length < 2) return bot.sendMessage(chatId, '❌ From aur To dono likho: `Bhopal Indore`', { parse_mode: 'Markdown' })
    const from = capitalize(parts[0])
    const to = capitalize(parts.slice(1).join(' '))
    await startTrip(chatId, from, to)
    return
  }

  // ── FALLBACK: try to parse as route ───────────────────────────────
  if (state === 'idle' || state === 'trip_select_route') {
    const parts = text.split(/\s+/)
    if (parts.length >= 2) {
      // Check if first part could be a vehicle number
      const maybeVehicle = parts[0].toUpperCase()
      if (/^[A-Z]{2}\d{2}/.test(maybeVehicle) || /^\d{4}$/.test(maybeVehicle)) {
        // Vehicle number + route
        const from = capitalize(parts[1])
        const to = parts.length > 2 ? capitalize(parts.slice(2).join(' ')) : null
        if (to) {
          await startTrip(chatId, from, to)
          return
        }
      } else {
        // Just route: "Bhopal Indore"
        const from = capitalize(parts[0])
        const to = capitalize(parts.slice(1).join(' '))
        await startTrip(chatId, from, to)
        return
      }
    }

    return bot.sendMessage(chatId,
      '💡 Trip log karne ke liye:\n🚀 "Naya Trip" button dabao\n📷 Loading slip photo bhejo\n✏️ Ya likho: `Bhopal Indore`',
      { parse_mode: 'Markdown', reply_markup: HOME_KEYBOARD })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TRIP FLOWS
// ═══════════════════════════════════════════════════════════════════════════

async function handleNewTrip(chatId, driver) {
  // Check if there's an active trip
  const { data } = getState(chatId)
  if (data.activeTripId) {
    return bot.sendMessage(chatId,
      '⚠️ Ek trip already active hai!\nPehle "🏁 Pahunch Gaya" karo, phir naya trip shuru karo.',
      { reply_markup: ACTIVE_TRIP_KEYBOARD })
  }

  const tenantId = driver?.tenantId ?? (await getTenantIdForDriver(chatId))
  // Fetch recent/saved routes (scoped by tenant when known)
  const routes = await prisma.savedRoute.findMany({
    where: tenantId ? { tenantId } : undefined,
    take: 5,
    orderBy: { createdAt: 'desc' },
  })

  const keyboard = []
  for (const r of routes) {
    keyboard.push([{ text: `${r.loadingLocation} → ${r.destination}`, callback_data: `route:${r.id}` }])
  }
  keyboard.push([{ text: '✏️ Naya Route Likho', callback_data: 'route:custom' }])

  setState(chatId, 'trip_select_route')
  return bot.sendMessage(chatId,
    `🚀 *Naya Trip*\n\n📷 Loading slip ki photo bhejo\nYa neeche se route chuno:`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } })
}

async function startTrip(chatId, from, to) {
  const driver = await findDriver(chatId)
  if (!driver) return

  const tenantId = driver.tenantId || (await getTenantIdForDriver(chatId))
  const vehicleId = driver.vehicleId
  let vehicle = null
  if (vehicleId) {
    vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ...(tenantId && { tenantId }) },
    })
  }

  if (!vehicle) {
    vehicle = await prisma.vehicle.findFirst({
      where: { status: 'active', ...(tenantId && { tenantId }) },
    })
  }

  if (!vehicle) {
    return bot.sendMessage(chatId, '❌ Koi vehicle nahi mila. Fleet owner se contact karo.', { reply_markup: HOME_KEYBOARD })
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

  setState(chatId, 'trip_start_location', { activeTripId: trip.id })

  // Notify owner bot
  await notifyOwner('trip_start', { trip, vehicle, driver })

  return bot.sendMessage(chatId,
    `✅ *Trip shuru!*\n\n` +
    `🚛 ${vehicle.vehicleNumber}\n` +
    `🛣️ ${from} → ${to}\n` +
    `📅 ${new Date().toLocaleDateString('hi-IN')}\n\n` +
    `📍 Start location share karo:`,
    { parse_mode: 'Markdown', reply_markup: LOCATION_KEYBOARD })
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPENSE LOGGING
// ═══════════════════════════════════════════════════════════════════════════

async function saveFuelExpense(chatId, litres, amount) {
  const { data } = getState(chatId)
  const tripId = data.activeTripId
  if (!tripId) return

  const rate = Math.round((amount / litres) * 100) / 100

  await prisma.tripExpense.create({
    data: { tripId, type: 'fuel', amount, quantity: litres, rate },
  })

  // Update trip totals
  const allFuel = await prisma.tripExpense.findMany({ where: { tripId, type: 'fuel' } })
  const totalFuel = allFuel.reduce((s, e) => s + e.amount, 0)
  const totalLitres = allFuel.reduce((s, e) => s + (e.quantity || 0), 0)
  await prisma.trip.update({
    where: { id: tripId },
    data: { fuelExpense: totalFuel, fuelLitres: totalLitres, dieselRate: rate },
  })

  const tripTotal = await getTripExpenseTotal(tripId)

  setState(chatId, 'trip_active')
  return bot.sendMessage(chatId,
    `⛽ *Diesel saved!*\n${litres}L — ₹${amount.toLocaleString('en-IN')} (₹${rate}/L)\n\n` +
    `📊 Trip kharcha ab tak: *₹${tripTotal.toLocaleString('en-IN')}*`,
    { parse_mode: 'Markdown', reply_markup: ACTIVE_TRIP_KEYBOARD })
}

async function saveTollExpense(chatId, amount) {
  const { data } = getState(chatId)
  const tripId = data.activeTripId
  if (!tripId) return

  await prisma.tripExpense.create({
    data: { tripId, type: 'toll', amount },
  })

  // Update trip total toll
  const allToll = await prisma.tripExpense.findMany({ where: { tripId, type: 'toll' } })
  const totalToll = allToll.reduce((s, e) => s + e.amount, 0)
  await prisma.trip.update({ where: { id: tripId }, data: { toll: totalToll } })

  const tripTotal = await getTripExpenseTotal(tripId)

  setState(chatId, 'trip_active')
  return bot.sendMessage(chatId,
    `🛣️ *Toll ₹${amount.toLocaleString('en-IN')} saved!*\n\n` +
    `📊 Trip kharcha ab tak: *₹${tripTotal.toLocaleString('en-IN')}*`,
    { parse_mode: 'Markdown', reply_markup: ACTIVE_TRIP_KEYBOARD })
}

async function saveCashExpense(chatId, type, amount) {
  const { data } = getState(chatId)
  const tripId = data.activeTripId
  if (!tripId) return

  const labels = { food: '🍽️ Khana', repair: '🔧 Repair', parking: '🅿️ Parking', room: '🏨 Room', other: '📝 Other' }

  await prisma.tripExpense.create({
    data: { tripId, type, amount, description: labels[type] || type },
  })

  // Update trip cash total
  const cashTypes = ['food', 'repair', 'parking', 'room', 'other']
  const allCash = await prisma.tripExpense.findMany({ where: { tripId, type: { in: cashTypes } } })
  const totalCash = allCash.reduce((s, e) => s + e.amount, 0)
  await prisma.trip.update({ where: { id: tripId }, data: { cashExpense: totalCash } })

  const tripTotal = await getTripExpenseTotal(tripId)

  setState(chatId, 'trip_active')
  return bot.sendMessage(chatId,
    `${labels[type]} *₹${amount.toLocaleString('en-IN')} saved!*\n\n` +
    `📊 Trip kharcha ab tak: *₹${tripTotal.toLocaleString('en-IN')}*`,
    { parse_mode: 'Markdown', reply_markup: ACTIVE_TRIP_KEYBOARD })
}

async function getTripExpenseTotal(tripId) {
  const expenses = await prisma.tripExpense.findMany({ where: { tripId } })
  return expenses.reduce((s, e) => s + e.amount, 0)
}

// ═══════════════════════════════════════════════════════════════════════════
// TRIP END
// ═══════════════════════════════════════════════════════════════════════════

async function handleTripEnd(chatId, tripId) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { vehicle: { select: { vehicleNumber: true } } },
  })
  if (!trip) {
    clearState(chatId)
    return bot.sendMessage(chatId, '❌ Trip nahi mila.', { reply_markup: HOME_KEYBOARD })
  }

  setState(chatId, 'trip_confirming')
  return bot.sendMessage(chatId,
    `🏁 *Trip khatam?*\n\n` +
    `🚛 ${trip.vehicle.vehicleNumber}\n` +
    `🛣️ ${trip.loadingLocation} → ${trip.destination}\n\n` +
    `Maal deliver ho gaya?`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Haan, deliver hua', callback_data: 'delivered_yes' },
           { text: '❌ Nahi', callback_data: 'delivered_no' }],
        ],
      },
    })
}

async function showTripSummary(chatId, tripId, driver) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { vehicle: { select: { vehicleNumber: true } }, expenses: true },
  })

  if (!trip) {
    clearState(chatId)
    return bot.sendMessage(chatId, '❌ Trip nahi mila.', { reply_markup: HOME_KEYBOARD })
  }

  // Calculate time
  const start = trip.createdAt
  const end = new Date()
  const durationMs = end - start
  const hours = Math.floor(durationMs / 3600000)
  const mins = Math.floor((durationMs % 3600000) / 60000)

  // Expense breakdown
  const fuel = trip.expenses.filter(e => e.type === 'fuel')
  const tolls = trip.expenses.filter(e => e.type === 'toll')
  const cashTypes = ['food', 'repair', 'parking', 'room', 'other']
  const cash = trip.expenses.filter(e => cashTypes.includes(e.type))

  const fuelTotal = fuel.reduce((s, e) => s + e.amount, 0)
  const fuelLitres = fuel.reduce((s, e) => s + (e.quantity || 0), 0)
  const tollTotal = tolls.reduce((s, e) => s + e.amount, 0)
  const cashTotal = cash.reduce((s, e) => s + e.amount, 0)
  const grandTotal = fuelTotal + tollTotal + cashTotal

  let summary = `✅ *Trip Complete!* 🎉\n\n`
  summary += `🚛 ${trip.vehicle.vehicleNumber}\n`
  summary += `🛣️ ${trip.loadingLocation} → ${trip.destination}\n`
  summary += `⏱️ ${hours}h ${mins}min\n\n`
  summary += `💰 *Kharcha Summary:*\n`
  if (fuelTotal > 0) summary += `├ ⛽ Diesel: ₹${fuelTotal.toLocaleString('en-IN')} (${fuelLitres}L)\n`
  if (tollTotal > 0) summary += `├ 🛣️ Toll: ₹${tollTotal.toLocaleString('en-IN')}\n`
  for (const c of cash) {
    summary += `├ ${c.description || c.type}: ₹${c.amount.toLocaleString('en-IN')}\n`
  }
  summary += `└ ─────────────────\n`
  summary += `  *Total: ₹${grandTotal.toLocaleString('en-IN')}*\n`

  // Calculate driving score if we have location data
  let drivingScore = null
  try {
    const { calculateDrivingScore } = await import('./drivingScore.js')
    drivingScore = await calculateDrivingScore(tripId, trip.tenantId)
  } catch (err) {
    console.error('[DriverBot] Driving score error:', err.message)
  }

  if (drivingScore && drivingScore.totalDistanceKm > 0) {
    const sc = drivingScore
    const emoji = sc.overallScore >= 80 ? '🟢' : sc.overallScore >= 60 ? '🟡' : '🔴'
    summary += `\n🏆 *Driving Score: ${emoji} ${sc.overallScore}/100*\n`
    summary += `├ 🏎️ Speed: ${sc.speedScore} | 🛑 Braking: ${sc.brakingScore}\n`
    summary += `├ 🚀 Accel: ${sc.accelerationScore} | ↩️ Turns: ${sc.corneringScore}\n`
    summary += `├ Avg: ${Math.round(sc.avgSpeed)} km/h | Max: ${Math.round(sc.maxSpeed)} km/h\n`
    if (sc.harshBrakeCount + sc.harshAccelCount + sc.sharpTurnCount > 0) {
      summary += `└ ⚠️ ${sc.harshBrakeCount} harsh brakes, ${sc.harshAccelCount} accel, ${sc.sharpTurnCount} turns\n`
    }
  }

  // Notify owner
  await notifyOwner('trip_complete', { trip, fuelTotal, tollTotal, cashTotal, grandTotal, hours, mins, fuelLitres, drivingScore })

  // Check fuel anomaly
  if (fuelLitres > 0 && trip.startLat && trip.endLat) {
    const dist = haversine(trip.startLat, trip.startLng, trip.endLat, trip.endLng)
    const kmPerL = dist / fuelLitres
    if (kmPerL < 2.0 && dist > 10) {
      await notifyOwner('fuel_anomaly', {
        trip, vehicle: trip.vehicle, driver, fuelLitres, dist: Math.round(dist), kmPerL: kmPerL.toFixed(1),
      })
    }
  }

  // Ask for receipt photo
  setState(chatId, 'trip_receipt')
  await bot.sendMessage(chatId, summary, { parse_mode: 'Markdown' })
  return bot.sendMessage(chatId, '📷 Koi bill/receipt hai? Photo bhejo:', {
    reply_markup: {
      inline_keyboard: [[{ text: '⏩ Skip — Agla Trip', callback_data: 'skip_receipt' }]],
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS & PROFILE
// ═══════════════════════════════════════════════════════════════════════════

async function handleMyStatus(chatId, driver) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  const [todayTrips, weekTrips, monthTrips] = await Promise.all([
    prisma.trip.findMany({ where: { driverId: driver.id, createdAt: { gte: today } }, include: { expenses: true } }),
    prisma.trip.findMany({ where: { driverId: driver.id, createdAt: { gte: weekAgo } } }),
    prisma.trip.findMany({ where: { driverId: driver.id, createdAt: { gte: monthStart } } }),
  ])

  const todayExpenses = todayTrips.reduce((s, t) => s + t.expenses.reduce((se, e) => se + e.amount, 0), 0)
  const todayFuel = todayTrips.reduce((s, t) => s + t.expenses.filter(e => e.type === 'fuel').reduce((se, e) => se + e.amount, 0), 0)
  const todayToll = todayTrips.reduce((s, t) => s + t.expenses.filter(e => e.type === 'toll').reduce((se, e) => se + e.amount, 0), 0)

  let text = `📊 *${driver.name} ji ka Status*\n\n`
  text += `📅 *Aaj:*\n`
  text += `✅ ${todayTrips.length} trips\n`
  if (todayExpenses > 0) text += `💰 Kharcha: ₹${todayExpenses.toLocaleString('en-IN')}\n`
  if (todayFuel > 0) text += `⛽ Diesel: ₹${todayFuel.toLocaleString('en-IN')}\n`
  if (todayToll > 0) text += `🛣️ Toll: ₹${todayToll.toLocaleString('en-IN')}\n`
  text += `\n📅 *Is hafte:*\n✅ ${weekTrips.length} trips\n`
  text += `\n📅 *Is mahine:*\n✅ ${monthTrips.length} trips`

  const kb = getState(chatId).data.activeTripId ? ACTIVE_TRIP_KEYBOARD : HOME_KEYBOARD
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: kb })
}

async function handleMyProfile(chatId, driver) {
  let text = `👤 *${driver.name} ji ki Profile*\n\n`
  text += `📱 Phone: ${driver.phone}\n`
  if (driver.licenseNumber) text += `📄 License: ${driver.licenseNumber}\n`
  if (driver.vehicle) text += `🚛 Vehicle: \`${driver.vehicle.vehicleNumber}\`\n`
  text += `Status: ${driver.active ? '🟢 Active' : '🔴 Inactive'}\n`
  text += `📦 Total trips: ${driver._count.trips}\n`

  // Verified status
  const verified = driver.licensePhotoUrl && driver.aadhaarPhotoUrl
  text += verified ? `\n✅ Verified Driver` : `\n⚪ Unverified — documents upload karo`

  const kb = getState(chatId).data.activeTripId ? ACTIVE_TRIP_KEYBOARD : HOME_KEYBOARD
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: kb })
}

// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function sendVehicleSelection(chatId) {
  const tenantId = await getTenantIdForDriver(chatId)
  const vehicles = await prisma.vehicle.findMany({
    where: { status: 'active', ...(tenantId && { tenantId }) },
    orderBy: { vehicleNumber: 'asc' },
    take: 50,
  })

  if (vehicles.length === 0) {
    return completeOnboarding(chatId, null)
  }

  const keyboard = []
  for (let i = 0; i < vehicles.length; i += 2) {
    const row = [{ text: vehicles[i].vehicleNumber, callback_data: `ob_vehicle:${vehicles[i].id}` }]
    if (vehicles[i + 1]) {
      row.push({ text: vehicles[i + 1].vehicleNumber, callback_data: `ob_vehicle:${vehicles[i + 1].id}` })
    }
    keyboard.push(row)
  }
  keyboard.push([{ text: '❌ Abhi nahi pata', callback_data: 'ob_vehicle:skip' }])

  return bot.sendMessage(chatId, '🚛 *Aapki gaadi kaunsi hai?*', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard },
  })
}

async function completeOnboarding(chatId, vehicleId) {
  const { data } = getState(chatId)
  try {
    const driver = await prisma.driver.create({
      data: {
        name: data.name,
        phone: data.phone,
        vehicleId: vehicleId || null,
        telegramChatId: String(chatId),
      },
      include: { vehicle: { select: { vehicleNumber: true } } },
    })

    clearState(chatId)

    let text = `🎉 *Registration ho gaya, ${driver.name} ji!*\n\n`
    text += `👤 Naam: ${driver.name}\n`
    text += `📱 Phone: ${driver.phone}\n`
    if (driver.vehicle) text += `🚛 Vehicle: ${driver.vehicle.vehicleNumber}\n`
    text += `\nAb trip log karne ke liye neeche button dabao!`

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: HOME_KEYBOARD })

    // Notify owner about new driver
    await notifyOwner('new_driver', { driver })
  } catch (err) {
    console.error('[DriverBot] Registration error:', err)
    clearState(chatId)
    if (err.code === 'P2002') {
      return bot.sendMessage(chatId, '❌ Yeh phone number pehle se registered hai.\nFleet owner se contact karo.')
    }
    return bot.sendMessage(chatId, '❌ Registration fail ho gaya. /start se dobara try karo.')
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOADING SLIP OCR
// ═══════════════════════════════════════════════════════════════════════════

async function handleLoadingSlipOCR(chatId, msg, driver) {
  const processingMsg = await bot.sendMessage(chatId, '🔍 Loading slip padh rahe hain... ruko')

  let tempDir = null, processedPath = null
  try {
    const photo = msg.photo[msg.photo.length - 1]
    const file = await bot.getFile(photo.file_id)
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_DRIVER_BOT_TOKEN}/${file.file_path}`

    const response = await fetch(fileUrl)
    const imageBuffer = Buffer.from(await response.arrayBuffer())

    // Save original
    const uploadsDir = join(__dirname, '..', '..', 'uploads', 'loading-slips')
    await mkdir(uploadsDir, { recursive: true })
    const slipFilename = `slip-${Date.now()}.jpg`
    await writeFile(join(uploadsDir, slipFilename), imageBuffer)
    const slipImageUrl = `/uploads/loading-slips/${slipFilename}`

    // Preprocess for OCR
    tempDir = await mkdtemp(join(tmpdir(), 'fleetsure-drv-'))
    processedPath = join(tempDir, 'processed.jpg')
    await sharp(imageBuffer).grayscale().normalize().sharpen({ sigma: 1.5 }).jpeg({ quality: 95 }).toFile(processedPath)

    const pythonScript = join(__dirname, '..', 'ocr', 'process_loading_slip.py')
    const ocrResult = await runPythonOCR(pythonScript, processedPath)

    if (ocrResult.error) {
      return bot.editMessageText(`❌ OCR Error: ${ocrResult.error}`, { chat_id: chatId, message_id: processingMsg.message_id })
    }

    const tenantId = driver.tenantId || (await getTenantIdForDriver(chatId))
    // Find vehicle (scoped by tenant when known)
    let vehicle = null
    if (ocrResult.vehicleNumber) {
      vehicle = await prisma.vehicle.findFirst({
        where: {
          vehicleNumber: { contains: ocrResult.vehicleNumber, mode: 'insensitive' },
          ...(tenantId && { tenantId }),
        },
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
      let text = `📋 *Slip scanned but vehicle nahi mila*\n\n`
      text += `🔤 Vehicle: \`${ocrResult.vehicleNumber || 'Pata nahi chala'}\`\n`
      text += `📄 Slip #: ${ocrResult.loadingSlipNumber || '—'}\n`
      text += `🛣️ ${ocrResult.originPlant || '?'} → ${ocrResult.destinationPlant || '?'}\n`
      text += `\n⚠️ Fleet owner se vehicle register karwao.`
      return bot.editMessageText(text, { chat_id: chatId, message_id: processingMsg.message_id, parse_mode: 'Markdown' })
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

    setState(chatId, 'trip_start_location', { activeTripId: trip.id })

    let text = `✅ *Trip logged from slip!*\n\n`
    text += `🚛 ${vehicle.vehicleNumber}\n`
    text += `🛣️ ${ocrResult.originPlant || 'Unknown'} → ${ocrResult.destinationPlant || 'Unknown'}\n`
    text += `📄 Slip: ${ocrResult.loadingSlipNumber || '—'}\n`
    text += `📅 ${ocrResult.tripDate || new Date().toLocaleDateString('hi-IN')}\n`

    await bot.editMessageText(text, { chat_id: chatId, message_id: processingMsg.message_id, parse_mode: 'Markdown' })

    // Notify owner
    await notifyOwner('trip_start', { trip, vehicle, driver })

    return bot.sendMessage(chatId, '📍 Start location share karo:', { reply_markup: LOCATION_KEYBOARD })
  } catch (err) {
    console.error('[DriverBot] OCR error:', err)
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
// PROGRESSIVE DOCUMENT COLLECTION
// ═══════════════════════════════════════════════════════════════════════════

export async function checkProgressiveDocPrompt(chatId, driver) {
  if (!bot) return
  const tripCount = driver._count?.trips || 0

  // After 5 trips: ask for license
  if (tripCount === 5 && !driver.licensePhotoUrl) {
    return bot.sendMessage(chatId,
      `👏 *5 trips complete!* Aap trusted driver ho.\n\n` +
      `📄 License upload karna chahenge?\nIsse aapko priority trips milenge.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📷 License Photo Bhejo', callback_data: 'upload_license' },
             { text: 'Baad mein →', callback_data: 'skip_receipt' }],
          ],
        },
      })
  }

  // After 10 trips: ask for aadhaar
  if (tripCount === 10 && !driver.aadhaarPhotoUrl) {
    return bot.sendMessage(chatId,
      `🏆 *10 trips complete!* Top performer!\n\n` +
      `📄 Aadhaar upload karo — verified badge milega ✅`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📷 Aadhaar Bhejo', callback_data: 'upload_aadhaar' },
             { text: 'Baad mein →', callback_data: 'skip_receipt' }],
          ],
        },
      })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUSH MESSAGES (called from cron)
// ═══════════════════════════════════════════════════════════════════════════

export async function sendMorningBrief() {
  if (!bot) return
  const drivers = await prisma.driver.findMany({
    where: { active: true, telegramChatId: { not: null } },
    include: { vehicle: { select: { vehicleNumber: true } } },
  })

  for (const d of drivers) {
    try {
      await bot.sendMessage(d.telegramChatId,
        `🌅 *Subah ki namaste, ${d.name} ji!*\n\n` +
        (d.vehicle ? `🚛 Aapki gaadi: ${d.vehicle.vehicleNumber}\n` : '') +
        `Trip shuru karne ke liye button dabao.`,
        { parse_mode: 'Markdown', reply_markup: HOME_KEYBOARD })
    } catch (err) {
      console.error(`[DriverBot] Morning msg failed for ${d.name}:`, err.message)
    }
  }
}

export async function sendEveningSummary() {
  if (!bot) return
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const drivers = await prisma.driver.findMany({
    where: { active: true, telegramChatId: { not: null } },
  })

  for (const d of drivers) {
    try {
      const trips = await prisma.trip.findMany({
        where: { driverId: d.id, createdAt: { gte: today } },
        include: { expenses: true },
      })

      if (trips.length === 0) continue

      const totalExpenses = trips.reduce((s, t) => s + t.expenses.reduce((se, e) => se + e.amount, 0), 0)
      const fuelTotal = trips.reduce((s, t) => s + t.expenses.filter(e => e.type === 'fuel').reduce((se, e) => se + e.amount, 0), 0)
      const tollTotal = trips.reduce((s, t) => s + t.expenses.filter(e => e.type === 'toll').reduce((se, e) => se + e.amount, 0), 0)

      let text = `📊 *Aaj ka summary, ${d.name} ji:*\n\n`
      text += `✅ ${trips.length} trip${trips.length > 1 ? 's' : ''} complete\n`
      if (fuelTotal > 0) text += `⛽ Diesel: ₹${fuelTotal.toLocaleString('en-IN')}\n`
      if (tollTotal > 0) text += `🛣️ Tolls: ₹${tollTotal.toLocaleString('en-IN')}\n`
      text += `💰 Total kharcha: ₹${totalExpenses.toLocaleString('en-IN')}\n\n`
      text += `👏 Kal bhi safe driving! 🙏`

      await bot.sendMessage(d.telegramChatId, text, { parse_mode: 'Markdown' })
    } catch (err) {
      console.error(`[DriverBot] Evening msg failed for ${d.name}:`, err.message)
    }
  }
}

export async function sendWeeklyReport() {
  if (!bot) return
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  weekAgo.setHours(0, 0, 0, 0)

  const drivers = await prisma.driver.findMany({
    where: { active: true, telegramChatId: { not: null } },
  })

  // Get trip counts for ranking
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
      const rank = i + 1
      const expenses = await prisma.tripExpense.findMany({
        where: { trip: { driverId: d.id, createdAt: { gte: weekAgo } } },
      })
      const totalExp = expenses.reduce((s, e) => s + e.amount, 0)
      const fuelExp = expenses.filter(e => e.type === 'fuel').reduce((s, e) => s + e.amount, 0)

      let text = `📊 *Hafte ka report, ${d.name} ji:*\n\n`
      text += `✅ ${d.weekTrips} trips\n`
      if (fuelExp > 0) text += `⛽ Diesel: ₹${fuelExp.toLocaleString('en-IN')}\n`
      text += `💰 Total kharcha: ₹${totalExp.toLocaleString('en-IN')}\n\n`
      text += `🏆 *Fleet rank: #${rank}* out of ${driverStats.filter(x => x.weekTrips > 0).length} drivers`

      await bot.sendMessage(d.telegramChatId, text, { parse_mode: 'Markdown' })
    } catch (err) {
      console.error(`[DriverBot] Weekly msg failed for ${d.name}:`, err.message)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFY OWNER BOT
// ═══════════════════════════════════════════════════════════════════════════

async function notifyOwner(event, payload) {
  try {
    // Dynamic import to avoid circular dependency
    const { sendOwnerNotification } = await import('./ownerBot.js')
    await sendOwnerNotification(event, payload)
  } catch (err) {
    // Owner bot may not be running — that's fine
    console.error('[DriverBot] Owner notification failed:', err.message)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function findDriver(chatId) {
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
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_DRIVER_BOT_TOKEN}/${file.file_path}`
    const response = await fetch(fileUrl)
    const buffer = Buffer.from(await response.arrayBuffer())

    const dir = join(__dirname, '..', '..', 'uploads', 'drivers')
    await mkdir(dir, { recursive: true })
    const filename = `${type}-${msg.chat.id}-${Date.now()}.jpg`
    await writeFile(join(dir, filename), buffer)
    return `/uploads/drivers/${filename}`
  } catch (err) {
    console.error('[DriverBot] Save photo error:', err)
    return null
  }
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
        console.error('[DriverBot OCR] stderr:', stderr)
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

export default { startDriverBot, getDriverBot, sendMorningBrief, sendEveningSummary, sendWeeklyReport }
