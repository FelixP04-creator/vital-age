/**
 * VITAL AGE — Demo-Daten-Generator
 * =====================================================================
 * Erzeugt 90 Tage realistischer Beispieldaten (deterministisch via
 * Seed-RNG). Die Daten sind EINDRUCKSVOLL als "DEMO" gekennzeichnet
 * (Banner + connection.demoMode=true). Es wird NIEMALS eine echte
 * Fitbit-/Google-Verbindung simuliert.
 *
 * Muster: zirkadiane Schlafzeiten mit Wochenend-Verschiebung, HRV mit
 * leichtem 2-Wochen-Trend, Trainingsblöcke (Kraft Mo/Do, Laufen Sa),
 * eine Phase mit schlechterer Erholung (Tag 60–64, Simulierung von
 * Stress/Illness-ähnlichem Muster — ohne Krankheitsdiagnose).
 */
import type {
  DailyRecord,
  SleepData,
  Activity,
  Baseline,
  Profile,
  HealthConnection,
  DailyCheckIn,
  Habit,
} from './types'
import { computeBaseline } from './scoring/baseline'

// --- Deterministischer RNG (mulberry32) ---
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dayISO(d: Date): string {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function generateDemoRecords(today = new Date()): DailyRecord[] {
  const rand = mulberry32(42)
  const records: DailyRecord[] = []
  const N = 90

  for (let i = N; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const date = dayISO(d)
    const dow = d.getDay() // 0=So
    const isWeekend = dow === 0 || dow === 6
    // "Stressphase" Tag 62–66 (zählt ab Start): Tagindex = N - i
    const dayIdx = N - i
    const stressPhase = dayIdx >= 62 && dayIdx <= 66
    // 2-Wochen-Wellen (Trend sichtbar)
    const wave = Math.sin(dayIdx / 14 * Math.PI) * 4

    // --- Schlaf ---
    const onsetMin = isWeekend ? 26 * 60 + Math.round(rand() * 50 - 10) : 23 * 60 + 15 + Math.round((rand() - 0.5) * 36)
    let durMin = 430 + Math.round((rand() - 0.5) * 50) + (isWeekend ? 35 : 0) - (stressPhase ? 45 : 0)
    durMin = Math.max(330, Math.min(540, durMin))
    const onset = new Date(d); onset.setHours(Math.floor(onsetMin / 60) % 24, onsetMin % 60, 0, 0)
    const offsetMs = onset.getTime() + durMin * 60000
    const offset = new Date(offsetMs)
    const awakeMin = Math.round(durMin * (0.04 + rand() * 0.04) - (stressPhase ? 8 : 0))
    const deepMin = Math.round(durMin * (0.18 + rand() * 0.05))
    const remMin = Math.round(durMin * (0.22 + rand() * 0.05))
    const lightMin = Math.max(0, durMin - deepMin - remMin - awakeMin)
    const bedMin = durMin + awakeMin + 12 // 12 min Einschlafzeit
    const efficiency = Math.round((durMin / bedMin) * 100)

    const sleep: SleepData = {
      date,
      durationMin: durMin,
      onset: onset.toISOString(),
      offset: offset.toISOString(),
      efficiencyPct: efficiency,
      efficiencySource: 'computed',
      stages: { deepMin, remMin, lightMin, awakeMin, source: 'measured' },
      source: 'measured',
    }

    // --- Vitals ---
    const hrvBase = 58 + wave + (isWeekend ? 3 : 0) - (stressPhase ? 14 : 0)
    const hrv = Math.round(hrvBase + (rand() - 0.5) * 10)
    const rhrBase = 52 - wave * 0.4 - (isWeekend ? 1 : 0) + (stressPhase ? 5 : 0)
    const rhr = Math.round(rhrBase + (rand() - 0.5) * 3)
    const spo2 = Math.round((96.5 + (rand() - 0.5) * 1.4) * 10) / 10
    const resp = Math.round((13 + (rand() - 0.5) * 2 + (stressPhase ? 1.5 : 0)) * 10) / 10
    const skinTemp = Math.round((rand() - 0.5) * 0.5 - (stressPhase ? -0.1 : 0.05)) * 100 / 100
    const vo2 = Math.round((41 + dayIdx * 0.03 + (rand() - 0.5) * 1.2) * 10) / 10

    // --- Aktivität & Strain-Bausteine ---
    const isRunDay = dayIdx % 7 === 5
    const isLiftDay = dayIdx % 7 === 1 || dayIdx % 7 === 4
    let activeMin = Math.round(55 + rand() * 30)
    let azm = Math.round(10 + rand() * 8)
    let steps = Math.round(7500 + rand() * 2500)
    if (isRunDay) { activeMin += 48; azm += 32; steps += 6800 }
    if (isLiftDay) { activeMin += 42; azm += 18; steps += 900 }
    if (stressPhase) { activeMin = Math.round(activeMin * 0.55); azm = Math.round(azm * 0.5) }
    const calories = Math.round(1850 + activeMin * 7.5 + (isRunDay ? 420 : 0) + (isLiftDay ? 180 : 0))

    records.push({
      date,
      restingHr: { value: rhr, source: 'measured' },
      hrv: { value: hrv, source: 'measured' },
      spo2: { value: spo2, source: 'measured' },
      respRate: { value: resp, source: 'measured' },
      skinTempDeltaC: { value: skinTemp, source: 'measured' },
      activeMinutes: { value: activeMin, source: 'measured' },
      activeZoneMinutes: { value: azm, source: 'measured' },
      steps: { value: steps, source: 'measured' },
      distanceKm: { value: Math.round((steps * 0.00075) * 10) / 10, source: 'measured' },
      caloriesKcal: { value: calories, source: 'measured' },
      vo2max: { value: vo2, source: 'computed', note: 'vom Gerät abgeleitet' },
      sleep,
      strain: null, // wird bei Bedarf via computeStrain berechnet
    })
  }
  return records
}

export function generateDemoActivities(records: DailyRecord[]): Activity[] {
  const rand = mulberry32(7)
  const acts: Activity[] = []
  let id = 1
  for (const r of records) {
    const d = new Date(r.date + 'T12:00:00')
    const dow = d.getDay() // 0=So ... 6=Sa
    const isRunDay = dow === 6 && (r.activeZoneMinutes.value ?? 0) > 30
    if (isRunDay) {
      acts.push({
        id: `demo-act-${id++}`,
        date: r.date,
        type: 'Laufen',
        name: 'Intervallläufer',
        durationMin: 42,
        caloriesKcal: 430,
        avgHr: Math.round(148 + rand() * 12),
        maxHr: Math.round(168 + rand() * 10),
        rpe: Math.round(6 + rand() * 2),
        energy: Math.round(3 + rand() * 2),
        mood: Math.round(3 + rand() * 2),
        notes: 'Intervalle mit 4×4 min',
        source: 'imported',
        createdAt: r.date + 'T07:30:00Z',
      })
    }
    if (dow === 1 || dow === 4) {
      acts.push({
        id: `demo-act-${id++}`,
        date: r.date,
        type: 'Kraft',
        name: 'Ganzkörper-Kraft',
        durationMin: 55,
        caloriesKcal: 240,
        avgHr: Math.round(112 + rand() * 10),
        maxHr: Math.round(138 + rand() * 8),
        rpe: Math.round(7 + rand() * 1.5),
        energy: Math.round(3 + rand() * 2),
        mood: Math.round(3 + rand() * 2),
        source: 'imported',
        createdAt: r.date + 'T18:15:00Z',
      })
    }
    // Ein manueller Eintrag als Beispiel (klar gekennzeichnet)
    if (dow === 3 && rand() > 0.6) {
      acts.push({
        id: `demo-act-${id++}`,
        date: r.date,
        type: 'Yoga',
        name: 'Abend-Yoga (manuell)',
        durationMin: 30,
        caloriesKcal: null,
        avgHr: null,
        maxHr: null,
        rpe: 3,
        energy: 4,
        mood: 4,
        notes: 'Manuell erfasst — kein Wearable-Import',
        source: 'manual',
        createdAt: r.date + 'T21:00:00Z',
      })
    }
  }
  return acts
}

export function generateDemoCheckIns(records: DailyRecord[]): DailyCheckIn[] {
  const rand = mulberry32(99)
  return records.map((r) => ({
    date: r.date,
    stress: Math.round(3 + rand() * 4),
    energy: Math.round(4 + rand() * 3),
    mood: Math.round(5 + rand() * 4),
    waterMl: Math.round((1800 + rand() * 1200) / 100) * 100,
    habitIds: rand() > 0.25 ? ['demo-h1', 'demo-h2'] : ['demo-h1'],
  }))
}

export function demoHabits(): Habit[] {
  return [
    { id: 'demo-h1', name: 'Vor 23:45 ins Bett', category: 'sleep', targetDays: [1, 2, 3, 4, 5], createdAt: '2026-08-01T00:00:00Z' },
    { id: 'demo-h2', name: 'Täglicher Spaziergang (20 min)', category: 'movement', targetDays: [], createdAt: '2026-08-01T00:00:00Z' },
    { id: 'demo-h3', name: 'Abendlicher Atem-Check (5 min)', category: 'mind', targetDays: [], createdAt: '2026-08-15T00:00:00Z' },
    { id: 'demo-h4', name: '3 Liter Wasser', category: 'nutrition', targetDays: [], createdAt: '2026-08-15T00:00:00Z' },
  ]
}

export function demoProfile(): Profile {
  return {
    id: 'demo-user',
    displayName: 'Demo-Profil',
    birthDate: '1990-04-12',
    sex: 'm',
    heightCm: 178,
    weightKg: 76,
    goals: ['general-health', 'sport-performance', 'protein'],
    fatPreferences: [],
    allergies: [],
    dietContext: ['mitteleuropäisch'],
  }
}

export function demoConnection(): HealthConnection {
  return {
    provider: 'google-health',
    device: 'Fitbit Air (Demo)',
    status: 'disconnected',
    lastSyncAt: null,
    scopes: ['health_fitness.userdata.read'],
    demoMode: true,
  }
}

export function demoBaseline(records: DailyRecord[]): Baseline {
  return computeBaseline(records)
}
