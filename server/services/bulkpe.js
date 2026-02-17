/**
 * Fleetsure — BulkPe API Wrapper
 * ──────────────────────────────
 * Thin wrapper around BulkPe REST API for FASTag operations.
 * Docs: https://docs.bulkpe.in/
 *
 * Endpoints used:
 *  1. GET  /client/listFastagProvider     — list FASTag bank providers
 *  2. POST /client/verifyFastag           — verify & get FASTag balance
 *  3. POST /client/bbps/selectBiller      — list billers for a category
 *  4. POST /client/bbps/FetchBillSingle   — fetch bill / balance for recharge
 *  5. POST /client/bbps/BillPayTxn        — execute recharge payment
 *  6. POST /client/bbps/transactionStatusCheck — check txn status
 *  7. POST /client/bbps/listBillTransactions   — transaction history
 */

const BASE_URL = 'https://api.bulkpe.in'

function getApiKey() {
  const key = process.env.BULKPE_API_KEY
  if (!key) throw new Error('BULKPE_API_KEY not configured')
  return key
}

async function bulkpeRequest(method, path, body = null) {
  const url = `${BASE_URL}${path}`
  const headers = {
    'Authorization': `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  }

  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)

  const res = await fetch(url, opts)
  const data = await res.json()

  if (!res.ok || data.status === false) {
    const msg = data.message || data.error || `BulkPe API error (${res.status})`
    const err = new Error(msg)
    err.statusCode = res.status
    err.bulkpeData = data
    throw err
  }

  return data
}

// ── In-memory cache for providers (refreshed every 15 days) ─────────────────

let providerCache = { data: null, fetchedAt: 0 }
const CACHE_TTL_MS = 15 * 24 * 60 * 60 * 1000 // 15 days

/**
 * List FASTag providers (banks).
 * Cached in memory for 15 days as recommended by BulkPe docs.
 */
export async function listFastagProviders(forceRefresh = false) {
  const now = Date.now()
  if (!forceRefresh && providerCache.data && (now - providerCache.fetchedAt) < CACHE_TTL_MS) {
    return providerCache.data
  }

  const result = await bulkpeRequest('GET', '/client/listFastagProvider')
  providerCache = { data: result.data || result, fetchedAt: now }
  return providerCache.data
}

/**
 * Verify FASTag and get live balance.
 * @param {string} vrn - Vehicle Registration Number (e.g. "MH12AB1234")
 * @param {string} provider - Provider ID from listFastagProviders
 * @param {string} reference - Unique reference number
 */
export async function verifyFastag(vrn, provider, reference) {
  return bulkpeRequest('POST', '/client/verifyFastag', {
    vrn,
    provider,
    reference,
  })
}

/**
 * List billers for the "Fastag" category (BBPS).
 * Returns biller IDs, names, and required customer params.
 */
export async function listFastagBillers() {
  return bulkpeRequest('POST', '/client/bbps/selectBiller', {
    biller: 'Fastag',
  })
}

/**
 * Fetch bill for a FASTag biller (pre-recharge step).
 * @param {string} billerId - Biller ID from selectBiller
 * @param {Array} custParam - Customer parameters [{name, value}]
 * @param {string} reference - Unique reference
 */
export async function fetchBill(billerId, custParam, reference) {
  return bulkpeRequest('POST', '/client/bbps/FetchBillSingle', {
    billerId,
    custParam,
    reference,
  })
}

/**
 * Execute a bill payment (recharge).
 * Payment is debited from BulkPe Virtual Account.
 * @param {string} fetchId - fetchId from fetchBill response
 * @param {number|string} amount - Amount to pay
 * @param {string} reference - Unique reference
 */
export async function payBill(fetchId, amount, reference) {
  return bulkpeRequest('POST', '/client/bbps/BillPayTxn', {
    fetchId,
    amount: String(amount),
    reference,
  })
}

/**
 * Check status of a previously made payment.
 * @param {string} transactionId - Transaction ID from payBill response
 */
export async function checkTxnStatus(transactionId) {
  return bulkpeRequest('POST', '/client/bbps/transactionStatusCheck', {
    transactionId,
  })
}

/**
 * List BBPS transactions (FASTag category).
 * @param {number} page
 * @param {number} limit
 * @param {string} status - SUCCESS | PENDING | FAILED
 */
export async function listTransactions(page = 1, limit = 50, status = '') {
  return bulkpeRequest('POST', '/client/bbps/listBillTransactions', {
    page: String(page),
    limit: String(limit),
    category: 'Fastag',
    status,
  })
}

/**
 * Check if BulkPe API key is configured.
 */
export function isConfigured() {
  return !!process.env.BULKPE_API_KEY
}
