/**
 * VITAL AGE — Baseline-Berechnung (persönliche Ausgangswerte)
 *
 * Prinzip: Baselines werden aus dem eigenen Verlauf berechnet (Rolling
 * Window der letzten BASELINE_WINDOW Tage, ROBUSTE Statistik: Median /
 * robustMean statt arithmetischem Mittel, um Ausreißer nicht zu
 * verzerren). Es werden KEINE globalen Referenzgrenzwerte als
 * persönlicher Maßstab verwendet.
 */
import type { DailyRecord, Baseline } from '../types'
import { median, robustMean, stdDev, clamp } from '../stats'
import { MIN_DAYS, BASELINE_WINDOW, validValues } from './config'

/**
 * minutes-of-day aus ISO-Zeit (lokales Datum des Nutzers).
 * Handhabt die Nacht um Mitternacht: onset 23:15 -> 1395.
 */
export function minutesOfDay(iso: string): number {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 0
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Berechnet die persönliche Baseline aus den letzten Tagen.
 * Gibt null-Werte zurück (nicht 0!), wenn für eine Größe nicht
 * genügend Daten vorhanden sind.
 */
export function computeBaseline(records: DailyRecord[]): Baseline {
  // Zeitlich sortiert, letztes Window nehmen
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  const window = sorted.slice(-BASELINE_WINDOW)

  const hrvVals = validValues(window, (r) => r.hrv.value, 'hrv')
  const rhrVals = validValues(window, (r) => r.restingHr.value, 'restingHr')

  // Schlafdaten: Dauer, onset (in Minuten seit Mitternacht)
  const sleepRecs = window.filter((r) => r.sleep !== null)
  const durVals = sleepRecs.map((r) => r.sleep!.durationMin)
  const onsetVals = sleepRecs
    .map((r) => minutesOfDay(r.sleep!.onset))
    .filter((m) => m >= 1080 || m <= 480) // plausibler Schlafbeginn 18:00–08:00
  // Konsistenz: Standardabweichung des Beginns (zirkadian-safe:
  // Werte um Mitternacht werden auf eine Achse gefaltet)
  let consistency: number | null = null
  if (onsetVals.length >= 3) {
    // Faltung: alles auf 0–720 Min Achse relativ zum Median
    const med = median(onsetVals)!
    const folded = onsetVals.map((m) => {
      let d = m - med
      if (d > 720) d -= 1440
      if (d < -720) d += 1440
      return d
    })
    consistency = stdDev(folded)
  }

  const enough = hrvVals.length >= MIN_DAYS && rhrVals.length >= MIN_DAYS
  const anySleep = sleepRecs.length >= MIN_DAYS

  return {
    hrvMs: hrvVals.length >= MIN_DAYS ? robustMean(hrvVals) : null,
    restingHrBpm: rhrVals.length >= MIN_DAYS ? robustMean(rhrVals) : null,
    sleepDurationMin: anySleep ? median(durVals) : null,
    sleepOnsetMin: anySleep ? median(onsetVals) : null,
    sleepConsistencyMin: anySleep ? consistency : null,
    computedAt: new Date().toISOString(),
    sampleDays: clamp(window.length, 0, BASELINE_WINDOW),
  }
}
