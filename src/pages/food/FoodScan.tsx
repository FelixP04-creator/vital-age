/**
 * VITAL AGE — Foto-Scanner (lokale KI + Datenbank)
 * =================================================
 * Der Nutzer fotografiert eine Mahlzeit. Das lokale Vision-Modell
 * erkennt NUR Namen und ungefähre Mengen. Die Nährwerte kommen
 * deterministisch aus der Lebensmitteldatenbank — das Modell darf
 * keine Nährwerte erfinden (Anti-Halluzination).
 * Ohne erreichbares Modell: klare Meldung + manueller Modus.
 * Geschätzte Werte sind immer gekennzeichnet und vor dem Speichern
 * von der Nutzerin/dem Nutzer zu bestätigen.
 */
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../store/useApp'
import { Card, Badge, Button, PageHeader } from '../../ui/components'
import { apiBase } from '../../lib/api'
import { buildFoodItem } from '../../lib/nutrition/calc'
import { aggregateMacros, aggregateMicros } from '../../lib/nutrition/calc'
import { FOOD_MAP } from '../../lib/nutrition/db'
import { fmt } from '../../lib/stats'
import type { Meal } from '../../lib/types'

interface ScanItem {
  rawName: string
  matchedId: string | null
  matchedLabel: string | null
  quantity: number
  unit: string
  confidence: number
  uncertainties: string[]
  cookingMethod?: string
  inDatabase: boolean
}

export default function FoodScan() {
  const { addMeal } = useApp()
  const nav = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState<string | null>(null)
  const [mealType, setMealType] = useState<Meal['mealType']>('dinner')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ items: ScanItem[]; overallConfidence: number; provider?: string; model?: string; notVisible: string[]; available: boolean; reason?: string } | null>(null)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => setImage(reader.result as string)
    reader.readAsDataURL(f)
  }

  async function scan() {
    if (!image) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`${apiBase()}/api/food/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, mealType, note: note.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setResult(data)
    } catch (e) {
      setError(
        `Der Scan-Server antwortet nicht (${e instanceof Error ? e.message : String(e)}). Starte ihn mit „npm run dev:server“ — oder erfahre manuell.`,
      )
    } finally {
      setBusy(false)
    }
  }

  async function saveScanned() {
    if (!result) return
    const items = result.items
      .filter((i) => i.matchedId)
      .map((i) => buildFoodItem(i.matchedId!, Math.max(1, Math.round(i.quantity)), 'g', 'estimated', { name: i.matchedLabel ?? i.rawName }))
      .filter((x): x is NonNullable<typeof x> => x !== null)
    if (items.length === 0) return
    const meal: Meal = {
      id: `meal-scan-${Date.now().toString(36)}`,
      date: new Date().toISOString().slice(0, 10),
      mealType,
      name: `Foto: ${items.map((i) => i.name).join(' + ').slice(0, 40)}`,
      items,
      macros: aggregateMacros(items),
      micros: aggregateMicros(items),
      method: 'photo',
      confidence: result.overallConfidence,
      confirmed: true,
      notes: 'Foto-Scan — Mengen geschätzt (lokale KI), Nährwerte aus Datenbank.',
      createdAt: new Date().toISOString(),
    }
    addMeal(meal)
    nav(`/food/${meal.id}`)
  }

  return (
    <>
      <PageHeader title="Foto-Scanner" back="/food" />
      <div className="page">
        <Card>
          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            Fotografiere deine Mahlzeit. Die <strong>lokale KI</strong> erkennt nur, <em>was</em> zu sehen ist
            (Namen + ungefähre Mengen). <strong>Nährwerte werden danach aus der Lebensmitteldatenbank berechnet</strong> —
            das Modell erfindet keine Werte.
          </p>

          <div className="grid-2" style={{ gap: 8, marginBottom: 10 }}>
            <div className="field">
              <label>Mahlzeit</label>
              <select className="select" value={mealType} onChange={(e) => setMealType(e.target.value as Meal['mealType'])}>
                <option value="breakfast">Frühstück</option>
                <option value="lunch">Mittagessen</option>
                <option value="dinner">Abendessen</option>
                <option value="snack">Snack</option>
              </select>
            </div>
            <div className="field">
              <label>Notiz (optional)</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. mit Olivenöl" />
            </div>
          </div>

          {image ? (
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <img src={image} alt="Mahlzeit" style={{ width: '100%', borderRadius: 14, maxHeight: 240, objectFit: 'cover' }} />
              <button
                type="button"
                className="icon-btn"
                style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, background: 'rgba(0,0,0,0.6)' }}
                onClick={() => setImage(null)}
                aria-label="Bild entfernen"
              >
                ✕
              </button>
            </div>
          ) : (
            <div
              className="dropzone"
              style={{
                border: '1.5px dashed var(--hairline)',
                borderRadius: 14,
                padding: '28px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: 10,
              }}
              onClick={() => fileRef.current?.click()}
            >
              <div style={{ fontSize: 28 }}>📷</div>
              <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                Tippe, um ein Foto auszuwählen
              </p>
              <p className="dim" style={{ fontSize: 11 }}>JPG/PNG, direkt im Browser verarbeitet, wird nicht hochgeladen außer zum lokalen Scan-Server</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} hidden />

          <Button block disabled={!image || busy} onClick={scan}>
            {busy ? 'Erkenne … (lokales Modell)' : 'Mahlzeit erkennen'}
          </Button>

          {error && (
            <div className="demo-banner" role="alert" style={{ background: 'var(--error-soft)', borderColor: 'rgba(255,59,48,0.3)', color: 'var(--error)', marginTop: 10 }}>
              <span className="icon">⚠</span>
              <span>{error}</span>
            </div>
          )}
        </Card>

        {result && !result.available && (
          <Card>
            <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <Badge tone="warning">kein Modell</Badge>
              <span style={{ fontWeight: 600 }}>Lokales Vision-Modell nicht erreichbar</span>
            </div>
            <p className="muted" style={{ fontSize: 12 }}>
              {result.reason ?? 'Ollama oder LM Studio läuft nicht oder hat kein Vision-Modell geladen.'}
            </p>
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              <strong>So schaltest du die Bilderkennung ein:</strong>
            </p>
            <ul className="muted" style={{ fontSize: 12, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li><strong>Ollama:</strong> <code>ollama pull qwen2.5vl:7b</code> — läuft auf <code>localhost:11434</code>.</li>
              <li><strong>LM Studio:</strong> <em>Qwen2.5-VL-7B-Instruct</em> (GGUF) laden + Server starten (Port 1234).</li>
              <li>Anschließend „Mahlzeit erkennen“ erneut antippen.</li>
            </ul>
            <Button block variant="ghost" style={{ marginTop: 10 }} onClick={() => nav('/food')}>
              Stattdessen manuell erfassen
            </Button>
          </Card>
        )}

        {result && result.available && (
          <Card title={`Erkannt (${result.items.length})`} icon={<span style={{ color: 'var(--primary)' }}>✓</span>}>
            <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <Badge tone="primary">
                {result.provider ?? 'lokales Modell'} · {result.model ?? ''}
              </Badge>
              <Badge tone={result.overallConfidence > 0.7 ? 'primary' : 'warning'}>
                Konfidenz {fmt(result.overallConfidence * 100, 0)} %
              </Badge>
            </div>

            <div className="stack-sm">
              {result.items.map((it, i) => (
                <div key={i} style={{ padding: '10px 12px', border: `1px solid ${it.matchedId ? 'rgba(0,240,168,0.2)' : 'rgba(255,170,0,0.3)'}`, borderRadius: 12 }}>
                  <div className="row-between">
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{it.matchedLabel ?? it.rawName}</span>
                    <Badge tone={it.matchedId ? 'primary' : 'warning'}>{it.matchedId ? 'gefunden' : 'nicht in DB'}</Badge>
                  </div>
                  <div className="dim mono" style={{ fontSize: 11, marginTop: 4 }}>
                    ~{fmt(it.quantity, 0)} g · Konfidenz {fmt(it.confidence * 100, 0)} %
                    {it.cookingMethod ? ` · ${it.cookingMethod}` : ''}
                  </div>
                  {it.uncertainties.length > 0 && (
                    <p className="dim" style={{ fontSize: 11, marginTop: 4 }}>Unsicher: {it.uncertainties.join(', ')}</p>
                  )}
                  {it.matchedId && (
                    <p className="mono" style={{ fontSize: 11, marginTop: 4, color: 'var(--primary)' }}>
                      → {FOOD_MAP[it.matchedId].n.kcal} kcal · {FOOD_MAP[it.matchedId].n.protein} g P · {FOOD_MAP[it.matchedId].n.fat} g F /100 g (DB)
                    </p>
                  )}
                </div>
              ))}
            </div>

            {result.notVisible.length > 0 && (
              <p className="dim" style={{ fontSize: 11, marginTop: 8 }}>Nicht eindeutig sichtbar: {result.notVisible.join(', ')}</p>
            )}

            <p className="dim" style={{ fontSize: 11, marginTop: 10, fontStyle: 'italic' }}>
              Geschätzte Mengen — bitte vor dem Speichern prüfen. Nur erkannte Lebensmittel mit Datenbank-Treffer werden gespeichert.
            </p>

            <Button block style={{ marginTop: 10 }} disabled={result.items.filter((i) => i.matchedId).length === 0} onClick={saveScanned}>
              Speichern ({result.items.filter((i) => i.matchedId).length} Lebensmittel)
            </Button>
          </Card>
        )}
      </div>
    </>
  )
}
