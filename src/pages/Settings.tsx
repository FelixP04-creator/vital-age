/**
 * VITAL AGE — Einstellungen
 * =====================================================================
 * Profil (Alter, Größe, Gewicht, Ziele, Präferenzen), Theme,
 * KI-Status (lokaler Provider), Google-Health-Verbindung und
 * Daten-Verwaltung (Demo zurücksetzen / alle Daten löschen).
 */
import { useState } from 'react'
import { Card, Badge, Button, PageHeader, Segmented } from '../ui/components'
import { useApp } from '../store/useApp'
import { DEFAULT_API_BASE } from '../lib/api'
import type { NutritionGoal } from '../lib/types'
import {
  beginGoogleHealthAuth,
  syncGoogleHealth,
  isGoogleHealthConfigured,
} from '../lib/health/googleHealth'

const GOALS: { id: NutritionGoal; label: string }[] = [
  { id: 'general-health', label: 'Gesundheit allgemein' },
  { id: 'balanced', label: 'Ausgewogen essen' },
  { id: 'sport-performance', label: 'Sportliche Leistung' },
  { id: 'protein', label: 'Mehr Eiweiß' },
  { id: 'fiber', label: 'Mehr Ballaststoffe' },
  { id: 'variety', label: 'Vielfalt' },
]

const FAT_PREFS = ['Mediterran', 'Pflanzlich-betont', 'Nüsse & Samen', 'Fetter Fisch', 'Sättigende Fette']

export default function Settings() {
  const { profile, updateProfile, theme, setTheme, connection, setConnection, resetDemoData, wipeAllData } =
    useApp()
  const [height, setHeight] = useState(String(profile.heightCm))
  const [weight, setWeight] = useState(String(profile.weightKg))
  const [fatTouched, setFatTouched] = useState(false)
  const [fatSel, setFatSel] = useState<string[]>(profile.fatPreferences)
  const [confirmWipe, setConfirmWipe] = useState(false)

  const toggleGoal = (g: NutritionGoal) => {
    const has = profile.goals.includes(g)
    updateProfile({ goals: has ? profile.goals.filter((x) => x !== g) : [...profile.goals, g] })
  }

  const toggleFat = (f: string) => {
    setFatTouched(true)
    const has = fatSel.includes(f)
    setFatSel(has ? fatSel.filter((x) => x !== f) : [...fatSel, f])
    updateProfile({ fatPreferences: has ? fatSel.filter((x) => x !== f) : [...fatSel, f] })
  }

  const saveBody = () => {
    const h = Number(height)
    const w = Number(weight)
    updateProfile({
      heightCm: Number.isFinite(h) ? h : profile.heightCm,
      weightKg: Number.isFinite(w) ? w : profile.weightKg,
    })
  }

  const connected = connection?.status === 'connected'
  const demo = connection?.demoMode === true
  const ghConfigured = isGoogleHealthConfigured()
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const doSync = async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const r = await syncGoogleHealth({ days: 28 })
      if (r.ok) {
        setSyncMsg(`Sync erledigt: ${r.days} Tage geladen.`)
      } else {
        setSyncMsg(`Sync fehlgeschlagen: ${r.error ?? 'unbekannter Fehler'}`)
      }
    } finally {
      setSyncing(false)
    }
  }


  const [apiBaseInput, setApiBaseInput] = useState(() => localStorage.getItem('vitalage_api_base') ?? '')
  const [apiBaseSaved, setApiBaseSaved] = useState(false)
  return (
    <>
      <PageHeader title="Einstellungen" back="/" />
      <div className="page">
        {/* Profil */}
        <Card>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Profil</h3>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <label className="field">
              <span className="dim" style={{ fontSize: 12 }}>Größe (cm)</span>
              <input className="input" type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
            </label>
            <label className="field">
              <span className="dim" style={{ fontSize: 12 }}>Gewicht (kg)</span>
              <input className="input" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </label>
            <Button variant="primary" onClick={saveBody}>Speichern</Button>
          </div>
          {profile.birthDate && (
            <p className="dim" style={{ fontSize: 12, marginTop: 8 }}>
              Geburtsdatum: {profile.birthDate} · Geschlecht: {profile.sex}
            </p>
          )}
        </Card>

        {/* Ernährungsziele */}
        <Card>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Ernährungsziele</h3>
          <div className="stack" style={{ gap: 8 }}>
            {GOALS.map((g) => {
              const on = profile.goals.includes(g.id)
              return (
                <button
                  key={g.id}
                  className="chip"
                  style={{
                    border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                    background: on ? 'color-mix(in oklab, var(--primary) 14%, transparent)' : 'transparent',
                    color: on ? 'var(--primary)' : 'var(--fg)',
                    cursor: 'pointer',
                    fontSize: 13,
                    padding: '8px 12px',
                    borderRadius: 10,
                    textAlign: 'left',
                  }}
                  onClick={() => toggleGoal(g.id)}
                >
                  {on ? '✓ ' : ''}{g.label}
                </button>
              )
            })}
          </div>
        </Card>

        {/* Fettpräferenzen */}
        <Card>
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Fettpräferenzen</h3>
          <p className="dim" style={{ fontSize: 12, marginBottom: 10 }}>
            Wird für die Fettquellen-Analyse in Mahlzeiten genutzt.
          </p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {FAT_PREFS.map((f) => (
              <button
                key={f}
                className="chip"
                style={{
                  border: `1px solid ${fatSel.includes(f) ? 'var(--primary)' : 'var(--border)'}`,
                  background: fatSel.includes(f) ? 'color-mix(in oklab, var(--primary) 14%, transparent)' : 'transparent',
                  color: fatSel.includes(f) ? 'var(--primary)' : 'var(--fg)',
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: '6px 10px',
                  borderRadius: 999,
                }}
                onClick={() => toggleFat(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </Card>

        {/* Theme */}
        <Card>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Darstellung</h3>
          <Segmented
            value={theme}
            onChange={(v) => setTheme(v as 'dark' | 'light')}
            options={[
              { value: 'dark', label: 'Dunkel' },
              { value: 'light', label: 'Hell' },
            ]}
          />
        </Card>

        {/* KI-Status */}
        <Card>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>KI (lokal)</h3>
          <p className="muted" style={{ fontSize: 13 }}>
            Coach & Foto-Scanner nutzen ein <strong>lokal laufendes, bildfähiges Modell</strong>
            (Ollama oder LM Studio) — deine Daten verlassen das Gerät nicht. Ohne erreichbares
            Modell arbeitet der Coach mit klar gekennzeichneter Regel-Engine.
          </p>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <Badge tone="neutral">Ollama · localhost:11434</Badge>
            <Badge tone="neutral">LM Studio · 192.168.56.1:1234</Badge>
          </div>
        </Card>

        {/* Google Health */}
        <Card>
          <div className="row-between" style={{ alignItems: 'center' }}>
            <h3 style={{ margin: '0', fontSize: 15 }}>Google Health (Fitbit Air)</h3>
            <Badge tone={connected ? 'primary' : 'neutral'}>
              {connected ? 'verbunden' : demo ? 'Demo-Daten' : 'nicht verbunden'}
            </Badge>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            {connected
              ? `Letzter Sync: ${connection?.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString('de-DE') : '–'}`
              : demo
                ? 'Aktuell werden klar gekennzeichnete Demo-Daten angezeigt. Für echte Messwerte mit Google Health verbinden.'
                : 'Noch keine Verbindung. Für echte Messwerte mit deinem Google-Konto verbinden (Fitbit-Air-Daten fließen über die Google Health API ein).'}
          </p>
          {!ghConfigured && (
            <p className="dim" style={{ fontSize: 12, marginTop: 8 }}>
              Setup offen: Client-ID fehlt im Build. Details: <code>docs/GOOGLE-HEALTH-SETUP.md</code> (Schritt 1–7, inkl. Redirect-URI und Scope-Freischaltung).
            </p>
          )}
          {connected && connection?.lastError && (
            <p style={{ fontSize: 12, marginTop: 8, color: 'var(--error)' }}>{connection.lastError}</p>
          )}
          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {!connected && (
              <Button
                variant="primary"
                disabled={!ghConfigured}
                onClick={() => {
                  const r = beginGoogleHealthAuth()
                  if (!r.started) setSyncMsg('Client-ID fehlt — Setup in docs/GOOGLE-HEALTH-SETUP.md.')
                }}
              >
                Mit Google Health verbinden
              </Button>
            )}
            {connected && (
              <Button variant="ghost" disabled={syncing} onClick={doSync}>
                {syncing ? 'Synchronisiere…' : 'Jetzt synchronisieren'}
              </Button>
            )}
            {connected && (
              <Button
                variant="danger"
                onClick={() =>
                  setConnection({
                    status: 'disconnected',
                    lastSyncAt: null,
                    lastError: undefined,
                    demoMode: true,
                    device: 'Fitbit Air (Demo)',
                  })
                }
              >
                Trennen
              </Button>
            )}
          </div>
          {syncMsg && <p className="dim" style={{ fontSize: 12, marginTop: 8 }}>{syncMsg}</p>}
        </Card>

        {/* API-Basis (KI-Server) */}
        <Card>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>API-Basis (KI-Server)</h3>
          <p className="dim" style={{ fontSize: 12, marginBottom: 8 }}>
            Wo der lokale KI-Server erreichbar ist. Im PC-Browser wird automatisch die
            eigene Herkunft genutzt; in der Handy-App meist die LAN-IP deines PCs.
          </p>
          <input
            className="input mono"
            value={apiBaseInput}
            onChange={(e) => setApiBaseInput(e.target.value)}
            placeholder={DEFAULT_API_BASE}
          />
          <Button
            variant="ghost"
            style={{ marginTop: 8 }}
            onClick={() => {
              localStorage.setItem('vitalage_api_base', apiBaseInput.trim())
              setApiBaseSaved(true)
              setTimeout(() => setApiBaseSaved(false), 2000)
            }}
          >
            {apiBaseSaved ? 'Gespeichert ✓' : 'Speichern'}
          </Button>
          <p className="dim" style={{ fontSize: 11, marginTop: 6 }}>
            Leer = gleiche Herkunft (PC-Browser). Standard: {DEFAULT_API_BASE}
          </p>
        </Card>

        {/* Daten */}
        <Card>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Daten</h3>
          <p className="muted" style={{ fontSize: 13 }}>
            Alle Daten liegen lokal in deinem Browser (localStorage).{demo && ' Aktuell sind Demo-Daten geladen (klar gekennzeichnet).'}
          </p>
          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <Button variant="ghost" onClick={resetDemoData}>Demo-Daten zurücksetzen</Button>
            {!confirmWipe ? (
              <Button variant="danger" onClick={() => setConfirmWipe(true)}>Alle Daten löschen …</Button>
            ) : (
              <>
                <Button variant="danger" onClick={wipeAllData}>Ja, endgültig löschen</Button>
                <Button variant="ghost" onClick={() => setConfirmWipe(false)}>Abbrechen</Button>
              </>
            )}
          </div>
        </Card>

        <Card>
          <p className="dim" style={{ fontSize: 12 }}>
            VITAL AGE v0.1.0 · Keine Cloud-Daten ohne deine Entscheidung · Kein Medizinprodukt.
          </p>
        </Card>
      </div>
    </>
  )
}
