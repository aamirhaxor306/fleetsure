import dotenv from 'dotenv'

dotenv.config()

const SUREPASS_BASE = (process.env.SUREPASS_API_BASE_URL || 'https://sandbox.surepass.app').replace(/\/+$/, '')
const TOKEN = process.env.SUREPASS_API_TOKEN

export function isSurepassConfigured() {
 return Boolean(TOKEN)
}

async function callSurepass(path, body) {
  if (!TOKEN) {
    throw new Error('SUREPASS_API_TOKEN is not configured')
  }

  const res = await fetch(`${SUREPASS_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  })

  const json = await res.json().catch(() => ({}))
  return { res, json }
}

/**
 * Fetch vehicle RC details from Surepass (Vahan/mParivahan data).
 * @param {string} vehicleNumber — e.g. "MP09AB1234"
 * @returns {object} Normalized vehicle + document data
 */
export async function fetchRCDetails(vehicleNumber) {
 const cleaned = vehicleNumber.toUpperCase().replace(/\s+/g, '')
  let { res, json } = await callSurepass('/identity/rc-v2', { id_number: cleaned })
  // Backward compatibility if account still uses legacy path
  if (res.status === 404) {
    ;({ res, json } = await callSurepass('/api/v1/rc/rc-v2', { id_number: cleaned }))
  }

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
 * Fetch driving license details (text API) from Surepass.
 * @param {string} licenseNumber
 * @param {string | undefined} dob - Optional date of birth (YYYY-MM-DD)
 */
export async function fetchDrivingLicenseText(licenseNumber, dob) {
  const cleaned = String(licenseNumber || '').toUpperCase().replace(/\s+/g, '')
  if (!cleaned) throw new Error('licenseNumber is required')

  const payload = { id_number: cleaned }
  if (dob) payload.date_of_birth = dob

  let { res, json } = await callSurepass('/identity/driving-license-text', payload)
  if (res.status === 404) {
    ;({ res, json } = await callSurepass('/api/v1/driving-license/driving-license-text', payload))
  }

  if (!res.ok || json.status_code !== 200 || !json.data) {
    const msg = json.message || json.message_code || 'Driving license not found or API error'
    throw new Error(msg)
  }

  const d = json.data
  return {
    licenseNumber: cleaned,
    holderName: d.name || d.holder_name || d.full_name || null,
    fatherName: d.father_name || null,
    dob: parseDate(d.dob || d.date_of_birth),
    issueDate: parseDate(d.issue_date || d.issued_on),
    expiryDate: parseDate(d.expiry_date || d.valid_upto),
    state: d.state || d.issuing_state || null,
    bloodGroup: d.blood_group || null,
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
