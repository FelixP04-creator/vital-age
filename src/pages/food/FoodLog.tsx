/**
 * VITAL AGE — Food Log (Ernährung)
 * Tagesübersicht (Makros vs. Ziele), Mahlzeiten nach Tag,
 * manuelle Erfassung (Suche in der Datenbank), Foto-Scan-Anbindung.
 * Quellen: USDA-FDC-basierte Datenbank (CC0), geschätzte Werte sind gekennzeichnet.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../store/useApp'
import {
  Card,
  Badge,
  Button,
  PageHeader,
  SourceBadge,
  Segmented,
} from '../../ui/components'
import { aggregateMacros, aggregateMicros, buildFoodItem, UNITS } from '../../lib/nutrition/calc'
import { searchFoods } from '../../lib/nutrition/db'
import { FOODS } from '../../lib/nutrition/db'
import { fmt } from '../../lib/stats'
import type { FoodItem, Meal, NutritionGoal, NutrientSource } from '../../lib/types'

const MEAL_LABELS: Record<Meal['mealType'], string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack',
}
const MEAL_TYPES: Meal['mealType'][] = ['breakfast', 'lunch', 'dinner', 'snack']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function FoodLog() {
  const { meals, addMeal, profile } = useApp()
  const nav = useNavigate()
  const [tab, setTab] = useState<'today' | 'log'>('today')
  const [mealType, setMealType] = useState<Meal['mealType']>('dinner')
  const [query, setQuery] = useState('')
  const [qty, setQty] = useState(100)
  const [unit, setUnit] = useState<FoodItem['unit']>('g')
  const [source, setSource] = useState<NutrientSource>('database')
  const [pending, setPending] = useState<FoodItem[]>([])
  const [note, setNote] = useState('')

  const results = useMemo(() => (query.trim() ? searchFoods(query) : FOODS.slice(0, 12)), [query])

  const mealsToday = useMemo(() => meals.filter((m) => m.date === todayStr()), [meals])
  const allItems = mealsToday.flatMap((m) => m.items)
  const macros = aggregateMacros(allItems)
  const micros = aggregateMicros(allItems)
  const goals = profile.goals ?? []
  const hasGoal = (g: NutritionGoal) => goals.includes(g)

  function addPending(foodId: string) {
    const item = buildFoodItem(foodId, qty, unit, source)
    if (item) setPending((p) => [...p, item])
  }

  function saveMeal() {
    if (pending.length === 0) return
    const m = aggregateMacros(pending)
    const micro = aggregateMicros(pending)
    const meal: Meal = {
      id: `meal-${Date.now().toString(36)}`,
      date: todayStr(),
      mealType,
      name: pending.map((p) => p.name).join(' + ').slice(0, 60),
      items: pending,
      macros: m,
      micros: micro,
      method: 'manual',
      confirmed: true,
      notes: note.trim() || undefined,
      createdAt: new Date().toISOString(),
    }
    addMeal(meal)
    setPending([])
    setQuery('')
    setNote('')
    setTab('log')
    nav(`/food/${meal.id}`)
  }

  const macroRows: { label: string; value: number | null; unit: string; goal?: number; invert?: boolean }[] = [
    { label: 'Kalorien', value: macros.caloriesKcal, unit: 'kcal', goal: hasGoal('sport-performance') ? 2600 : 2200 },
    { label: 'Eiweiß', value: macros.proteinG, unit: 'g', goal: hasGoal('protein') ? 140 : 120 },
    { label: 'Kohlenhydrate', value: macros.carbsG, unit: 'g', goal: hasGoal('sport-performance') ? 300 : 250 },
    { label: 'Fett', value: macros.fatG, unit: 'g', goal: 75 },
    { label: 'Ballaststoffe', value: macros.fiberG, unit: 'g', goal: hasGoal('fiber') ? 35 : 30 },
    { label: 'Zucker', value: macros.sugarG, unit: 'g', invert: true },
  ]

  return (
    <>
      <PageHeader title="Ernährung" back="/" />
      <div className="page">
        <Segmented
          options={[
            { value: 'today', label: 'Heute' },
            { value: 'log', label: 'Log' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as 'today' | 'log')}
        />

        {tab === 'today' ? (
          <>
            {/* Tages-Makros vs. Ziele */}
            <Card title="Heute" icon={<span style={{ color: 'var(--primary)' }}>◍</span>}>
              <div className="grid-2" style={{ gap: 12 }}>
                {macroRows.map((r) => (
                  <MacroTile key={r.label} {...r} />
                ))}
              </div>
              {allItems.length === 0 && (
                <p className="dim" style={{ fontSize: 11, marginTop: 10 }}>
                  Noch keine Mahlzeiten heute. Nährwerte kommen aus der USDA-FDC-basierten Datenbank (CC0, Quelle: fdc.nal.usda.gov).
                </p>
              )}
            </Card>

            {/* Mikros (Auswahl) */}
            <Card title="Wichtige Mikronährstoffe" icon={<span>⚗</span>}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <MicroChip label="Eisen" value={micros.iron} unit="mg" />
                <MicroChip label="Calcium" value={micros.calcium} unit="mg" />
                <MicroChip label="Zink" value={micros.zinc} unit="mg" />
                <MicroChip label="Vitamin D" value={micros.vitaminD} unit="µg" />
                <MicroChip label="Vitamin B12" value={micros.vitaminB12} unit="µg" />
                <MicroChip label="Natrium" value={micros.sodium} unit="mg" />
              </div>
              <p className="dim" style={{ fontSize: 11, marginTop: 8 }}>
                Summe des Tages, nur aus erfassten Lebensmitteln — keine Schätzung für Ungefressenes.
              </p>
            </Card>

            {/* Erfassung */}
            <Card title="Lebensmittel erfassen" icon={<span style={{ color: 'var(--tertiary)' }}>＋</span>}>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>Mahlzeit</label>
                <div className="seg">
                  {MEAL_TYPES.map((t) => (
                    <button key={t} type="button" className={mealType === t ? 'active' : ''} onClick={() => setMealType(t)}>
                      {MEAL_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field" style={{ marginBottom: 10 }}>
                <label>Suche</label>
                <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="z. B. Lachs, Haferflocken, Avocado …" />
              </div>

              <div className="stack-sm" style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--hairline)', borderRadius: 12, padding: 4 }}>
                {results.map((f) => (
                  <button key={f.id} type="button" className="food-row" onClick={() => addPending(f.id)}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{f.name}</div>
                      <div className="dim mono" style={{ fontSize: 11 }}>
                        {f.n.kcal} kcal · {f.n.protein} g P · {f.n.carbs} g KH · {f.n.fat} g F /100g
                      </div>
                    </div>
                    <span style={{ color: 'var(--primary)', fontSize: 16 }}>＋</span>
                  </button>
                ))}
                {results.length === 0 && <p className="dim" style={{ fontSize: 12, padding: 8 }}>Nichts gefunden.</p>}
              </div>

              <div className="grid-2" style={{ marginTop: 10, gap: 8 }}>
                <div className="field">
                  <label>Menge</label>
                  <input className="input" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
                </div>
                <div className="field">
                  <label>Einheit</label>
                  <select className="select" value={unit} onChange={(e) => setUnit(e.target.value as FoodItem['unit'])}>
                    {Object.entries(UNITS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field" style={{ marginTop: 6 }}>
                <label>Quellen-Kennzeichnung</label>
                <select className="select" value={source} onChange={(e) => setSource(e.target.value as NutrientSource)}>
                  <option value="database">Datenbank (USDA-FDC-basiert)</option>
                  <option value="estimated">Geschätzt (Verpackung/Verdacht)</option>
                </select>
              </div>

              {pending.length > 0 && (
                <div className="stack-sm" style={{ marginTop: 8 }}>
                  {pending.map((p) => (
                    <div key={p.id} className="row-between" style={{ fontSize: 13 }}>
                      <span>
                        {p.name} — {fmt(p.quantity, 0)} {UNITS[p.unit]?.label} <SourceBadge source={p.nutrientSource} />
                      </span>
                      <button className="icon-btn" style={{ width: 24, height: 24, fontSize: 11 }} onClick={() => setPending((x) => x.filter((i) => i.id !== p.id))}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="field" style={{ marginTop: 8 }}>
                <label>Notiz (optional)</label>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. mit Olivenöl, gebraten" />
              </div>

              <Button block disabled={pending.length === 0} onClick={saveMeal}>
                {pending.length === 0 ? 'Erst Lebensmittel hinzufügen' : `Mahlzeit speichern (${pending.length})`}
              </Button>
            </Card>

            <Button block variant="ghost" onClick={() => nav('/food/scan')}>
              📷 Foto-Scanner (lokale KI)
            </Button>
          </>
        ) : (
          <FoodLogList onOpen={(id) => nav(`/food/${id}`)} />
        )}
      </div>
    </>
  )
}

function MacroTile({ label, value, unit, goal, invert }: { label: string; value: number | null; unit: string; goal?: number; invert?: boolean }) {
  const pct = value !== null && goal ? Math.min(100, (value / goal) * 100) : null
  const over = pct !== null && pct > 100
  return (
    <div className="tile">
      <div className="tile__label">{label}</div>
      <div className="tile__value">
        {value !== null ? fmt(value, 0) : '–'}
        <span className="tile__unit">{unit}</span>
      </div>
      {pct !== null && (
        <div style={{ marginTop: 6 }}>
          <div className="bar">
            <div className="bar__fill" style={{ width: `${Math.min(100, pct)}%`, background: over ? 'var(--warning)' : invert ? 'var(--tertiary)' : 'var(--primary)' }} />
          </div>
          <div className="dim mono" style={{ fontSize: 10, marginTop: 2 }}>
            {fmt(pct, 0)} % {goal ? `· Ziel ${fmt(goal, 0)}` : ''}
          </div>
        </div>
      )}
    </div>
  )
}

function MicroChip({ label, value, unit }: { label: string; value: number | undefined; unit: string }) {
  return (
    <span className="badge badge--neutral" style={{ textTransform: 'none' }}>
      {label}: <strong className="mono">{value !== undefined ? fmt(value, 1) : '–'}</strong> {unit}
    </span>
  )
}

function FoodLogList({ onOpen }: { onOpen: (id: string) => void }) {
  const { meals, deleteMeal } = useApp()
  const sorted = useMemo(() => [...meals].sort((a, b) => b.date.localeCompare(a.date)), [meals])
  const byDate = useMemo(() => {
    const m = new Map<string, Meal[]>()
    for (const meal of sorted) {
      const arr = m.get(meal.date) ?? []
      arr.push(meal)
      m.set(meal.date, arr)
    }
    return [...m.entries()]
  }, [sorted])

  if (sorted.length === 0) {
    return (
      <Card>
        <p className="muted" style={{ fontSize: 13 }}>Noch keine Mahlzeiten erfasst. Starte im Tab „Heute“ mit der Erfassung oder Foto-Scan.</p>
      </Card>
    )
  }

  return (
    <div className="stack-md">
      {byDate.map(([date, dayMeals]) => (
        <Card key={date} title={date} icon={<span>▤</span>}>
          <div className="stack-sm">
            {dayMeals.map((meal) => (
              <div key={meal.id}>
                <button type="button" className="food-row" onClick={() => onOpen(meal.id)}>
                  <div>
                    <div className="row" style={{ gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{meal.name}</span>
                      <Badge tone={meal.method === 'photo' ? 'tertiary' : 'neutral'}>{meal.method === 'photo' ? '📷 Foto' : 'manuell'}</Badge>
                      {meal.confidence !== undefined && <Badge tone={meal.confidence > 0.7 ? 'primary' : 'warning'}>{fmt(meal.confidence * 100, 0)} %</Badge>}
                    </div>
                    <div className="dim mono" style={{ fontSize: 11, marginTop: 2 }}>
                      {MEAL_LABELS[meal.mealType]} · {fmt(meal.macros.caloriesKcal, 0)} kcal · {fmt(meal.macros.proteinG, 0)} g P
                    </div>
                  </div>
                  <span className="row" style={{ gap: 6 }}>
                    <span style={{ color: 'var(--muted)' }}>›</span>
                  </span>
                </button>
                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 2 }}>
                  <button className="dim" style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }} onClick={() => deleteMeal(meal.id)}>
                    löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
