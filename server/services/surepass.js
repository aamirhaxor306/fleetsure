import dotenv from 'dotenv'

dotenv.config()

const SUREPASS_BASE = 'https://kyc-api.surepass.io/api/v1'
const TOKEN = process.env.SUREPASS_API_TOKEN

export function isSurepassConfigured() {
  return Boolean(TOKEN)
}

/**
 * Fetch vehicle RC details from Surepass (Vahan/mParivahan data).
 * @param {string} vehicleNumber — e.g. "MP09AB1234"
 * @returns {object} Normalized vehicle + document data
 */
export async function fetchRCDetails(vehicleNumber) {
  if (!TOKEN) {
    throw new Error('SUREPASS_API_TOKEN is not configured')
  }

  const cleaned = vehicleNumber.toUpperCase().replace(/\s+/g, '')

  const res = await fetch(`${SUREPASS_BASE}/rc/rc-verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ id_number: cleaned }),
  })

  const json = await res.json()

  if (!res.ok || json.status_code !== 200 || !json.data) {
    const msg = json.message || json.message_code || 'Vehicle not found or API error'
    throw new Error(msg)
  }

  const d = json.data

  // ── Normalize into Fleetsure-friendly shape ────────────────────────
  return {
    // Vehicle fields
    vehicleNumber: cleaned,
    vehicleType: d.vehicle_category || d.vehicle_class_description || d.body_type || 'Unknown',
    ownerName: d.owner_name || null,
    fatherName: d.father_name || null,
    manufacturer: d.maker_description || d.maker_model || null,
    model: d.maker_model || null,
    fuelType: d.fuel_description || d.fuel_type || null,
    color: d.color || null,
    chassisNumber: d.vehicle_chasi_number || null,
    engineNumber: d.vehicle_engine_number || null,
    registrationDate: d.registration_date || null,
    registrationAuthority: d.registered_at || d.registration_authority || null,
    financier: d.financer || null,

    // Document expiry dates (ISO date strings or null)
    insuranceExpiry: parseDate(d.insurance_upto),
    insuranceCompany: d.insurance_name || d.insurance_company || null,
    fitnessExpiry: parseDate(d.fit_up_to),
    pucExpiry: parseDate(d.pucc_upto || d.puc_valid_upto),
    permitExpiry: parseDate(d.permit_valid_upto),
    permitNumber: d.permit_number || null,
    permitType: d.permit_type || null,

    // Raw data for reference
    _raw: d,
  }
}

/**
 * Parse a date string from the Surepass response.
 * Handles formats like "dd-mm-yyyy", "yyyy-mm-dd", or ISO strings.
 */
function parseDate(str) {
  if (!str || str === 'NA' || str === '' || str === 'null') return null

  // dd-mm-yyyy format (common in Indian govt data)
  const ddmmyyyy = str.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (ddmmyyyy) {
    return new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`).toISOString()
  }

  // Try native Date parsing for yyyy-mm-dd or ISO
  const d = new Date(str)
  if (!isNaN(d.getTime())) return d.toISOString()

  return null
}
