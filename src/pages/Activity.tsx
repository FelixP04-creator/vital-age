/**
 * VITAL AGE — Aktivität & Trainingsjournal
 * Automatisch importierte + manuelle Einträge (klar getrennt),
 * Wochen-/Monatsübersicht, Selbsteinschätzung (Energie/Wohlbefinden/RPE).
 */
import { useMemo, useState } from 'react'
import { useApp } from '../store/useApp'
import { Card, Badge, Button, PageHeader, Sheet } from '../ui/components'
import { fmtMin, mean } from '../lib/stats'
import type { Activity, ActivityType } from '../lib/types'

const TYPES: ActivityType[] = ['Laufen', 'Kraft', 'Radfahren', 'Schwimmen', 'Yoga', 'Spaziergang', 'Fußball', 'Klettern', 'Sonstiges']

export default function Activity() {
  const { activities, addActivity, deleteActivity } = useApp()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'imported' | 'manual'>('all')

  const sorted = useMemo(() => [...activities].sort((a, b) => b.date.localeCompare(a.date)), [activities])
  const filtered = filter === 'all' ? sorted : sorted.filter((a) => a.source === filter)

  // Wochenübersicht (letzte 4 Wochen)
  const weeks = useMemo(() => {
    const now = new Date()
    const out: { label: string; count: number; min: number; kcal: number }[] = []
    for (let w = 3; w >= 0; w--) {
      const end = new Date(now)
      end.setDate(end.getDate() - w * 7)
      const start = new Date(end)
      start.setDate(start.getDate() - 6)
      const s = start.toISOString().slice(0, 10)
      const e = end.toISOString().slice(0, 10)
      const acts = activities.filter((a) => a.date >= s && a.date <= e)
      out.push({
        label: `${start.getDate()}.${start.getMonth() + 1}.`,
        count: acts.length,
        min: acts.reduce((a, x) => a + x.durationMin, 0),
        kcal: acts.reduce((a, x) => a + (x.caloriesKcal ?? 0), 0),
      })
    }
    return out
  }, [activities])

  const imported = activities.filter((a) => a.source === 'imported').length
  const manual = activities.length - imported

  return (
    <>
      <PageHeader title="Aktivität" back="/" action={<Button size="sm" onClick={() => setOpen(true)}>+ Erfassen</Button>} />
      <div className="page">
        {/* Filter */}
        <div className="seg">
          {([
            ['all', `Alle (${activities.length})`],
            ['imported', `Importiert (${imported})`],
            ['manual', `Manuell (${manual})`],
          ] as const).map(([k, l]) => (
            <button key={k} type="button" className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>

        {/* Wochenübersicht */}
        <Card title="Letzte 4 Wochen" icon={<span style={{ color: 'var(--tertiary)' }}>▦</span>}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Woche ab</th>
                <th className="num">Einheiten</th>
                <th className="num">Dauer</th>
                <th className="num">kcal</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.label}>
                  <td>{w.label}</td>
                  <td className="num">{w.count}</td>
                  <td className="num">{fmtMin(w.min)}</td>
                  <td className="num">{w.kcal > 0 ? w.kcal : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Historie */}
        {filtered.length === 0 ? (
          <Card>
            <p className="muted" style={{ fontSize: 13 }}>
              Keine Einträge. „+ Erfassen“ für ein manuelles Training — importierte Aktivitäten erscheinen hier nach der Synchronisation (klar als „importiert“ markiert).
            </p>
          </Card>
        ) : (
          <div className="stack-sm">
            {filtered.map((a) => (
              <div key={a.id} className="card" style={{ padding: '12px 14px' }}>
                <div className="row-between">
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</span>
                    <Badge tone={a.source === 'imported' ? 'secondary' : 'neutral'}>{a.source === 'imported' ? 'importiert' : 'manuell'}</Badge>
                  </div>
                  <button className="icon-btn" style={{ width: 28, height: 28, fontSize: 12 }} onClick={() => deleteActivity(a.id)} aria-label="Löschen">✕</button>
                </div>
                <div className="mono dim" style={{ fontSize: 12, marginTop: 4 }}>
                  {a.date} · {a.type} · {a.durationMin} min
                  {a.caloriesKcal !== null ? ` · ${a.caloriesKcal} kcal` : ''}
                </div>
                <div className="row" style={{ gap: 12, marginTop: 6 }}>
                  {a.avgHr !== null && <Chip label="Ø HF" value={`${a.avgHr} bpm`} />}
                  {a.maxHr !== null && <Chip label="max" value={`${a.maxHr}`} />}
                  {a.rpe !== null && <Chip label="RPE" value={`${a.rpe}/10`} />}
                  {a.energy !== null && <Chip label="Energie" value={`${a.energy}/5`} />}
                  {a.mood !== null && <Chip label="Wohlbef." value={`${a.mood}/5`} />}
                </div>
                {a.notes && <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{a.notes}</p>}
              </div>
            ))}
          </div>
        )}

        <p className="dim" style={{ fontSize: 11, textAlign: 'center' }}>
          Gemessene (importierte) und manuelle Einträge werden getrennt ausgewiesen und nie vermischt.
        </p>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Training erfassen">
        <ManualForm
          onSave={(a) => {
            addActivity(a)
            setOpen(false)
          }}
        />
      </Sheet>
    </>
  )
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="badge badge--neutral" style={{ textTransform: 'none' }}>
      <span className="dim">{label}</span> {value}
    </span>
  )
}

function ManualForm({ onSave }: { onSave: (a: Activity) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<ActivityType>('Laufen')
  const [durationMin, setDurationMin] = useState(30)
  const [rpe, setRpe] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [mood, setMood] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="stack-sm">
      <div className="field">
        <label>Bezeichnung</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Intervallläufer" />
      </div>
      <div className="grid-2">
        <div className="field">
          <label>Art</label>
          <select className="select" value={type} onChange={(e) => setType(e.target.value as ActivityType)}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Dauer (min)</label>
          <input className="input" type="number" min={1} max={720} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} />
        </div>
      </div>
      <div className="field">
        <label>Subjektive Anstrengung (RPE 1–10, optional)</label>
        <input className="input" type="number" min={1} max={10} value={rpe ?? ''} onChange={(e) => setRpe(e.target.value ? Number(e.target.value) : null)} />
      </div>
      <div className="grid-2">
        <div className="field">
          <label>Energie danach (1–5, optional)</label>
          <input className="input" type="number" min={1} max={5} value={energy ?? ''} onChange={(e) => setEnergy(e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div className="field">
          <label>Wohlbefinden (1–5, optional)</label>
          <input className="input" type="number" min={1} max={5} value={mood ?? ''} onChange={(e) => setMood(e.target.value ? Number(e.target.value) : null)} />
        </div>
      </div>
      <div className="field">
        <label>Notizen</label>
        <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Beliebige Anmerkungen" />
      </div>
      <Button
        block
        disabled={!name.trim()}
        onClick={() =>
          onSave({
            id: `man-${Date.now().toString(36)}`,
            date: today,
            type,
            name: name.trim(),
            durationMin: Math.max(1, Math.round(durationMin)),
            caloriesKcal: null,
            avgHr: null,
            maxHr: null,
            rpe,
            energy,
            mood,
            notes: notes.trim() || undefined,
            source: 'manual',
            createdAt: new Date().toISOString(),
          })
        }
      >
        Speichern (manuell)
      </Button>
    </div>
  )
}
