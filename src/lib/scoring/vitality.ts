/**
 * VITAL AGE — Vitalitätsindex (0–100) & "Biologisches Alter"-Bereich
 * =====================================================================
 * WICHTIGE METHODISCHE EINSCHRÄNKUNG (s. docs/VITALITY-MODEL.md):
 *
 *  A) "Physiologischer Altersindikator": Ein echtes biologisches Alter
 *     lässt sich aus Wearable-Daten (HRV, RHR, Schlaf) NICHT
 *     zuverlässig bestimmen. Die App zeigt daher KEINEN scheinbar
 *     exakten Alterswert. Stattdessen:
 *
 *  B) "Vitalitätsindex": Ein app-eigener 0–100-Indikator, der die
 *     VERÄNDERUNG der verfügbaren Gesundheits- und Fitnessfaktoren
 *     zusammenfasst (relativ zum eigenen Basiswert). Er ist kein
 *     medizinisch validiertes biologisches Alter und keine Diagnose.
 *
 * FORMEL:
 *   Vitality = Σ w_i * F_i   über verfügbare Faktoren F_i ∈ [0,100]
 *     (Gewichte werden auf verfügbare Faktoren umverteilt)
 *
 *   Faktoren (alle personalisiert gegen Baseline/Referenz):
 *     F_HRV     = 100*clamp(0.5 + (hrv/base-1)*4, 0, 1)          w=0.25
 *     F_RHR     = 100*clamp(0.5 - (rhr-base)/20, 0, 1)           w=0.15
 *     F_Sleep   = 0.5*EffF + 0.5*DurF                            w=0.20
 *        DurF = 100*clamp(0.5 + (dur-refDur)/120, 0, 1)  (±2h)
 *     F_Fitness = 100*clamp((vo2 - 25)/(55-25), 0, 1)            w=0.20
 *        (VO2max-Skala; alters-/geschlechtsabhängige Referenzen sind
 *         complex -> bewusst einfache, dokumentierte Skala)
 *     F_Active  = 100*clamp(activeMin/150, 0, 1)                 w=0.10
 *     F_Spo2    = 100*clamp((spo2-90)/8, 0, 1)                   w=0.10
 *
 *   Unsicherheit: Konfidenz hängt von der Zahl der verfügbaren
 *   Faktoren und der Baseline-Größe ab.
 */
import type {
  DailyRecord,
  Baseline,
  VitalityResult,
  ScoreDriver,
  Confidence,
} from '../types'
import { round1, clamp } from '../stats'

const WEIGHTS = {
  hrv: 0.25,
  rhr: 0.15,
  sleep: 0.2,
  fitness: 0.2,
  active: 0.1,
  spo2: 0.1,
} as const

export function computeVitality(record: DailyRecord, baseline: Baseline): VitalityResult {
  const drivers: ScoreDriver[] = []
  let totalW = 0
  let total = 0

  const add = (name: string, f: number | null, detail: string, w: number) => {
    if (f === null) return
    totalW += w
    total += w * f
    drivers.push({
      name,
      detail,
      direction: f >= 65 ? 'good' : f >= 35 ? 'neutral' : 'bad',
      weight: w,
    })
  }

  // HRV
  if (record.hrv.value !== null && baseline.hrvMs !== null) {
    const f = 100 * clamp(0.5 + (record.hrv.value! / baseline.hrvMs! - 1) * 4, 0, 1)
    add(
      'HRV vs. Baseline',
      f,
      `${round1(record.hrv.value!)} ms (Baseline ${round1(baseline.hrvMs!)} ms)`,
      WEIGHTS.hrv,
    )
  }
  // RHR
  if (record.restingHr.value !== null && baseline.restingHrBpm !== null) {
    const f = 100 * clamp(0.5 - (record.restingHr.value! - baseline.restingHrBpm!) / 20, 0, 1)
    add(
      'Ruhe-Herzfrequenz',
      f,
      `${record.restingHr.value!} bpm (Baseline ${round1(baseline.restingHrBpm!)} bpm)`,
      WEIGHTS.rhr,
    )
  }
  // Schlaf
  if (record.sleep) {
    const s = record.sleep
    const effF = s.efficiencyPct !== null ? 100 * clamp((s.efficiencyPct - 80) / 15, 0, 1) : null
    const refDur = baseline.sleepDurationMin ?? 450
    const durF = 100 * clamp(0.5 + (s.durationMin - refDur) / 120, 0, 1)
    const parts = [effF, durF].filter((x): x is number => x !== null)
    if (parts.length > 0) {
      const f = parts.reduce((a, b) => a + b, 0) / parts.length
      add('Schlaf (Dauer & Effizienz)', f, `${Math.round(s.durationMin / 60)}h ${Math.round(s.durationMin % 60)}m`, WEIGHTS.sleep)
    }
  }
  // Fitness (VO2max)
  if (record.vo2max.value !== null) {
    const f = 100 * clamp((record.vo2max.value! - 25) / 30, 0, 1)
    add('Cardio-Fitness (VO₂max)', f, `${round1(record.vo2max.value!)} ml/kg/min`, WEIGHTS.fitness)
  }
  // Aktivität
  if (record.activeMinutes.value !== null) {
    const f = 100 * clamp(record.activeMinutes.value! / 150, 0, 1)
    add('Aktive Minuten', f, `${Math.round(record.activeMinutes.value!)} min`, WEIGHTS.active)
  }
  // SpO2
  if (record.spo2.value !== null) {
    const f = 100 * clamp((record.spo2.value! - 90) / 8, 0, 1)
    add('Sauerstoffsättigung', f, `${record.spo2.value!} %`, WEIGHTS.spo2)
  }

  if (totalW === 0) {
    return {
      date: record.date,
      score: null,
      confidence: 'low',
      drivers: [],
      chronologicalAge: null,
      note: 'Nicht genügend Daten für einen Vitalitätsindex (mindestens HRV, Ruhe-HF oder Schlaf nötig).',
    }
  }

  const score = round1(clamp(total / totalW, 0, 100))
  let confidence: Confidence = 'medium'
  if (totalW >= 0.7 && baseline.sampleDays >= 14) confidence = 'high'
  else if (totalW < 0.3) confidence = 'low'

  return {
    date: record.date,
    score,
    confidence,
    drivers,
    chronologicalAge: null, // wird vom Caller gesetzt, wenn birthDate vorliegt
    note:
      'VITAL-AGE-eigener Indikator über verfügbare Messwerte. KEIN medizinisch validiertes biologisches Alter, keine Diagnose.',
  }
}
