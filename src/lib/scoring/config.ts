/**
 * VITAL AGE — Berechnungs-Konstanten & Filter
 */
import type { DailyRecord } from '../types'
import { isPlausible } from '../schemas'

/** Mindestanzahl gültiger Tage, bevor ein persönlicher Baseline/Trend gezeigt wird. */
export const MIN_DAYS = 7
/** Rolling Window (Tage) für Baseline-Berechnung. */
export const BASELINE_WINDOW = 28

/**
 * Filtert Tage mit gültigem (plausiblen) Wert für eine Größe.
 * Fehlende (null) und unplausible Werte werden NICHT als 0 behandelt.
 */
export function validValues(
  records: DailyRecord[],
  pick: (r: DailyRecord) => number | null,
  plausKey?: string,
): number[] {
  const out: number[] = []
  for (const r of records) {
    const v = pick(r)
    if (v === null || Number.isNaN(v)) continue
    if (plausKey && !isPlausible(plausKey, v)) continue
    out.push(v)
  }
  return out
}
