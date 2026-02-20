/**
 * Twilio WhatsApp Client — Fleetsure
 * ────────────────────────────────────
 * Thin abstraction over Twilio SDK for sending WhatsApp messages.
 * Supports plain text, button messages, and list messages.
 */

import twilio from 'twilio'

let client = null
let fromNumber = null

export function initTwilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const number = process.env.TWILIO_WHATSAPP_NUMBER

  if (!sid || !token || !number) {
    console.log('[WhatsApp] Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_WHATSAPP_NUMBER — disabled')
    return false
  }

  client = twilio(sid, token)
  fromNumber = number.startsWith('whatsapp:') ? number : `whatsapp:${number}`
  console.log('[WhatsApp] Twilio client initialized')
  return true
}

export function getTwilioClient() { return client }

/**
 * Normalize phone to WhatsApp format: whatsapp:+91XXXXXXXXXX
 */
function normalizePhone(phone) {
  if (!phone) return null
  let clean = phone.replace(/[\s\-()]/g, '')
  if (clean.startsWith('whatsapp:')) return clean
  if (!clean.startsWith('+')) {
    if (clean.startsWith('91') && clean.length === 12) clean = '+' + clean
    else if (clean.length === 10) clean = '+91' + clean
    else clean = '+' + clean
  }
  return `whatsapp:${clean}`
}

/**
 * Send a plain text WhatsApp message.
 */
export async function sendWhatsApp(to, body) {
  if (!client || !fromNumber) {
    console.warn('[WhatsApp] Client not initialized — message not sent')
    return null
  }

  const toNumber = normalizePhone(to)
  if (!toNumber) {
    console.warn('[WhatsApp] Invalid phone number:', to)
    return null
  }

  try {
    const msg = await client.messages.create({
      from: fromNumber,
      to: toNumber,
      body,
    })
    return msg.sid
  } catch (err) {
    console.error(`[WhatsApp] Send failed to ${to}:`, err.message)
    return null
  }
}

/**
 * Send a WhatsApp message with interactive buttons (max 3).
 * Twilio uses Content Templates for interactive messages.
 * For simplicity, we send the menu as numbered text options.
 */
export async function sendWhatsAppWithButtons(to, body, buttons = []) {
  if (buttons.length === 0) return sendWhatsApp(to, body)

  let text = body + '\n\n'
  buttons.forEach((btn, i) => {
    text += `*${i + 1}.* ${btn.label}\n`
  })
  text += `\n_Reply with the number to choose._`

  return sendWhatsApp(to, text)
}

/**
 * Send a WhatsApp message with a list menu (max 10 items).
 */
export async function sendWhatsAppWithList(to, body, items = []) {
  if (items.length === 0) return sendWhatsApp(to, body)

  let text = body + '\n\n'
  items.forEach((item, i) => {
    text += `*${i + 1}.* ${item.label}`
    if (item.description) text += ` — ${item.description}`
    text += '\n'
  })
  text += `\n_Reply with the number to choose._`

  return sendWhatsApp(to, text)
}

/**
 * Format currency in Indian Rupees
 */
export function inr(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`
}

/**
 * Validate Twilio webhook signature (for production security).
 * In dev, this can be skipped.
 */
export function validateTwilioSignature(req) {
  if (process.env.NODE_ENV !== 'production') return true

  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) return false

  try {
    const twilioSig = req.headers['x-twilio-signature']
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`
    return twilio.validateRequest(authToken, twilioSig, url, req.body)
  } catch {
    return false
  }
}

export default { initTwilio, getTwilioClient, sendWhatsApp, sendWhatsAppWithButtons, sendWhatsAppWithList, inr, validateTwilioSignature }
