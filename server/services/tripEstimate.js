const OPENROUTE_BASE = 'https://api.openrouteservice.org'
const OPENROUTE_KEY = process.env.OPENROUTE_API_KEY

const FUEL_PRICE_API_URL = process.env.FUEL_PRICE_API_URL
const FUEL_PRICE_API_KEY = process.env.FUEL_PRICE_API_KEY

export async function estimateTrip({ from, to }) {
  const fromPoint = await geocodePlace(from)
  const toPoint = await geocodePlace(to)

  if (!fromPoint || !toPoint) {
    throw new Error('Could not geocode route points')
  }

  const distance = await getDistanceKm(fromPoint, toPoint)
  return {
    distanceKm: Math.max(1, Math.round(distance)),
    distanceSource: OPENROUTE_KEY ? 'openroute' : 'estimated',
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
    const url = `${OPENROUTE_BASE}/geocode/search?api_key=${encodeURIComponent(OPENROUTE_KEY)}&text=${encodeURIComponent(q)}&size=1`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      const coords = data?.features?.[0]?.geometry?.coordinates
      if (Array.isArray(coords) && coords.length === 2) {
        return { lng: Number(coords[0]), lat: Number(coords[1]) }
      }
    }
  }

  // Fallback: Nominatim (no key)
  const nomiUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`
  const nomiRes = await fetch(nomiUrl, { headers: { 'User-Agent': 'fleetsure-trip-estimator/1.0' } })
  if (!nomiRes.ok) return null
  const nomi = await nomiRes.json()
  if (!Array.isArray(nomi) || !nomi[0]) return null

  return { lat: Number(nomi[0].lat), lng: Number(nomi[0].lon) }
}

async function getDistanceKm(fromPoint, toPoint) {
  if (OPENROUTE_KEY) {
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
        return meters / 1000
      }
    }
  }

  // Fallback estimate when key is missing/unavailable.
  const straightKm = haversineKm(fromPoint.lat, fromPoint.lng, toPoint.lat, toPoint.lng)
  return straightKm * 1.2
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
