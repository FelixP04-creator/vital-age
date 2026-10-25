import { describe, it, expect } from 'vitest'
import { computeBaseline } from './baseline'
import { MIN_DAYS, BASELINE_WINDOW } from './config'
import { calmRecords, makeRecord, dateRange } from '../__tests__/fixtures'

describe('baseline: persönliche Baselines aus Rolling Window', () => {
  it('MIN_DAYS & BASELINE_WINDOW sind dokumentierte Konstanten', () => {
    expect(MIN_DAYS).toBe(7)
    expect(BASELINE_WINDOW).toBe(28)
  })

  it('berechnet HRV/RHR-Baseline nahe der stabilen Werte', () => {
    const recs = calmRecords('2026-09-01') // 28 Tage, HRV 59–61, RHR 53–55
    const b = computeBaseline(recs)
    expect(b.hrvMs).not.toBeNull()
    expect(b.restingHrBpm).not.toBeNull()
    expect(b.hrvMs!).toBeGreaterThanOrEqual(58)
    expect(b.hrvMs!).toBeLessThanOrEqual(62)
    expect(b.restingHrBpm!).toBeGreaterThanOrEqual(52)
    expect(b.restingHrBpm!).toBeLessThanOrEqual(56)
    expect(b.sampleDays).toBe(28)
  })

  it('Schlaf-Baseline: Dauer & Beginn aus den Nachten', () => {
    const recs = calmRecords('2026-09-01')
    const b = computeBaseline(recs)
    expect(b.sleepDurationMin).not.toBeNull()
    expect(b.sleepDurationMin!).toBeGreaterThan(400)
    expect(b.sleepDurationMin!).toBeLessThan(500)
    expect(b.sleepOnsetMin).not.toBeNull()
    // 23:10–23:19 => ca. 1390–1399 Minuten
    expect(b.sleepOnsetMin!).toBeGreaterThan(1380)
    expect(b.sleepOnsetMin!).toBeLessThan(1410)
  })

  it('nur das letzte Window zählt (ältere Werte fließen nicht ein)', () => {
    const dates = dateRange('2026-07-01', 60)
    // erste 32 Tage HRV 100, letzte 28 Tage HRV 60
    const recs = dates.map((d, i) =>
      makeRecord(d, {
        hrv: i < 32 ? 100 : 60,
        rhr: 54,
        sleep: { dur: 450, onsetH: 23, onsetM: 15 },
      }),
    )
    const b = computeBaseline(recs)
    // Baseline muss aus den LETZTEN 28 Tagen kommen (HRV ~60, nicht 100)
    expect(b.hrvMs!).toBeLessThan(70)
    expect(b.sampleDays).toBe(BASELINE_WINDOW)
  })

  it('fehlende Werte -> null, niemals 0', () => {
    const recs = dateRange('2026-09-01', 10).map((d) =>
      makeRecord(d, { hrv: null, rhr: null, sleep: null }),
    )
    const b = computeBaseline(recs)
    expect(b.hrvMs).toBeNull()
    expect(b.restingHrBpm).toBeNull()
    expect(b.sleepDurationMin).toBeNull()
  })
})
