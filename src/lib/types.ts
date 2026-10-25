/**
 * VITAL AGE — Zentrales Datenmodell
 *
 * Designprinzipien:
 * - Jeder Messwert trägt eine Quellen-Kennzeichnung (measured/computed/estimated).
 * - Fehlende Daten sind null — niemals 0 (0 wäre eine falsche Aussage).
 * - Alle Zeiten als ISO-8601 (UTC), Tage als YYYY-MM-DD (lokales Datum des Nutzers).
 * - Einheiten: Minuten, bpm, ms, %, °C, km, kcal, g, ml.
 */

/* ------------------------------------------------------------------ */
/* Quellen-Kennzeichnung                                               */
/* ------------------------------------------------------------------ */

/** Herkunft eines Wertes: gemessen (Wearable), von der App berechnet, oder geschätzt. */
export type MetricSource = 'measured' | 'computed' | 'estimated'

export interface Metric<T = number> {
  value: T | null
  source: MetricSource
  note?: string
}

/* ------------------------------------------------------------------ */
/* Schlaf                                                              */
/* ------------------------------------------------------------------ */

export interface SleepStages {
  deepMin: number | null
  remMin: number | null
  lightMin: number | null
  awakeMin: number | null
  /** Gerät liefert Phasen nur, wenn es sie tatsächlich misst. */
  source: MetricSource
}

export interface SleepData {
  /** Der Tag, an dem die Schlafnacht ENDET (Morgen). */
  date: string
  durationMin: number
  onset: string // ISO
  offset: string // ISO
  /** Zeit im Bett vs. Zeit eingeschlafen, in % (wenn berechnet). */
  efficiencyPct: number | null
  efficiencySource: MetricSource | null
  stages: SleepStages
  source: MetricSource
}

/* ------------------------------------------------------------------ */
/* Belastung (Strain)                                                  */
/* ------------------------------------------------------------------ */

export interface StrainData {
  /** Gesamtbelastrung 0–21 (eigenes, dokumentiertes Modell — s. docs/STRAIN-MODEL.md) */
  total: number
  /** Anteil aus strukturiertem Training (Workout-Strain). */
  workout: number
  /** Anteil aus Alltagsaktivität (Activity-Strain). */
  activity: number
  workoutLabel?: string
  workoutMinutes: number
  source: MetricSource
}

/* ------------------------------------------------------------------ */
/* Tagesprofil — alle Messwerte eines Kalendertags                      */
/* ------------------------------------------------------------------ */

export interface DailyRecord {
  /** YYYY-MM-DD */
  date: string
  restingHr: Metric // bpm
  hrv: Metric // ms (RMSSD, über Nacht)
  spo2: Metric // %
  respRate: Metric // Atemzüge/min (nachts)
  skinTempDeltaC: Metric // Abweichung von der persönlichen Nacht-Baseline, °C
  activeMinutes: Metric // min
  activeZoneMinutes: Metric // min
  steps: Metric // Schrittzahl
  distanceKm: Metric
  caloriesKcal: Metric
  vo2max: Metric // ml/kg/min
  sleep: SleepData | null
  strain: StrainData | null
}

/* ------------------------------------------------------------------ */
/* Aktivität / Trainingsjournal                                         */
/* ------------------------------------------------------------------ */

export type ActivityType =
  | 'Laufen'
  | 'Kraft'
  | 'Radfahren'
  | 'Schwimmen'
  | 'Yoga'
  | 'Spaziergang'
  | 'Fußball'
  | 'Klettern'
  | 'Sonstiges'

export interface Activity {
  id: string
  date: string
  type: ActivityType
  name: string
  durationMin: number
  caloriesKcal: number | null
  avgHr: number | null
  maxHr: number | null
  /** Subjektive Anstrengung 1–10 (RPE). */
  rpe: number | null
  /** Selbsteinschätzung Energie 1–5. */
  energy: number | null
  /** Selbsteinschätzung Wohlbefinden 1–5. */
  mood: number | null
  notes?: string
  /** imported = vom Wearable, manual = von Hand erfasst */
  source: 'imported' | 'manual'
  createdAt: string
}

/* ------------------------------------------------------------------ */
/* Ernährung                                                            */
/* ------------------------------------------------------------------ */

/** Nährstoff-Quellen: deklariert (Verpackung), Datenbank (z. B. USDA FDC), geschätzt (Foto/KI). */
export type NutrientSource = 'label' | 'database' | 'estimated'

export interface FoodItem {
  id: string
  name: string
  quantity: number
  unit: 'g' | 'ml' | 'piece' | 'portion'
  rawOrCooked?: 'raw' | 'cooked'
  cookingMethod?: string
  /** Nährwerte pro 100 g/ml, Einheit g (oder mg für Mikro, je nach Schlüssel). */
  nutrients: Record<string, number>
  nutrientSource: NutrientSource
  /** Fettquellen-Zuordnung, z. B. ['olive-oil'], für die Fettquellen-Analyse. */
  fatSources?: string[]
  proteinQuality?: {
    leucinGPer100?: number
    digestibility?: number // 0–1 (PDCAIS-ähnlich)
    essentialAminoAcidsGPer100?: Record<string, number>
  }
}

export interface MealMacros {
  proteinG: number
  carbsG: number
  fiberG: number
  sugarG: number
  addedSugarG: number | null
  fatG: number
  satFatG: number | null
  monoFatG: number | null
  polyFatG: number | null
  omega3G: number | null
  omega6G: number | null
  transFatG: number | null
  alcoholG: number | null
  caloriesKcal: number
}

export type MealMethod = 'photo' | 'manual' | 'barcode' | 'chat'

export interface Meal {
  id: string
  date: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  name: string
  items: FoodItem[]
  macros: MealMacros
  /** Mikronährstoffe (Summe der Items). */
  micros: Record<string, number>
  method: MealMethod
  /** Konfidenz der Foto-/KI-Erkennung 0–1 (nur bei photo/chat). */
  confidence?: number
  /** Nutzer hat die geschätzten Werte bestätigt/korrigiert. */
  confirmed: boolean
  notes?: string
  createdAt: string
}

/* ------------------------------------------------------------------ */
/* Tages-Check-in (Stress, Energie, Gewohnheiten, Wasser)               */
/* ------------------------------------------------------------------ */

export interface DailyCheckIn {
  date: string
  stress: number | null // 1–10 (subjektiv)
  energy: number | null // 1–10
  mood: number | null // 1–10
  waterMl: number
  reflection?: string
  habitIds: string[]
}

export interface Habit {
  id: string
  name: string
  category: 'sleep' | 'movement' | 'recovery' | 'mind' | 'nutrition'
  /** Wochentage 0–6 (Mo–So), leer = täglich */
  targetDays: number[]
  createdAt: string
}

/* ------------------------------------------------------------------ */
/* Basiswerte (persönliche Baselines)                                   */
/* ------------------------------------------------------------------ */

export interface Baseline {
  hrvMs: number | null
  restingHrBpm: number | null
  sleepDurationMin: number | null
  /** typischer Schlafbeginn (Minuten seit Mitternacht) */
  sleepOnsetMin: number | null
  sleepConsistencyMin: number | null // Standardabweichung des Schlafbeginns
  computedAt: string
  sampleDays: number
}

/* ------------------------------------------------------------------ */
/* Profil & Verbindung                                                  */
/* ------------------------------------------------------------------ */

export type NutritionGoal =
  | 'general-health'
  | 'balanced'
  | 'sport-performance'
  | 'protein'
  | 'fiber'
  | 'variety'

export interface Profile {
  id: string
  displayName: string
  birthDate?: string
  sex?: 'm' | 'f' | 'other'
  heightCm?: number
  weightKg?: number
  goals: NutritionGoal[]
  /** Persönliche Fett-Präferenzen (nur dokumentiert, keine Empfehlung). */
  fatPreferences: string[]
  allergies: string[]
  /** z. B. 'vegetarisch', 'halal', 'mitteleuropäisch' */
  dietContext: string[]
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'expired' | 'error'

export interface HealthConnection {
  provider: 'google-health'
  device: string // z. B. 'Fitbit Air'
  status: ConnectionStatus
  lastSyncAt: string | null
  lastError?: string
  scopes: string[]
  /** True, wenn aktuell DEMO-Daten angezeigt werden. */
  demoMode: boolean
}

/* ------------------------------------------------------------------ */
/* KI-Coach                                                            */
/* ------------------------------------------------------------------ */

export interface CoachMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  /** rule-based = lokale Regel-Engine, llm = echtes Sprachmodell */
  engine: 'rule-based' | 'llm'
  createdAt: string
}

/* ------------------------------------------------------------------ */
/* Scores (Ergebnisse der Berechnungs-Engine)                           */
/* ------------------------------------------------------------------ */

export type Confidence = 'low' | 'medium' | 'high'

export interface ScoreDriver {
  name: string
  detail: string
  direction: 'good' | 'bad' | 'neutral'
  weight: number
}

export interface RecoveryResult {
  date: string
  /** 0–100, null = nicht genügend Daten (kein erfundener Wert). */
  score: number | null
  confidence: Confidence
  drivers: ScoreDriver[]
  explanation: string
  /** Mindestanzahl verfügbarer Eingänge, die für den Score nötig wären. */
  requiredInputs: number
  availableInputs: number
}

export interface VitalityResult {
  date: string
  /** 0–100, app-eigener Vitalitätsindex (kein biologisches Alter). */
  score: number | null
  confidence: Confidence
  drivers: ScoreDriver[]
  /** Kalenderalter, nur wenn der Nutzer es angegeben hat. */
  chronologicalAge: number | null
  note: string
}

export interface SleepSummary {
  date: string
  durationMin: number | null
  efficiencyPct: number | null
  consistencyScore: number | null // 0–100: Stetigkeit der Schlafzeiten
  deficitMin: number | null // vs. persönlicher Durchschnitt / Referenz
  avgOnsetMin: number | null
  avgOffsetMin: number | null
  routineNote: string
}
