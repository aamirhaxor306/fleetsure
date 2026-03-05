/**
 * Fleetsure — Zod Validation Schemas
 *
 * Reusable schemas for the highest-risk routes.
 * Other routes can gradually adopt by importing from here.
 */
import { z } from 'zod'

// ── Common ──────────────────────────────────────────────────────────────

export const uuidParam = z.object({
    id: z.string().uuid('Invalid ID format'),
})

// ── Vehicles ────────────────────────────────────────────────────────────

export const createVehicleSchema = z.object({
    vehicleNumber: z.string()
        .min(4, 'Vehicle number is too short')
        .max(15, 'Vehicle number is too long')
        .transform(v => v.toUpperCase().replace(/\s+/g, '')),
    vehicleType: z.enum(['Truck', 'Trailer', 'Tanker', 'Tipper', 'Mini Truck', 'Pickup', 'Other'], {
        errorMap: () => ({ message: 'Invalid vehicle type' }),
    }),
    purchaseYear: z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1),
    approxKm: z.coerce.number().int().min(0).default(0),
    status: z.enum(['active', 'idle']).default('active'),
    axleConfig: z.enum(['6W', '10W', '12W', '14W']).default('6W'),
})

export const updateVehicleSchema = createVehicleSchema.partial()

// ── Drivers ─────────────────────────────────────────────────────────────

export const createDriverSchema = z.object({
    name: z.string().min(2, 'Name is too short').max(100),
    phone: z.string().min(10).max(15).optional(),
    licenseNumber: z.string().max(20).optional(),
    telegramChatId: z.string().max(20).optional(),
})

export const updateDriverSchema = createDriverSchema.partial()

// ── Trips ───────────────────────────────────────────────────────────────

export const createTripSchema = z.object({
    vehicleId: z.string().uuid('Invalid vehicle ID'),
    driverId: z.string().uuid('Invalid driver ID').optional().nullable(),
    date: z.string().min(1, 'Date is required'),
    loadingSlipNumber: z.string().max(50).optional().default(''),
    loadingLocation: z.string().max(200).optional().default(''),
    destination: z.string().max(200).optional().default(''),
    freightAmount: z.coerce.number().min(0).optional().nullable(),
    fuelExpense: z.coerce.number().min(0).optional().default(0),
    tollExpense: z.coerce.number().min(0).optional().default(0),
    otherExpenses: z.coerce.number().min(0).optional().default(0),
    driverPay: z.coerce.number().min(0).optional().default(0),
    notes: z.string().max(500).optional().default(''),
    status: z.enum(['logged', 'reconciled']).optional().default('logged'),
    savedRouteId: z.string().uuid().optional().nullable(),
    monthlyBillId: z.string().uuid().optional().nullable(),
})

export const updateTripSchema = createTripSchema.partial()

// ── Documents ───────────────────────────────────────────────────────────

export const createDocumentSchema = z.object({
    vehicleId: z.string().uuid('Invalid vehicle ID'),
    documentType: z.enum(['insurance', 'FC', 'permit', 'PUC'], {
        errorMap: () => ({ message: 'Invalid document type. Must be insurance, FC, permit, or PUC' }),
    }),
    expiryDate: z.string().min(1, 'Expiry date is required'),
    provider: z.string().max(200).optional().default(''),
    policyNumber: z.string().max(100).optional().default(''),
    premium: z.coerce.number().min(0).optional().nullable(),
    notes: z.string().max(500).optional().default(''),
})

// ── Fuel ────────────────────────────────────────────────────────────────

export const createFuelSchema = z.object({
    vehicleId: z.string().uuid('Invalid vehicle ID'),
    date: z.string().min(1, 'Date is required'),
    liters: z.coerce.number().min(0.1, 'Liters must be positive'),
    costPerLiter: z.coerce.number().min(0),
    totalCost: z.coerce.number().min(0),
    odometerKm: z.coerce.number().min(0).optional(),
    fuelStation: z.string().max(200).optional().default(''),
    notes: z.string().max(500).optional().default(''),
})

// ── Maintenance ─────────────────────────────────────────────────────────

export const createMaintenanceSchema = z.object({
    vehicleId: z.string().uuid('Invalid vehicle ID'),
    maintenanceType: z.enum(['engine', 'tyre', 'brake', 'clutch', 'oil_change', 'battery', 'electrical', 'body_work', 'ac', 'general']),
    description: z.string().max(500).optional().default(''),
    cost: z.coerce.number().min(0).default(0),
    maintenanceDate: z.string().min(1, 'Date is required'),
    vendor: z.string().max(200).optional().default(''),
    notes: z.string().max(500).optional().default(''),
})

// ── Settings ────────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    phone: z.string().min(10).max(15).optional(),
})

export const updateCompanySchema = z.object({
    name: z.string().min(2).max(200).optional(),
    gst: z.string().max(20).optional(),
    address: z.string().max(500).optional(),
})

export const inviteUserSchema = z.object({
    email: z.string().email('Invalid email address'),
    role: z.enum(['owner', 'manager', 'viewer'], {
        errorMap: () => ({ message: 'Role must be owner, manager, or viewer' }),
    }),
})

// ── Auth ────────────────────────────────────────────────────────────────

export const requestOtpSchema = z.object({
    email: z.string().email('Invalid email address'),
})

export const verifyOtpSchema = z.object({
    email: z.string().email('Invalid email address'),
    otp: z.string().length(6, 'OTP must be 6 digits'),
})

export const onboardSchema = z.object({
    fleetName: z.string().min(2, 'Fleet name is too short').max(200),
    ownerName: z.string().min(2, 'Name is too short').max(100),
})
