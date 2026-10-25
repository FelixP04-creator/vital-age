/**
 * VITAL AGE — Strain-Modell (Belastung, 0–21)
 * =====================================================================
 * EIGENES, DOKUMENTIERTES MODELL — ausdrücklich NICHT äquivalent zum
 * proprietären WHOOP-Algorithmus (s. docs/STRAIN-MODEL.md).
 *
 * Strain = Aktivitätsanteil + Workout-Anteil, gedeckelt bei 21.
 *
 *   Strain_Aktivität = activeZoneMinutes / 30        [0..~7]
 *     (WHO-artige "Aktiv-Zonenminuten" als Proxy für intensiven
 *      Alltagsaufwand; 30 AZM ~ moderate Grundlast)
 *
 *   Strain_Workout = min( (Energie_kcal - Grundumsatz_Anteil) / 25, 14 )
 *     Energie_Kalorien aus importierten Aktivitäten; 25 kcal ≈ 1 Strain.
 *
 *   Strain_Gesamt = min( Strain_Aktivität + Strain_Workout, 21 )
 *
 * Wenn keine aktiven Kalorien verfügbar sind (nur Schritte/Minuten),
 * wird der Aktivitätsanteil über activeMinutes geschätzt und als
 * source 'estimated' gekennzeichnet.
 */
import type { DailyRecord } from '../types'
import { round1, clamp } from '../stats'

export const STRAIN_MAX = 21

/** Aktive Zonenminuten -> Strain-Anteil (Alltag). */
export function activityStrain(activeZoneMin: number | null, activeMin: number | null): { value: number; estimated: boolean } {
  if (activeZoneMin !== null) {
    return { value: activeZoneMin / 30, estimated: false }
  }
  if (activeMin !== null) {
    // Grobe Schätzung: 40 % der aktiven Minuten zählen als "Zone"
    return { value: (activeMin * 0.4) / 30, estimated: true }
  }
  return { value: 0, estimated: false }
}

/** Importierte Trainingskalorien -> Strain-Anteil (Workout). */
export function workoutStrain(exportedKcal: number | null): { value: number; estimated: boolean } {
  if (exportedKcal === null) return { value: 0, estimated: false }
  return { value: clamp(exportedKcal / 25, 0, 14), estimated: false }
}

/**
 * Berechnet den Gesamt-Strain eines Tages.
 * @param exportedKcal Kalorien aus importierten Aktivitäten des Tages.
 */
export function computeStrain(record: DailyRecord, exportedKcal: number | null): {
  total: number
  workout: number
  activity: number
  estimated: boolean
} {
  const act = activityStrain(record.activeZoneMinutes.value, record.activeMinutes.value)
  const wor = workoutStrain(exportedKcal)
  const total = clamp(act.value + wor.value, 0, STRAIN_MAX)
  return {
    total: round1(total),
    workout: round1(wor.value),
    activity: round1(act.value),
    estimated: act.estimated || (exportedKcal === null && act.value === 0),
  }
}

/**
 * Empfohlener Tages-Strain-Zielbereich basierend auf dem 7-Tage-Durchschnitt:
 * 0.9–1.15 × Mittelwert, begrenzt auf 5–16 (bewegter, aber realistisch).
 */
export function strainTarget(recentStrains: number[]): { min: number; max: number } {
  const valid = recentStrains.filter((x) => x > 0)
  if (valid.length < 3) return { min: 5, max: 12 }
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length
  return {
    min: round1(clamp(avg * 0.9, 3, 14)),
    max: round1(clamp(avg * 1.15, 6, 18)),
  }
}
