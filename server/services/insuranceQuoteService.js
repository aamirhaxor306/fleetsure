/**
 * Insurance Quote Service — Provider-Adapter Architecture
 * ─────────────────────────────────────────────────────────────────
 * Each provider adapter implements the same interface:
 *   { name, isAvailable(), fetchQuotes(vehicleDetails) }
 *
 * To add a REAL provider (Turtlemint, PolicyBazaar, direct insurer):
 *   1. Create a new adapter in the providers array below
 *   2. Implement fetchQuotes() with the real API call
 *   3. Map the API response to the standard QuoteShape
 *   4. Set isAvailable() to return true when API key is configured
 *
 * Standard QuoteShape:
 *   { insurer, premium, coverType, idv, deductible,
 *     premiumBreakdown: { od, tp, ncbDiscount, netPremium, gst, total },
 *     addOns: string[], validUntil: string }
 * ─────────────────────────────────────────────────────────────────
 */

// ── Provider Adapters ───────────────────────────────────────────────────────

/**
 * Mock provider — always available, generates realistic demo quotes.
 * Use this in dev/demo environments.
 */
const MockProvider = {
  name: 'Fleetsure Mock API',
  isAvailable: () => true,
  fetchQuotes: async (vehicleDetails) => {
    const base = estimateBasePremium(vehicleDetails)
    const policyType = vehicleDetails.policyType || 'comprehensive'

    const INSURERS = [
      { name: 'ICICI Lombard', baseFactor: 1.0 },
      { name: 'Bajaj Allianz', baseFactor: 0.95 },
      { name: 'HDFC ERGO', baseFactor: 1.05 },
      { name: 'New India Assurance', baseFactor: 0.92 },
      { name: 'Go Digit', baseFactor: 0.88 },
      { name: 'Tata AIG', baseFactor: 1.02 },
      { name: 'United India', baseFactor: 0.90 },
    ]

    const shuffled = [...INSURERS].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, 3 + Math.floor(Math.random() * 3))

    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + 7)

    return selected.map((insurer) => {
      const factor = insurer.baseFactor + (Math.random() * 0.1 - 0.05)
      const od = Math.round(base.odPremium * factor)
      const tp = base.tpPremium
      const ncbDisc = Math.round(base.ncbDiscount * factor)

      let premium, coverType
      if (policyType === 'third_party') {
        premium = tp
        coverType = 'Third Party Only'
      } else if (policyType === 'own_damage') {
        premium = od - ncbDisc
        coverType = 'Own Damage Only'
      } else {
        premium = od + tp - ncbDisc
        coverType = 'Comprehensive'
      }

      const gst = Math.round(premium * 0.18)
      const total = premium + gst

      return {
        insurer: insurer.name,
        premium: total,
        coverType,
        idv: base.idv,
        deductible: 1000,
        premiumBreakdown: { od: policyType !== 'third_party' ? od : 0, tp: policyType !== 'own_damage' ? tp : 0, ncbDiscount: ncbDisc, netPremium: premium, gst, total },
        addOns: getRandomAddOns(insurer.baseFactor),
        validUntil: validUntil.toISOString().split('T')[0],
      }
    }).sort((a, b) => a.premium - b.premium)
  },
}

/**
 * Turtlemint API stub — placeholder for real integration.
 * To activate: set TURTLEMINT_API_KEY in .env and implement the fetch logic.
 */
const TurtlemintProvider = {
  name: 'Turtlemint',
  isAvailable: () => !!process.env.TURTLEMINT_API_KEY,
  fetchQuotes: async (vehicleDetails) => {
    // TODO: Replace with actual Turtlemint API call
    // const response = await fetch('https://api.turtlemint.com/v1/quotes', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.TURTLEMINT_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     registration_number: vehicleDetails.vehicleNumber,
    //     vehicle_type: 'commercial',
    //     // ... map other fields
    //   }),
    // })
    // const data = await response.json()
    // return data.quotes.map(q => ({
    //   insurer: q.insurer_name,
    //   premium: q.total_premium,
    //   coverType: q.cover_type,
    //   idv: q.idv,
    //   deductible: q.deductible,
    //   premiumBreakdown: { od: q.od_premium, tp: q.tp_premium, ncbDiscount: q.ncb, netPremium: q.net_premium, gst: q.gst, total: q.total_premium },
    //   addOns: q.add_ons || [],
    //   validUntil: q.valid_until,
    // }))
    throw new Error('Turtlemint provider not yet implemented')
  },
}

/**
 * PolicyBazaar API stub — placeholder for real integration.
 */
const PolicyBazaarProvider = {
  name: 'PolicyBazaar',
  isAvailable: () => !!process.env.POLICYBAZAAR_API_KEY,
  fetchQuotes: async (vehicleDetails) => {
    // TODO: Implement real PolicyBazaar API integration
    throw new Error('PolicyBazaar provider not yet implemented')
  },
}

// ── Provider Registry ───────────────────────────────────────────────────────

const providers = [
  TurtlemintProvider,
  PolicyBazaarProvider,
  MockProvider, // Fallback — always available
]

// ── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Fetch insurance quotes from all available providers.
 * Falls back to mock provider if no real APIs are configured.
 *
 * @param {Object} vehicleDetails
 * @returns {Promise<Array>} Merged & sorted quotes from all providers
 */
export async function fetchInsuranceQuotes(vehicleDetails) {
  const activeProviders = providers.filter((p) => p.isAvailable())

  if (activeProviders.length === 0) {
    console.warn('No insurance providers available')
    return []
  }

  const allQuotes = []
  const errors = []

  for (const provider of activeProviders) {
    try {
      const quotes = await provider.fetchQuotes(vehicleDetails)
      allQuotes.push(...quotes)
      console.log(`  [${provider.name}] returned ${quotes.length} quotes`)

      // If we get real quotes from a non-mock provider, skip the mock
      if (provider !== MockProvider && quotes.length > 0) {
        break // Use first real provider's results
      }
    } catch (err) {
      errors.push({ provider: provider.name, error: err.message })
      console.warn(`  [${provider.name}] failed: ${err.message}`)
      // Continue to next provider
    }
  }

  if (errors.length > 0 && allQuotes.length === 0) {
    console.error('All providers failed:', errors)
  }

  // Sort cheapest first
  allQuotes.sort((a, b) => a.premium - b.premium)

  return allQuotes
}

/**
 * Get the list of configured (available) providers.
 * Useful for admin/debug views.
 */
export function getActiveProviders() {
  return providers
    .filter((p) => p.isAvailable())
    .map((p) => ({ name: p.name, active: true }))
}

// ── Shared Helpers ──────────────────────────────────────────────────────────

function estimateBasePremium(vehicle) {
  const currentYear = new Date().getFullYear()
  const age = currentYear - (vehicle.purchaseYear || 2020)
  const idv = vehicle.idv || (age <= 2 ? 1200000 : age <= 5 ? 900000 : 600000)

  const odRate = 0.035 + age * 0.002
  const odPremium = Math.round(idv * odRate)
  const tpPremium = 18500

  const ncb = vehicle.ncbPercentage || 0
  const ncbDiscount = Math.round(odPremium * (ncb / 100))

  return { idv, odPremium, tpPremium, ncbDiscount, age }
}

function getRandomAddOns(factor) {
  const allAddOns = [
    'Zero Depreciation',
    'Roadside Assistance',
    'Engine Protector',
    'Return to Invoice',
    'Key Replacement',
    'Consumable Cover',
    'Tyre Protector',
  ]
  const count = factor > 1.0 ? 4 : factor > 0.95 ? 3 : 2
  const shuffled = [...allAddOns].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

/**
 * Get estimated renewal costs for non-insurance documents.
 * Based on typical MP RTO rates for commercial vehicles.
 */
export function getEstimatedCost(documentType) {
  const estimates = {
    FC: { min: 3000, max: 5000, label: 'Fitness Certificate', processDays: '3-5 working days' },
    PUC: { min: 300, max: 500, label: 'Pollution Under Control', processDays: 'Same day' },
    permit: { min: 5000, max: 15000, label: 'State/National Permit', processDays: '5-10 working days' },
    insurance: { min: 15000, max: 50000, label: 'Motor Insurance', processDays: '1-2 days' },
  }
  return estimates[documentType] || estimates.insurance
}
