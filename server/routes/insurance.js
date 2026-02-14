/**
 * Insurance Optimizer API
 * ───────────────────────
 * Computes fleet-wide insurance intelligence from existing data:
 * vehicles, documents, renewals, maintenance, and trips.
 * No new models needed -- everything is derived.
 */

import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import {
  POLICY_TYPES, ADD_ONS, NCB_SLABS, CLAIM_PROCESS,
  getNextNcbSlab, RECOMMENDATION_TYPES,
} from '../data/insuranceBenefits.js'

const router = Router()

router.use(requireAuth)

// ── GET /api/insurance/optimizer ─────────────────────────────────────────────

router.get('/optimizer', async (req, res) => {
  try {
    // ── 1. Fetch all vehicles with their documents & maintenance ──────────
    const vehicles = await prisma.vehicle.findMany({
      where: { tenantId: req.tenantId },
      include: {
        documents: {
          where: { documentType: 'insurance' },
          orderBy: { expiryDate: 'desc' },
          take: 1,
        },
        maintenanceLogs: {
          orderBy: { maintenanceDate: 'desc' },
        },
        trips: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { distance: true, createdAt: true },
        },
      },
    })

    // ── 2. Fetch all completed renewal requests with quotes ──────────────
    const completedRenewals = await prisma.renewalRequest.findMany({
      where: { status: 'renewed', documentType: 'insurance' },
      include: {
        quotes: { orderBy: { amount: 'asc' } },
        vehicle: { select: { vehicleNumber: true, previousInsurer: true } },
      },
    })

    // ── 3. Build per-vehicle coverage summary ────────────────────────────
    const now = new Date()
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

    const vehicleSummaries = vehicles.map(v => {
      const insDocs = v.documents
      const insDoc = insDocs[0] || null
      const isExpired = insDoc ? new Date(insDoc.expiryDate) < now : true
      const isExpiringSoon = insDoc ? new Date(insDoc.expiryDate) < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) : true
      const daysUntilExpiry = insDoc ? Math.ceil((new Date(insDoc.expiryDate) - now) / (24 * 60 * 60 * 1000)) : -999

      // Maintenance cost in last 12 months
      const recentMaint = v.maintenanceLogs.filter(m => new Date(m.maintenanceDate) >= oneYearAgo)
      const maintenanceCost = recentMaint.reduce((s, m) => s + m.amount, 0)
      const maintenanceCount = recentMaint.length

      // Monthly km estimate from trips
      const recentTrips = v.trips.filter(t => new Date(t.createdAt) >= oneYearAgo)
      const totalTripKm = recentTrips.reduce((s, t) => s + (t.distance || 0), 0)
      const monthsOfData = Math.max(1, Math.ceil((now - oneYearAgo) / (30 * 24 * 60 * 60 * 1000)))
      const monthlyKm = Math.round(totalTripKm / monthsOfData)

      // NCB
      const ncb = v.ncbPercentage || 0
      const nextNcb = getNextNcbSlab(ncb)
      const policyType = v.policyType || 'comprehensive'

      // Coverage status
      let coverageStatus = 'good'
      if (isExpired) coverageStatus = 'expired'
      else if (isExpiringSoon) coverageStatus = 'warning'
      else if (policyType === 'third_party') coverageStatus = 'gap'

      return {
        id: v.id,
        vehicleNumber: v.vehicleNumber,
        vehicleType: v.vehicleType,
        purchaseYear: v.purchaseYear,
        policyType,
        previousInsurer: v.previousInsurer,
        ncbPercentage: ncb,
        nextNcb,
        coverageStatus,
        daysUntilExpiry,
        isExpired,
        isExpiringSoon,
        maintenanceCost,
        maintenanceCount,
        monthlyKm,
        coveredRisks: POLICY_TYPES[policyType]?.coveredRisks || [],
      }
    })

    // ── 4. Calculate savings from completed renewals ─────────────────────
    let totalSavings = 0
    let totalSpend = 0
    const savingsPerVehicle = []

    for (const renewal of completedRenewals) {
      const selectedQuote = renewal.quotes.find(q => q.selected) || renewal.quotes[0]
      if (!selectedQuote) continue

      const selectedAmount = selectedQuote.amount
      totalSpend += selectedAmount

      // Estimate "what they would have paid" without comparison (highest quote or +15%)
      const sortedQuotes = [...renewal.quotes].sort((a, b) => b.amount - a.amount)
      const worstQuote = sortedQuotes[0]
      const previousEstimate = worstQuote ? worstQuote.amount : selectedAmount * 1.15
      const savings = Math.max(0, Math.round(previousEstimate - selectedAmount))
      totalSavings += savings

      savingsPerVehicle.push({
        vehicleNumber: renewal.vehicle.vehicleNumber,
        previousInsurer: renewal.vehicle.previousInsurer || 'Market Average',
        previousEstimate: Math.round(previousEstimate),
        selectedAmount: Math.round(selectedAmount),
        selectedInsurer: selectedQuote.partnerName,
        savings,
        savingsPercent: previousEstimate > 0 ? Math.round((savings / previousEstimate) * 100) : 0,
      })
    }

    // ── 5. Compute NCB fleet value ──────────────────────────────────────
    const ncbTotalValue = vehicles.reduce((sum, v) => {
      const ncb = v.ncbPercentage || 0
      if (ncb === 0) return sum
      // Estimate OD premium based on vehicle age
      const age = now.getFullYear() - (v.purchaseYear || 2020)
      const idv = v.idv || (age <= 2 ? 1200000 : age <= 5 ? 900000 : 600000)
      const odRate = 0.035 + age * 0.002
      const odPremium = Math.round(idv * odRate)
      const ncbDiscount = Math.round(odPremium * (ncb / 100))
      return sum + ncbDiscount
    }, 0)

    // ── 6. Coverage gap count ───────────────────────────────────────────
    const coverageGapCount = vehicleSummaries.filter(
      v => v.coverageStatus === 'expired' || v.coverageStatus === 'gap'
    ).length

    // ── 7. Generate smart recommendations ───────────────────────────────
    const recommendations = []

    for (const v of vehicleSummaries) {
      // Expired insurance
      if (v.isExpired) {
        recommendations.push({
          vehicleNumber: v.vehicleNumber,
          type: 'expired_insurance',
          icon: '🔴',
          severity: 'critical',
          message: `${v.vehicleNumber} insurance expired ${Math.abs(v.daysUntilExpiry)} days ago! Driving without insurance is illegal and risky.`,
        })
      }

      // Third-party with high maintenance
      if (v.policyType === 'third_party' && v.maintenanceCost > 5000) {
        recommendations.push({
          vehicleNumber: v.vehicleNumber,
          type: 'upgrade_to_comprehensive',
          icon: '🛡️',
          severity: 'high',
          message: `${v.vehicleNumber} had Rs ${v.maintenanceCost.toLocaleString('en-IN')} in maintenance this year but only has Third Party coverage. Comprehensive would cover these repairs.`,
        })
      }

      // NCB preservation
      if (v.ncbPercentage >= 20 && !v.nextNcb.isMax) {
        const age = now.getFullYear() - (v.purchaseYear || 2020)
        const idv = age <= 2 ? 1200000 : age <= 5 ? 900000 : 600000
        const odRate = 0.035 + age * 0.002
        const odPremium = Math.round(idv * odRate)
        const currentSaving = Math.round(odPremium * (v.ncbPercentage / 100))
        const nextSaving = Math.round(odPremium * (v.nextNcb.next / 100))

        recommendations.push({
          vehicleNumber: v.vehicleNumber,
          type: 'ncb_preservation',
          icon: '💰',
          severity: 'medium',
          message: `${v.vehicleNumber} is at ${v.ncbPercentage}% NCB (saving Rs ${currentSaving.toLocaleString('en-IN')}/year). Stay claim-free to reach ${v.nextNcb.next}% and save Rs ${nextSaving.toLocaleString('en-IN')}/year.`,
        })
      }

      // High mileage + Zero Dep recommendation
      if (v.monthlyKm > 3000 && v.policyType === 'comprehensive') {
        recommendations.push({
          vehicleNumber: v.vehicleNumber,
          type: 'high_mileage_zero_dep',
          icon: '🛣️',
          severity: 'medium',
          message: `${v.vehicleNumber} runs ~${v.monthlyKm.toLocaleString('en-IN')} km/month. Zero Depreciation add-on (Rs 3,000-8,000/year) pays for itself after one accident claim.`,
        })
      }

      // Coverage gap
      if (v.policyType === 'third_party' && !v.isExpired) {
        recommendations.push({
          vehicleNumber: v.vehicleNumber,
          type: 'coverage_gap',
          icon: '⚠️',
          severity: 'high',
          message: `${v.vehicleNumber} has only Third Party coverage. Any accident repair comes from your pocket -- consider upgrading to Comprehensive.`,
        })
      }
    }

    // Sort: critical > high > medium
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    recommendations.sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3))

    // ── 8. Return everything ────────────────────────────────────────────
    return res.json({
      kpis: {
        totalFleetInsuranceSpend: totalSpend,
        totalSavings,
        ncbFleetValue: ncbTotalValue,
        coverageGapCount,
        vehicleCount: vehicles.length,
      },
      vehicleSummaries,
      savingsPerVehicle,
      recommendations: recommendations.slice(0, 20),
      // Static reference data
      policyTypes: POLICY_TYPES,
      addOns: ADD_ONS,
      ncbSlabs: NCB_SLABS,
      claimProcess: CLAIM_PROCESS,
    })
  } catch (err) {
    console.error('[Insurance] Optimizer error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/insurance/benefits — Static benefits data ──────────────────────

router.get('/benefits', (req, res) => {
  return res.json({
    policyTypes: POLICY_TYPES,
    addOns: ADD_ONS,
    ncbSlabs: NCB_SLABS,
    claimProcess: CLAIM_PROCESS,
  })
})

export default router
