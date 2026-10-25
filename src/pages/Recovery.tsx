/**
 * VITAL AGE — Recovery-Modul
 * Recovery-Score 0–100, Einflüsse (HRV/RHR/Schlaf) gegenüber
 * persönlichem Basiswert, Verlauf über Wochen, Erklärungen und
 * vorsichtige Empfehlungen.
 */
import { useMemo } from 'react'
import { useApp } from '../store/useApp'
import { computeDayScores, computeBaseline, MIN_DAYS } from '../lib/scoring'
import {
  Card,
  ScoreRing,
  SourceBadge,
  Sparkline,
  Badge,
  PageHeader,
  LinearTrack,
  Delta,
} from '../ui/components'
import { fmt, fmtMin } from '../lib/stats'

export default function Recovery() {
  const records = useApp((s) => s.records)
  const sorted = useMemo(() => [...records].sort((a, b) => a.date.localeCompare(b.date)), [records])
  const today = new Date().toISOString().slice(0, 10)
  const scores = useMemo(() => computeDayScores(sorted, today), [sorted, today])
  const baseline = useMemo(() => computeBaseline(sorted), [sorted])
  const rec = sorted.find((r) => r.date === today)

  // 28-Tage-Verlauf des Recovery-Scores (reproduzierbar berechnet)
  const window28 = useMemo(() => sorted.slice(-28), [sorted])
  const history = useMemo(
    () =>
      window28.map((r) => {
        const s = computeDayScores(sorted, r.date)
        return { date: r.date, score: s.recovery.score }
      }),
    [sorted, window28],
  )
  const hrvVals = history.map((h) => h.score)

  const { score, drivers, explanation, confidence, availableInputs, requiredInputs } = scores.recovery
  const color = score === null ? 'var(--text-dim)' : score >= 67 ? 'var(--primary)' : score >= 33 ? 'var(--warning)' : 'var(--error)'

  return (
    <>
      <PageHeader title="Recovery" back="/" />
      <div className="page">
        {/* Haupt-Score */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <ScoreRing score={score} size={150} color={color} label="Recovery" />
            <div className="stack-sm" style={{ flex: 1 }}>
              {score === null ? (
                <>
                  <Badge tone="warning">Nicht genügend Daten</Badge>
                  <p className="muted" style={{ fontSize: 13 }}>{explanation}</p>
                  <p className="dim" style={{ fontSize: 12 }}>
                    Es fehlen {requiredInputs - availableInputs} von {requiredInputs} benötigten Eingängen. Ab {MIN_DAYS} Tagen mit HRV/RHR-Daten erscheint der Score.
                  </p>
                </>
              ) : (
                <>
                  <div className="row">
                    <Badge tone={score >= 67 ? 'primary' : score >= 33 ? 'warning' : 'error'}>{confidence === 'high' ? 'hohe Konfidenz' : confidence === 'low' ? 'niedrige Konfidenz' : 'mittlere Konfidenz'}</Badge>
                    <SourceBadge source="computed" title="Von der App aus deinen Daten berechnet" />
                  </div>
                  <p className="muted" style={{ fontSize: 13 }}>{explanation}</p>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Einflussfaktoren */}
        <Card title="Was beeinflusst den Score heute" icon={<span style={{ color: 'var(--primary)' }}>◈</span>}>
          {drivers.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Keine Einflussfaktoren — es fehlen die zugrunde liegenden Messwerte.</p>}
          <div className="stack-sm">
            {drivers.map((d) => (
              <div key={d.name} className="card card--flat" style={{ padding: '10px 12px' }}>
                <div className="row-between">
                  <div className="row" style={{ gap: 6 }}>
                    <span style={{ color: d.direction === 'good' ? 'var(--primary)' : d.direction === 'bad' ? 'var(--error)' : 'var(--warning)' }}>
                      {d.direction === 'good' ? '●' : d.direction === 'bad' ? '●' : '●'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</span>
                  </div>
                  <span className="mono dim" style={{ fontSize: 11 }}>Gewicht {Math.round(d.weight * 100)} %</span>
                </div>
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{d.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Verlauf */}
        <Card title="Erholungsverlauf (28 Tage)" icon={<span style={{ color: 'var(--secondary)' }}>↗</span>}>
          <Sparkline values={hrvVals} color={color} height={72} baseline={67} />
          <div className="row-between" style={{ marginTop: 8 }}>
            <span className="dim" style={{ fontSize: 11 }}>Linie bei 67 % = Schwelle „Optimal"</span>
            <span className="mono" style={{ fontSize: 12, color }}>{hrvVals.filter((v): v is number => v !== null).length}/28 Tage mit Score</span>
          </div>
        </Card>

        {/* Basiswerte */}
        <Card title="Deine persönlichen Baselines" icon={<span style={{ color: 'var(--tertiary)' }}>◎</span>}>
          <div className="stat-grid">
            <div className="stat">
              <div className="k">HRV-Baseline</div>
              <div className="v">{baseline.hrvMs !== null ? fmt(baseline.hrvMs, 0) : '–'} <small>ms</small></div>
            </div>
            <div className="stat">
              <div className="k">Ruhe-HF-Baseline</div>
              <div className="v">{baseline.restingHrBpm !== null ? fmt(baseline.restingHrBpm, 0) : '–'} <small>bpm</small></div>
            </div>
          </div>
          <p className="dim" style={{ fontSize: 11, marginTop: 8 }}>
            Baselines = robuster Median der letzten {typeof baseline.sampleDays === 'number' ? Math.min(28, baseline.sampleDays) : '–'} Tage. Der Recovery-Score vergleicht heute damit — nicht mit globalen Grenzwerten.
          </p>
        </Card>

        {/* Methodik + Hinweise */}
        <Card title="So wird der Score berechnet" icon={<span>§</span>}>
          <div className="stack-sm">
            <FormulaLine w="45" name="HRV vs. Baseline" desc="±25 % zur Baseline skaliert auf 0–100" />
            <FormulaLine w="30" name="Ruhe-HF vs. Baseline" desc="±10 bpm zur Baseline skaliert auf 0–100" />
            <FormulaLine w="15" name="Schlaf" desc="Effizienz (80–95 %) + Stetigkeit des Schlafbeginns" />
          </div>
          <div className="divider" />
          <ul className="muted" style={{ fontSize: 12, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>Bei fehlenden Schlafdaten werden die Gewichte auf HRV/RHR umverteilt (55/45).</li>
            <li>Unter {MIN_DAYS} Tagen mit Daten gibt es bewusst KEINEN Score — kein erfundener Wert.</li>
            <li>Ein niedriger Score beschreibt weniger Erholung als üblich. Er ist KEIN Krankheitszeichen und keine Diagnose.</li>
            <li>Der Score ist ein app-eigener Wert (computed) — abgeleitet aus gemessenen Größen.</li>
          </ul>
        </Card>

        {/* Empfohlene Tagesgestaltung */}
        <Card title="Empfehlung für heute" icon={<span style={{ color: 'var(--primary)' }}>→</span>}>
          {score === null ? (
            <p className="muted" style={{ fontSize: 13 }}>Sobald genügend Daten vorliegen, bekommst du hier eine vorsichtige, datenbasierte Empfehlung.</p>
          ) : (
            <div className="stack-sm">
              <div className="row" style={{ gap: 8 }}>
                <LinearTrack pct={score} color={color} />
              </div>
              {score >= 67 && (
                <p style={{ fontSize: 13 }}>
                  <strong style={{ color: 'var(--primary)' }}>Gut erholt.</strong> Wenn dein Körpergefühl mitspielt, ist heute ein intensiverer Trainingstag möglich. Trinken und Schlaf nicht vernachlässigen.
                </p>
              )}
              {score !== null && score >= 33 && score < 67 && (
                <p style={{ fontSize: 13 }}>
                  <strong style={{ color: 'var(--warning)' }}>Gemäßigt.</strong> Moderate Belastung ist sinnvoll. Plane etwas mehr Puffer ein und achte auf einen früheren Schlafbeginn.
                </p>
              )}
              {score !== null && score < 33 && (
                <p style={{ fontSize: 13 }}>
                  <strong style={{ color: 'var(--error)' }}>Wenig Erholung.</strong> Ein ruhigerer Tag, lockeres Training und frühere Schlafenszeit sind heute sinnvoll. Das bedeutet nicht automatisch Krankheit — beobachte deinen Verlauf.
                </p>
              )}
              <p className="dim" style={{ fontSize: 11 }}>
                Allgemeine Wellness-Empfehlung, keine medizinische Anweisung. Bei anhaltend niedrigem Score oder Beschwerden: Arztpraxis.
              </p>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

function FormulaLine({ w, name, desc }: { w: string; name: string; desc: string }) {
  return (
    <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
      <span className="mono" style={{ fontSize: 12, color: 'var(--primary)', minWidth: 34 }}>{w} %</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
        <div className="muted" style={{ fontSize: 12 }}>{desc}</div>
      </div>
    </div>
  )
}
