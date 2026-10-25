/**
 * Test-Fixtures: bauen DailyRecords mit kontrollierten Werten.
 * Alle Werte sind plausibel (passen die Schemas in schemas.ts),
 * damit die Baseline-Filter sie nicht verwerfen.
 */
import type { DailyRecord, SleepData, MetricSource } from '../types'

const m = (value: number | null, source: MetricSource = 'measured') => ({ value, source })

export interface SleepOpts {
  /** Dauer in Minuten */
  dur: number
  /** Schlafbeginn: Stunde/Minute (23:15 -> 23/15) */
  onsetH: number
  onsetM: number
}

export function makeRecord(
  date: string,
  opts: Partial<{
    hrv: number | null
    rhr: number | null
    activeZoneMin: number | null
    activeMin: number | null
    sleep: SleepOpts | null
  }> = {},
): DailyRecord {
  let sleep: SleepData | null = null
  const so = opts.sleep
  if (so) {
    const d = new Date(`${date}T00:00:00`)
    const onset = new Date(d)
    onset.setHours(so.onsetH, so.onsetM, 0, 0)
    const offset = new Date(onset.getTime() + so.dur * 60000)
    const awakeMin = 12
    const deepMin = Math.round(so.dur * 0.2)
    const remMin = Math.round(so.dur * 0.22)
    const lightMin = Math.max(0, so.dur - deepMin - remMin - awakeMin)
    sleep = {
      date,
      durationMin: so.dur,
      onset: onset.toISOString(),
      offset: offset.toISOString(),
      efficiencyPct: 92,
      efficiencySource: 'computed',
      stages: { deepMin, remMin, lightMin, awakeMin, source: 'measured' },
      source: 'measured',
    }
  }
  return {
    date,
    restingHr: m(opts.rhr ?? null),
    hrv: m(opts.hrv ?? null),
    spo2: m(null),
    respRate: m(null),
    skinTempDeltaC: m(null),
    activeMinutes: m(opts.activeMin === undefined ? 60 : opts.activeMin),
    activeZoneMinutes: m(opts.activeZoneMin ?? null),
    steps: m(8000),
    distanceKm: m(5.2),
    caloriesKcal: m(2100),
    vo2max: m(null),
    sleep,
    strain: null,
  }
}

/** Erzeugt N aufeinanderfolgende Tage (ISO-Daten), beginnend bei start. */
export function dateRange(start: string, n: number): string[] {
  const out: string[] = []
  const d = new Date(`${start}T12:00:00`)
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return out
}

/** 28 "ruhige" Tage: HRV ~60, RHR ~54, Schlaf ~450 Min um 23:15. */
export function calmRecords(start: string, n = 28): DailyRecord[] {
  return dateRange(start, n).map((d, i) =>
    makeRecord(d, {
      hrv: 60 + (i % 3) - 1, // 59–61
      rhr: 54 + (i % 3) - 1, // 53–55
      sleep: { dur: 440 + (i % 5) * 5, onsetH: 23, onsetM: 10 + (i % 10) },
    }),
  )
}
