import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

// ── All 64 trip records from fleetsure calculator (1).xlsx ──────────────────

const TRIP_DATA = [
  { loading: '12434 - GAIL GANDHAR BP', truck: 'MP04HE9634', dest: '12507 - INDORE LPG PLANT', freight: 59335.45, dist: 972, rate: 3.5164, fuel: 324, dieselRate: 92.67, fuelExp: 30025.08, toll: 7776, cash: 2000 },
  { loading: '12434 - GAIL GANDHAR BP', truck: 'MP04HE9365', dest: '12507 - INDORE LPG PLANT', freight: 60087.40, dist: 972, rate: 3.5164, fuel: 324, dieselRate: 92.67, fuelExp: 30025.08, toll: 7776, cash: 2000 },
  { loading: '12434 - GAIL GANDHAR BP', truck: 'MP04HE9665', dest: '12507 - INDORE LPG PLANT', freight: 57250.51, dist: 972, rate: 3.5164, fuel: 324, dieselRate: 92.67, fuelExp: 30025.08, toll: 7776, cash: 2000 },
  { loading: '12434 - GAIL GANDHAR BP', truck: 'MP04HE9365', dest: '12507 - INDORE LPG PLANT', freight: 59096.20, dist: 972, rate: 3.5164, fuel: 324, dieselRate: 92.67, fuelExp: 30025.08, toll: 7776, cash: 2000 },
  { loading: '12692 - RAIPUR LPG PLANT', truck: 'MP04HE9614', dest: '12504 - JABALPUR LPG PLANT', freight: 67841.91, dist: 1090, rate: 3.5164, fuel: 363, dieselRate: 92.67, fuelExp: 33670.10, toll: 8720, cash: 2000 },
  { loading: '12692 - RAIPUR LPG PLANT', truck: 'MP04HE9620', dest: '12504 - JABALPUR LPG PLANT', freight: 66883.69, dist: 1090, rate: 3.5164, fuel: 363, dieselRate: 92.67, fuelExp: 33670.10, toll: 8720, cash: 2000 },
  { loading: '12692 - RAIPUR LPG PLANT', truck: 'MP04HE9633', dest: '12504 - JABALPUR LPG PLANT', freight: 67803.58, dist: 1090, rate: 3.5164, fuel: 363, dieselRate: 92.67, fuelExp: 33670.10, toll: 8720, cash: 2000 },
  { loading: '12692 - RAIPUR LPG PLANT', truck: 'MP04HE9609', dest: '12504 - JABALPUR LPG PLANT', freight: 66270.43, dist: 1090, rate: 3.5164, fuel: 363, dieselRate: 92.67, fuelExp: 33670.10, toll: 8720, cash: 2000 },
  { loading: '12692 - RAIPUR LPG PLANT', truck: 'MP04HE9614', dest: '12504 - JABALPUR LPG PLANT', freight: 67496.95, dist: 1090, rate: 3.5164, fuel: 363, dieselRate: 92.67, fuelExp: 33670.10, toll: 8720, cash: 2000 },
  { loading: '12692 - RAIPUR LPG PLANT', truck: 'MP04HE9620', dest: '12504 - JABALPUR LPG PLANT', freight: 68800.12, dist: 1090, rate: 3.5164, fuel: 363, dieselRate: 92.67, fuelExp: 33670.10, toll: 8720, cash: 2000 },
  { loading: '12692 - RAIPUR LPG PLANT', truck: 'MP04HE9617', dest: '12504 - JABALPUR LPG PLANT', freight: 69030.10, dist: 1090, rate: 3.5164, fuel: 363, dieselRate: 92.67, fuelExp: 33670.10, toll: 8720, cash: 2000 },
  { loading: '12692 - RAIPUR LPG PLANT', truck: 'MP04HE9633', dest: '12504 - JABALPUR LPG PLANT', freight: 67803.58, dist: 1090, rate: 3.5164, fuel: 363, dieselRate: 92.67, fuelExp: 33670.10, toll: 8720, cash: 2000 },
  { loading: '12811 - CHERLAPALLY LPG', truck: 'MP04HE9623', dest: '12504 - JABALPUR LPG PLANT', freight: 100373.53, dist: 1620, rate: 3.5164, fuel: 540, dieselRate: 92.67, fuelExp: 50041.80, toll: 12960, cash: 2000 },
  { loading: '12811 - CHERLAPALLY LPG', truck: 'MP04HE9623', dest: '12504 - JABALPUR LPG PLANT', freight: 98322.76, dist: 1620, rate: 3.5164, fuel: 540, dieselRate: 92.67, fuelExp: 50041.80, toll: 12960, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9608', dest: '12507 - INDORE LPG PLANT', freight: 61637.71, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9632', dest: '12520 - BHOPAL-LPG', freight: 85264.54, dist: 1384, rate: 3.5164, fuel: 461, dieselRate: 92.67, fuelExp: 42751.76, toll: 11072, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9610', dest: '12507 - INDORE LPG PLANT', freight: 61498.18, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9619', dest: '12507 - INDORE LPG PLANT', freight: 61916.77, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9565', dest: '12507 - INDORE LPG PLANT', freight: 61149.35, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9616', dest: '12530 - MALHOTRA CHHINDWARA HP PVT BOT', freight: 98502.52, dist: 1588, rate: 3.5164, fuel: 529, dieselRate: 92.67, fuelExp: 49053.32, toll: 12704, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9635', dest: '12507 - INDORE LPG PLANT', freight: 60800.53, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9632', dest: '12507 - INDORE LPG PLANT', freight: 61602.83, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9619', dest: '12507 - INDORE LPG PLANT', freight: 61707.48, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9634', dest: '12520 - BHOPAL-LPG', freight: 85799.88, dist: 1384, rate: 3.5164, fuel: 461, dieselRate: 92.67, fuelExp: 42751.76, toll: 11072, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9608', dest: '12520 - BHOPAL-LPG', freight: 85945.88, dist: 1384, rate: 3.5164, fuel: 461, dieselRate: 92.67, fuelExp: 42751.76, toll: 11072, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9610', dest: '12520 - BHOPAL-LPG', freight: 85653.88, dist: 1384, rate: 3.5164, fuel: 461, dieselRate: 92.67, fuelExp: 42751.76, toll: 11072, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9565', dest: '12520 - BHOPAL-LPG', freight: 85702.54, dist: 1384, rate: 3.5164, fuel: 461, dieselRate: 92.67, fuelExp: 42751.76, toll: 11072, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9619', dest: '12520 - BHOPAL-LPG', freight: 86432.55, dist: 1384, rate: 3.5164, fuel: 461, dieselRate: 92.67, fuelExp: 42751.76, toll: 11072, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9365', dest: '12520 - BHOPAL-LPG', freight: 84729.21, dist: 1384, rate: 3.5164, fuel: 461, dieselRate: 92.67, fuelExp: 42751.76, toll: 11072, cash: 2000 },
  { loading: '12503 - VIJAIPUR GAIL - LPG', truck: 'MP04HE9609', dest: '12504 - JABALPUR LPG PLANT', freight: 64128.68, dist: 1032, rate: 3.5327, fuel: 344, dieselRate: 92.67, fuelExp: 31878.48, toll: 8256, cash: 2000 },
  { loading: '12503 - VIJAIPUR GAIL - LPG', truck: 'MP04HE9617', dest: '12504 - JABALPUR LPG PLANT', freight: 65040.12, dist: 1032, rate: 3.5327, fuel: 344, dieselRate: 92.67, fuelExp: 31878.48, toll: 8256, cash: 2000 },
  { loading: '12503 - VIJAIPUR GAIL - LPG', truck: 'MP04HE9616', dest: '12507 - INDORE LPG PLANT', freight: 29806.10, dist: 474, rate: 3.5327, fuel: 158, dieselRate: 92.67, fuelExp: 14641.86, toll: 3792, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9634', dest: '12507 - INDORE LPG PLANT', freight: 61567.94, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9635', dest: '12530 - MALHOTRA CHHINDWARA HP PVT BOT', freight: 98111.64, dist: 1588, rate: 3.5164, fuel: 529, dieselRate: 92.67, fuelExp: 49053.32, toll: 12704, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9610', dest: '12507 - INDORE LPG PLANT', freight: 61777.24, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9632', dest: '12507 - INDORE LPG PLANT', freight: 61393.53, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9608', dest: '12507 - INDORE LPG PLANT', freight: 61533.06, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9616', dest: '12520 - BHOPAL-LPG', freight: 84826.54, dist: 1384, rate: 3.5164, fuel: 461, dieselRate: 92.67, fuelExp: 42751.76, toll: 11072, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9619', dest: '12507 - INDORE LPG PLANT', freight: 61637.71, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9365', dest: '12507 - INDORE LPG PLANT', freight: 61428.41, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9634', dest: '12507 - INDORE LPG PLANT', freight: 62160.95, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9610', dest: '12507 - INDORE LPG PLANT', freight: 62021.42, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9632', dest: '12530 - MALHOTRA CHHINDWARA HP PVT BOT', freight: 98558.36, dist: 1588, rate: 3.5164, fuel: 529, dieselRate: 92.67, fuelExp: 49053.32, toll: 12704, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9608', dest: '12507 - INDORE LPG PLANT', freight: 61672.59, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9635', dest: '12507 - INDORE LPG PLANT', freight: 61428.41, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9619', dest: '12507 - INDORE LPG PLANT', freight: 61812.12, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9565', dest: '12507 - INDORE LPG PLANT', freight: 61498.18, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9616', dest: '12507 - INDORE LPG PLANT', freight: 61288.88, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9634', dest: '12507 - INDORE LPG PLANT', freight: 61881.89, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9610', dest: '12507 - INDORE LPG PLANT', freight: 61323.77, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9608', dest: '12507 - INDORE LPG PLANT', freight: 61428.41, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', truck: 'MP04HE9632', dest: '12507 - INDORE LPG PLANT', freight: 61602.83, dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000 },
  { loading: '12692 - RAIPUR LPG PLANT', truck: 'MP04HE9609', dest: '12504 - JABALPUR LPG PLANT', freight: 65388.86, dist: 1090, rate: 3.5164, fuel: 363, dieselRate: 92.67, fuelExp: 33670.10, toll: 8720, cash: 2000 },
  { loading: '12692 - RAIPUR LPG PLANT', truck: 'MP04HE9617', dest: '12504 - JABALPUR LPG PLANT', freight: 68263.52, dist: 1090, rate: 3.5164, fuel: 363, dieselRate: 92.67, fuelExp: 33670.10, toll: 8720, cash: 2000 },
  { loading: '12692 - RAIPUR LPG PLANT', truck: 'MP04HE9633', dest: '12504 - JABALPUR LPG PLANT', freight: 67841.91, dist: 1090, rate: 3.5164, fuel: 363, dieselRate: 92.67, fuelExp: 33670.10, toll: 8720, cash: 2000 },
  { loading: '12692 - RAIPUR LPG PLANT', truck: 'MP04HE9620', dest: '12504 - JABALPUR LPG PLANT', freight: 67420.29, dist: 1090, rate: 3.5164, fuel: 363, dieselRate: 92.67, fuelExp: 33670.10, toll: 8720, cash: 2000 },
  { loading: '12692 - RAIPUR LPG PLANT', truck: 'MP04HE9614', dest: '12504 - JABALPUR LPG PLANT', freight: 67343.63, dist: 1090, rate: 3.5164, fuel: 363, dieselRate: 92.67, fuelExp: 33670.10, toll: 8720, cash: 2000 },
  { loading: '12692 - RAIPUR LPG PLANT', truck: 'MP04HE9609', dest: '12504 - JABALPUR LPG PLANT', freight: 65772.15, dist: 1090, rate: 3.5164, fuel: 363, dieselRate: 92.67, fuelExp: 33670.10, toll: 8720, cash: 2000 },
  { loading: '12692 - RAIPUR LPG PLANT', truck: 'MP04HE9633', dest: '12504 - JABALPUR LPG PLANT', freight: 67726.92, dist: 1090, rate: 3.5164, fuel: 363, dieselRate: 92.67, fuelExp: 33670.10, toll: 8720, cash: 2000 },
  { loading: '12811 - CHERLAPALLY LPG', truck: 'MP04HE9623', dest: '12504 - JABALPUR LPG PLANT', freight: 100772.29, dist: 1620, rate: 3.5164, fuel: 540, dieselRate: 92.67, fuelExp: 50041.80, toll: 12960, cash: 2000 },
  { loading: '12503 - VIJAIPUR GAIL - LPG', truck: 'MP04HE9665', dest: '12520 - BHOPAL-LPG', freight: 16715.54, dist: 271, rate: 3.5327, fuel: 90, dieselRate: 92.67, fuelExp: 8371.19, toll: 2168, cash: 2000 },
  { loading: '12439 - HPC -IOTL SAVALI (STP 1058)', truck: 'MP04HE9565', dest: '12520 - BHOPAL-LPG', freight: 70265.55, dist: 1136, rate: 3.5164, fuel: 379, dieselRate: 92.67, fuelExp: 35091.04, toll: 9088, cash: 2000 },
  { loading: '12434 - GAIL GANDHAR BP', truck: 'MP04HE9665', dest: '12507 - INDORE LPG PLANT', freight: 58925.30, dist: 972, rate: 3.5164, fuel: 324, dieselRate: 92.67, fuelExp: 30025.08, toll: 7776, cash: 2000 },
  { loading: '12434 - GAIL GANDHAR BP', truck: 'MP04HE9665', dest: '12507 - INDORE LPG PLANT', freight: 58139.17, dist: 972, rate: 3.5164, fuel: 324, dieselRate: 92.67, fuelExp: 30025.08, toll: 7776, cash: 2000 },
  { loading: '12434 - GAIL GANDHAR BP', truck: 'MP04HE9365', dest: '12507 - INDORE LPG PLANT', freight: 59403.81, dist: 972, rate: 3.5164, fuel: 324, dieselRate: 92.67, fuelExp: 30025.08, toll: 7776, cash: 2000 },
]

async function main() {
  console.log('Seeding database...')

  // ── 1. Create demo Tenant ──────────────────────────────────────────────────
  const tenant = await prisma.tenant.create({
    data: { name: 'Demo Fleet Transport' },
  })
  const T = tenant.id
  console.log(`  Created tenant: ${tenant.name} (${T})`)

  // ── 2. Create demo User (email: demo@fleetsure.in, role: owner) ───────────
  const demoUser = await prisma.user.create({
    data: {
      tenantId: T,
      email: 'demo@fleetsure.in',
      phone: '9999999999',
      name: 'Fleet Owner',
      role: 'owner',
    },
  })
  console.log(`  Created user: ${demoUser.email} (${demoUser.role})`)

  // ── 3. Upsert vehicles from trip data ─────────────────────────────────────
  const uniqueTrucks = [...new Set(TRIP_DATA.map((t) => t.truck))]
  const vehicleMap = {}

  for (const vn of uniqueTrucks) {
    const v = await prisma.vehicle.create({
      data: {
        tenantId: T,
        vehicleNumber: vn,
        vehicleType: 'LPG Tanker',
        purchaseYear: 2020,
        approxKm: 0,
        status: 'active',
      },
    })
    vehicleMap[vn] = v.id
  }
  console.log(`  Created ${uniqueTrucks.length} vehicles`)

  // ── Add insurance data to vehicles ────────────────────────────────────────
  const insurerNames = ['ICICI Lombard', 'Bajaj Allianz', 'HDFC ERGO', 'New India Assurance', 'Go Digit', 'Tata AIG', 'United India']
  const ncbValues = [0, 0, 20, 20, 25, 25, 35, 35, 45, 50]
  const policyTypes = ['comprehensive', 'comprehensive', 'comprehensive', 'third_party', 'comprehensive']
  const purchaseYears = [2019, 2020, 2021, 2018, 2022, 2020, 2019, 2021, 2020, 2018, 2023, 2019, 2020, 2021, 2022, 2020]

  const allVehiclesList = await prisma.vehicle.findMany({ where: { tenantId: T } })
  for (let i = 0; i < allVehiclesList.length; i++) {
    await prisma.vehicle.update({
      where: { id: allVehiclesList[i].id },
      data: {
        ncbPercentage: ncbValues[i % ncbValues.length],
        previousInsurer: insurerNames[i % insurerNames.length],
        policyType: policyTypes[i % policyTypes.length],
        purchaseYear: purchaseYears[i % purchaseYears.length],
        idv: [1200000, 900000, 1050000, 600000, 1100000][i % 5],
      },
    })
  }
  console.log(`  Updated ${allVehiclesList.length} vehicles with insurance data`)

  // ── Seed saved routes ──────────────────────────────────────────────────────
  const routeMap = {}
  for (const t of TRIP_DATA) {
    const key = `${t.loading}||${t.dest}`
    if (!routeMap[key]) {
      const loadShort = t.loading.includes(' - ') ? t.loading.split(' - ').slice(1).join(' - ').trim() : t.loading
      const destShort = t.dest.includes(' - ') ? t.dest.split(' - ').slice(1).join(' - ').trim() : t.dest
      routeMap[key] = {
        tenantId: T,
        shortName: `${loadShort} → ${destShort}`,
        loadingLocation: t.loading,
        destination: t.dest,
        distance: t.dist,
        ratePerKm: t.rate,
        defaultFuelLitres: t.fuel,
        defaultDieselRate: t.dieselRate,
        defaultFuelExpense: t.fuelExp,
        defaultToll: t.toll,
        defaultCash: t.cash,
      }
    }
  }
  for (const route of Object.values(routeMap)) {
    await prisma.savedRoute.create({ data: route })
  }
  console.log(`  Seeded ${Object.keys(routeMap).length} saved routes`)

  // ── Seed all 64 trips ──────────────────────────────────────────────────────
  for (const t of TRIP_DATA) {
    const vehicleId = vehicleMap[t.truck]
    if (!vehicleId) continue
    await prisma.trip.create({
      data: {
        tenantId: T,
        vehicleId,
        loadingLocation: t.loading,
        destination: t.dest,
        freightAmount: t.freight,
        distance: t.dist,
        ratePerKm: t.rate,
        fuelLitres: t.fuel,
        dieselRate: t.dieselRate,
        fuelExpense: t.fuelExp,
        toll: t.toll,
        cashExpense: t.cash,
        status: 'reconciled',
      },
    })
  }
  console.log(`  Seeded ${TRIP_DATA.length} trips`)

  // ── Seed Renewal Partners ──────────────────────────────────────────────────
  const partners = [
    { tenantId: T, name: 'Fleetsure Insurance API', partnerType: 'insurance_api', commissionPct: 5.0, serviceArea: 'All India' },
    { tenantId: T, name: 'Sharma Insurance Broker', partnerType: 'insurance_broker', phone: '9876543210', email: 'sharma.broker@example.com', commissionPct: 8.0, serviceArea: 'Madhya Pradesh' },
    { tenantId: T, name: 'Gupta RTO Services', partnerType: 'rto_agent', phone: '9876543211', email: 'gupta.rto@example.com', commissionPct: 10.0, serviceArea: 'Bhopal, Indore, Jabalpur' },
    { tenantId: T, name: 'MP PUC Centre - Bhopal', partnerType: 'puc_center', phone: '9876543212', commissionPct: 15.0, serviceArea: 'Bhopal' },
  ]
  for (const p of partners) {
    await prisma.renewalPartner.create({ data: p })
  }
  console.log(`  Seeded ${partners.length} renewal partners`)

  // ── Seed Documents ─────────────────────────────────────────────────────────
  const allVehicles = await prisma.vehicle.findMany({ where: { tenantId: T } })
  const now = new Date()
  let docCount = 0

  for (let i = 0; i < allVehicles.length; i++) {
    const v = allVehicles[i]

    const insExpiry = new Date(now)
    if (i % 5 === 0) insExpiry.setDate(insExpiry.getDate() - 5)
    else if (i % 5 === 1) insExpiry.setDate(insExpiry.getDate() + 10)
    else if (i % 5 === 2) insExpiry.setDate(insExpiry.getDate() + 25)
    else if (i % 5 === 3) insExpiry.setDate(insExpiry.getDate() + 40)
    else insExpiry.setDate(insExpiry.getDate() + 200)

    await prisma.document.create({ data: { tenantId: T, vehicleId: v.id, documentType: 'insurance', expiryDate: insExpiry, reminderDays: 30 } })

    const fcExpiry = new Date(now)
    if (i % 4 === 0) fcExpiry.setDate(fcExpiry.getDate() + 15)
    else if (i % 4 === 1) fcExpiry.setDate(fcExpiry.getDate() + 35)
    else fcExpiry.setDate(fcExpiry.getDate() + 365)
    await prisma.document.create({ data: { tenantId: T, vehicleId: v.id, documentType: 'FC', expiryDate: fcExpiry, reminderDays: 30 } })

    const pucExpiry = new Date(now)
    if (i % 3 === 0) pucExpiry.setDate(pucExpiry.getDate() + 7)
    else pucExpiry.setDate(pucExpiry.getDate() + 120)
    await prisma.document.create({ data: { tenantId: T, vehicleId: v.id, documentType: 'PUC', expiryDate: pucExpiry, reminderDays: 15 } })

    const permitExpiry = new Date(now)
    if (i % 6 === 0) permitExpiry.setDate(permitExpiry.getDate() + 20)
    else permitExpiry.setDate(permitExpiry.getDate() + 250)
    await prisma.document.create({ data: { tenantId: T, vehicleId: v.id, documentType: 'permit', expiryDate: permitExpiry, reminderDays: 30 } })

    docCount += 4
  }
  console.log(`  Seeded ${docCount} documents for ${allVehicles.length} vehicles`)

  // ── Seed renewal requests + quotes ────────────────────────────────────────
  const expiringDocs = await prisma.document.findMany({
    where: { tenantId: T, expiryDate: { lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } },
    include: { vehicle: true },
    take: 3,
  })

  const allPartners = await prisma.renewalPartner.findMany({ where: { tenantId: T } })
  const apiPartner = allPartners.find((p) => p.partnerType === 'insurance_api')
  const rtoPartner = allPartners.find((p) => p.partnerType === 'rto_agent')

  for (const doc of expiringDocs) {
    const request = await prisma.renewalRequest.create({
      data: {
        tenantId: T,
        vehicleId: doc.vehicleId,
        documentId: doc.id,
        documentType: doc.documentType,
        status: 'quotes_received',
        vehicleSnapshot: { vehicleNumber: doc.vehicle.vehicleNumber, vehicleType: doc.vehicle.vehicleType, purchaseYear: doc.vehicle.purchaseYear },
      },
    })

    const partner = doc.documentType === 'insurance' ? apiPartner : rtoPartner
    if (partner) {
      const validUntil = new Date(now)
      validUntil.setDate(validUntil.getDate() + 7)
      const amounts = doc.documentType === 'insurance' ? [28500, 31200, 34800] : doc.documentType === 'FC' ? [3500, 4200] : doc.documentType === 'PUC' ? [350, 400] : [8000, 12000]

      for (const amt of amounts) {
        await prisma.renewalQuote.create({
          data: {
            tenantId: T,
            requestId: request.id,
            partnerId: partner.id,
            partnerName: doc.documentType === 'insurance' ? ['ICICI Lombard', 'Bajaj Allianz', 'Go Digit'][amounts.indexOf(amt)] : partner.name,
            amount: amt,
            coverageDetails: doc.documentType === 'insurance'
              ? { coverType: 'Comprehensive', idv: 900000, addOns: ['Zero Depreciation', 'Roadside Assistance'] }
              : { processDays: '3-5 days', includes: ['Inspection', 'Certificate', 'RTO fees'] },
            validUntil,
            source: doc.documentType === 'insurance' ? 'api' : 'manual',
          },
        })
      }
    }
  }
  console.log(`  Seeded ${expiringDocs.length} sample renewal requests with quotes`)

  // ── Seed Tyres ─────────────────────────────────────────────────────────────
  const tyreVehicles = await prisma.vehicle.findMany({ where: { tenantId: T }, take: 4 })
  const tyreBrands = ['MRF', 'Apollo', 'CEAT', 'JK Tyre', 'Bridgestone']
  const tyreModels = ['S-1', 'XT-200', 'Radial HD', 'STEEL KING', 'R150']
  const positions6W = ['FL', 'FR', 'R1LO', 'R1LI', 'R1RI', 'R1RO', 'S1']
  const conditions = ['good', 'good', 'good', 'warn', 'good', 'replace', 'good']
  const kmOffsets = [20000, 25000, 55000, 65000, 30000, 75000, 10000]

  let tyreCount = 0
  for (let vi = 0; vi < tyreVehicles.length; vi++) {
    const v = tyreVehicles[vi]
    const baseKm = 120000 + vi * 5000
    await prisma.vehicle.update({ where: { id: v.id }, data: { approxKm: baseKm } })

    for (let pi = 0; pi < positions6W.length; pi++) {
      if (vi === 2 && (pi === 4 || pi === 6)) continue
      const brandIdx = (vi + pi) % tyreBrands.length
      const conditionIdx = (vi + pi) % conditions.length
      const installedKm = baseKm - kmOffsets[pi % kmOffsets.length]

      await prisma.tyre.create({
        data: {
          tenantId: T,
          vehicleId: v.id,
          position: positions6W[pi],
          brand: tyreBrands[brandIdx],
          model: tyreModels[brandIdx],
          installedDate: new Date(2025, 3 + (pi % 6), 1 + pi * 3),
          installedKm: Math.max(0, installedKm),
          expectedLifeKm: 80000,
          condition: conditions[conditionIdx],
          notes: conditions[conditionIdx] === 'replace' ? 'Tread worn below 2mm' : null,
        },
      })
      tyreCount++
    }
  }
  console.log(`  Seeded ${tyreCount} tyres for ${tyreVehicles.length} vehicles`)

  // ── Seed completed insurance renewals ──────────────────────────────────────
  const insVehicles = await prisma.vehicle.findMany({ where: { tenantId: T }, take: 5 })
  const insPartners = await prisma.renewalPartner.findMany({ where: { tenantId: T } })
  const apiPartnerIns = insPartners.find(p => p.partnerType === 'insurance_api') || insPartners[0]

  const completedRenewalInsurers = [
    ['ICICI Lombard', 'Bajaj Allianz', 'Go Digit', 'HDFC ERGO'],
    ['New India Assurance', 'Tata AIG', 'United India'],
    ['Bajaj Allianz', 'ICICI Lombard', 'Go Digit'],
    ['HDFC ERGO', 'Tata AIG', 'New India Assurance', 'ICICI Lombard'],
    ['Go Digit', 'United India', 'Bajaj Allianz'],
  ]
  const basePremiums = [32000, 28000, 35000, 41000, 26000]

  let renewalSeedCount = 0
  for (let vi = 0; vi < insVehicles.length; vi++) {
    const v = insVehicles[vi]
    const insDoc = await prisma.document.findFirst({ where: { tenantId: T, vehicleId: v.id, documentType: 'insurance' } })
    if (!insDoc) continue

    const renReq = await prisma.renewalRequest.create({
      data: {
        tenantId: T,
        vehicleId: v.id,
        documentId: insDoc.id,
        documentType: 'insurance',
        status: 'renewed',
        vehicleSnapshot: { vehicleNumber: v.vehicleNumber, vehicleType: v.vehicleType, purchaseYear: v.purchaseYear },
        renewedAt: new Date(now.getTime() - (30 + vi * 15) * 24 * 60 * 60 * 1000),
      },
    })

    const insurers = completedRenewalInsurers[vi]
    const base = basePremiums[vi]
    const validUntil = new Date(now)
    validUntil.setDate(validUntil.getDate() + 7)

    const quotePremiums = insurers.map((_, idx) => {
      const factor = 1.0 + (idx * 0.08) + (Math.random() * 0.05)
      return Math.round(base * factor)
    }).sort((a, b) => a - b)

    for (let qi = 0; qi < insurers.length; qi++) {
      await prisma.renewalQuote.create({
        data: {
          tenantId: T,
          requestId: renReq.id,
          partnerId: apiPartnerIns.id,
          partnerName: insurers[qi],
          amount: quotePremiums[qi],
          coverageDetails: {
            coverType: 'Comprehensive',
            idv: v.idv || 900000,
            addOns: qi === 0 ? ['Zero Depreciation', 'Roadside Assistance', 'Engine Protector'] : qi === 1 ? ['Zero Depreciation', 'Roadside Assistance'] : ['Roadside Assistance'],
          },
          premiumBreakdown: {
            od: Math.round(quotePremiums[qi] * 0.55),
            tp: 18500,
            ncbDiscount: Math.round(quotePremiums[qi] * 0.1),
            netPremium: Math.round(quotePremiums[qi] / 1.18),
            gst: Math.round(quotePremiums[qi] - quotePremiums[qi] / 1.18),
            total: quotePremiums[qi],
          },
          validUntil,
          selected: qi === 0,
          source: 'api',
        },
      })
    }

    await prisma.platformTransaction.create({
      data: {
        tenantId: T,
        renewalRequestId: renReq.id,
        quoteAmount: quotePremiums[0],
        commissionPct: 5.0,
        commissionAmount: Math.round(quotePremiums[0] * 0.05),
        partnerName: insurers[0],
        vehicleNumber: v.vehicleNumber,
        documentType: 'insurance',
        status: 'collected',
      },
    })
    renewalSeedCount++
  }
  console.log(`  Seeded ${renewalSeedCount} completed insurance renewals with quotes`)

  // ── Seed maintenance logs ──────────────────────────────────────────────────
  const maintVehicles = await prisma.vehicle.findMany({ where: { tenantId: T }, take: 6 })
  const maintTypes = ['engine', 'brake', 'tyre', 'clutch', 'general']
  const maintDescriptions = [
    'Engine oil change + filter', 'Brake pad replacement', 'Tyre rotation + alignment',
    'Clutch plate replaced', 'General service + checkup', 'Radiator repair',
    'Suspension work', 'Electrical wiring fix', 'AC compressor repair',
  ]
  let maintCount = 0
  for (let vi = 0; vi < maintVehicles.length; vi++) {
    const v = maintVehicles[vi]
    const numLogs = 2 + (vi % 4)
    for (let mi = 0; mi < numLogs; mi++) {
      const daysAgo = 30 + Math.floor(Math.random() * 300)
      await prisma.maintenanceLog.create({
        data: {
          tenantId: T,
          vehicleId: v.id,
          maintenanceType: maintTypes[(vi + mi) % maintTypes.length],
          description: maintDescriptions[(vi * 3 + mi) % maintDescriptions.length],
          amount: 2000 + Math.floor(Math.random() * 18000),
          workshopName: ['Sharma Motors', 'Gupta Auto', 'National Garage', 'Highway Service'][vi % 4],
          maintenanceDate: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
        },
      })
      maintCount++
    }
  }
  console.log(`  Seeded ${maintCount} maintenance logs`)

  // ── Seed mock driving data ─────────────────────────────────────────────────
  const sampleTrip = await prisma.trip.findFirst({
    where: { tenantId: T, destination: { contains: 'INDORE' } },
    include: { vehicle: true },
    orderBy: { createdAt: 'asc' },
  })

  // ── Seed multiple drivers ──────────────────────────────────────────────────
  const driverData = [
    { name: 'Rajesh Kumar', phone: '9876500001', licenseNumber: 'MP0420230012345' },
    { name: 'Suresh Yadav', phone: '9876500002', licenseNumber: 'MP0420210056789' },
    { name: 'Vikram Singh', phone: '9876500003', licenseNumber: 'MP0420220098765' },
    { name: 'Mohan Patel', phone: '9876500004', licenseNumber: 'MP0420200034567' },
    { name: 'Anil Sharma', phone: '9876500005', licenseNumber: 'MP0420230045678' },
    { name: 'Deepak Verma', phone: '9876500006', licenseNumber: 'MP0420210067890' },
  ]

  const createdDrivers = []
  for (let di = 0; di < driverData.length; di++) {
    const v = allVehicles[di % allVehicles.length]
    const driver = await prisma.driver.create({
      data: {
        tenantId: T,
        ...driverData[di],
        vehicleId: v.id,
      },
    })
    createdDrivers.push(driver)
  }
  console.log(`  Seeded ${createdDrivers.length} drivers`)

  // ── Assign drivers to existing trips ──────────────────────────────────────
  const allTrips = await prisma.trip.findMany({ where: { tenantId: T }, orderBy: { createdAt: 'asc' } })
  for (let ti = 0; ti < allTrips.length; ti++) {
    const driver = createdDrivers[ti % createdDrivers.length]
    await prisma.trip.update({
      where: { id: allTrips[ti].id },
      data: { driverId: driver.id },
    })
  }
  console.log(`  Assigned drivers to ${allTrips.length} trips`)

  // ── Seed recent unreconciled (logged) trips ───────────────────────────────
  const recentTripData = [
    { loading: '12434 - GAIL GANDHAR BP', dest: '12507 - INDORE LPG PLANT', dist: 972, rate: 3.5164, fuel: 324, dieselRate: 92.67, fuelExp: 30025.08, toll: 7776, cash: 2000, daysAgo: 1 },
    { loading: '12692 - RAIPUR LPG PLANT', dest: '12504 - JABALPUR LPG PLANT', dist: 1090, rate: 3.5164, fuel: 363, dieselRate: 92.67, fuelExp: 33670.10, toll: 8720, cash: 2000, daysAgo: 1 },
    { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', dest: '12520 - BHOPAL-LPG', dist: 1384, rate: 3.5164, fuel: 461, dieselRate: 92.67, fuelExp: 42751.76, toll: 11072, cash: 2000, daysAgo: 2 },
    { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', dest: '12507 - INDORE LPG PLANT', dist: 992, rate: 3.5164, fuel: 331, dieselRate: 92.67, fuelExp: 30642.88, toll: 7936, cash: 2000, daysAgo: 2 },
    { loading: '12811 - CHERLAPALLY LPG', dest: '12504 - JABALPUR LPG PLANT', dist: 1620, rate: 3.5164, fuel: 540, dieselRate: 92.67, fuelExp: 50041.80, toll: 12960, cash: 2000, daysAgo: 3 },
    { loading: '12503 - VIJAIPUR GAIL - LPG', dest: '12504 - JABALPUR LPG PLANT', dist: 1032, rate: 3.5327, fuel: 344, dieselRate: 92.67, fuelExp: 31878.48, toll: 8256, cash: 2000, daysAgo: 3 },
    { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', dest: '12530 - MALHOTRA CHHINDWARA HP PVT BOT', dist: 1588, rate: 3.5164, fuel: 529, dieselRate: 92.67, fuelExp: 49053.32, toll: 12704, cash: 2000, daysAgo: 4 },
    { loading: '12434 - GAIL GANDHAR BP', dest: '12507 - INDORE LPG PLANT', dist: 972, rate: 3.5164, fuel: 324, dieselRate: 92.67, fuelExp: 30025.08, toll: 7776, cash: 2000, daysAgo: 5 },
    { loading: '12692 - RAIPUR LPG PLANT', dest: '12504 - JABALPUR LPG PLANT', dist: 1090, rate: 3.5164, fuel: 363, dieselRate: 92.67, fuelExp: 33670.10, toll: 8720, cash: 2000, daysAgo: 6 },
    { loading: '12459 - GCPL DAHEJ LPG PVT IMPORT FACL', dest: '12520 - BHOPAL-LPG', dist: 1384, rate: 3.5164, fuel: 461, dieselRate: 92.67, fuelExp: 42751.76, toll: 11072, cash: 2000, daysAgo: 7 },
  ]

  let loggedTripCount = 0
  for (const rt of recentTripData) {
    const vehicle = allVehicles[loggedTripCount % allVehicles.length]
    const driver = createdDrivers[loggedTripCount % createdDrivers.length]
    const tripDate = new Date(now.getTime() - rt.daysAgo * 24 * 60 * 60 * 1000)
    await prisma.trip.create({
      data: {
        tenantId: T,
        vehicleId: vehicle.id,
        driverId: driver.id,
        loadingLocation: rt.loading,
        destination: rt.dest,
        distance: rt.dist,
        ratePerKm: rt.rate,
        fuelLitres: rt.fuel,
        dieselRate: rt.dieselRate,
        fuelExpense: rt.fuelExp,
        toll: rt.toll,
        cashExpense: rt.cash,
        status: 'logged',
        tripDate,
        createdAt: tripDate,
      },
    })
    loggedTripCount++
  }
  console.log(`  Seeded ${loggedTripCount} recent unreconciled trips`)

  // ── Spread existing reconciled trip dates over past 60 days ────────────────
  for (let ti = 0; ti < allTrips.length; ti++) {
    const daysAgo = 7 + Math.floor((ti / allTrips.length) * 53)
    const tripDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
    await prisma.trip.update({
      where: { id: allTrips[ti].id },
      data: { tripDate, createdAt: tripDate },
    })
  }
  console.log(`  Spread ${allTrips.length} reconciled trips over past 60 days`)

  // ── Seed Monthly Bills ────────────────────────────────────────────────────
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const billMonths = [
    { month: currentMonth, year: currentYear, total: 0, reconciled: false },
    { month: currentMonth === 1 ? 12 : currentMonth - 1, year: currentMonth === 1 ? currentYear - 1 : currentYear, total: 2850000, reconciled: true },
    { month: currentMonth <= 2 ? 10 + currentMonth : currentMonth - 2, year: currentMonth <= 2 ? currentYear - 1 : currentYear, total: 3120000, reconciled: true },
  ]

  for (const bm of billMonths) {
    await prisma.monthlyBill.create({
      data: {
        tenantId: T,
        month: bm.month,
        year: bm.year,
        totalAmount: bm.total,
        tripCount: bm.total > 0 ? Math.round(bm.total / 65000) : 0,
        reconciledAt: bm.reconciled ? new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) : null,
      },
    })
  }
  console.log(`  Seeded ${billMonths.length} monthly bills`)

  // ── Seed Alerts ───────────────────────────────────────────────────────────
  const alertData = [
    { vehicleIdx: 0, alertType: 'document_expiry', message: 'Insurance for MP04HE9634 expired 5 days ago. Penalty risk: ₹2,000-4,000. Vehicle can be impounded.', severity: 'high', resolved: false },
    { vehicleIdx: 1, alertType: 'document_expiry', message: 'Insurance for MP04HE9365 expiring in 10 days. Start renewal process now.', severity: 'high', resolved: false },
    { vehicleIdx: 2, alertType: 'document_expiry', message: 'PUC for MP04HE9665 expiring in 7 days. Fine: ₹10,000 under MV Act 2019.', severity: 'medium', resolved: false },
    { vehicleIdx: 3, alertType: 'document_expiry', message: 'FC for MP04HE9614 expiring in 15 days. Book inspection appointment.', severity: 'medium', resolved: false },
    { vehicleIdx: 0, alertType: 'high_maintenance', message: 'MP04HE9634 has spent ₹45,000 on maintenance in last 90 days. Above fleet average by 65%.', severity: 'high', resolved: false },
    { vehicleIdx: 4, alertType: 'high_maintenance', message: 'MP04HE9620 engine repair cost ₹18,000. Third repair in 6 months — consider overhaul.', severity: 'medium', resolved: false },
    { vehicleIdx: 5, alertType: 'repeated_issue', message: 'MP04HE9633 has had 3 brake-related repairs in last 4 months. Inspect brake system thoroughly.', severity: 'high', resolved: false },
    { vehicleIdx: 6, alertType: 'idle_vehicle', message: 'MP04HE9609 has been idle for 12 days. Daily idle cost: ₹2,500 (EMI + insurance + depreciation).', severity: 'medium', resolved: false },
    { vehicleIdx: 7, alertType: 'idle_vehicle', message: 'MP04HE9623 has no trips logged in 8 days. Check driver availability.', severity: 'low', resolved: false },
    { vehicleIdx: 2, alertType: 'document_expiry', message: 'Permit for MP04HE9665 expiring in 20 days. National permit renewal: ₹16,500.', severity: 'low', resolved: false },
    { vehicleIdx: 0, alertType: 'document_expiry', message: 'PUC for MP04HE9634 expired. Vehicle cleared after renewal.', severity: 'medium', resolved: true },
    { vehicleIdx: 1, alertType: 'high_maintenance', message: 'MP04HE9365 brake pad replaced. Issue resolved.', severity: 'low', resolved: true },
  ]

  let alertCount = 0
  for (const a of alertData) {
    const vehicle = allVehicles[a.vehicleIdx % allVehicles.length]
    const daysAgo = a.resolved ? 15 + Math.floor(Math.random() * 20) : Math.floor(Math.random() * 10)
    await prisma.alert.create({
      data: {
        tenantId: T,
        vehicleId: vehicle.id,
        alertType: a.alertType,
        message: a.message,
        severity: a.severity,
        resolved: a.resolved,
        createdAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
      },
    })
    alertCount++
  }
  console.log(`  Seeded ${alertCount} alerts (${alertData.filter(a => !a.resolved).length} unresolved)`)

  // ── Seed more maintenance with recent dates ───────────────────────────────
  const recentMaintData = [
    { vehicleIdx: 0, type: 'engine', desc: 'Engine oil change + filter replacement', amount: 8500, workshop: 'Sharma Motors', daysAgo: 5 },
    { vehicleIdx: 0, type: 'brake', desc: 'Front brake shoe replacement', amount: 4200, workshop: 'Sharma Motors', daysAgo: 15 },
    { vehicleIdx: 0, type: 'general', desc: 'Air filter + fuel filter change', amount: 3200, workshop: 'National Garage', daysAgo: 25 },
    { vehicleIdx: 1, type: 'tyre', desc: 'Front left tyre replaced - MRF Steel Muscle', amount: 19500, workshop: 'Highway Tyre Center', daysAgo: 8 },
    { vehicleIdx: 2, type: 'brake', desc: 'Brake drum resurfacing', amount: 5500, workshop: 'Gupta Auto', daysAgo: 12 },
    { vehicleIdx: 2, type: 'brake', desc: 'Brake pad replacement - rear axle', amount: 3800, workshop: 'Gupta Auto', daysAgo: 45 },
    { vehicleIdx: 2, type: 'brake', desc: 'Brake cylinder leak repair', amount: 6200, workshop: 'Gupta Auto', daysAgo: 90 },
    { vehicleIdx: 3, type: 'clutch', desc: 'Clutch plate + pressure plate replaced', amount: 14500, workshop: 'National Garage', daysAgo: 20 },
    { vehicleIdx: 4, type: 'engine', desc: 'Turbocharger repair', amount: 35000, workshop: 'Authorized Service', daysAgo: 10 },
    { vehicleIdx: 4, type: 'engine', desc: 'Radiator flush + coolant change', amount: 4500, workshop: 'Authorized Service', daysAgo: 60 },
    { vehicleIdx: 4, type: 'engine', desc: 'Injector nozzle replacement', amount: 12000, workshop: 'Authorized Service', daysAgo: 120 },
    { vehicleIdx: 5, type: 'general', desc: 'Full vehicle service - 15000km interval', amount: 7800, workshop: 'Highway Service', daysAgo: 3 },
    { vehicleIdx: 6, type: 'tyre', desc: 'Tyre rotation + wheel alignment', amount: 2800, workshop: 'Highway Tyre Center', daysAgo: 18 },
    { vehicleIdx: 7, type: 'general', desc: 'Battery replacement - Exide 150AH', amount: 12000, workshop: 'National Garage', daysAgo: 7 },
    { vehicleIdx: 8, type: 'general', desc: 'Suspension leaf spring replaced', amount: 8500, workshop: 'Sharma Motors', daysAgo: 22 },
  ]

  let recentMaintCount = 0
  for (const m of recentMaintData) {
    const vehicle = allVehicles[m.vehicleIdx % allVehicles.length]
    await prisma.maintenanceLog.create({
      data: {
        tenantId: T,
        vehicleId: vehicle.id,
        maintenanceType: m.type,
        description: m.desc,
        amount: m.amount,
        workshopName: m.workshop,
        maintenanceDate: new Date(now.getTime() - m.daysAgo * 24 * 60 * 60 * 1000),
      },
    })
    recentMaintCount++
  }
  console.log(`  Seeded ${recentMaintCount} recent maintenance records`)

  // ── Seed driving data for sample trip ─────────────────────────────────────
  if (sampleTrip) {
    const mockDriver = createdDrivers[0]

    await prisma.trip.update({
      where: { id: sampleTrip.id },
      data: { driverId: mockDriver.id, startLat: 23.2599, startLng: 77.4126, endLat: 22.7196, endLng: 75.8577 },
    })

    const bhopalToIndoreRoute = [
      { lat: 23.2599, lng: 77.4126, speed: 0 },
      { lat: 23.2401, lng: 77.3812, speed: 28 },
      { lat: 23.2105, lng: 77.3350, speed: 45 },
      { lat: 23.1802, lng: 77.2750, speed: 62 },
      { lat: 23.1520, lng: 77.2150, speed: 68 },
      { lat: 23.1200, lng: 77.1530, speed: 72 },
      { lat: 23.0880, lng: 77.0900, speed: 55 },
      { lat: 23.0750, lng: 77.0600, speed: 35 },
      { lat: 23.0550, lng: 77.0050, speed: 65 },
      { lat: 23.0200, lng: 76.9400, speed: 70 },
      { lat: 22.9850, lng: 76.8700, speed: 74 },
      { lat: 22.9500, lng: 76.8000, speed: 68 },
      { lat: 22.9200, lng: 76.7350, speed: 78 },
      { lat: 22.8900, lng: 76.6700, speed: 60 },
      { lat: 22.8650, lng: 76.6100, speed: 48 },
      { lat: 22.8500, lng: 76.5700, speed: 35 },
      { lat: 22.8350, lng: 76.5300, speed: 42 },
      { lat: 22.8200, lng: 76.4900, speed: 55 },
      { lat: 22.8100, lng: 76.4400, speed: 67 },
      { lat: 22.8000, lng: 76.3900, speed: 71 },
      { lat: 22.7880, lng: 76.3350, speed: 65 },
      { lat: 22.7800, lng: 76.2800, speed: 58 },
      { lat: 22.7720, lng: 76.2300, speed: 72 },
      { lat: 22.7650, lng: 76.1800, speed: 63 },
      { lat: 22.7580, lng: 76.1300, speed: 52 },
      { lat: 22.7500, lng: 76.0800, speed: 45 },
      { lat: 22.7450, lng: 76.0300, speed: 38 },
      { lat: 22.7400, lng: 75.9800, speed: 55 },
      { lat: 22.7350, lng: 75.9400, speed: 62 },
      { lat: 22.7300, lng: 75.9100, speed: 48 },
      { lat: 22.7250, lng: 75.8900, speed: 35 },
      { lat: 22.7220, lng: 75.8750, speed: 22 },
      { lat: 22.7200, lng: 75.8650, speed: 15 },
      { lat: 22.7196, lng: 75.8590, speed: 8 },
      { lat: 22.7196, lng: 75.8577, speed: 0 },
    ]

    const tripStartTime = new Date(sampleTrip.createdAt || now)
    for (let i = 0; i < bhopalToIndoreRoute.length; i++) {
      const pt = bhopalToIndoreRoute[i]
      const timestamp = new Date(tripStartTime.getTime() + i * 7 * 60 * 1000)
      await prisma.locationLog.create({
        data: {
          tenantId: T,
          driverId: mockDriver.id,
          tripId: sampleTrip.id,
          latitude: pt.lat,
          longitude: pt.lng,
          speed: pt.speed,
          timestamp,
        },
      })
    }
    console.log(`  Seeded ${bhopalToIndoreRoute.length} location logs`)

    const drivingEvents = [
      { type: 'harsh_brake', severity: 5.2, lat: 23.0880, lng: 77.0900, speed: 55, minutesIn: 42 },
      { type: 'harsh_brake', severity: 4.8, lat: 22.8650, lng: 76.6100, speed: 48, minutesIn: 98 },
      { type: 'harsh_accel', severity: 4.5, lat: 23.0550, lng: 77.0050, speed: 65, minutesIn: 56 },
      { type: 'sharp_turn', severity: 3.9, lat: 22.8350, lng: 76.5300, speed: 42, minutesIn: 112 },
    ]

    for (const ev of drivingEvents) {
      await prisma.drivingEvent.create({
        data: {
          tenantId: T,
          tripId: sampleTrip.id,
          driverId: mockDriver.id,
          type: ev.type,
          severity: ev.severity,
          latitude: ev.lat,
          longitude: ev.lng,
          speed: ev.speed,
          timestamp: new Date(tripStartTime.getTime() + ev.minutesIn * 60 * 1000),
        },
      })
    }
    console.log(`  Seeded ${drivingEvents.length} driving events`)

    await prisma.drivingScore.create({
      data: {
        tenantId: T,
        tripId: sampleTrip.id,
        overallScore: 74,
        speedScore: 72,
        brakingScore: 84,
        accelerationScore: 92,
        corneringScore: 90,
        avgSpeed: 51.3,
        maxSpeed: 78.0,
        overspeedingPct: 11.4,
        harshBrakeCount: 2,
        harshAccelCount: 1,
        sharpTurnCount: 1,
        idleMinutes: 12.5,
        totalDistanceKm: 195.8,
        totalDurationMin: 238.0,
      },
    })
    console.log(`  Seeded driving score (74/100)`)
    console.log(`  Mock trip ID: ${sampleTrip.id} (vehicle: ${sampleTrip.vehicle.vehicleNumber})`)
  } else {
    console.log('  Skipping driving data — no Indore trip found')
  }

  // ── Seed driving scores for more trips ────────────────────────────────────
  const scorableTrips = await prisma.trip.findMany({
    where: { tenantId: T, drivingScore: null, driverId: { not: null } },
    take: 12,
    orderBy: { createdAt: 'desc' },
  })

  const scoreTemplates = [
    { overall: 88, speed: 90, braking: 85, accel: 88, corner: 92, avg: 48.5, max: 68, overspeed: 4.2, hBrake: 1, hAccel: 0, sTurn: 0, idle: 8 },
    { overall: 65, speed: 60, braking: 70, accel: 62, corner: 72, avg: 56.8, max: 82, overspeed: 18.5, hBrake: 4, hAccel: 3, sTurn: 2, idle: 22 },
    { overall: 92, speed: 95, braking: 90, accel: 91, corner: 94, avg: 45.2, max: 65, overspeed: 2.1, hBrake: 0, hAccel: 0, sTurn: 0, idle: 5 },
    { overall: 71, speed: 68, braking: 75, accel: 70, corner: 74, avg: 52.1, max: 76, overspeed: 14.3, hBrake: 3, hAccel: 2, sTurn: 1, idle: 15 },
    { overall: 80, speed: 82, braking: 78, accel: 80, corner: 82, avg: 49.7, max: 72, overspeed: 8.6, hBrake: 2, hAccel: 1, sTurn: 1, idle: 10 },
    { overall: 58, speed: 52, braking: 60, accel: 55, corner: 68, avg: 59.4, max: 88, overspeed: 24.7, hBrake: 6, hAccel: 4, sTurn: 3, idle: 28 },
  ]

  let dScoreCount = 0
  for (let si = 0; si < scorableTrips.length; si++) {
    const trip = scorableTrips[si]
    const tmpl = scoreTemplates[si % scoreTemplates.length]
    try {
      await prisma.drivingScore.create({
        data: {
          tenantId: T,
          tripId: trip.id,
          overallScore: tmpl.overall,
          speedScore: tmpl.speed,
          brakingScore: tmpl.braking,
          accelerationScore: tmpl.accel,
          corneringScore: tmpl.corner,
          avgSpeed: tmpl.avg,
          maxSpeed: tmpl.max,
          overspeedingPct: tmpl.overspeed,
          harshBrakeCount: tmpl.hBrake,
          harshAccelCount: tmpl.hAccel,
          sharpTurnCount: tmpl.sTurn,
          idleMinutes: tmpl.idle,
          totalDistanceKm: trip.distance * 0.52,
          totalDurationMin: trip.distance * 0.25,
        },
      })
      dScoreCount++
    } catch { /* skip if already exists */ }
  }
  console.log(`  Seeded ${dScoreCount} additional driving scores`)

  // ── Seed FASTag data ─────────────────────────────────────────────────────
  const fastagVehicles = await prisma.vehicle.findMany({ where: { tenantId: T }, take: 10 })
  const fastagProviders = [
    { id: 'ICIC00000NATFT', name: 'ICICI Bank FASTag' },
    { id: 'HDFC00000NATFT', name: 'HDFC Bank FASTag' },
    { id: 'SBIN00000NATFT', name: 'SBI FASTag' },
    { id: 'UTIB00000NATFT', name: 'Axis Bank FASTag' },
    { id: 'KKBK00000NATFT', name: 'Kotak Bank FASTag' },
    { id: 'IDFB00000NATFT', name: 'IDFC FIRST Bank FASTag' },
    { id: 'PAYT00000NATFT', name: 'Paytm FASTag' },
  ]
  const fastagBalances = [1245, 87, 562, 2100, 148, 890, 320, 45, 1780, 410]
  const fastagStatuses = ['Activated', 'Activated', 'Activated', 'Activated', 'Activated', 'Activated', 'Activated', 'Blocked', 'Activated', 'Activated']
  const customerNames = ['DEMO FLEET TRANSPORT', 'DEMO FLEET TRANSPORT', 'SHARMA TRANSPORT', 'DEMO FLEET TRANSPORT', 'DEMO FLEET', 'DEMO FLEET TRANSPORT', 'SHARMA LOGISTICS', 'DEMO FLEET TRANSPORT', 'DEMO FLEET TRANSPORT', 'DEMO FLEET']

  const createdFastags = []
  for (let fi = 0; fi < Math.min(fastagVehicles.length, 8); fi++) {
    const v = fastagVehicles[fi]
    const prov = fastagProviders[fi % fastagProviders.length]
    const checkedDaysAgo = [0, 1, 0, 2, 1, 3, 0, 5][fi]
    const ft = await prisma.fasTag.create({
      data: {
        tenantId: T,
        vehicleId: v.id,
        fastagId: `34${String(Math.floor(1000000000 + Math.random() * 9000000000))}`,
        provider: prov.id,
        providerName: prov.name,
        customerName: customerNames[fi],
        balance: fastagBalances[fi],
        rechargeLimit: 100000,
        tagStatus: fastagStatuses[fi],
        vehicleClass: 'VC20 - Multi Axle Truck',
        lastCheckedAt: new Date(now.getTime() - checkedDaysAgo * 24 * 60 * 60 * 1000),
      },
    })
    createdFastags.push({ ...ft, vehicleNumber: v.vehicleNumber })
  }
  console.log(`  Seeded ${createdFastags.length} FASTag links`)

  // Seed low-balance alerts for vehicles with balance < 200
  for (const ft of createdFastags) {
    if (ft.balance < 200) {
      await prisma.alert.create({
        data: {
          tenantId: T,
          vehicleId: ft.vehicleId,
          alertType: 'fastag_low_balance',
          severity: 'high',
          message: `FASTag low balance: ${ft.vehicleNumber} has only ₹${Math.round(ft.balance)}. Recharge immediately to avoid toll issues.`,
          resolved: false,
        },
      })
    }
  }
  const lowBalCount = createdFastags.filter(f => f.balance < 200).length
  console.log(`  Created ${lowBalCount} low-balance FASTag alerts`)

  // Seed FASTag transactions (mock recharge history)
  const txnData = [
    { fastagIdx: 0, amount: 2000, charge: 3, gst: 0.54, status: 'SUCCESS', daysAgo: 2 },
    { fastagIdx: 0, amount: 1000, charge: 2, gst: 0.36, status: 'SUCCESS', daysAgo: 15 },
    { fastagIdx: 1, amount: 500, charge: 2, gst: 0.36, status: 'SUCCESS', daysAgo: 20 },
    { fastagIdx: 2, amount: 1000, charge: 2, gst: 0.36, status: 'SUCCESS', daysAgo: 5 },
    { fastagIdx: 2, amount: 500, charge: 2, gst: 0.36, status: 'SUCCESS', daysAgo: 25 },
    { fastagIdx: 3, amount: 5000, charge: 5, gst: 0.90, status: 'SUCCESS', daysAgo: 1 },
    { fastagIdx: 3, amount: 2000, charge: 3, gst: 0.54, status: 'SUCCESS', daysAgo: 18 },
    { fastagIdx: 4, amount: 500, charge: 2, gst: 0.36, status: 'FAILED', daysAgo: 3 },
    { fastagIdx: 4, amount: 1000, charge: 2, gst: 0.36, status: 'SUCCESS', daysAgo: 12 },
    { fastagIdx: 5, amount: 2000, charge: 3, gst: 0.54, status: 'SUCCESS', daysAgo: 4 },
    { fastagIdx: 5, amount: 1000, charge: 2, gst: 0.36, status: 'SUCCESS', daysAgo: 22 },
    { fastagIdx: 6, amount: 500, charge: 2, gst: 0.36, status: 'SUCCESS', daysAgo: 8 },
    { fastagIdx: 6, amount: 200, charge: 2, gst: 0.36, status: 'SUCCESS', daysAgo: 30 },
    { fastagIdx: 7, amount: 1000, charge: 2, gst: 0.36, status: 'PENDING', daysAgo: 0 },
    { fastagIdx: 0, amount: 500, charge: 2, gst: 0.36, status: 'SUCCESS', daysAgo: 35 },
    { fastagIdx: 3, amount: 1000, charge: 2, gst: 0.36, status: 'SUCCESS', daysAgo: 40 },
  ]

  let txnCount = 0
  for (const tx of txnData) {
    const ft = createdFastags[tx.fastagIdx]
    if (!ft) continue
    const txnDate = new Date(now.getTime() - tx.daysAgo * 24 * 60 * 60 * 1000)
    await prisma.fasTagTransaction.create({
      data: {
        tenantId: T,
        fastagId: ft.id,
        type: 'recharge',
        amount: tx.amount,
        charge: tx.charge,
        gst: tx.gst,
        totalAmount: tx.amount + tx.charge + tx.gst,
        reference: `FS-SEED-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        bulkpeTxnId: tx.status !== 'PENDING' ? `BBPS${String(Math.floor(10000 + Math.random() * 90000))}` : null,
        npciRef: tx.status === 'SUCCESS' ? `NS0${String(Math.floor(10000000000 + Math.random() * 90000000000))}` : null,
        status: tx.status,
        billerName: ft.providerName,
        vehicleNumber: ft.vehicleNumber,
        message: tx.status === 'SUCCESS' ? 'Transaction is Successful' : tx.status === 'FAILED' ? 'Transaction Failed' : 'Transaction Pending',
        createdAt: txnDate,
      },
    })
    txnCount++
  }
  console.log(`  Seeded ${txnCount} FASTag transactions`)

  console.log('\nSeeding complete!')
  console.log(`\n  Login with email: demo@fleetsure.in`)
  console.log(`  OTP will be printed in server console\n`)
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
