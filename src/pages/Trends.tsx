/**
 * VITAL AGE — Trends (alle Kennzahlen über Zeit)
 * Heute / 7T / 30T / 90T / 1J (1J nur bei genügend Historie).
 */
import { useMemo, useState } from 'react'
import { useApp } from '../store/useApp'
import { computeBaseline } from '../lib/scoring'
import {
  Card,
  Segmented,
  Sparkline,
  PageHeader,
} from '../ui/components'
import { PERIODS, periodDays, type PeriodKey } from '../lib/periods'
import { fmt, linearTrend, mean } from '../lib/stats'

export default function Trends() {
  const records = useApp((s) => s.records)
  const [period, setPeriod] = useState<PeriodKey>('30d')
  const sorted = useMemo(() => [...records].sort((a, b) => a.date.localeCompare(b.date)), [records])
  const baseline = useMemo(() => computeBaseline(sorted), [records.length ? sorted : sorted])
  const days = periodDays(period)
  const window = useMemo(() => sorted.slice(-days), [sorted, days])
  const n = window.length
  const has1y = sorted.length >= 180

  const series = useMemo(
    () => ({
      hrv: window.map((r) => r.hrv.value),
      rhr: window.map((r) => r.restingHr.value),
      sleep: window.map((r) => r.sleep?.durationMin ?? null),
      spo2: window.map((r) => r.spo2.value),
      active: window.map((r) => r.activeMinutes.value),
      steps: window.map((r) => r.steps.value),
      vo2: window.map((r) => r.vo2max.value),
    }),
    [window],
  )

  const rows: { key: keyof typeof series; label: string; color: string; unit: string; baseline?: number | null; invert?: boolean; decimals?: number }[] = [
    { key: 'hrv', label: 'HRV', color: 'var(--primary)', unit: 'ms', baseline: baseline.hrvMs },
    { key: 'rhr', label: 'Ruhe-HF', color: 'var(--secondary)', unit: 'bpm', baseline: baseline.restingHrBpm, invert: true },
    { key: 'sleep', label: 'Schlafdauer', color: 'var(--tertiary)', unit: 'min', baseline: baseline.sleepDurationMin },
    { key: 'spo2', label: 'SpO₂', color: 'var(--info)', unit: '%' },
    { key: 'active', label: 'Aktive Minuten', color: 'var(--warning)', unit: 'min' },
    { key: 'steps', label: 'Schritte', color: 'var(--primary)', unit: '' },
    { key: 'vo2', label: 'VO₂max', color: 'var(--tertiary)', unit: 'ml/kg/min', decimals: 1 },
  ]

  return (
    <>
      <PageHeader title="Trends" back="/" />
      <div className="page">
        <Card>
          <Segmented
            options={PERIODS.filter((p) => (p.key !== '1y' ? true : has1y)).map((p) => ({ value: p.key, label: p.label }))}
            value={period}
            onChange={setPeriod}
          />
          <p className="dim" style={{ fontSize: 11, marginTop: 8 }}>
            {n} von {days} Tagen mit Daten. 1J erscheint erst ab ~6 Monaten Historie (keine halben Kurven).
          </p>
        </Card>

        <Card title="Kennzahlen im Verlauf" icon={<span style={{ color: 'var(--tertiary)' }}>↗</span>}>
          <div className="stack-sm" style={{ gap: 16 }}>
            {rows.map((r) => (
              <TrendChart key={r.key} label={r.label} values={series[r.key]} color={r.color} unit={r.unit} baseline={r.baseline ?? null} invert={r.invert} decimals={r.decimals ?? 0} />
            ))}
          </div>
        </Card>

        <Card title="Wie zu lesen" icon={<span>§</span>}>
          <ul className="muted" style={{ fontSize: 12, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <li>Gestrichelte Linie = deine persönliche Baseline (robuster Median, 28 Tage) — wo möglich.</li>
            <li>Lücken in der Kurve = Tage ohne Messwert (keine 0!).</li>
            <li>Kurzfristige Sprünge sind normal; entscheidend ist die Richtung über Wochen.</li>
            <li>Trends sind app-eigene Auswertungen (computed), keine medizinischen Befunde.</li>
          </ul>
        </Card>
      </div>
    </>
  )
}

function TrendChart({
  label,
  values,
  color,
  unit,
  baseline,
  invert,
  decimals,
}: {
  label: string
  values: (number | null)[]
  color: string
  unit: string
  baseline?: number | null
  invert?: boolean
  decimals?: number
}) {
  const nums = values.filter((v): v is number => v !== null)
  const last = nums.at(-1) ?? null
  const avg = nums.length ? mean(nums) : null
  const trend = linearTrend(nums)
  const trendGood = trend === null ? null : invert ? trend < 0 : trend > 0
  return (
    <div>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <span className="muted" style={{ fontSize: 12 }}>{label} ({unit})</span>
        <span className="mono" style={{ fontSize: 12, color }}>
          {last !== null ? fmt(last, decimals) : '–'}
          {avg !== null && <span className="dim"> · Ø {fmt(avg, decimals)}</span>}
          {trend !== null && Math.abs(trend) > 0.01 && (
            <span style={{ color: trendGood ? 'var(--primary)' : 'var(--warning)', marginLeft: 6 }}>
              {trend > 0 ? '▲' : '▼'} {fmt(Math.abs(trend), 1)}/T
            </span>
          )}
        </span>
      </div>
      <Sparkline values={values} color={color} baseline={baseline ?? undefined} height={64} />
    </div>
  )
}
