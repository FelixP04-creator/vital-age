/**
 * VITAL AGE — Vitalität / "Biologisches Alter"-Bereich
 * =====================================================================
 * A) Physiologischer Altersindikator: Die App zeigt KEIN scheinbar
 *    exaktes biologisches Alter aus Wearable-Daten (das wäre
 *    wissenschaftlich nicht vertretbar). Stattdessen Kalenderalter
 *    (opt-in) + Hinweis auf die Grenzen.
 * B) Vitalitätsindex 0–100: app-eigener, dokumentierter Indikator
 *    über verfügbare Messwerte (HRV, RHR, Schlaf, VO2max, Aktivität,
 *    SpO2) — mit Transparenz zu Datenqualität & Unsicherheit.
 * Keine Beschämung, keine Angst vor dem Altern, keine Verjüngungs-
 * versprechen.
 */
import { useMemo } from 'react'
import { useApp } from '../store/useApp'
import { computeDayScores, computeBaseline } from '../lib/scoring'
import { calcAge } from './Home'
import {
  Card,
  ScoreRing,
  SourceBadge,
  Badge,
  PageHeader,
  Sparkline,
  LinearTrack,
} from '../ui/components'
import { fmt } from '../lib/stats'

export default function Vitality() {
  const { records, profile } = useApp()
  const sorted = useMemo(() => [...records].sort((a, b) => a.date.localeCompare(b.date)), [records])
  const today = new Date().toISOString().slice(0, 10)
  const scores = useMemo(() => computeDayScores(sorted, today), [sorted, today])
  const baseline = useMemo(() => computeBaseline(sorted), [sorted])
  const v = scores.vitality

  // Verlauf (90 Tage)
  const window90 = useMemo(() => sorted.slice(-90), [sorted])
  const history = useMemo(
    () => window90.map((r) => computeDayScores(sorted, r.date).vitality.score),
    [sorted, window90],
  )
  const valid = history.filter((x): x is number => x !== null)
  const trendUp = valid.length >= 7 && valid[valid.length - 1] > valid[0]

  const color = v.score === null ? 'var(--text-dim)' : v.score >= 70 ? 'var(--primary)' : v.score >= 45 ? 'var(--tertiary)' : 'var(--warning)'
  const chronological = profile.birthDate ? calcAge(profile.birthDate) : null

  return (
    <>
      <PageHeader title="Vitalität" back="/" />
      <div className="page">
        {/* Methodik-Hinweis (zuerst, weil zentral) */}
        <div className="demo-banner" role="note" style={{ background: 'var(--secondary-soft)', borderColor: 'rgba(0,194,255,0.3)', color: 'var(--info)' }}>
          <span className="icon">ⓘ</span>
          <span>
            Ein echtes <strong>biologisches Alter</strong> lässt sich nicht zuverlässig aus HRV, Ruhepuls und Schlaf bestimmen.
            Deshalb zeigt VITAL AGE keinen scheinbar exakten Alterswert — sondern einen <strong>app-eigenen Vitalitätsindex</strong>
            über deine verfügbaren Messwerte. Keine Diagnose, keine Verjüngungs-Versprechen.
          </span>
        </div>

        {/* Vitalitätsindex */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <ScoreRing score={v.score} size={150} color={color} label="Vitalität" />
            <div className="stack-sm" style={{ flex: 1 }}>
              <div className="row">
                <Badge tone="secondary">app-eigen</Badge>
                <SourceBadge source="computed" />
                {v.confidence !== 'low' && <Badge tone={v.confidence === 'high' ? 'primary' : 'neutral'}>{v.confidence === 'high' ? 'hohe' : 'mittlere'} Konfidenz</Badge>}
              </div>
              {v.score !== null ? (
                <p className="muted" style={{ fontSize: 13 }}>
                  {v.score >= 70
                    ? 'Deine verfügbaren Kennwerte liegen überwiegend im günstigen Bereich.'
                    : v.score >= 45
                      ? 'Deine Kennwerte sind gemischt — einzelne Faktoren ziehen den Index nach unten (siehe unten).'
                      : 'Mehrere Kennwerte liegen unter deinem Basisniveau. Das ist ein Signal, kein Urteil.'}
                </p>
              ) : (
                <p className="muted" style={{ fontSize: 13 }}>{v.note}</p>
              )}
              {chronological !== null && (
                <p className="dim" style={{ fontSize: 12 }}>
                  Kalenderalter: {chronological} J. (angegeben). Der Index misst Verfassung, nicht „jünger/älter als du bist“.
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Kalenderalter (opt-in) */}
        {chronological === null && (
          <Card title="Kalenderalter (optional)" icon={<span>🎂</span>}>
            <p className="muted" style={{ fontSize: 13 }}>
              Du kannst in den Einstellungen ein Geburtsdatum angeben — dann wird dein Kalenderalter hier angezeigt.
              VITAL AGE nutzt es NUR als Referenz, nie als Wertung.
            </p>
          </Card>
        )}

        {/* Einflussfaktoren */}
        <Card title="Was in den Index einfließt" icon={<span style={{ color: 'var(--primary)' }}>◈</span>}>
          {v.drivers.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Noch nicht genügend Messwerte für eine Aufschlüsselung.</p>
          ) : (
            <div className="stack-sm">
              {v.drivers.map((d) => (
                <div key={d.name} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: d.direction === 'good' ? 'var(--primary)' : d.direction === 'bad' ? 'var(--error)' : 'var(--warning)', marginTop: 2 }}>●</span>
                  <div style={{ flex: 1 }}>
                    <div className="row-between">
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</span>
                      <span className="mono dim" style={{ fontSize: 11 }}>Gewicht {Math.round(d.weight * 100)} %</span>
                    </div>
                    <p className="muted" style={{ fontSize: 12 }}>{d.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="dim" style={{ fontSize: 11, marginTop: 8 }}>
            Fehlende Faktoren werden nicht mit 0 bestraft — die Gewichte werden auf vorhandene Messwerte umverteilt
            (daher sinkt die Konfidenz bei wenigen Daten).
          </p>
        </Card>

        {/* Verlauf */}
        <Card title="Verlauf (90 Tage)" icon={<span style={{ color: 'var(--tertiary)' }}>↗</span>}>
          <Sparkline values={history} color={color} height={72} />
          <div className="row-between" style={{ marginTop: 8 }}>
            <span className="dim" style={{ fontSize: 11 }}>{valid.length}/90 Tage mit Index</span>
            {valid.length >= 7 && (
              <span className="mono" style={{ fontSize: 12, color: trendUp ? 'var(--primary)' : 'var(--warning)' }}>
                {trendUp ? '▲ steigt' : '▼ sinkt'} ({fmt(valid[valid.length - 1] - valid[0], 1)} seit Beginn)
              </span>
            )}
          </div>
        </Card>

        {/* Datenqualität & Unsicherheit */}
        <Card title="Datenqualität & Unsicherheit" icon={<span>▦</span>}>
          <div className="stat-grid">
            <div className="stat">
              <div className="k">Baseline-Datenbasis</div>
              <div className="v">{baseline.sampleDays} <small>Tage</small></div>
            </div>
            <div className="stat">
              <div className="k">Faktoren heute aktiv</div>
              <div className="v">{v.drivers.length} <small>/ 6</small></div>
            </div>
          </div>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            <QualityRow ok={baseline.sampleDays >= 14} label="Baseline (≥14 Tage)" detail="Je länger deine Historie, desto stabiler die Vergleichsbasis." />
            <QualityRow ok={v.drivers.length >= 4} label="Messwerte (≥4 Faktoren)" detail="Mehr Quellen = robusterer Index und höhere Konfidenz." />
            <QualityRow ok={v.score !== null} label="Index berechenbar" detail="Erst ab mindestens einem Kern-Messwert (HRV/RHR/Schlaf) erscheint ein Wert." />
          </div>
        </Card>

        {/* Verbesserungsbereiche (positiv formuliert) */}
        <Card title="Mögliche Hebel" icon={<span style={{ color: 'var(--primary)' }}>→</span>}>
          <Improvements drivers={v.drivers} />
          <p className="dim" style={{ fontSize: 11, marginTop: 8 }}>
            Vorschläge im allgemeinen Wellness-Kontext — abgestimmt auf deinen Verlauf, nicht auf globale Grenzwerte.
            Keine medizinische Empfehlung.
          </p>
        </Card>

        {/* Methodik */}
        <Card title="Formel & Grenzen" icon={<span>§</span>}>
          <div className="stack-sm">
            <p className="muted" style={{ fontSize: 12 }}>
              <strong>Vitalität = gewichteter Mittelwert</strong> verfügbarer Faktoren (0–100): HRV (25 %), Ruhe-HF (15 %),
              Schlaf (20 %), VO₂max (20 %), aktive Minuten (10 %), SpO₂ (10 %). Fehlt ein Faktor, wird sein Gewicht umverteilt.
            </p>
            <p className="muted" style={{ fontSize: 12 }}>
              <strong>Grenzen:</strong> Kein medizinisch validiertes „biologisches Alter“. Kein Ersatz für ärztliche
              Untersuchungen. Der Index reagiert auf kurzfristige Schwankungen (Stress, Schlaf, Belastung) —
              einzelne niedrige Werte sind kein Befund.
            </p>
          </div>
        </Card>
      </div>
    </>
  )
}

function QualityRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="row" style={{ gap: 10 }}>
      <span style={{ color: ok ? 'var(--primary)' : 'var(--warning)', fontSize: 14 }}>{ok ? '✓' : '○'}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div className="muted" style={{ fontSize: 11 }}>{detail}</div>
      </div>
    </div>
  )
}

function Improvements({ drivers }: { drivers: { name: string; direction: string; detail: string }[] }) {
  const weak = drivers.filter((d) => d.direction === 'bad').slice(0, 3)
  const tips: Record<string, string> = {
    'HRV vs. Baseline': 'Festere Schlafenszeit, weniger Alkohol am Abend und 20–30 min Bewegung am Tag unterstützen die nächtliche Erholung.',
    'Ruhe-Herzfrequenz': 'Ausreichend Schlaf und moderate Ausdauer (z. B. zügiges Gehen) senken die Ruhe-HF langfristig.',
    'Schlaf (Dauer & Effizienz)': 'Stabile Zeiten und ein kühles, dunkles Schlafzimmer verbessern Dauer und Effizienz.',
    'Cardio-Fitness (VO₂max)': '2–3 Ausdauereinheiten pro Woche (z. B. lockeres Laufen, Rad) sind der einfachste Hebel für VO₂max.',
    'Aktive Minuten': 'Kleine Einheiten (Treppen, Spaziergänge) addieren sich schnell auf 60–150 aktive Minuten.',
    'Sauerstoffsättigung': 'Ausreichend Schlaf und Vermeidung von Enge/Erhöhung (z. B. beim Schlafen) sind die Hauptfaktoren.',
  }
  if (weak.length === 0) {
    return <p className="muted" style={{ fontSize: 13 }}>Keine deutlich schwachen Faktoren — gute Basis. Halte deine Routine und beobachte den Verlauf.</p>
  }
  return (
    <div className="stack-sm">
      {weak.map((w) => (
        <div key={w.name} className="card card--flat" style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)' }}>{w.name}</div>
          <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>{tips[w.name] ?? 'Beobachte den Verlauf — ein einzelner Tag ist kein Muster.'}</p>
        </div>
      ))}
    </div>
  )
}
