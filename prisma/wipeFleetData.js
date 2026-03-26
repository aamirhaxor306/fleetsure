import { PrismaClient } from '@prisma/client'

/**
 * DANGEROUS: Wipes ALL tenant/user/vehicle data (fleet app) from the target DB.
 * Keeps: OpsUser, Lead, Workshop, SparePartSKU, InventoryTransaction (ops catalog / leads).
 *
 * Guardrails:
 * - Requires explicit env confirmation to run.
 *
 * Usage (production):
 *   CONFIRM_WIPE_FLEET_DATA="DELETE_ALL_FLEET_DATA" node prisma/wipeFleetData.js
 */

const CONFIRM = 'DELETE_ALL_FLEET_DATA'

function mustConfirm() {
  const v = process.env.CONFIRM_WIPE_FLEET_DATA
  if (v !== CONFIRM) {
    throw new Error(
      `Refusing to run. Set CONFIRM_WIPE_FLEET_DATA="${CONFIRM}" to proceed.`
    )
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('Refusing to run: DATABASE_URL is not set.')
  }
}

const prisma = new PrismaClient()

async function del(label, fn) {
  const res = await fn()
  const count = typeof res?.count === 'number' ? res.count : null
  // eslint-disable-next-line no-console
  console.log(`${label}: ${count ?? 'ok'}`)
}

async function main() {
  mustConfirm()

  // eslint-disable-next-line no-console
  console.log('Wiping fleet data (tenants/users/vehicles + dependent records)...')

  // NOTE: Order matters for FK constraints where cascades aren't defined.
  // Trip-related (children → parent)
  await del('TripExpense', () => prisma.tripExpense.deleteMany())
  await del('DrivingScore', () => prisma.drivingScore.deleteMany())
  await del('DrivingEvent', () => prisma.drivingEvent.deleteMany())
  await del('LocationLog', () => prisma.locationLog.deleteMany())
  await del('Trip', () => prisma.trip.deleteMany())
  await del('MonthlyBill', () => prisma.monthlyBill.deleteMany())

  // Vehicle-linked logs
  await del('FuelLog', () => prisma.fuelLog.deleteMany())
  await del('FasTagTransaction', () => prisma.fasTagTransaction.deleteMany())
  await del('FasTag', () => prisma.fasTag.deleteMany())
  await del('Tyre', () => prisma.tyre.deleteMany())
  await del('MaintenanceLog', () => prisma.maintenanceLog.deleteMany())
  await del('Alert', () => prisma.alert.deleteMany())

  // Renewals (children → parent)
  await del('RenewalQuote', () => prisma.renewalQuote.deleteMany())
  await del('PlatformTransaction', () => prisma.platformTransaction.deleteMany())
  await del('RenewalRequest', () => prisma.renewalRequest.deleteMany())
  await del('Document', () => prisma.document.deleteMany())
  await del('RenewalPartner', () => prisma.renewalPartner.deleteMany())

  // Tenant-scoped misc
  await del('SavedRoute', () => prisma.savedRoute.deleteMany())
  await del('Driver', () => prisma.driver.deleteMany())
  await del('NpsResponse', () => prisma.npsResponse.deleteMany())

  // Ops tables that are tenant-scoped (children → parent)
  await del('FleetLedger', () => prisma.fleetLedger.deleteMany())
  await del('Invoice', () => prisma.invoice.deleteMany())
  await del('JobParts', () => prisma.jobParts.deleteMany())
  await del('JobLabor', () => prisma.jobLabor.deleteMany())
  await del('ServiceJob', () => prisma.serviceJob.deleteMany())
  await del('FleetMessage', () => prisma.fleetMessage.deleteMany())

  // Core entities
  await del('Vehicle', () => prisma.vehicle.deleteMany())
  await del('User', () => prisma.user.deleteMany())
  await del('Tenant', () => prisma.tenant.deleteMany())

  // eslint-disable-next-line no-console
  console.log('Done.')
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

