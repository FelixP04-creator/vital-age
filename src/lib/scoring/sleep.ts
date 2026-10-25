/**
 * VITAL AGE — Schlafanalyse
 * =====================================================================
 * Kennzahlen (alle an den PERSÖNLICHEN Verlauf gebunden):
 *
 *  - Schlafeffizienz  = Schlafzeit / Zeit im Bett  (wenn Bett-Zeit vorliegt,
 *    sonst aus on-/offset + Awake-Phasen abgeleitet; source: computed)
 *  - Schlafkonsistenz = 100 * clamp(1 - std(onset)/120, 0, 1)  [0..100]
 *      (Schlafbeginn schwankt um >2h => 0; zirkadiane Faltung um Mitternacht)
 *  - Schlafdefizit    = persönliche Referenzdauer (Median 14T) - heutige Dauer
 *      (positive Werte = Defizit; KEIN globaler "9 Stunden"-Maßstab)
 *  - Phase-Anteile    = nur, wenn das Gerät Phasen liefert (sonst null)
 *
 * Empfehlungsbasis (adult, AASM): 7–9 h Schlaf; Konsistenz der Zeiten
 * wird als eigener Faktor bewertet. Die App bewertet nie einzelne
 * Nächte abwertend.
 */
import type { DailyRecord, SleepSummary, MetricSource } from '../types'
import { median, stdDev, round1, clamp, mean } from '../stats'
import { minutesOfDay } from './baseline'

const AASM_RECOMMENDED_MIN = 420 // 7 h (untere Grenze, adult)
const AASM_RECOMMENDED_MAX = 540 // 9 h

/** Effizienz aus den verfügbaren Größen (null wenn nicht berechenbar). */
export function sleepEfficiency(record: DailyRecord): { pct: number | null; source: MetricSource | null } {
  const s = record.sleep
  if (!s) return { pct: null, source: null }
  const awake = s.stages.awakeMin
  if (s.efficiencyPct !== null) {
    return { pct: s.efficiencyPct, source: s.efficiencySource ?? 'measured' }
  }
  // Abgeleitet: (Dauer - wach im Bett) / Dauer
  if (awake !== null && s.durationMin > 0) {
    return { pct: clamp(((s.durationMin - awake) / s.durationMin) * 100, 0, 100), source: 'computed' }
  }
  return { pct: null, source: null }
}

/** Konsistenz der Schlafzeiten über ein Fenster (Tage). */
export function consistencyFactor(records: DailyRecord[]): number | null {
  const onsets = records
    .filter((r) => r.sleep)
    .map((r) => minutesOfDay(r.sleep!.onset))
    .filter((m) => m >= 1080 || m <= 480)
  if (onsets.length < 3) return null
  const med = median(onsets)!
  const folded = onsets.map((m) => {
    let d = m - med
    if (d > 720) d -= 1440
    if (d < -720) d += 1440
    return d
  })
  const sd = stdDev(folded)
  if (sd === null) return null
  return round1(clamp((1 - sd / 120) * 100, 0, 100))
}

/**
 * Zusammenfassung der Schlafsituation: heute im Vergleich zum
 * persönlichen Schnitt (14 Tage) + Routine-Kommentar.
 */
export function summarizeSleep(records: DailyRecord[], date: string): SleepSummary {
  const rec = records.find((r) => r.date === date) ?? null
  const window14 = records
    .filter((r) => r.sleep)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)

  const dur = rec?.sleep?.durationMin ?? null
  const effInfo = rec ? sleepEfficiency(rec) : { pct: null, source: null }

  const avgOnset = window14.length ? median(window14.map((r) => minutesOfDay(r.sleep!.onset))) : null
  const avgOffset = window14.length ? median(window14.map((r) => minutesOfDay(r.sleep!.offset))) : null

  // Defizit vs. persönlichem Schnitt (14T), abgerundet
  let deficit: number | null = null
  if (dur !== null && window14.length >= 7) {
    const ref = median(window14.map((r) => r.sleep!.durationMin))!
    deficit = Math.round(ref - dur)
  }

  const cons = consistencyFactor(records.filter((r) => r.sleep).slice(-7))

  // Routine-Kommentar (vorsichtig, beschämend-frei)
  let routine = 'Deine Schlafzeiten sind im persönlichen Schnitt stabil.'
  if (cons !== null && cons < 40) {
    routine = 'Deine Schlafzeiten schwanken in letzter Zeit. Eine stabilere Abendroutine könnte dir helfen.'
  } else if (avgOnset !== null && avgOnset > 1500) {
    routine = `Im Schnitt gehst du erst gegen ${clockStr(avgOnset)} ins Bett — das ist dein persönlicher Rhythmus, kein Fehler.`
  }
  if (deficit !== null && deficit > 60) {
    routine += ` Diese Nacht lagst du ~${Math.round(deficit / 60)} h unter deinem eigenen Schnitt.`
  }

  return {
    date,
    durationMin: dur,
    efficiencyPct: effInfo.pct !== null ? round1(effInfo.pct) : null,
    consistencyScore: cons,
    deficitMin: deficit,
    avgOnsetMin: avgOnset !== null ? Math.round(avgOnset) : null,
    avgOffsetMin: avgOffset !== null ? Math.round(avgOffset) : null,
    routineNote: routine,
  }
}

export function clockStr(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const mm = Math.round(m % 60)
  return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
}

/** Referenzbereich (AASM, Erwachsene) — NUR als Information, nicht als Urteil. */
export function aasmReference(): { min: number; max: number; note: string } {
  return {
    min: AASM_RECOMMENDED_MIN,
    max: AASM_RECOMMENDED_MAX,
    note: 'Allgemeine Empfehlung für Erwachsene (AASM): 7–9 h. Dein persönlicher Bedarf kann abweichen.',
  }
}

/** Durchschnittliche Werte für Trends (7/30/90 Tage). */
export function sleepTrend(records: DailyRecord[], days: number) {
  const recent = records
    .filter((r) => r.sleep)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days)
  if (recent.length === 0) return null
  return {
    avgDurationMin: round1(mean(recent.map((r) => r.sleep!.durationMin))!),
    avgEfficiency: round1(mean(recent.map((r) => r.sleep!.efficiencyPct ?? 0))!),
    n: recent.length,
  }
}
