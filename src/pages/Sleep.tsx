/**
 * VITAL AGE — Schlafanalyse-Modul
 * Gesamtschlafdauer, -beginn/-aufwachen, Phasen (nur wenn das Gerät sie
 * liefert), Effizienz, Konsistenz, Defizit vs. persönlichem Schnitt,
 * Verlauf 7/30/90 Tage, persönliche Routine, Methodik.
 */
import { useMemo, useState } from 'react'
import { useApp } from '../store/useApp'
import { computeDayScores, computeBaseline, summarizeSleep, aasmReference } from '../lib/scoring'
import {
  Card,
  SourceBadge,
  Segmented,
  Sparkline,
  Badge,
  PageHeader,
  SleepStageBar,
  LinearTrack,
} from '../ui/components'
import { fmt, fmtMin } from '../lib/stats'
import type { PeriodKey } from '../lib/periods'

const RANGES = [
  { value: '7d' as PeriodKey, label: '7T' },
  { value: '30d' as PeriodKey, label: '30T' },
  { value: '90d' as PeriodKey, label: '90T' },
]

export default function Sleep() {
  const records = useApp((s) => s.records)
  const [range, setRange] = useState<PeriodKey>('30d')
  const sorted = useMemo(() => [...records].sort((a, b) => a.date.localeCompare(b.date)), [records])
  const today = new Date().toISOString().slice(0, 10)
  const scores = useMemo(() => computeDayScores(sorted, today), [sorted, today])
  const baseline = useMemo(() => computeBaseline(sorted), [sorted])
  const s = scores.sleep
  const rec = sorted.find((r) => r.date === today)
  const sleepRec = rec?.sleep ?? null
  const aasm = aasmReference()

  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const window = useMemo(() => sorted.filter((r) => r.sleep).slice(-days), [sorted, days])
  const durTrend = window.map((r) => r.sleep!.durationMin)
  const effTrend = window.map((r) => r.sleep!.efficiencyPct)
  const n = window.length

  const onsetStr = sleepRec ? clockOf(sleepRec.onset) : null
  const offsetStr = sleepRec ? clockOf(sleepRec.offset) : null

  return (
    <>
      <PageHeader title="Schlaf" back="/" />
      <div className="page">
        {/* Hauptwert */}
        <Card>
          <div className="row-between">
            <div>
              <div className="t-label" style={{ color: 'var(--text-variant)' }}>Gestern Nacht</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span className="t-metric" style={{ fontSize: 44 }}>{sleepRec ? fmtMin(sleepRec.durationMin) : '–'}</span>
                {sleepRec && <SourceBadge source={sleepRec.source} />}
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                {onsetStr && offsetStr ? `${onsetStr} → ${offsetStr}` : 'Keine Schlafdaten für diese Nacht'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="t-label" style={{ color: 'var(--text-variant)' }}>Effizienz</div>
              <div className="t-metric" style={{ fontSize: 24, marginTop: 4, color: s.efficiencyPct !== null && s.efficiencyPct < 85 ? 'var(--warning)' : 'var(--primary)' }}>
                {s.efficiencyPct !== null ? `${fmt(s.efficiencyPct, 0)} %` : '–'}
              </div>
              <div className="dim" style={{ fontSize: 11 }}>Schlafzeit ÷ Zeit im Bett</div>
            </div>
          </div>
        </Card>

        {/* Phasen */}
        {sleepRec && (
          <Card title="Schlafphasen" icon={<span style={{ color: 'var(--secondary)' }}>≋</span>}>
            <SleepStageBar stages={sleepRec.stages} totalMin={sleepRec.durationMin} />
            <p className="dim" style={{ fontSize: 11, marginTop: 10 }}>
              Phasen {sleepRec.stages.source === 'measured' ? 'vom Gerät gemessen' : 'abgeleitet'}. Zeigt das Gerät Phasen nicht, erfindet die App keine — sie bleiben ausgeblendet.
            </p>
          </Card>
        )}

        {/* Konsistenz + Defizit */}
        <div className="grid-2">
          <div className="card">
            <div className="t-label" style={{ color: 'var(--text-variant)' }}>Konsistenz</div>
            <div className="t-metric" style={{ fontSize: 26, marginTop: 4, color: (s.consistencyScore ?? 0) >= 60 ? 'var(--primary)' : 'var(--warning)' }}>
              {s.consistencyScore !== null ? `${fmt(s.consistencyScore, 0)} %` : '–'}
            </div>
            <LinearTrack pct={s.consistencyScore ?? 0} color={(s.consistencyScore ?? 0) >= 60 ? 'var(--primary)' : 'var(--warning)'} />
            <p className="dim" style={{ fontSize: 11, marginTop: 6 }}>Stetigkeit deines Schlafbeginns (7 Tage, zirkadian-korrekt)</p>
          </div>
          <div className="card">
            <div className="t-label" style={{ color: 'var(--text-variant)' }}>vs. deinem Schnitt</div>
            <div className="t-metric" style={{ fontSize: 26, marginTop: 4, color: (s.deficitMin ?? 0) > 45 ? 'var(--warning)' : 'var(--primary)' }}>
              {s.deficitMin !== null ? (s.deficitMin >= 0 ? `−${fmtMin(s.deficitMin)}` : `+${fmtMin(Math.abs(s.deficitMin))}`) : '–'}
            </div>
            <p className="dim" style={{ fontSize: 11, marginTop: 6 }}>
              {s.deficitMin !== null
                ? s.deficitMin >= 0
                  ? 'unter deinem 14-Tage-Schnitt (einmalig unbedenklich)'
                  : 'über deinem 14-Tage-Schnitt'
                : 'Zu wenig Nächte für einen Vergleich'}
            </p>
          </div>
        </div>

        {/* Persönliche Routine */}
        <Card title="Deine Schlafroutine" icon={<span style={{ color: 'var(--tertiary)' }}>☾</span>}>
          {s.avgOnsetMin !== null && s.avgOffsetMin !== null ? (
            <div className="stack-sm">
              <div className="row-between">
                <span className="muted" style={{ fontSize: 13 }}>Ø ins Bett</span>
                <span className="mono" style={{ fontSize: 15 }}>{clockMin(s.avgOnsetMin)}</span>
              </div>
              <div className="row-between">
                <span className="muted" style={{ fontSize: 13 }}>Ø aufwachen</span>
                <span className="mono" style={{ fontSize: 15 }}>{clockMin(s.avgOffsetMin)}</span>
              </div>
              <div className="row-between">
                <span className="muted" style={{ fontSize: 13 }}>Ø Dauer (14 T)</span>
                <span className="mono" style={{ fontSize: 15 }}>{baseline.sleepDurationMin !== null ? fmtMin(baseline.sleepDurationMin) : '–'}</span>
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{s.routineNote}</p>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>Noch nicht genügend Nächte, um deine Routine zu bestimmen.</p>
          )}
          <div className="divider" />
          <p className="dim" style={{ fontSize: 11 }}>{aasm.note}</p>
        </Card>

        {/* Verlauf */}
        <Card title="Schlafverlauf" icon={<span style={{ color: 'var(--secondary)' }}>↗</span>}>
          <Segmented options={RANGES} value={range} onChange={setRange} />
          <div className="stack-sm" style={{ gap: 14, marginTop: 12 }}>
            <div>
              <div className="row-between" style={{ marginBottom: 4 }}>
                <span className="muted" style={{ fontSize: 12 }}>Dauer (min)</span>
                <span className="mono" style={{ fontSize: 12 }}>{n}/{days} Nächte</span>
              </div>
              <Sparkline values={durTrend} color="var(--tertiary)" baseline={baseline.sleepDurationMin ?? undefined} height={64} />
            </div>
            <div>
              <div className="row-between" style={{ marginBottom: 4 }}>
                <span className="muted" style={{ fontSize: 12 }}>Effizienz (%)</span>
              </div>
              <Sparkline values={effTrend} color="var(--secondary)" baseline={88} height={56} />
            </div>
          </div>
        </Card>

        {/* Methodik */}
        <Card title="Wie die Werte zustande kommen" icon={<span>§</span>}>
          <ul className="muted" style={{ fontSize: 12, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <li><strong>Effizienz</strong> = Schlafzeit ÷ Zeit im Bett. Liegt die Bett-Zeit nicht vor, wird sie aus Schlafbeginn/-ende und Wachphasen abgeleitet (dann „Berechnet“).</li>
            <li><strong>Konsistenz</strong> = Stetigkeit des Schlafbeginns über 7 Tage; Schwankung &gt; 2 h → Richtung 0 %. Die Berechnung faltet Werte um Mitternacht korrekt zusammen.</li>
            <li><strong>Defizit</strong> = deine eigene 14-Tage-Referenz minus letzte Nacht — kein globaler „9-Stunden“-Maßstab.</li>
            <li><strong>Phasen</strong> werden nur angezeigt, wenn das Gerät sie misst. Kein Hersteller liefert alle Phasen gleich.</li>
            <li>Fehlende Nächte werden als Lücke gezeigt, nie als „0 h geschlafen“.</li>
          </ul>
        </Card>
      </div>
    </>
  )
}

function clockOf(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function clockMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}
