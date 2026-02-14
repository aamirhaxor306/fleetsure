import prisma from '../lib/prisma.js'
import dotenv from 'dotenv'

dotenv.config()
const THRESHOLD = parseInt(process.env.ALERT_MAINTENANCE_THRESHOLD) || 50000

/**
 * Run the alert engine — checks all 4 rules and creates new alerts.
 * Deduplicates: won't create a new alert if an unresolved one of the
 * same type already exists for the same vehicle.
 */
export async function runAlertEngine(tenantId) {
  const now = new Date()
  let created = 0

  const vehicles = await prisma.vehicle.findMany({
    where: { tenantId },
    include: {
      maintenanceLogs: true,
      documents: true,
    },
  })

  for (const vehicle of vehicles) {
    // ── Rule 1: High maintenance spend in last 60 days ───────────────────

    const sixtyDaysAgo = new Date(now)
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    const recentSpend = vehicle.maintenanceLogs
      .filter((m) => new Date(m.maintenanceDate) >= sixtyDaysAgo)
      .reduce((sum, m) => sum + m.amount, 0)

    if (recentSpend > THRESHOLD) {
      const exists = await prisma.alert.findFirst({
        where: {
          tenantId,
          vehicleId: vehicle.id,
          alertType: 'high_maintenance',
          resolved: false,
        },
      })
      if (!exists) {
        await prisma.alert.create({
          data: {
            tenantId,
            vehicleId: vehicle.id,
            alertType: 'high_maintenance',
            severity: 'high',
            message: `Vehicle ${vehicle.vehicleNumber} has unusually high maintenance spend (₹${recentSpend.toLocaleString('en-IN')}) in the last 60 days. Threshold: ₹${THRESHOLD.toLocaleString('en-IN')}.`,
          },
        })
        created++
      }
    }

    // ── Rule 2: Repeated issue (same type 2+ times in 90 days) ──────────

    const ninetyDaysAgo = new Date(now)
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const recentLogs = vehicle.maintenanceLogs.filter(
      (m) => new Date(m.maintenanceDate) >= ninetyDaysAgo
    )

    const typeCounts = {}
    for (const log of recentLogs) {
      typeCounts[log.maintenanceType] = (typeCounts[log.maintenanceType] || 0) + 1
    }

    for (const [type, count] of Object.entries(typeCounts)) {
      if (count >= 2) {
        const exists = await prisma.alert.findFirst({
          where: {
            tenantId,
            vehicleId: vehicle.id,
            alertType: 'repeated_issue',
            resolved: false,
            message: { contains: type },
          },
        })
        if (!exists) {
          await prisma.alert.create({
            data: {
              tenantId,
              vehicleId: vehicle.id,
              alertType: 'repeated_issue',
              severity: 'medium',
              message: `Vehicle ${vehicle.vehicleNumber} has had "${type}" maintenance ${count} times in the last 90 days. Check if there's a recurring problem.`,
            },
          })
          created++
        }
      }
    }

    // ── Rule 3: Idle vehicle (no maintenance logged in 7+ days) ─────────

    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const hasRecentLog = vehicle.maintenanceLogs.some(
      (m) => new Date(m.maintenanceDate) >= sevenDaysAgo
    )

    if (!hasRecentLog && vehicle.status === 'active') {
      const exists = await prisma.alert.findFirst({
        where: {
          tenantId,
          vehicleId: vehicle.id,
          alertType: 'idle_vehicle',
          resolved: false,
        },
      })
      if (!exists) {
        await prisma.alert.create({
          data: {
            tenantId,
            vehicleId: vehicle.id,
            alertType: 'idle_vehicle',
            severity: 'low',
            message: `Vehicle ${vehicle.vehicleNumber} has had no activity logged in the past 7 days. Is it idle or just not recorded?`,
          },
        })
        created++
      }
    }

    // ── Rule 4: Document expiry within reminder_days ────────────────────

    for (const doc of vehicle.documents) {
      const expiryDate = new Date(doc.expiryDate)
      const reminderDate = new Date(expiryDate)
      reminderDate.setDate(reminderDate.getDate() - doc.reminderDays)

      if (now >= reminderDate) {
        const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))
        const label = daysLeft <= 0 ? 'EXPIRED' : `expires in ${daysLeft} days`

        const exists = await prisma.alert.findFirst({
          where: {
            tenantId,
            vehicleId: vehicle.id,
            alertType: 'document_expiry',
            resolved: false,
            message: { contains: doc.documentType },
          },
        })
        if (!exists) {
          await prisma.alert.create({
            data: {
              tenantId,
              vehicleId: vehicle.id,
              alertType: 'document_expiry',
              severity: 'high',
              message: `Vehicle ${vehicle.vehicleNumber}: ${doc.documentType} ${label} (${expiryDate.toLocaleDateString('en-IN')}).`,
            },
          })
          created++
        }

        // ── Auto-create a RenewalRequest if none exists ────────────
        const existingRenewal = await prisma.renewalRequest.findFirst({
          where: {
            tenantId,
            documentId: doc.id,
            status: { notIn: ['cancelled', 'renewed'] },
          },
        })
        if (!existingRenewal) {
          try {
            await prisma.renewalRequest.create({
              data: {
                tenantId,
                vehicleId: vehicle.id,
                documentId: doc.id,
                documentType: doc.documentType,
                vehicleSnapshot: {
                  vehicleNumber: vehicle.vehicleNumber,
                  vehicleType: vehicle.vehicleType,
                  purchaseYear: vehicle.purchaseYear,
                },
              },
            })
          } catch (_) {
            // Ignore if duplicate or constraint error
          }
        }
      }
    }
  }

  return { created, checkedVehicles: vehicles.length, timestamp: now.toISOString() }
}
