import { describe, it, expect } from 'vitest'
import { activityStrain, workoutStrain, computeStrain, strainTarget, STRAIN_MAX } from './strain'
import { makeRecord } from '../__tests__/fixtures'

describe('strain: Belastungsscore 0–21 (eigenes Modell)', () => {
  it('STRAIN_MAX ist 21 (dokumentierte Skala)', () => {
    expect(STRAIN_MAX).toBe(21)
  })

  it('activityStrain: Zonenminuten messen direkt (4 min Zone = 1 Strain)', () => {
    expect(activityStrain(90, null)).toEqual({ value: 3, estimated: false })
  })

  it('activityStrain: ohne Zonenminuten wird aus aktiven Minuten GESCHÄTZT (40 %)', () => {
    const r = activityStrain(null, 60)
    expect(r.value).toBeCloseTo(0.8, 5)
    expect(r.estimated).toBe(true)
  })

  it('activityStrain: ohne Daten -> 0, keine Schätzung', () => {
    expect(activityStrain(null, null)).toEqual({ value: 0, estimated: false })
  })

  it('workoutStrain: exportierte kcal / 25, gedeckelt bei 14', () => {
    expect(workoutStrain(null)).toEqual({ value: 0, estimated: false })
    expect(workoutStrain(250).value).toBe(10)
    expect(workoutStrain(2000).value).toBe(14)
  })

  it('computeStrain: Summe wird auf 0–21 geklemmt', () => {
    const rec = makeRecord('2026-10-24', { activeZoneMin: 120 }) // 4 Strain
    const s = computeStrain(rec, 350) // + 14 Workout
    expect(s.total).toBe(18)
    expect(s.total).toBeLessThanOrEqual(STRAIN_MAX)

    // Extrem-Tag: 600 Zonenminuten + 2000 kcal => clamp auf 21
    const rec2 = makeRecord('2026-10-24', { activeZoneMin: 600 })
    expect(computeStrain(rec2, 2000).total).toBe(21)
  })

  it('strainTarget: ohne genug Geschichte -> Standardbereich 5–12', () => {
    expect(strainTarget([8])).toEqual({ min: 5, max: 12 })
    expect(strainTarget([])).toEqual({ min: 5, max: 12 })
  })

  it('strainTarget: aus Durchschnitt (±10/15 %), Null-Tage werden ignoriert', () => {
    const t = strainTarget([10, 10, 10, 0])
    expect(t.min).toBe(9)
    expect(t.max).toBe(11.5)
    expect(t.min).toBeLessThan(t.max)
  })
})
