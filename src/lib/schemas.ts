/**
 * VITAL AGE — Zod-Schemas für Datenvalidierung.
 * Wird für: Import externer Daten (Google Health), API-Responses,
 * LocalStorage-Load (Defensive Parsing), Formulare.
 */
import { z } from 'zod'

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Erwartet YYYY-MM-DD')

export const isoDateTime = z.string().datetime({ offset: true }).or(z.string())

export const sourceEnum = z.enum(['measured', 'computed', 'estimated'])

export const metricSchema = z.object({
  value: z.number().nullable(),
  source: sourceEnum,
  note: z.string().optional(),
})

export const sleepStagesSchema = z.object({
  deepMin: z.number().min(0).nullable(),
  remMin: z.number().min(0).nullable(),
  lightMin: z.number().min(0).nullable(),
  awakeMin: z.number().min(0).nullable(),
  source: sourceEnum,
})

export const sleepSchema = z.object({
  date: isoDate,
  durationMin: z.number().min(0).max(24 * 60),
  onset: z.string(),
  offset: z.string(),
  efficiencyPct: z.number().min(0).max(100).nullable(),
  efficiencySource: sourceEnum.nullable(),
  stages: sleepStagesSchema,
  source: sourceEnum,
})

export const strainSchema = z.object({
  total: z.number().min(0).max(21),
  workout: z.number().min(0).max(21),
  activity: z.number().min(0).max(21),
  workoutLabel: z.string().optional(),
  workoutMinutes: z.number().min(0).max(24 * 60),
  source: sourceEnum,
})

export const dailyRecordSchema = z.object({
  date: isoDate,
  restingHr: metricSchema,
  hrv: metricSchema,
  spo2: metricSchema,
  respRate: metricSchema,
  skinTempDeltaC: metricSchema,
  activeMinutes: metricSchema,
  activeZoneMinutes: metricSchema,
  steps: metricSchema,
  distanceKm: metricSchema,
  caloriesKcal: metricSchema,
  vo2max: metricSchema,
  sleep: sleepSchema.nullable(),
  strain: strainSchema.nullable(),
})

export const activitySchema = z.object({
  id: z.string().min(1),
  date: isoDate,
  type: z.string(),
  name: z.string().min(1),
  durationMin: z.number().min(0).max(24 * 60),
  caloriesKcal: z.number().min(0).nullable(),
  avgHr: z.number().min(0).max(260).nullable(),
  maxHr: z.number().min(0).max(260).nullable(),
  rpe: z.number().min(1).max(10).nullable(),
  energy: z.number().min(1).max(5).nullable(),
  mood: z.number().min(1).max(5).nullable(),
  notes: z.string().optional(),
  source: z.enum(['imported', 'manual']),
  createdAt: z.string(),
})

export const foodItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.enum(['g', 'ml', 'piece', 'portion']),
  rawOrCooked: z.enum(['raw', 'cooked']).optional(),
  cookingMethod: z.string().optional(),
  nutrients: z.record(z.string(), z.number()),
  nutrientSource: z.enum(['label', 'database', 'estimated']),
  fatSources: z.array(z.string()).optional(),
  proteinQuality: z
    .object({
      leucinGPer100: z.number().min(0).optional(),
      digestibility: z.number().min(0).max(1).optional(),
      essentialAminoAcidsGPer100: z.record(z.string(), z.number()).optional(),
    })
    .optional(),
})

export const mealMacrosSchema = z.object({
  proteinG: z.number().min(0),
  carbsG: z.number().min(0),
  fiberG: z.number().min(0),
  sugarG: z.number().min(0),
  addedSugarG: z.number().min(0).nullable(),
  fatG: z.number().min(0),
  satFatG: z.number().min(0).nullable(),
  monoFatG: z.number().min(0).nullable(),
  polyFatG: z.number().min(0).nullable(),
  omega3G: z.number().min(0).nullable(),
  omega6G: z.number().min(0).nullable(),
  transFatG: z.number().min(0).nullable(),
  alcoholG: z.number().min(0).nullable(),
  caloriesKcal: z.number().min(0),
})

export const mealSchema = z.object({
  id: z.string().min(1),
  date: isoDate,
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  name: z.string(),
  items: z.array(foodItemSchema),
  macros: mealMacrosSchema,
  micros: z.record(z.string(), z.number()),
  method: z.enum(['photo', 'manual', 'barcode', 'chat']),
  confidence: z.number().min(0).max(1).optional(),
  confirmed: z.boolean(),
  notes: z.string().optional(),
  createdAt: z.string(),
})

export const dailyCheckInSchema = z.object({
  date: isoDate,
  stress: z.number().min(1).max(10).nullable(),
  energy: z.number().min(1).max(10).nullable(),
  mood: z.number().min(1).max(10).nullable(),
  waterMl: z.number().min(0).max(10000),
  reflection: z.string().optional(),
  habitIds: z.array(z.string()),
})

export const habitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['sleep', 'movement', 'recovery', 'mind', 'nutrition']),
  targetDays: z.array(z.number().int().min(0).max(6)),
  createdAt: z.string(),
})

export const baselineSchema = z.object({
  hrvMs: z.number().positive().nullable(),
  restingHrBpm: z.number().positive().nullable(),
  sleepDurationMin: z.number().positive().nullable(),
  sleepOnsetMin: z.number().min(0).max(1439).nullable(),
  sleepConsistencyMin: z.number().min(0).nullable(),
  computedAt: z.string(),
  sampleDays: z.number().int().min(0),
})

export const profileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  birthDate: z.string().optional(),
  sex: z.enum(['m', 'f', 'other']).optional(),
  heightCm: z.number().min(100).max(250).optional(),
  weightKg: z.number().min(20).max(300).optional(),
  goals: z.array(
    z.enum([
      'general-health',
      'balanced',
      'sport-performance',
      'protein',
      'fiber',
      'variety',
    ]),
  ),
  fatPreferences: z.array(z.string()),
  allergies: z.array(z.string()),
  dietContext: z.array(z.string()),
})

export const connectionSchema = z.object({
  provider: z.literal('google-health'),
  device: z.string(),
  status: z.enum(['connected', 'disconnected', 'expired', 'error']),
  lastSyncAt: z.string().nullable(),
  lastError: z.string().optional(),
  scopes: z.array(z.string()),
  demoMode: z.boolean(),
})

/* ------------------------------------------------------------------ */
/* Validierungs-Helfer                                                  */
/* ------------------------------------------------------------------ */

/**
 * Prüft, ob ein Messwert plausibel ist (unplausible Values erkennen).
 * Grenzwerte sind bewusst großzügig (Menschenbereich, kein Urteil).
 */
export function isPlausible(key: string, value: number | null): boolean {
  if (value === null) return false
  const ranges: Record<string, [number, number]> = {
    restingHr: [25, 130],
    hrv: [10, 500],
    spo2: [70, 100],
    respRate: [6, 60],
    steps: [0, 100000],
    activeMinutes: [0, 1440],
    caloriesKcal: [0, 15000],
    vo2max: [15, 100],
    sleepDurationMin: [120, 1140],
    strainTotal: [0, 21],
  }
  const r = ranges[key]
  if (!r) return true
  return value >= r[0] && value <= r[1]
}

export type DailyRecordInput = z.infer<typeof dailyRecordSchema>
