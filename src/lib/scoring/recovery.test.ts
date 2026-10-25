import { describe, it, expect } from 'vitest'
import { computeRecovery } from './recovery'
import { computeBaseline } from './baseline'
import { calmRecords, makeRecord } from '../__tests__/fixtures'

describe('recovery: Erholungsscore 0–100', () => {
  it('ohne HRV & RHR: score = null (keine erfundenen Werte), Erklärung vorhanden', () => {
    const rec = makeRecord('2026-10-24', { hrv: null, rhr: null, sleep: null })
    const recs = calmRecords('2026-09-01')
    const r = computeRecovery({ record: rec, baseline: computeBaseline(recs), consistencyFactor: null })
    expect(r.score).toBeNull()
    expect(r.confidence).toBe('low')
    expect(r.drivers).toHaveLength(0)
    expect(r.explanation.length).toBeGreaterThan(10)
    expect(r.availableInputs).toBeLessThan(r.requiredInputs)
  })

  it('mit guten Werten: score im gültigen Bereich, Drivers vorhanden', () => {
    const recs = calmRecords('2026-09-01')
    const target = recs[recs.length - 1].date
    const rec = makeRecord(target, {
      hrv: 64, // über Baseline (~60)
      rhr: 51, // unter Baseline (~54) => gut erholt
      sleep: { dur: 470, onsetH: 23, onsetM: 15 },
    })
    const r = computeRecovery({ record: rec, baseline: computeBaseline(recs), consistencyFactor: 80 })
    expect(r.score).not.toBeNull()
    expect(r.score!).toBeGreaterThanOrEqual(0)
    expect(r.score!).toBeLessThanOrEqual(100)
    expect(r.drivers.length).toBeGreaterThan(0)
    for (const d of r.drivers) {
      expect(['good', 'bad', 'neutral']).toContain(d.direction)
      expect(d.weight).toBeGreaterThan(0)
    }
  })

  it('schlechter Tag (niedrige HRV, hohe RHR) => deutlich schlechter als guter Tag', () => {
    const recs = calmRecords('2026-09-01')
    const target = recs[recs.length - 1].date
    const base = computeBaseline(recs)
    const good = computeRecovery({
      record: makeRecord(target, { hrv: 66, rhr: 50, sleep: { dur: 480, onsetH: 23, onsetM: 15 } }),
      baseline: base,
      consistencyFactor: 85,
    })
    const bad = computeRecovery({
      record: makeRecord(target, { hrv: 48, rhr: 62, sleep: { dur: 350, onsetH: 0, onsetM: 40 } }),
      baseline: base,
      consistencyFactor: 40,
    })
    expect(good.score).not.toBeNull()
    expect(bad.score).not.toBeNull()
    expect(good.score!).toBeGreaterThan(bad.score!)
  })
})
