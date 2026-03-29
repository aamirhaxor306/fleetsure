/**
 * Telegram bots use long-polling (getUpdates). Only one process may poll per bot token;
 * a second instance causes ETELEGRAM 409 (e.g. Railway + local dev with the same .env).
 */

function parseBool(v) {
  if (v == null || String(v).trim() === '') return null
  const s = String(v).toLowerCase().trim()
  if (['1', 'true', 'yes', 'on'].includes(s)) return true
  if (['0', 'false', 'no', 'off'].includes(s)) return false
  return null
}

export function isTelegramWebhookEnabled() {
  const explicit = parseBool(process.env.TELEGRAM_WEBHOOK)
  if (explicit !== null) return explicit
  return process.env.NODE_ENV === 'production' && !!process.env.TELEGRAM_WEBHOOK_BASE_URL
}

/** @returns {boolean} Whether driver + owner bots should start polling. */
export function isTelegramPollingEnabled() {
  if (isTelegramWebhookEnabled()) return false
  const explicit = parseBool(process.env.TELEGRAM_POLLING)
  if (explicit !== null) return explicit
  return process.env.NODE_ENV === 'production'
}

export function shouldStartTelegramBots() {
  return isTelegramWebhookEnabled() || isTelegramPollingEnabled()
}
