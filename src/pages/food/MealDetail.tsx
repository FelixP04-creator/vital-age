/**
 * VITAL AGE — Mahlzeitendetail
 * Makro-/Mikro-Details, Meal-Score (transparent: Subscores + Gründe),
 * Bioverfügbarkeits-Erklärungen (nur anwendbare, mit Evidenzstufe),
 * Fettquellen-Analyse, Quellen-Kennzeichnung, Evidenzlinks.
 */
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../../store/useApp'
import { Card, Badge, Button, ScoreRing, PageHeader, SourceBadge } from '../../ui/components'
import { scoreMeal } from '../../lib/nutrition/mealScore'
import { absorptionInsights } from '../../lib/nutrition/absorption'
import { analyzeFats, omegaRatioContext, FAT_SOURCES } from '../../lib/nutrition/fatSources'
import { fmt } from '../../lib/stats'
import type { NutrientSource } from '../../lib/types'
import type { FatSourceId } from '../../lib/nutrition/db'

const SOURCE_LABEL: Record<NutrientSource, string> = {
  label: 'Verpackungsetikett',
  database: 'Datenbank (USDA-FDC-basiert, CC0)',
  estimated: 'Geschätzt',
}

export default function MealDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { meals, profile, deleteMeal } = useApp()
  const meal = meals.find((m) => m.id === id)

  const score = useMemo(() => (meal ? scoreMeal(meal, profile) : null), [meal, profile])
  const insights = useMemo(() => (meal ? absorptionInsights(meal).filter((i) => i.applicable) : []), [meal])
  const fats = useMemo(() => (meal ? analyzeFats(meal, profile.fatPreferences) : null), [meal, profile.fatPreferences])

  if (!meal || !score) {
    return (
      <>
        <PageHeader title="Mahlzeit" back="/food" />
        <div className="page">
          <Card>
            <p className="muted" style={{ fontSize: 13 }}>Mahlzeit nicht gefunden.</p>
            <Button onClick={() => nav('/food')} style={{ marginTop: 10 }}>Zurück zum Log</Button>
          </Card>
        </div>
      </>
    )
  }

  const macroRows: [string, number | null, string][] = [
    ['Kalorien', meal.macros.caloriesKcal, 'kcal'],
    ['Eiweiß', meal.macros.proteinG, 'g'],
    ['Kohlenhydrate', meal.macros.carbsG, 'g'],
    ['– davon Zucker', meal.macros.sugarG, 'g'],
    ['Fett', meal.macros.fatG, 'g'],
    ['– gesättigt', meal.macros.satFatG, 'g'],
    ['– einfach ungesättigt', meal.macros.monoFatG, 'g'],
    ['– mehrfach ungesättigt', meal.macros.polyFatG, 'g'],
    ['Omega-3', meal.macros.omega3G, 'g'],
    ['Omega-6', meal.macros.omega6G, 'g'],
    ['Ballaststoffe', meal.macros.fiberG, 'g'],
  ]

  return (
    <>
      <PageHeader title="Mahlzeit" back="/food" />
      <div className="page">
        {/* Kopf */}
        <Card>
          <div className="row" style={{ gap: 12, alignItems: 'center' }}>
            <ScoreRing score={score.score * 10} size={76} sub={`${score.score}/10`} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{meal.name}</div>
              <div className="dim mono" style={{ fontSize: 12, marginTop: 2 }}>
                {meal.date} · {meal.mealType} · {meal.items.length} Lebensmittel
              </div>
              <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <Badge tone="neutral">{meal.method === 'photo' ? '📷 Foto' : 'manuell'}</Badge>
                <Badge tone={score.confidence === 'solid' ? 'primary' : 'warning'}>
                  {score.confidence === 'solid' ? 'solide Basis' : 'vorläufig'}
                </Badge>
                {!meal.confirmed && <Badge tone="warning">unbestätigt</Badge>}
              </div>
            </div>
          </div>
        </Card>

        {/* Meal-Score */}
        <Card title={`Meal-Score ${score.score}/10`} icon={<span>★</span>}>
          <p className="dim" style={{ fontSize: 11, marginBottom: 8 }}>
            Wie gut passt die Mahlzeit zu deinen Zielen (1–10). <em>Nicht</em> „gesund/ungesund“ — kein Urteil, nur Einordnung.
          </p>
          <div className="stack-sm" style={{ marginBottom: 10 }}>
            {Object.entries(score.subscores).map(([k, v]) => (
              <div key={k} className="row-between" style={{ fontSize: 12 }}>
                <span className="muted">{SUB_LABELS[k] ?? k}</span>
                <span className="mono" style={{ color: 'var(--primary)' }}>{v}/10</span>
              </div>
            ))}
          </div>
          {score.reasons.length > 0 && (
            <ul className="muted" style={{ fontSize: 12, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {score.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          {score.improvements.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="dim" style={{ fontSize: 11, marginBottom: 4 }}>Mögliche Verbesserungen (max. 3):</div>
              <ul style={{ fontSize: 12, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {score.improvements.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {score.evidence.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="dim" style={{ fontSize: 11, marginBottom: 4 }}>Quellen (Evidenz):</div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {score.evidence.map((e) => (
                  <a key={e.url} href={e.url} target="_blank" rel="noreferrer" className="badge badge--neutral" style={{ textDecoration: 'none', fontSize: 10 }}>
                    {e.label} ↗
                  </a>
                ))}
              </div>
            </div>
          )}
          <p className="dim" style={{ fontSize: 10, marginTop: 10, fontStyle: 'italic' }}>{score.disclaimer}</p>
        </Card>

        {/* Makros */}
        <Card title="Makronährstoffe" icon={<span>◍</span>}>
          <table className="tbl">
            <tbody>
              {macroRows.map(([label, val, unit]) => (
                <tr key={label}>
                  <td className="muted">{label}</td>
                  <td className="num">
                    <span className="mono">{val !== null ? fmt(val, 1) : '–'}</span> {unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Fettquellen */}
        {fats && fats.totalFatG > 0 && (
          <Card title="Fettquellen" icon={<span>◑</span>}>
            <p className="dim" style={{ fontSize: 11, marginBottom: 8 }}>
              Aus welchen Lebensmitteln kommen die Fette? (Seed-Oils werden fair kontextualisiert, nicht pauschal abgewertet.)
            </p>
            <div className="stack-sm">
              {Object.entries(fats.bySource).map(([sid, grams]) => (
                <div key={sid} className="row-between" style={{ fontSize: 13 }}>
                  <span>{FAT_SOURCES[sid as FatSourceId]?.label ?? sid}</span>
                  <span className="mono dim">
                    {fmt(grams, 1)} g · {fmt((grams / fats.totalFatG) * 100, 0)} %
                  </span>
                </div>
              ))}
            </div>
            {fats.omega6to3 !== null && (
              <div className="dim" style={{ fontSize: 11, marginTop: 8 }}>
                Omega-6/3 ≈ {fmt(fats.omega6to3, 1)} — {omegaRatioContext(fats.omega6to3)}
              </div>
            )}
            {fats.preferenceNotes.length > 0 && (
              <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>
                {fats.preferenceNotes.map((n, i) => (
                  <div key={i}>{n}</div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Absorption */}
        {insights.length > 0 && (
          <Card title="Bioverfügbarkeit" icon={<span>⚗</span>}>
            <p className="dim" style={{ fontSize: 11, marginBottom: 8 }}>
              Wie deine Kombinationen die Aufnahme beeinflussen — nur gut untersuchte Mechanismen, mit Evidenzstufe.
            </p>
            <div className="stack-sm">
              {insights.map((ins) => (
                <div key={ins.id} className="insight" style={{ borderLeft: `3px solid ${ins.evidenceLevel === 'human' ? 'var(--primary)' : 'var(--tertiary)'}`, paddingLeft: 10 }}>
                  <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{ins.title}</span>
                    <Badge tone={ins.evidenceLevel === 'human' ? 'primary' : 'tertiary'}>{ins.evidenceLevel === 'human' ? 'human' : 'mechanistisch'}</Badge>
                  </div>
                  <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{ins.detail}</p>
                  <p className="dim" style={{ fontSize: 11, marginTop: 4 }}>
                    {ins.effect} · Unsicherheit: {ins.uncertainty} · {ins.source}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Items */}
        <Card title="Lebensmittel" icon={<span>▤</span>}>
          <div className="stack-sm">
            {meal.items.map((it) => (
              <div key={it.id} className="row-between" style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--hairline)' }}>
                <div>
                  {it.name} <span className="mono dim">{fmt(it.quantity, 0)} {it.unit}</span>
                </div>
                <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                  <span className="mono dim" style={{ fontSize: 11 }}>{fmt(it.nutrients['kcal'] ?? 0, 0)} kcal</span>
                  <SourceBadge source={it.nutrientSource} title={SOURCE_LABEL[it.nutrientSource]} />
                </div>
              </div>
            ))}
          </div>
          {meal.notes && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Notiz: {meal.notes}</p>}
        </Card>

        <Button
          variant="ghost"
          block
          onClick={() => {
            deleteMeal(meal.id)
            nav('/food')
          }}
        >
          Mahlzeit löschen
        </Button>
      </div>
    </>
  )
}

const SUB_LABELS: Record<string, string> = {
  protein: 'Eiweiß',
  carbs: 'Kohlenhydrate/Qualität',
  fat: 'Fettqualität',
  micro: 'Mikronährstoffe',
  fiber: 'Ballaststoffe',
  goal: 'Ziel-Fit',
}
