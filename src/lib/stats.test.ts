import { describe, it, expect } from 'vitest'
import {
  mean, median, stdDev, clamp, scaleTo100, linearTrend, movingAverage,
  fmt, fmtMin, fmtClock, round1, round2,
} from './stats'

describe('stats: robuste Mittelwerte', () => {
  it('mean: arithmetisches Mittel', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5)
  })

  it('mean: leeres Array -> null (keine erfundenen Werte)', () => {
    expect(mean([])).toBeNull()
  })

  it('median: ungerade/gerade Länge', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNull()
  })

  it('stdDev: Stichproben-Standardabweichung (n-1)', () => {
    // mean=5, Σ(v-μ)²=32, /(8-1)=4.571 → 2.138
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])!).toBeCloseTo(2.13809, 3)
    expect(stdDev([])).toBeNull()
    expect(stdDev([5])).toBeNull() // <2 Werte -> null (nie erfunden)
  })
})

describe('stats: clamp & Skalierung', () => {
  it('clamp: Wert in den Grenzen', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(42, 0, 10)).toBe(10)
  })

  it('scaleTo100: lineare Skalierung auf 0–100', () => {
    expect(scaleTo100(50, 0, 100)).toBe(50)
    expect(scaleTo100(-10, 0, 100)).toBe(0)
    expect(scaleTo100(200, 0, 100)).toBe(100)
  })

  it('scaleTo100: entarteter Bereich (min==max) -> 100', () => {
    expect(scaleTo100(7, 7, 7)).toBe(100)
  })
})

describe('stats: Trends', () => {
  it('linearTrend: steigende Serie -> positiv', () => {
    const t = linearTrend([10, 12, 14, 16, 18])
    expect(t).not.toBeNull()
    expect(t!).toBeGreaterThan(0)
  })

  it('linearTrend: konstante Serie -> 0', () => {
    const t = linearTrend([5, 5, 5, 5])
    expect(t).not.toBeNull()
    expect(Math.abs(t!)).toBeLessThan(0.001)
  })

  it('movingAverage: Fenstergröße k, am Anfang null', () => {
    const ma = movingAverage([1, 2, 3, 4, 5], 3)
    expect(ma[0]).toBeNull()
    expect(ma[1]).toBeNull()
    expect(ma[2]).toBe(2)
    expect(ma[4]).toBeCloseTo(4, 5)
  })
})

describe('stats: Formatierung (de-DE, null = „–“)', () => {
  it('fmt: null -> Gedankenstrich (Prinzip: nie 0 bei fehlenden Daten)', () => {
    expect(fmt(null)).toBe('–')
    expect(fmt(1234.5, 1)).toBe('1.234,5')
  })

  it('fmtMin: Minuten in Stunden/Minuten', () => {
    expect(fmtMin(null)).toBe('–')
    expect(fmtMin(90)).toBe('1h 30m')
    expect(fmtMin(45)).toBe('45m')
  })

  it('fmtClock: Minuten seit Mitternacht -> Uhrzeit', () => {
    expect(fmtClock(null)).toBe('–')
    expect(fmtClock(23 * 60 + 15)).toBe('23:15')
    expect(fmtClock(0)).toBe('00:00')
  })

  it('round1/round2: Nachkommastellen', () => {
    expect(round1(3.456)).toBe(3.5)
    expect(round2(3.4567)).toBe(3.46)
  })
})
