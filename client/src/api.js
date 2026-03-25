const BASE = '/api'

let _getToken = null
export function setClerkGetToken(fn) { _getToken = fn }

async function request(path, opts = {}) {
 const headers = { 'Content-Type': 'application/json', ...opts.headers }

 if (_getToken) {
 try {
 const token = await _getToken()
 if (token) headers['Authorization'] = `Bearer ${token}`
 } catch {}
 }

 const res = await fetch(`${BASE}${path}`, {
 credentials: 'include',
 headers,
 ...opts,
 })
 if (res.status === 401 && !path.startsWith('/auth')) {
 window.location.href = '/login'
 throw new Error('Not authenticated')
 }
 const data = await res.json()
 if (!res.ok) throw new Error(data.error || 'Request failed')
 return data
}

async function requestMultipart(path, formData) {
 const headers = {}
 if (_getToken) {
 try {
 const token = await _getToken()
 if (token) headers['Authorization'] = `Bearer ${token}`
 } catch { /* ignore */ }
 }
 const res = await fetch(`${BASE}${path}`, {
 method: 'POST',
 credentials: 'include',
 headers,
 body: formData,
 })
 if (res.status === 401 && !path.startsWith('/auth')) {
 window.location.href = '/login'
 throw new Error('Not authenticated')
 }
 const data = await res.json()
 if (!res.ok) throw new Error(data.error || 'Request failed')
 return data
}

// ── Auth (Email OTP + Backend JWT) ───────────────────────
export const auth = {
 requestOtp: (email) =>
 request('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email }) }),
 verifyOtp: (email, otp) =>
 request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp }) }),
 onboard: (fleetName, ownerName) =>
 request('/auth/onboard', { method: 'POST', body: JSON.stringify({ fleetName, ownerName }) }),
 me: () => request('/auth/me'),
 logout: () => request('/auth/logout', { method: 'POST' }),
}

// ── Vehicles ─────────────────────────────────────────────
export const vehicles = {
 list: () => request('/vehicles'),
 get: (id) => request(`/vehicles/${id}`),
 create: (data) =>
 request('/vehicles', { method: 'POST', body: JSON.stringify(data) }),
 update: (id, data) =>
 request(`/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
 remove: (id) =>
 request(`/vehicles/${id}`, { method: 'DELETE' }),
 fetchRC: (vehicleNumber) =>
 request('/vehicles/fetch-rc', { method: 'POST', body: JSON.stringify({ vehicleNumber }) }),
 fetchRCStatus: () => request('/vehicles/fetch-rc/status'),
 importPreview: (file) => {
 const fd = new FormData()
 fd.append('file', file)
 fd.append('mode', 'preview')
 return requestMultipart('/vehicles/import', fd)
 },
 importCommit: (file) => {
 const fd = new FormData()
 fd.append('file', file)
 fd.append('mode', 'import')
 return requestMultipart('/vehicles/import', fd)
 },
}

// ── Maintenance ──────────────────────────────────────────
export const maintenance = {
 list: (vehicleId) =>
 request(`/maintenance${vehicleId ? `?vehicleId=${vehicleId}` : ''}`),
 stats: () => request('/maintenance/stats'),
 create: (data) =>
 request('/maintenance', { method: 'POST', body: JSON.stringify(data) }),
 remove: (id) =>
 request(`/maintenance/${id}`, { method: 'DELETE' }),
}

export const fuel = {
 list: (vehicleId) =>
 request(`/fuel${vehicleId ? `?vehicleId=${vehicleId}` : ''}`),
 stats: () => request('/fuel/stats'),
 create: (data) =>
 request('/fuel', { method: 'POST', body: JSON.stringify(data) }),
 remove: (id) =>
 request(`/fuel/${id}`, { method: 'DELETE' }),
 parseSms: (smsText) =>
 request('/fuel/parse-sms', { method: 'POST', body: JSON.stringify({ smsText }) }),
}

// ── Documents ────────────────────────────────────────────
export const documents = {
 list: (vehicleId) =>
 request(`/documents${vehicleId ? `?vehicleId=${vehicleId}` : ''}`),
 create: (data) =>
 request('/documents', { method: 'POST', body: JSON.stringify(data) }),
 update: (id, data) =>
 request(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
}

// ── Alerts ───────────────────────────────────────────────
export const alerts = {
 list: (showResolved = false) =>
 request(`/alerts${showResolved ? '?resolved=true' : ''}`),
 resolve: (id) =>
 request(`/alerts/${id}/resolve`, { method: 'PUT' }),
 runEngine: () =>
 request('/alerts/run', { method: 'POST' }),
}

// ── Trips ────────────────────────────────────────────────
export const trips = {
 list: () => request('/trips'),
 get: (id) => request(`/trips/${id}`),
 create: (data) =>
 request('/trips', { method: 'POST', body: JSON.stringify(data) }),
 autoEstimate: (data) =>
 request('/trips/auto-estimate', { method: 'POST', body: JSON.stringify(data) }),
 update: (id, data) =>
 request(`/trips/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
 analytics: () => request('/trips/analytics'),
}

// ── Drivers ──────────────────────────────────────────────
export const drivers = {
 list: () => request('/drivers'),
 get: (id) => request(`/drivers/${id}`),
 create: (data) =>
 request('/drivers', { method: 'POST', body: JSON.stringify(data) }),
 update: (id, data) =>
 request(`/drivers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
 remove: (id) =>
 request(`/drivers/${id}`, { method: 'DELETE' }),
}

// ── Saved Routes ─────────────────────────────────────────
export const savedRoutes = {
 list: () => request('/saved-routes'),
 create: (data) =>
 request('/saved-routes', { method: 'POST', body: JSON.stringify(data) }),
 update: (id, data) =>
 request(`/saved-routes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
 remove: (id) =>
 request(`/saved-routes/${id}`, { method: 'DELETE' }),
}

// ── Renewals ─────────────────────────────────────────────
export const renewals = {
 list: (status) =>
 request(`/renewals${status ? `?status=${status}` : ''}`),
 expiring: () => request('/renewals/expiring'),
 get: (id) => request(`/renewals/${id}`),
 create: (data) =>
 request('/renewals', { method: 'POST', body: JSON.stringify(data) }),
 fetchQuotes: (id, data = {}) =>
 request(`/renewals/${id}/fetch-quotes`, { method: 'POST', body: JSON.stringify(data) }),
 addQuote: (id, data) =>
 request(`/renewals/${id}/add-quote`, { method: 'POST', body: JSON.stringify(data) }),
 selectQuote: (id, quoteId) =>
 request(`/renewals/${id}/select/${quoteId}`, { method: 'PUT' }),
 confirm: (id) =>
 request(`/renewals/${id}/confirm`, { method: 'PUT' }),
 complete: (id, newExpiryDate) =>
 request(`/renewals/${id}/complete`, { method: 'PUT', body: JSON.stringify({ newExpiryDate }) }),
}

// ── Renewal Partners ─────────────────────────────────────
export const renewalPartners = {
 list: () => request('/renewal-partners'),
 create: (data) =>
 request('/renewal-partners', { method: 'POST', body: JSON.stringify(data) }),
}

// ── OCR (Server-side PaddleOCR) ─────────────────────────
export const ocr = {
 scanLoadingSlip: async (imageFile) => {
 const formData = new FormData()
 formData.append('image', imageFile)
 const res = await fetch('/api/ocr/loading-slip', {
 method: 'POST',
 credentials: 'include',
 body: formData,
 })
 if (res.status === 401) {
 window.location.href = '/login'
 throw new Error('Not authenticated')
 }
 const data = await res.json()
 if (!res.ok) throw new Error(data.error || 'OCR failed')
 return data
 },
}

// ── Tyres ────────────────────────────────────────────────
export const tyres = {
 listForVehicle: (vehicleId) => request(`/tyres/vehicle/${vehicleId}`),
 create: (data) =>
 request('/tyres', { method: 'POST', body: JSON.stringify(data) }),
 update: (id, data) =>
 request(`/tyres/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
 remove: (id) =>
 request(`/tyres/${id}`, { method: 'DELETE' }),
}

// ── Summary ──────────────────────────────────────────────
export const summary = {
 weekly: () => request('/summary/weekly'),
}

// ── AI Insights ─────────────────────────────────────────
export const insights = {
 daily: () => request('/insights/daily'),
 chat: (question) =>
 request('/insights/chat', { method: 'POST', body: JSON.stringify({ question }) }),
 suggestions: () => request('/insights/suggestions'),
 agent: (message, conversationId) =>
 request('/insights/agent', { method: 'POST', body: JSON.stringify({ message, conversationId }) }),
 agentConfirm: (conversationId, confirmed) =>
 request('/insights/agent/confirm', { method: 'POST', body: JSON.stringify({ conversationId, confirmed }) }),
}

// ── Settings ────────────────────────────────────────────
export const settings = {
 getProfile: () => request('/settings/profile'),
 updateProfile: (data) =>
 request('/settings/profile', { method: 'PUT', body: JSON.stringify(data) }),
 updateCompany: (data) =>
 request('/settings/company', { method: 'PUT', body: JSON.stringify(data) }),
 getTeam: () => request('/settings/team'),
 inviteUser: (data) =>
 request('/settings/team/invite', { method: 'POST', body: JSON.stringify(data) }),
 removeUser: (id) =>
 request(`/settings/team/${id}`, { method: 'DELETE' }),
 updateUserRole: (id, role) =>
 request(`/settings/team/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
}

// ── Money Lost ──────────────────────────────────────────
export const moneyLost = {
 get: () => request('/money-lost'),
}

// ── Fleet Health ────────────────────────────────────────
export const fleetHealth = {
 score: () => request('/fleet-health'),
}

// ── Insurance Optimizer ─────────────────────────────────
export const insurance = {
 optimizer: () => request('/insurance/optimizer'),
 benefits: () => request('/insurance/benefits'),
}

// ── Trip Monthly Stats ──────────────────────────────────
export const tripStats = {
 monthly: () => request('/trips/monthly-stats'),
}

// ── FASTag ──────────────────────────────────────────────
export const fastag = {
 providers: () => request('/fastag/providers'),
 vehicles: () => request('/fastag/vehicles'),
 link: (data) =>
 request('/fastag/link', { method: 'POST', body: JSON.stringify(data) }),
 unlink: (id) =>
 request(`/fastag/link/${id}`, { method: 'DELETE' }),
 balance: (fastagId) =>
 request('/fastag/balance', { method: 'POST', body: JSON.stringify({ fastagId }) }),
 balanceAll: () =>
 request('/fastag/balance/all', { method: 'POST' }),
 recharge: (fastagId, amount) =>
 request('/fastag/recharge', { method: 'POST', body: JSON.stringify({ fastagId, amount }) }),
 transactions: (params = {}) => {
 const qs = new URLSearchParams()
 if (params.vehicleId) qs.set('vehicleId', params.vehicleId)
 if (params.status) qs.set('status', params.status)
 if (params.page) qs.set('page', params.page)
 const q = qs.toString()
 return request(`/fastag/transactions${q ? '?' + q : ''}`)
 },
 txnStatus: (txnId) =>
 request(`/fastag/transactions/${txnId}/status`),
}
