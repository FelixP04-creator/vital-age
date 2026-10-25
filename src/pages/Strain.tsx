/**
 * VITAL AGE — Belastungs-Modul (Strain)
 * Tagesbelastung 0–21 (eigenes, dokumentiertes Modell),
 * Workout- vs. Alltagsanteil, Zielbereich, Verlauf, Wochenübersicht,
 * Vergleich Belastung vs. Erholung.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store/useApp'
import { computeDayScores, computeBaseline, strainTarget, STRAIN_MAX } from '../lib/scoring'
import {
  Card,
  SourceBadge,
  Segmented,
  Sparkline,
  Badge,
  PageHeader,
  LinearTrack,
} from '../ui/components'
import { fmt } from '../lib/stats'
import type { PeriodKey } from '../lib/periods'

const RANGES = [
  { value: '7d' as PeriodKey, label: '7T' },
  { value: '30d' as PeriodKey, label: '30T' },
  { value: '90d' as PeriodKey, label: '90T' },
]

export default function Strain() {
  const { records, activities } = useApp()
  const [range, setRange] = useState<PeriodKey>('7d')
  const sorted = useMemo(() => [...records].sort((a, b) => a.date.localeCompare(b.date)), [records])
  const today = new Date().toISOString().slice(0, 10)

  // Aktive Kalorien pro Tag aus importierten Aktivitäten
  const kcalByDay = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of activities) {
      if (a.caloriesKcal) m.set(a.date, (m.get(a.date) ?? 0) + a.caloriesKcal)
    }
    return m
  }, [activities])

  const scores = useMemo(() => computeDayScores(sorted, today, kcalByDay.get(today) ?? null), [sorted, today, kcalByDay])
  const rec = sorted.find((r) => r.date === today)

  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const window = useMemo(() => sorted.slice(-days), [sorted, days])
  const strainTrend = window.map((r) => {
    const kcal = kcalByDay.get(r.date) ?? null
    const s = r.strain ?? null
    if (s) return s.total
    if (kcal !== null) return Math.min(STRAIN_MAX, kcal / 25 + (r.activeZoneMinutes.value ?? 0) / 30)
    return (r.activeZoneMinutes.value ?? r.activeMinutes.value !== null ? (r.activeMinutes.value ?? 0) * 0.4 / 30 : null) as number | null
  })
  const target = strainTarget(strainTrend.filter((v): v is number => v !== null && v > 0))

  const total = scores.strain?.total ?? null
  const pct = total !== null ? (total / STRAIN_MAX) * 100 : 0
  const inTarget = total !== null && total >= target.min && total <= target.max
  const color = inTarget ? 'var(--secondary)' : total !== null && total > target.max ? 'var(--warning)' : 'var(--secondary)'

  // Belastung vs. Erholung (7 Tage)
  const compare = useMemo(
    () =>
      sorted.slice(-7).map((r) => {
        const s = computeDayScores(sorted, r.date, kcalByDay.get(r.date) ?? null)
        return { date: r.date, strain: s.strain?.total ?? null, recovery: s.recovery.score }
      }),
    [sorted, kcalByDay],
  )

  // Woche: Summen pro Wochentag (letzte 7 Tage)
  const week = compare

  return (
    <>
      <PageHeader title="Belastung" back="/" />
      <div className="page">
        {/* Tages-Strain */}
        <Card>
          <div className="row-between">
            <div>
              <div className="t-label" style={{ color: 'var(--text-variant)' }}>Tagesbelastung</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                <span className="t-metric" style={{ fontSize: 44 }}>{total !== null ? fmt(total, 1) : '–'}</span>
                <span className="t-label" style={{ color: 'var(--text-variant)' }}>/ {STRAIN_MAX}.0</span>
                {total !== null && <SourceBadge source={scores.strain!.source} />}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="t-label" style={{ color: 'var(--text-variant)' }}>Zielbereich</div>
              <div className="mono" style={{ fontSize: 14, marginTop: 4 }}>{fmt(target.min, 1)} – {fmt(target.max, 1)}</div>
              {total !== null && (
                <div style={{ marginTop: 4 }}>
                  <Badge tone={inTarget ? 'primary' : 'warning'}>
                    {inTarget ? 'im Ziel' : total > target.max ? 'über Ziel' : 'unter Ziel'}
                  </Badge>
                </div>
              )}
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <LinearTrack pct={pct} color={color} height={8} />
            <div className="row-between" style={{ marginTop: 6 }}>
              <span className="dim" style={{ fontSize: 11 }}>0</span>
              <span className="dim" style={{ fontSize: 11 }}>Ziel {target.min}–{target.max}</span>
              <span className="dim" style={{ fontSize: 11 }}>{STRAIN_MAX}</span>
            </div>
          </div>
          {scores.strain && (
            <div className="grid-2" style={{ marginTop: 10 }}>
              <div className="card card--flat" style={{ padding: '8px 10px' }}>
                <div className="dim" style={{ fontSize: 11 }}>Alltag</div>
                <div className="mono" style={{ fontSize: 18 }}>{fmt(scores.strain.activity, 1)}</div>
              </div>
              <div className="card card--flat" style={{ padding: '8px 10px' }}>
                <div className="dim" style={{ fontSize: 11 }}>Training</div>
                <div className="mono" style={{ fontSize: 18 }}>{fmt(scores.strain.workout, 1)}</div>
              </div>
            </div>
          )}
        </Card>

        {/* Verlauf */}
        <Card title="Belastungsverlauf" icon={<span style={{ color: 'var(--secondary)' }}>↗</span>}>
          <Segmented options={RANGES} value={range} onChange={setRange} />
          <div style={{ marginTop: 12 }}>
            <Sparkline values={strainTrend} color={color} height={72} baseline={(target.min + target.max) / 2} />
          </div>
          <p className="dim" style={{ fontSize: 11, marginTop: 8 }}>
            Gestrichelte Linie = Mitte deines persönlichen Zielbereichs (0.9–1.15× deines 7-Tage-Durchschnitts).
          </p>
        </Card>

        {/* Belastung vs. Erholung */}
        <Card title="Belastung vs. Erholung (7 Tage)" icon={<span style={{ color: 'var(--primary)' }}>⇄</span>}>
          {compare.filter((c) => c.strain !== null).length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Noch keine Belastungsdaten im Zeitraum.</p>
          ) : (
            <div className="stack-sm">
              {compare.map((c) => (
                <div key={c.date} className="row" style={{ gap: 10 }}>
                  <span className="mono dim" style={{ fontSize: 11, width: 52 }}>{c.date.slice(5)}</span>
                  <div style={{ flex: 1 }}>
                    <LinearTrack pct={((c.strain ?? 0) / STRAIN_MAX) * 100} color="var(--secondary)" height={5} />
                  </div>
                  <span className="mono" style={{ fontSize: 11, width: 30, textAlign: 'right' }}>{c.strain !== null ? fmt(c.strain, 1) : '–'}</span>
                  <span className="mono" style={{ fontSize: 11, width: 30, textAlign: 'right', color: c.recovery !== null && c.recovery < 40 ? 'var(--warning)' : 'var(--primary)' }}>
                    {c.recovery !== null ? fmt(c.recovery, 0) : '–'}
                  </span>
                </div>
              ))}
              <div className="row" style={{ gap: 10 }}>
                <span className="mono dim" style={{ fontSize: 10, width: 52 }}>Datum</span>
                <span className="dim" style={{ fontSize: 10, flex: 1 }}>Belastung →</span>
                <span className="dim" style={{ fontSize: 10, width: 30, textAlign: 'right' }}>Strain</span>
                <span className="dim" style={{ fontSize: 10, width: 30, textAlign: 'right' }}>Reco.</span>
              </div>
            </div>
          )}
          <p className="dim" style={{ fontSize: 11, marginTop: 8 }}>
            Ein hoher Strain-Tag mit niedrigem Recovery am Folgetag ist normal. Dauerhaft über dem Zielbereich mit fallender Erholung = Signal für mehr Puffer.
          </p>
        </Card>

        {/* Aktivitäten des Tages */}
        <Card
          title="Heutige Aktivitäten"
          icon={<span style={{ color: 'var(--tertiary)' }}>▣</span>}
          action={
            <Link to="/aktivitaet" className="muted" style={{ fontSize: 12 }}>
              Journal →
            </Link>
          }
        >
          {activities.filter((a) => a.date === today).length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Keine Aktivitäten für heute erfasst oder importiert.</p>
          ) : (
            <div className="stack-sm">
              {activities
                .filter((a) => a.date === today)
                .map((a) => (
                  <div key={a.id} className="card card--flat" style={{ padding: '10px 12px' }}>
                    <div className="row-between">
                      <div className="row" style={{ gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</span>
                        <Badge tone={a.source === 'imported' ? 'secondary' : 'neutral'}>{a.source === 'imported' ? 'importiert' : 'manuell'}</Badge>
                      </div>
                      <span className="mono" style={{ fontSize: 13 }}>{a.durationMin} min</span>
                    </div>
                    <div className="row" style={{ gap: 12, marginTop: 4 }}>
                      <span className="dim" style={{ fontSize: 11 }}>{a.type}</span>
                      {a.avgHr !== null && <span className="dim" style={{ fontSize: 11 }}>Ø {a.avgHr} bpm</span>}
                      {a.rpe !== null && <span className="dim" style={{ fontSize: 11 }}>RPE {a.rpe}/10</span>}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>

        {/* Modell-Dokumentation */}
        <Card title="Das Strain-Modell (0–21)" icon={<span>§</span>}>
          <div className="stack-sm">
            <p className="muted" style={{ fontSize: 12 }}>
              <strong>Alltagsanteil</strong> = Aktive-Zonenminuten ÷ 30 (bei Fallback: 40 % der aktiven Minuten, dann „Geschätzt“).
            </p>
            <p className="muted" style={{ fontSize: 12 }}>
              <strong>Trainingsanteil</strong> = importierte aktive Kalorien ÷ 25 (gedeckelt bei 14).
            </p>
            <p className="muted" style={{ fontSize: 12 }}>
              <strong>Gesamt</strong> = Summe, gedeckelt bei 21. Der Zielbereich richtet sich nach deinem eigenen 7-Tage-Durchschnitt.
            </p>
          </div>
          <div className="divider" />
          <p className="dim" style={{ fontSize: 11 }}>
            Dies ist ein eigenes, transparentes Modell — ausdrücklich NICHT äquivalent zum proprietären WHOOP-Strain-Algorithmus.
            Trainingsbelastung (Workout), Alltagsaktivität und Erholung werden getrennt ausgewiesen.
          </p>
        </Card>
      </div>
    </>
  )
}
