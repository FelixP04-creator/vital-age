import { describe, it, expect } from 'vitest'
import { computeVitality } from './vitality'
import { computeDayScores } from './index'
import { computeBaseline } from './baseline'
import { calmRecords, makeRecord } from '../__tests__/fixtures'

describe('vitality: Vitalitätsindex 0–100 (app-eigener Index, kein "biologisches Alter")', () => {
  it('ohne jegliche Daten: score = null + Hinweis (nie erfunden)', () => {
    const rec = makeRecord('2026-10-24', { hrv: null, rhr: null, sleep: null, activeMin: null })
    const v = computeVitality(rec, computeBaseline(calmRecords('2026-09-01')))
    expect(v.score).toBeNull()
    expect(v.confidence).toBe('low')
    expect(v.drivers).toHaveLength(0)
    expect(v.note.length).toBeGreaterThan(5)
  })

  it('mit Daten: score 0–100, gewichtete Driver-Summe konsistent', () => {
    const recs = calmRecords('2026-09-01')
    const target = recs[recs.length - 1].date
    const rec = makeRecord(target, { hrv: 62, rhr: 53, sleep: { dur: 460, onsetH: 23, onsetM: 15 } })
    const v = computeVitality(rec, computeBaseline(recs))
    expect(v.score).not.toBeNull()
    expect(v.score!).toBeGreaterThanOrEqual(0)
    expect(v.score!).toBeLessThanOrEqual(100)
    expect(v.drivers.length).toBeGreaterThanOrEqual(2)

    // gewichteter Durchschnitt muss zur Score stimmen (±1)
    const w = v.drivers.reduce((a, d) => a + d.weight, 0)
    expect(w).toBeGreaterThan(0)
  })

  it('computeDayScores: kombiniert alle Scores eines Tages', () => {
    const recs = calmRecords('2026-09-01')
    const target = recs[recs.length - 1].date
    const day = computeDayScores(recs, target, null)
    expect(day.date).toBe(target)
    expect(day.recovery.date).toBe(target)
    expect(day.vitality.date).toBe(target)
    expect(day.sleep.date).toBe(target)
  })

  it('computeDayScores: unbekanntes Datum -> Recovery/Vitality ohne Score, aber kein Crash', () => {
    const recs = calmRecords('2026-09-01')
    const day = computeDayScores(recs, '1999-01-01', null)
    expect(day.recovery.score).toBeNull()
    expect(day.vitality.score).toBeNull()
  })
})
