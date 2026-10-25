/**
 * VITAL AGE — Berechnungs-Engine (Öffentliche API)
 */
import type {
  DailyRecord,
  Baseline,
  RecoveryResult,
  VitalityResult,
  SleepSummary,
  StrainData,
} from '../types'
import { computeBaseline } from './baseline'
import { computeRecovery, type RecoveryInput } from './recovery'
import { computeStrain, strainTarget, STRAIN_MAX } from './strain'
import { summarizeSleep, consistencyFactor, sleepEfficiency, aasmReference } from './sleep'
import { computeVitality } from './vitality'
import { MIN_DAYS } from './config'

export { MIN_DAYS, STRAIN_MAX }
export { computeBaseline }
export { computeRecovery }
export { computeVitality }
export { summarizeSleep, consistencyFactor, sleepEfficiency, aasmReference }
export { computeStrain, strainTarget }

export interface DayScores {
  date: string
  recovery: RecoveryResult
  vitality: VitalityResult
  strain: StrainData | null
  sleep: SleepSummary
}

/**
 * Haupt-Funktion: berechnet ALLE Scores für einen Tag.
 * Reine Funktion, deterministisch, getestet.
 */
export function computeDayScores(
  records: DailyRecord[],
  date: string,
  exportedKcal: number | null = null,
): DayScores {
  const baseline = computeBaseline(records)
  const rec = records.find((r) => r.date === date) ?? null

  // 7-Tage-Fenster um den Tag (inklusive) für Konsistenz
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  const idx = sorted.findIndex((r) => r.date === date)
  const window7 = sorted.slice(Math.max(0, idx - 6), idx + 1)
  const cons = consistencyFactor(window7)

  const recovery = rec
    ? computeRecovery({ record: rec, baseline, consistencyFactor: cons })
    : {
        date,
        score: null,
        confidence: 'low' as const,
        drivers: [],
        explanation: 'Kein Datenstand für diesen Tag.',
        requiredInputs: 2,
        availableInputs: 0,
      }

  const vitality = rec
    ? computeVitality(rec, baseline)
    : {
        date,
        score: null,
        confidence: 'low' as const,
        drivers: [],
        chronologicalAge: null,
        note: 'Kein Datenstand für diesen Tag.',
      }

  let strain: StrainData | null = null
  if (rec) {
    const s = computeStrain(rec, exportedKcal)
    if (s.total > 0 || rec.activeMinutes.value !== null) {
      strain = {
        total: s.total,
        workout: s.workout,
        activity: s.activity,
        workoutMinutes: 0,
        source: s.estimated ? 'estimated' : 'measured',
      }
    }
  }

  const sleep = summarizeSleep(records, date)

  return { date, recovery, vitality, strain, sleep }
}
