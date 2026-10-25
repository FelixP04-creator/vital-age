/**
 * VITAL AGE — Home / Dashboard (zentrale Startseite)
 * Tagesübersicht mit großen Kennzahlen, Quellen-Kennzeichnung
 * (gemessen/berechnet/geschätzt), Recovery-/Strain-/Schlaf-Karten,
 * Vitals, Trend-Verlauf und Verlinkung zu allen Modulen.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store/useApp'
import { computeDayScores, computeBaseline } from '../lib/scoring'
import {
  Card,
  ScoreRing,
  SourceBadge,
  Segmented,
  Sparkline,
  SyncBar,
  Badge,
  LinearTrack,
  Delta,
} from '../ui/components'
import { PERIODS, periodDays, type PeriodKey } from '../lib/periods'
import { fmt, fmtMin } from '../lib/stats'

export default function Home() {
  const { records, connection, period, setPeriod, profile } = useApp()
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const sorted = useMemo(() => [...records].sort((a, b) => a.date.localeCompare(b.date)), [records])
  const scores = useMemo(() => computeDayScores(sorted, today), [sorted, today])
  const baseline = useMemo(() => computeBaseline(sorted), [sorted])
  const rec = sorted.find((r) => r.date === today)

  const days = periodDays(period)
  const window = useMemo(() => sorted.slice(-days), [sorted, days])

  const hrvTrend = window.map((r) => r.hrv.value)
  const rhrTrend = window.map((r) => r.restingHr.value)
  const sleepTrend = window.map((r) => r.sleep?.durationMin ?? null)
  const strainTrend = window.map((r) => {
    if (!r.strain && r.activeMinutes.value === null) return null
    return r.strain?.total ?? Math.min(21, (r.activeMinutes.value ?? 0) / 30)
  })

  const recScore = scores.recovery.score
  const recColor = recScore === null ? 'var(--text-dim)' : recScore >= 67 ? 'var(--primary)' : recScore >= 33 ? 'var(--warning)' : 'var(--error)'

  const dateLabel = new Date(today + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <>
      <div className="topbar" style={{ padding: '12px 16px 0' }}>
        <div>
          <div className="row" style={{ gap: 6 }}>
            <h1>VITAL AGE</h1>
            <Badge tone="neutral">PWA</Badge>
          </div>
          <div className="crumbs">{dateLabel}</div>
        </div>
        <Link to="/einstellungen" className="icon-btn" aria-label="Einstellungen">⚙</Link>
      </div>

      <div className="page">
        <SyncBar device={connection.device} lastSyncAt={connection.lastSyncAt} status={connection.status} demoMode={connection.demoMode} />

        {connection.demoMode && (
          <div className="demo-banner" role="status">
            <span className="icon">⚠</span>
            <span>Demo-Modus: Es werden klar gekennzeichnete Beispieldaten angezeigt — keine echte Fitbit-Verbindung.</span>
          </div>
        )}

        {/* Vitalitäts-Indikator Banner */}
        <Link to="/vitalitaet" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, var(--card) 0%, var(--card-high) 100%)' }}>
            <div style={{ position: 'absolute', right: -40, bottom: -40, width: 140, height: 140, borderRadius: '50%', background: 'var(--primary-soft)', filter: 'blur(30px)', pointerEvents: 'none' }} />
            <div className="row-between" style={{ position: 'relative' }}>
              <div className="stack-sm" style={{ gap: 4 }}>
                <div className="row" style={{ gap: 6 }}>
                  <span style={{ color: 'var(--primary)' }}>✦</span>
                  <span className="t-badge" style={{ color: 'var(--primary)' }}>Vitalitätsindex</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span className="t-metric" style={{ fontSize: 40, color: 'var(--text)' }}>{scores.vitality.score ?? '–'}</span>
                  <span className="t-label" style={{ color: 'var(--text-variant)' }}>/ 100</span>
                  {scores.vitality.score !== null && (
                    <span className="badge badge--neutral" style={{ marginLeft: 6 }}>app-eigen</span>
                  )}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {profile.birthDate
                    ? `Kalenderalter: ${calcAge(profile.birthDate)} J. — der Index ist KEIN biologisches Alter.`
                    : 'App-eigener Indikator über deine Messwerte — kein biologisches Alter.'}
                </div>
              </div>
              <div style={{ fontSize: 22, color: 'var(--text-dim)' }}>→</div>
            </div>
          </div>
        </Link>

        {/* Recovery */}
        <Link to="/recovery" style={{ textDecoration: 'none' }}>
          <div className="card">
            <div className="card-title">
              <div className="row" style={{ gap: 8 }}>
                <span style={{ color: recColor }}>♡</span>
                <h2>Recovery</h2>
              </div>
              {recScore !== null && (
                <Badge tone={recScore >= 67 ? 'primary' : recScore >= 33 ? 'warning' : 'error'}>
                  {recScore >= 67 ? 'Optimal' : recScore >= 33 ? 'Mäßig' : 'Defizit'}
                </Badge>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ScoreRing score={recScore} size={116} color={recColor} label="Score" />
              <div className="stack-sm" style={{ flex: 1, gap: 8 }}>
                <div className="row-between">
                  <span className="muted" style={{ fontSize: 12 }}>HRV</span>
                  <span className="mono" style={{ fontSize: 14 }}>
                    {fmt(rec?.hrv.value ?? null, 0)} ms {rec?.hrv.value !== null && <SourceBadge source={rec!.hrv.source} />}
                  </span>
                </div>
                <div className="row-between">
                  <span className="muted" style={{ fontSize: 12 }}>Ruhe-HF</span>
                  <span className="mono" style={{ fontSize: 14 }}>
                    {fmt(rec?.restingHr.value ?? null, 0)} bpm {rec?.restingHr.value !== null && <SourceBadge source={rec!.restingHr.source} />}
                  </span>
                </div>
                <div className="row-between">
                  <span className="muted" style={{ fontSize: 12 }}>Trend</span>
                  <Delta value={deltaVsBaseline(rec?.hrv.value ?? null, baseline.hrvMs)} unit="%" invert={false} />
                </div>
              </div>
            </div>
          </div>
        </Link>

        {/* Strain + Sleep Zeile */}
        <div className="grid-2">
          <Link to="/belastung" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ height: '100%' }}>
              <div className="card-title">
                <h2 style={{ fontSize: 14 }}>⚡ Strain</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span className="t-metric" style={{ fontSize: 30 }}>{scores.strain?.total ?? '–'}</span>
                <span className="t-label" style={{ color: 'var(--text-variant)' }}>/ 21</span>
              </div>
              <LinearTrack pct={((scores.strain?.total ?? 0) / 21) * 100} color="var(--secondary)" />
              <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                {scores.strain
                  ? `${Math.round(scores.strain.activity)} Alltag · ${Math.round(scores.strain.workout)} Training`
                  : 'Heute noch keine belastenden Daten'}
              </div>
            </div>
          </Link>
          <Link to="/schlaf" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ height: '100%' }}>
              <div className="card-title">
                <h2 style={{ fontSize: 14 }}>☾ Schlaf</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span className="t-metric" style={{ fontSize: 30 }}>{scores.sleep.durationMin !== null ? fmtMin(scores.sleep.durationMin) : '–'}</span>
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                {scores.sleep.efficiencyPct !== null ? `Effizienz ${fmt(scores.sleep.efficiencyPct, 0)} %` : 'Keine Daten'}
              </div>
              <div className="muted" style={{ fontSize: 11 }}>
                {scores.sleep.avgOnsetMin !== null && scores.sleep.avgOffsetMin !== null
                  ? `Ø ${clock(scores.sleep.avgOnsetMin)}–${clock(scores.sleep.avgOffsetMin)}`
                  : ''}
              </div>
            </div>
          </Link>
        </div>

        {/* Vitals Grid */}
        <Card title="Vitals heute" icon={<span style={{ color: 'var(--secondary)' }}>+</span>}>
          <div className="stat-grid">
            <Stat k="Schritte" v={fmt(rec?.steps.value ?? null)} s="schritte" src={rec?.steps.source} />
            <Stat k="Aktive Min" v={fmt(rec?.activeMinutes.value ?? null)} s="min" src={rec?.activeMinutes.source} />
            <Stat k="SpO₂" v={fmt(rec?.spo2.value ?? null)} s="%" src={rec?.spo2.source} />
            <Stat k="VO₂max" v={fmt(rec?.vo2max.value ?? null, 1)} s="ml/kg/min" src={rec?.vo2max.source} />
          </div>
        </Card>

        {/* Trend-Verlauf mit Zeitraum-Wahl */}
        <Card
          title="Persönliche Trends"
          icon={<span style={{ color: 'var(--tertiary)' }}>↗</span>}
          action={
            <Link to="/trends" className="muted" style={{ fontSize: 12 }}>
              Alle →
            </Link>
          }
        >
          <Segmented options={PERIODS.filter((p) => p.key !== 'today').map((p) => ({ value: p.key as PeriodKey, label: p.label }))} value={period === 'today' ? '7d' : period} onChange={(v) => setPeriod(v)} />
          <div className="stack-sm" style={{ gap: 14, marginTop: 12 }}>
            <TrendRow label="HRV (ms)" values={hrvTrend} color="var(--primary)" baseline={baseline.hrvMs} />
            <TrendRow label="Ruhe-HF (bpm)" values={rhrTrend} color="var(--secondary)" baseline={baseline.restingHrBpm} invert />
            <TrendRow label="Schlaf (min)" values={sleepTrend} color="var(--tertiary)" baseline={baseline.sleepDurationMin} />
            <TrendRow label="Strain (0–21)" values={strainTrend} color="var(--warning)" baseline={null} />
          </div>
          <p className="dim" style={{ fontSize: 11, marginTop: 10 }}>
            Gestrichelte Linie = deine persönliche Baseline (robuster Median, 28 Tage). Werte unterhalb von 7 Tagen sind nicht verlässlich.
          </p>
        </Card>

        {/* Schnellzugriff */}
        <div className="card">
          <div className="card-title">
            <h2>Module</h2>
          </div>
          <div className="tag-row">
            <ModLink to="/food" icon="🍽" label="Food Log" />
            <ModLink to="/coach" icon="✳" label="KI-Coach" />
            <ModLink to="/aktivitaet" icon="▣" label="Aktivität" />
            <ModLink to="/evidenz" icon="§" label="Evidenz" />
            <ModLink to="/perspektiven" icon="◐" label="Perspektiven" />
            <ModLink to="/absorption" icon="∿" label="Absorption" />
          </div>
        </div>

        <p className="dim" style={{ fontSize: 11, textAlign: 'center', padding: '8px 16px' }}>
          VITAL AGE ist ein Wellness-Werkzeug, kein Medizinprodukt. Es stellt keine Diagnosen.
        </p>
      </div>
    </>
  )
}

/* ------------------------- Teil-Komponenten ------------------------- */

function Stat({ k, v, s, src }: { k: string; v: string; s: string; src?: 'measured' | 'computed' | 'estimated' }) {
  return (
    <div className="stat">
      <div className="k">{k} {src && v !== '–' && <SourceBadge source={src} />}</div>
      <div className="v">
        {v} <small>{s}</small>
      </div>
    </div>
  )
}

function TrendRow({ label, values, color, baseline, invert }: { label: string; values: (number | null)[]; color: string; baseline: number | null; invert?: boolean }) {
  const nums = values.filter((v): v is number => v !== null)
  const last = nums.at(-1) ?? null
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
  return (
    <div>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <span className="muted" style={{ fontSize: 12 }}>{label}</span>
        <span className="mono" style={{ fontSize: 12, color }}>
          {last !== null ? fmt(last, 0) : '–'}
          {avg !== null && last !== null && (
            <span className="dim" style={{ marginLeft: 6 }}>Ø {fmt(avg, 0)}</span>
          )}
        </span>
      </div>
      <Sparkline values={values} color={color} baseline={baseline ?? undefined} />
      {invert && <div style={{ visibility: 'hidden' }} />}
    </div>
  )
}

function ModLink({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link to={to} className="badge badge--neutral" style={{ padding: '6px 10px', fontSize: 11, textTransform: 'none' }}>
      <span style={{ marginRight: 4 }}>{icon}</span>
      {label}
    </Link>
  )
}

function deltaVsBaseline(v: number | null, base: number | null): number | null {
  if (v === null || base === null || base === 0) return null
  return Math.round(((v / base - 1) * 100) * 10) / 10
}

function clock(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export function calcAge(birthDate: string): number {
  const b = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}
