import Groq from 'groq-sdk'

const OPENROUTE_BASE = 'https://api.openrouteservice.org'
const OPENROUTE_KEY = process.env.OPENROUTE_API_KEY

const FUEL_PRICE_API_URL = process.env.FUEL_PRICE_API_URL
const FUEL_PRICE_API_KEY = process.env.FUEL_PRICE_API_KEY
const GROQ_KEY = process.env.GROQ_API_KEY

/** Indian retail HSD band (INR/L) — sanity clamp for LLM output */
const DIESEL_INR_MIN = 72
const DIESEL_INR_MAX = 135

export async function estimateTrip({ from, to }) {
 const fromPoint = await geocodePlace(from)
 const toPoint = await geocodePlace(to)

 if (!fromPoint || !toPoint) {
 throw new Error(
 'Could not find those places. Try city names with state or country (e.g. Mumbai, Maharashtra).'
 )
 }

 const { km, distanceSource } = await getDistanceKm(fromPoint, toPoint)
 return {
 distanceKm: Math.max(1, Math.round(km)),
 distanceSource,
 }
}

/**
 * India-only retail diesel estimate via Groq (same stack as fleet AI insights).
 * Not live market data — approximate INR/L from model knowledge for trip planning.
 */
export async function fetchIndiaDieselRateGroq({ from, to }) {
 if (!GROQ_KEY) return null

 const origin = String(from || '').trim()
 const dest = String(to || '').trim()
 if (!origin || !dest) return null

 const system = `You help Indian fleet operators. You reply with ONLY a single JSON object, no markdown fences, no other text.
Keys: "dieselRate" (number, INR per litre) and "note" (short string).
The price must be typical Indian retail pump HSD/diesel in India only — never USD, never other countries.
If the route is ambiguous, give a reasonable India-wide or regional corridor estimate.`

 const user = `Loading / origin: "${origin}"
Destination: "${dest}"

Return JSON only, example shape: {"dieselRate":92.5,"note":"Approx. India retail HSD"}`

 try {
 const groq = new Groq({ apiKey: GROQ_KEY })
 const completion = await groq.chat.completions.create({
 model: 'llama-3.3-70b-versatile',
 messages: [
 { role: 'system', content: system },
 { role: 'user', content: user },
 ],
 temperature: 0.15,
 max_tokens: 120,
 })

 const text = completion.choices[0]?.message?.content?.trim() || ''
 const parsed = parseDieselJsonFromLLM(text)
 if (!parsed) return null

 const rate = Number(parsed.dieselRate)
 if (!Number.isFinite(rate) || rate < DIESEL_INR_MIN || rate > DIESEL_INR_MAX) {
 console.warn('[tripEstimate] Groq diesel out of band:', rate)
 return null
 }

 return {
 dieselRate: Math.round(rate * 100) / 100,
 note: String(parsed.note || 'India retail estimate (Groq)').slice(0, 120),
 }
 } catch (err) {
 console.warn('[tripEstimate] Groq diesel estimate failed:', err?.message || err)
 return null
 }
}

function parseDieselJsonFromLLM(text) {
 if (!text) return null
 let raw = text.trim()
 const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
 if (fence) raw = fence[1].trim()

 try {
 return JSON.parse(raw)
 } catch {
 const m = raw.match(/"dieselRate"\s*:\s*([\d.]+)/i)
 if (!m) return null
 const dieselRate = parseFloat(m[1])
 const noteM = raw.match(/"note"\s*:\s*"([^"]*)"/)
 return { dieselRate, note: noteM ? noteM[1] : 'India retail estimate' }
 }
}

export async function fetchExternalDieselRate({ from, to }) {
 if (!FUEL_PRICE_API_URL) return null

 try {
 const url = new URL(FUEL_PRICE_API_URL)
 url.searchParams.set('from', from || '')
 url.searchParams.set('to', to || '')

 const headers = {}
 if (FUEL_PRICE_API_KEY) headers['Authorization'] = `Bearer ${FUEL_PRICE_API_KEY}`

 const res = await fetch(url.toString(), { headers })
 if (!res.ok) return null
 const data = await res.json()

 const rate = Number(data?.dieselRate ?? data?.diesel ?? data?.rate)
 if (!Number.isFinite(rate) || rate <= 0) return null

 return {
 dieselRate: Math.round(rate * 100) / 100,
 source: 'external',
 note: data?.source || 'Market API',
 }
 } catch {
 return null
 }
}

async function geocodePlace(query) {
 const q = String(query || '').trim()
 if (!q) return null

 // Preferred: OpenRoute geocoding (if key configured)
 if (OPENROUTE_KEY) {
 try {
 const url = `${OPENROUTE_BASE}/geocode/search?api_key=${encodeURIComponent(OPENROUTE_KEY)}&text=${encodeURIComponent(q)}&size=1`
 const res = await fetch(url)
 if (res.ok) {
 const data = await res.json()
 const coords = data?.features?.[0]?.geometry?.coordinates
 if (Array.isArray(coords) && coords.length === 2) {
 return { lng: Number(coords[0]), lat: Number(coords[1]) }
 }
 }
 } catch (err) {
 console.warn('[tripEstimate] OpenRoute geocode failed:', err?.message || err)
 }
 }

 // Fallback: Nominatim (no key)
 try {
 const nomiUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`
 const nomiRes = await fetch(nomiUrl, { headers: { 'User-Agent': 'fleetsure-trip-estimator/1.0' } })
 if (!nomiRes.ok) return null
 const nomi = await nomiRes.json()
 if (!Array.isArray(nomi) || !nomi[0]) return null

 return { lat: Number(nomi[0].lat), lng: Number(nomi[0].lon) }
 } catch (err) {
 console.warn('[tripEstimate] Nominatim geocode failed:', err?.message || err)
 return null
 }
}

async function getDistanceKm(fromPoint, toPoint) {
 if (OPENROUTE_KEY) {
 try {
 const res = await fetch(`${OPENROUTE_BASE}/v2/directions/driving-car`, {
 method: 'POST',
 headers: {
 Authorization: OPENROUTE_KEY,
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 coordinates: [
 [fromPoint.lng, fromPoint.lat],
 [toPoint.lng, toPoint.lat],
 ],
 }),
 })

 if (res.ok) {
 const data = await res.json()
 const meters = data?.routes?.[0]?.summary?.distance
 if (Number.isFinite(meters) && meters > 0) {
 return { km: meters / 1000, distanceSource: 'openroute' }
 }
 }
 } catch (err) {
 console.warn('[tripEstimate] OpenRoute directions failed:', err?.message || err)
 }
 }

 const straightKm = haversineKm(fromPoint.lat, fromPoint.lng, toPoint.lat, toPoint.lng)
 return { km: straightKm * 1.2, distanceSource: 'straight_line' }
}

function haversineKm(lat1, lon1, lat2, lon2) {
 const R = 6371
 const dLat = ((lat2 - lat1) * Math.PI) / 180
 const dLon = ((lon2 - lon1) * Math.PI) / 180
 const a =
 Math.sin(dLat / 2) ** 2 +
 Math.cos((lat1 * Math.PI) / 180) *
 Math.cos((lat2 * Math.PI) / 180) *
 Math.sin(dLon / 2) ** 2
 return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}
