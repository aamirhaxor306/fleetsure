import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const EMAIL = 'aamirsec6@gmail.com'

const TRIP_DATA = [
  { loading: 'GAIL GANDHAR BP', truck: 'MP04HE9634', dest: 'INDORE LPG PLANT', freight: 59335, dist: 972, rate: 3.52, fuel: 324, dieselRate: 92.67, fuelExp: 30025, toll: 7776, cash: 2000 },
  { loading: 'GAIL GANDHAR BP', truck: 'MP04HE9365', dest: 'INDORE LPG PLANT', freight: 60087, dist: 972, rate: 3.52, fuel: 324, dieselRate: 92.67, fuelExp: 30025, toll: 7776, cash: 2000 },
  { loading: 'GAIL GANDHAR BP', truck: 'MP04HE9665', dest: 'INDORE LPG PLANT', freight: 57250, dist: 972, rate: 3.52, fuel: 324, dieselRate: 92.67, fuelExp: 30025, toll: 7776, cash: 2000 },
  { loading: 'RAIPUR LPG PLANT', truck: 'MP04HE9614', dest: 'JABALPUR LPG PLANT', freight: 67841, dist: 1090, rate: 3.52, fuel: 363, dieselRate: 92.67, fuelExp: 33670, toll: 8720, cash: 2000 },
  { loading: 'RAIPUR LPG PLANT', truck: 'MP04HE9620', dest: 'JABALPUR LPG PLANT', freight: 66883, dist: 1090, rate: 3.52, fuel: 363, dieselRate: 92.67, fuelExp: 33670, toll: 8720, cash: 2000 },
  { loading: 'RAIPUR LPG PLANT', truck: 'MP04HE9633', dest: 'JABALPUR LPG PLANT', freight: 67803, dist: 1090, rate: 3.52, fuel: 363, dieselRate: 92.67, fuelExp: 33670, toll: 8720, cash: 2000 },
  { loading: 'GCPL DAHEJ LPG', truck: 'MP04HE9608', dest: 'INDORE LPG PLANT', freight: 61637, dist: 992, rate: 3.52, fuel: 331, dieselRate: 92.67, fuelExp: 30642, toll: 7936, cash: 2000 },
  { loading: 'GCPL DAHEJ LPG', truck: 'MP04HE9632', dest: 'BHOPAL LPG', freight: 85264, dist: 1384, rate: 3.52, fuel: 461, dieselRate: 92.67, fuelExp: 42751, toll: 11072, cash: 2000 },
  { loading: 'GCPL DAHEJ LPG', truck: 'MP04HE9610', dest: 'INDORE LPG PLANT', freight: 61498, dist: 992, rate: 3.52, fuel: 331, dieselRate: 92.67, fuelExp: 30642, toll: 7936, cash: 2000 },
  { loading: 'GCPL DAHEJ LPG', truck: 'MP04HE9619', dest: 'INDORE LPG PLANT', freight: 61916, dist: 992, rate: 3.52, fuel: 331, dieselRate: 92.67, fuelExp: 30642, toll: 7936, cash: 2000 },
  { loading: 'GCPL DAHEJ LPG', truck: 'MP04HE9565', dest: 'INDORE LPG PLANT', freight: 61149, dist: 992, rate: 3.52, fuel: 331, dieselRate: 92.67, fuelExp: 30642, toll: 7936, cash: 2000 },
  { loading: 'GCPL DAHEJ LPG', truck: 'MP04HE9616', dest: 'CHHINDWARA LPG', freight: 98502, dist: 1588, rate: 3.52, fuel: 529, dieselRate: 92.67, fuelExp: 49053, toll: 12704, cash: 2000 },
  { loading: 'CHERLAPALLY LPG', truck: 'MP04HE9623', dest: 'JABALPUR LPG PLANT', freight: 100373, dist: 1620, rate: 3.52, fuel: 540, dieselRate: 92.67, fuelExp: 50041, toll: 12960, cash: 2000 },
  { loading: 'VIJAIPUR GAIL LPG', truck: 'MP04HE9609', dest: 'JABALPUR LPG PLANT', freight: 64128, dist: 1032, rate: 3.53, fuel: 344, dieselRate: 92.67, fuelExp: 31878, toll: 8256, cash: 2000 },
  { loading: 'GCPL DAHEJ LPG', truck: 'MP04HE9635', dest: 'INDORE LPG PLANT', freight: 60800, dist: 992, rate: 3.52, fuel: 331, dieselRate: 92.67, fuelExp: 30642, toll: 7936, cash: 2000 },
  { loading: 'GCPL DAHEJ LPG', truck: 'MP04HE9634', dest: 'BHOPAL LPG', freight: 85799, dist: 1384, rate: 3.52, fuel: 461, dieselRate: 92.67, fuelExp: 42751, toll: 11072, cash: 2000 },
  { loading: 'GCPL DAHEJ LPG', truck: 'MP04HE9608', dest: 'BHOPAL LPG', freight: 85945, dist: 1384, rate: 3.52, fuel: 461, dieselRate: 92.67, fuelExp: 42751, toll: 11072, cash: 2000 },
  { loading: 'RAIPUR LPG PLANT', truck: 'MP04HE9617', dest: 'JABALPUR LPG PLANT', freight: 69030, dist: 1090, rate: 3.52, fuel: 363, dieselRate: 92.67, fuelExp: 33670, toll: 8720, cash: 2000 },
  { loading: 'GCPL DAHEJ LPG', truck: 'MP04HE9632', dest: 'CHHINDWARA LPG', freight: 98558, dist: 1588, rate: 3.52, fuel: 529, dieselRate: 92.67, fuelExp: 49053, toll: 12704, cash: 2000 },
  { loading: 'CHERLAPALLY LPG', truck: 'MP04HE9623', dest: 'JABALPUR LPG PLANT', freight: 98322, dist: 1620, rate: 3.52, fuel: 540, dieselRate: 92.67, fuelExp: 50041, toll: 12960, cash: 2000 },
]

async function main() {
  console.log(`Seeding demo data for ${EMAIL}...`)
  const now = new Date()

  // Check if user already exists
  let user = await prisma.user.findUnique({ where: { email: EMAIL } })
  let T

  if (user && user.tenantId) {
    T = user.tenantId
    console.log(`  User exists, tenant: ${T}`)
  } else {
    const tenant = await prisma.tenant.create({ data: { name: 'Aamir Transport Co.' } })
    T = tenant.id
    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { tenantId: T, name: 'Aamir Saudagar', role: 'owner' } })
    } else {
      user = await prisma.user.create({ data: { tenantId: T, email: EMAIL, name: 'Aamir Saudagar', role: 'owner' } })
    }
    console.log(`  Created tenant + user`)
  }

  // Vehicles
  const trucks = [...new Set(TRIP_DATA.map(t => t.truck))]
  const vMap = {}
  const insurers = ['ICICI Lombard', 'Bajaj Allianz', 'HDFC ERGO', 'New India', 'Go Digit', 'Tata AIG']
  for (let i = 0; i < trucks.length; i++) {
    const existing = await prisma.vehicle.findFirst({ where: { tenantId: T, vehicleNumber: trucks[i] } })
    if (existing) { vMap[trucks[i]] = existing.id; continue }
    const v = await prisma.vehicle.create({
      data: {
        tenantId: T, vehicleNumber: trucks[i], vehicleType: 'LPG Tanker',
        purchaseYear: 2019 + (i % 4), approxKm: 120000 + i * 8000, status: 'active',
        previousInsurer: insurers[i % insurers.length],
        policyType: 'comprehensive',
        ncbPercentage: [0, 20, 25, 35, 45][i % 5],
        idv: [900000, 1050000, 1200000, 800000, 1100000][i % 5],
      },
    })
    vMap[trucks[i]] = v.id
  }
  console.log(`  ${trucks.length} vehicles`)

  // Drivers
  const driverData = [
    { name: 'Rajesh Kumar', phone: '9876500001', licenseNumber: 'MP0420230012345' },
    { name: 'Suresh Yadav', phone: '9876500002', licenseNumber: 'MP0420210056789' },
    { name: 'Vikram Singh', phone: '9876500003', licenseNumber: 'MP0420220098765' },
    { name: 'Mohan Patel', phone: '9876500004', licenseNumber: 'MP0420200034567' },
    { name: 'Anil Sharma', phone: '9876500005', licenseNumber: 'MP0420230045678' },
    { name: 'Deepak Verma', phone: '9876500006', licenseNumber: 'MP0420210067890' },
  ]
  const drivers = []
  for (let i = 0; i < driverData.length; i++) {
    const existing = await prisma.driver.findFirst({ where: { tenantId: T, phone: driverData[i].phone } })
    if (existing) { drivers.push(existing); continue }
    const d = await prisma.driver.create({
      data: { tenantId: T, ...driverData[i], vehicleId: Object.values(vMap)[i % Object.values(vMap).length] },
    })
    drivers.push(d)
  }
  console.log(`  ${drivers.length} drivers`)

  // Trips (spread over 60 days)
  for (let i = 0; i < TRIP_DATA.length; i++) {
    const t = TRIP_DATA[i]
    const daysAgo = 3 + Math.floor((i / TRIP_DATA.length) * 57)
    const tripDate = new Date(now.getTime() - daysAgo * 86400000)
    await prisma.trip.create({
      data: {
        tenantId: T, vehicleId: vMap[t.truck], driverId: drivers[i % drivers.length].id,
        loadingLocation: t.loading, destination: t.dest,
        freightAmount: t.freight, distance: t.dist, ratePerKm: t.rate,
        fuelLitres: t.fuel, dieselRate: t.dieselRate, fuelExpense: t.fuelExp,
        toll: t.toll, cashExpense: t.cash, status: 'reconciled',
        tripDate, createdAt: tripDate,
      },
    })
  }
  console.log(`  ${TRIP_DATA.length} trips`)

  // Documents
  const allVehicles = await prisma.vehicle.findMany({ where: { tenantId: T } })
  let docCount = 0
  for (let i = 0; i < allVehicles.length; i++) {
    const v = allVehicles[i]
    const existing = await prisma.document.findFirst({ where: { tenantId: T, vehicleId: v.id } })
    if (existing) continue

    const ins = new Date(now); ins.setDate(ins.getDate() + [-5, 10, 25, 40, 200][i % 5])
    await prisma.document.create({ data: { tenantId: T, vehicleId: v.id, documentType: 'insurance', expiryDate: ins, reminderDays: 30 } })

    const fc = new Date(now); fc.setDate(fc.getDate() + [15, 35, 365, 180][i % 4])
    await prisma.document.create({ data: { tenantId: T, vehicleId: v.id, documentType: 'FC', expiryDate: fc, reminderDays: 30 } })

    const puc = new Date(now); puc.setDate(puc.getDate() + [7, 120, 90][i % 3])
    await prisma.document.create({ data: { tenantId: T, vehicleId: v.id, documentType: 'PUC', expiryDate: puc, reminderDays: 15 } })

    const permit = new Date(now); permit.setDate(permit.getDate() + [20, 250, 300][i % 3])
    await prisma.document.create({ data: { tenantId: T, vehicleId: v.id, documentType: 'permit', expiryDate: permit, reminderDays: 30 } })
    docCount += 4
  }
  console.log(`  ${docCount} documents`)

  // Maintenance
  const maintDescs = ['Engine oil change', 'Brake pad replacement', 'Tyre rotation', 'Clutch plate replaced', 'General service', 'Radiator repair', 'Suspension work', 'Electrical fix']
  const workshops = ['Sharma Motors', 'Gupta Auto', 'National Garage', 'Highway Service']
  let mc = 0
  for (let i = 0; i < Math.min(allVehicles.length, 8); i++) {
    for (let j = 0; j < 2 + (i % 3); j++) {
      await prisma.maintenanceLog.create({
        data: {
          tenantId: T, vehicleId: allVehicles[i].id,
          maintenanceType: ['engine', 'brake', 'tyre', 'clutch', 'general'][(i + j) % 5],
          description: maintDescs[(i + j) % maintDescs.length],
          amount: 2000 + Math.floor(Math.random() * 18000),
          workshopName: workshops[i % 4],
          maintenanceDate: new Date(now.getTime() - (5 + j * 30) * 86400000),
        },
      })
      mc++
    }
  }
  console.log(`  ${mc} maintenance logs`)

  // Alerts
  const alertsData = [
    { idx: 0, type: 'document_expiry', msg: 'Insurance expired 5 days ago. Penalty risk!', sev: 'high' },
    { idx: 1, type: 'document_expiry', msg: 'Insurance expiring in 10 days. Start renewal.', sev: 'high' },
    { idx: 2, type: 'document_expiry', msg: 'PUC expiring in 7 days. Fine: ₹10,000.', sev: 'medium' },
    { idx: 3, type: 'high_maintenance', msg: 'High maintenance spend in last 90 days.', sev: 'high' },
    { idx: 4, type: 'idle_vehicle', msg: 'Vehicle idle for 12 days. Daily cost: ₹2,500.', sev: 'medium' },
    { idx: 5, type: 'repeated_issue', msg: '3 brake repairs in 4 months. Inspect thoroughly.', sev: 'high' },
  ]
  for (const a of alertsData) {
    const v = allVehicles[a.idx % allVehicles.length]
    await prisma.alert.create({
      data: {
        tenantId: T, vehicleId: v.id, alertType: a.type,
        message: `${v.vehicleNumber}: ${a.msg}`, severity: a.sev, resolved: false,
        createdAt: new Date(now.getTime() - Math.floor(Math.random() * 7) * 86400000),
      },
    })
  }
  console.log(`  ${alertsData.length} alerts`)

  // Saved routes
  const routes = [
    { short: 'Gandhar → Indore', from: 'GAIL GANDHAR BP', to: 'INDORE LPG PLANT', dist: 972, rate: 3.52, fuel: 324, fuelExp: 30025, toll: 7776, cash: 2000 },
    { short: 'Raipur → Jabalpur', from: 'RAIPUR LPG PLANT', to: 'JABALPUR LPG PLANT', dist: 1090, rate: 3.52, fuel: 363, fuelExp: 33670, toll: 8720, cash: 2000 },
    { short: 'Dahej → Indore', from: 'GCPL DAHEJ LPG', to: 'INDORE LPG PLANT', dist: 992, rate: 3.52, fuel: 331, fuelExp: 30642, toll: 7936, cash: 2000 },
    { short: 'Dahej → Bhopal', from: 'GCPL DAHEJ LPG', to: 'BHOPAL LPG', dist: 1384, rate: 3.52, fuel: 461, fuelExp: 42751, toll: 11072, cash: 2000 },
  ]
  for (const r of routes) {
    const existing = await prisma.savedRoute.findFirst({ where: { tenantId: T, shortName: r.short } })
    if (existing) continue
    await prisma.savedRoute.create({
      data: {
        tenantId: T, shortName: r.short, loadingLocation: r.from, destination: r.to,
        distance: r.dist, ratePerKm: r.rate, defaultFuelLitres: r.fuel,
        defaultDieselRate: 92.67, defaultFuelExpense: r.fuelExp, defaultToll: r.toll, defaultCash: r.cash,
      },
    })
  }
  console.log(`  ${routes.length} saved routes`)

  console.log(`\n✅ Done! Login with: ${EMAIL}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
