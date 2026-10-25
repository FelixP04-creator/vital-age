import { describe, it, expect } from 'vitest'
import { sleepEfficiency, consistencyFactor, summarizeSleep } from './sleep'
import { calmRecords, makeRecord } from '../__tests__/fixtures'

describe('sleep: Schlafzusammenfassung (persönlich, keine globalen Grenzwerte)', () => {
  it('sleepEfficiency: null bei fehlendem Schlaf', () => {
    const rec = makeRecord('2026-10-24', { sleep: null })
    expect(sleepEfficiency(rec).pct).toBeNull()
  })

  it('sleepEfficiency: gemessener Wert wird weitergegeben (measured)', () => {
    const rec = makeRecord('2026-10-24', { sleep: { dur: 450, onsetH: 23, onsetM: 15 } })
    const e = sleepEfficiency(rec)
    expect(e.pct).toBe(92)
    expect(e.source).toBe('computed')
  })

  it('summarizeSleep: Dauer & Zeiten aus den eigenen Daten', () => {
    const recs = calmRecords('2026-09-01')
    const target = recs[recs.length - 1].date
    const s = summarizeSleep(recs, target)
    expect(s.date).toBe(target)
    expect(s.durationMin).not.toBeNull()
    expect(s.durationMin!).toBeGreaterThan(400)
    expect(s.avgOnsetMin).not.toBeNull()
    expect(s.avgOffsetMin).not.toBeNull()
    // Onset ist abends (>= 18:00), Offset ist morgens (< 10:00)
    expect(s.avgOnsetMin!).toBeGreaterThanOrEqual(1080)
    expect(s.avgOffsetMin!).toBeLessThan(600)
    // Chronologie: Offset ≈ Onset + Dauer (Tagesbruch, mod 1440)
    const expected = (s.avgOnsetMin! + s.durationMin!) % 1440
    const d = Math.abs(s.avgOffsetMin! - expected)
    expect(Math.min(d, 1440 - d)).toBeLessThan(90)
    expect(s.routineNote.length).toBeGreaterThan(0)
  })

  it('summarizeSleep: Defizit vs. eigener Schnitt (negative Zahl = unter Durchschnitt)', () => {
    const recs = calmRecords('2026-09-01')
    const target = recs[recs.length - 1].date
    // letzten Tag kürzer schlafen lassen
    recs[recs.length - 1] = makeRecord(target, {
      hrv: 60, rhr: 54,
      sleep: { dur: 330, onsetH: 1, onsetM: 10 },
    })
    const s = summarizeSleep(recs, target)
    expect(s.deficitMin).not.toBeNull()
    expect(s.deficitMin!).toBeGreaterThan(30)
  })

  it('consistencyFactor: stabile Schlafzeiten -> hohe Konsistenz, chaotische -> niedrig', () => {
    const stable = calmRecords('2026-09-01', 7)
    const stableFactor = consistencyFactor(stable)
    expect(stableFactor).not.toBeNull()
    expect(stableFactor!).toBeGreaterThan(70)

    const chaotic = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07'].map(
      (d, i) => makeRecord(d, { hrv: 60, rhr: 54, sleep: { dur: 440, onsetH: i % 2 === 0 ? 22 : 1, onsetM: 0 } }),
    )
    const chaoticFactor = consistencyFactor(chaotic)
    expect(chaoticFactor).not.toBeNull()
    expect(chaoticFactor!).toBeLessThan(stableFactor!)
  })

  it('consistencyFactor: zu wenige Tage (<2) -> null (nie geschätzt)', () => {
    expect(consistencyFactor(calmRecords('2026-09-01', 1))).toBeNull()
    expect(consistencyFactor([])).toBeNull()
  })
})
