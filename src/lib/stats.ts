/**
 * VITAL AGE — Statistik-Helfer (reine Funktionen, getestet).
 */

export function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

/** Stichproben-Standardabweichung (n-1); null bei <2 Werten. */
export function stdDev(values: number[]): number | null {
  if (values.length < 2) return null
  const m = mean(values)
  if (m === null) return null
  const varr = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(varr)
}

/** Robuster Mittelwert: entfernt je einen Extremwert (wenn n>=4). */
export function robustMean(values: number[]): number | null {
  if (values.length === 0) return null
  if (values.length < 4) return mean(values)
  const s = [...values].sort((a, b) => a - b)
  return mean(s.slice(1, -1))
}

/**
 * Trend über Zeit: einfachste Regressionssteigung (Einheit pro Schritt).
 * steps = Indexreihenfolge (z. B. Tage). null bei <3 Punkten.
 */
export function linearTrend(values: number[]): number | null {
  const n = values.length
  if (n < 3) return null
  const xs = values.map((_, i) => i)
  const mx = mean(xs)!
  const my = mean(values)!
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (values[i] - my)
    den += (xs[i] - mx) ** 2
  }
  if (den === 0) return null
  return num / den
}

/** Moving Average; k=3 ist der Standard für Tagesdaten. */
export function movingAverage(values: number[], k = 3): (number | null)[] {
  return values.map((_, i) => {
    if (i + 1 < k) return null
    return mean(values.slice(i - k + 1, i + 1))
  })
}

export function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x))
}

/**
 * Lineare Skalierung von [inMin,inMax] auf [0,100].
 * WICHTIG: wird für relative Scores verwendet, die sich an den
 * PERSÖNLICHEN Basiswert orientieren (keine globalen Grenzwerte).
 */
export function scaleTo100(value: number, inMin: number, inMax: number): number {
  if (inMax === inMin) return 100
  return clamp(((value - inMin) / (inMax - inMin)) * 100, 0, 100)
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10
}

export function round2(x: number): number {
  return Math.round(x * 100) / 100
}

/** Format: 96.4 -> "96" (keine falsche Präzision) */
export function fmt(x: number | null, digits = 0): string {
  if (x === null || Number.isNaN(x)) return '–'
  return x.toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** Minuten -> "7h 24m" */
export function fmtMin(min: number | null): string {
  if (min === null || Number.isNaN(min)) return '–'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

/** Minuten seit Mitternacht -> "23:15" */
export function fmtClock(min: number | null): string {
  if (min === null || Number.isNaN(min)) return '–'
  const h = Math.floor(((min % 1440) + 1440) % 1440 / 60)
  const m = Math.round((((min % 1440) + 1440) % 1440) % 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}
