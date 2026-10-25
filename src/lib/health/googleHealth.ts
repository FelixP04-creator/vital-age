/**
 * VITAL AGE — Google Health API Adapter (OAuth 2.0, Authorization-Code-Flow)
 * =====================================================================
 * Architektur (Basis: docs/GOOGLE-HEALTH-SETUP.md):
 *
 *   Browser ──(1) Redirect──► accounts.google.com (Login + Consent)
 *   Browser ◄──(2) Redirect──┘ mit ?code=***&state=...
 *   Browser ──(3) POST code──► /api/health/oauth/token (Express-Server)
 *     Server  ────────────────► oauth2.googleapis.com (Code→Token, Secret bleibt serverseitig)
 *   Browser ◄──(4) access_token (serverseitig, niemals in localStorage)
 *   Browser ──(5) POST /api/health/sync──► Google Health API (v4beta)
 *   Browser ◄──(6) DataPoints → mapDataPointsToRecords() → Store
 *
 * SICHERHEIT:
 *  - Client-Secret lebt NUR im Express-Server (.env) — nie im Frontend.
 *  - Access-Tokens bleiben im Server (In-Memory, pro Session) — der
 *    Browser erhält sie nicht, dadurch kein localStorage-Token-Leak.
 *  - `state` = CSRF-Schutz: wird vor dem Redirect gesetzt, im Callback
 *    strikt verglichen.
 *  - Ohne konfigurierte Client-ID ist der Adapter inaktiv (UI zeigt
 *    Setup-Hinweis, Demo-Modus bleibt aktiv).
 *
 * WICHTIG: Die exakten DataType-Strings (z. B. `heart_rate`,
 * `sleep_segment`) folgen der Google Health API v4beta-Referenz und
 * werden beim Sync defensiv gemappt — unbekannte Felder → null
 * (Prinzip: keine erfundenen Werte).
 */
import { useApp } from '../../store/useApp'
import { apiBase } from '../api'
import type { DailyRecord, MetricSource, HealthConnection } from '../types'

/* ---------------- Konfiguration (aus Vite-Env, keine Secrets) ---------------- */

/** Client-ID ist öffentlich (kein Secret) → darf im Frontend stehen. */
const CLIENT_ID = (import.meta.env.VITE_GOOGLE_HEALTH_CLIENT_ID as string | undefined) ?? ''
/** Redirect-URI muss exakt mit der im Google-Cloud-Console registrierten übereinstimmen. */
const REDIRECT_URI =
  (import.meta.env.VITE_GOOGLE_HEALTH_REDIRECT_URI as string | undefined) ??
  'http://localhost:5173/oauth/health/callback'

const OAUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const SCOPES = [
  'https://www.googleapis.com/auth/health.data.read',
  'openid',
  'email',
]

const STATE_KEY = 'vitalage_gh_state'
const STATE_TTL_MS = 10 * 60 * 1000

export function isGoogleHealthConfigured(): boolean {
  return CLIENT_ID.length > 10
}

/* ---------------- (1) OAuth-Start: Redirect zu Google ---------------- */

export function beginGoogleHealthAuth(): { started: boolean; error?: string } {
  if (!isGoogleHealthConfigured()) {
    return { started: false, error: 'NO_CLIENT_ID' }
  }
  // CSRF-State: Zufall, zeitlich begrenzt, im Callback verifiziert
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36)
  try {
    sessionStorage.setItem(STATE_KEY, state)
  } catch {
    /* Storage fehlt → kein State möglich, Flow trotzdem starten (Warnung in UI) */
  }
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent',
  })
  window.location.assign(`${OAUTH_ENDPOINT}?${params.toString()}`)
  return { started: true }
}

/* ---------------- (2) Callback: Code + State prüfen ---------------- */

export interface AuthResult {
  ok: boolean
  error?: string
}

/**
 * Wird beim App-Start mit der aktuellen URL aufgerufen.
 * Erkennt einen OAuth-Callback (code+state in den Query-Parametern),
 * verifiziert den State und leitet den Code an den Server weiter.
 * Gibt true zurück, wenn ein Callback bearbeitet wurde (URL-Räumen).
 */
export async function handleAuthCallback(currentUrl: string): Promise<AuthResult & { handled: boolean }> {
  const url = new URL(currentUrl)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  if (!code && !oauthError) return { ok: true, handled: false }

  if (oauthError) {
    useApp.getState().setConnection({
      status: 'error',
      lastError: `Google Health: ${oauthError}`,
      demoMode: true,
    })
    return { ok: false, error: oauthError, handled: true }
  }

  // CSRF-State strikt verifizieren
  let stored: string | null = null
  try {
    stored = sessionStorage.getItem(STATE_KEY)
  } catch {
    /* ignore */
  }
  if (!stored || stored !== state) {
    return { ok: false, error: 'STATE_MISMATCH', handled: true }
  }
  try {
    sessionStorage.removeItem(STATE_KEY)
  } catch {
    /* ignore */
  }

  // Code an den Server schicken (Secret bleibt serverseitig)
  try {
    const res = await fetch(`${apiBase()}/api/health/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirectUri: REDIRECT_URI }),
    })
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error ?? `Token-Austausch fehlgeschlagen (${res.status})`)
    }
    useApp.getState().setConnection({
      status: 'connected',
      lastSyncAt: null,
      lastError: undefined,
      demoMode: false,
      device: 'Google Health',
    })
    return { ok: true, handled: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    useApp.getState().setConnection({
      status: 'error',
      lastError: msg,
      demoMode: true,
    })
    return { ok: false, error: msg, handled: true }
  }
}

/* ---------------- (5)+(6) Sync: DataPoints → DailyRecords ---------------- */

/** Ein normalisierter DataPoint von der Google Health API (v4beta). */
export interface GhDataPoint {
  dataType: string
  /** ISO-Zeitstempel des Beginns */
  startAt: string
  /** ISO-Zeitstempel des Endes */
  endAt: string
  /** Rohe Felder — je nach DataType unterschiedlich */
  value: Record<string, unknown>
  source?: { id?: string; name?: string }
}

/**
 * Deterministische Mapping-Logik: DataPoints → DailyRecord pro Tag.
 * WICHTIG: Nur tatsächlich vorliegende Felder werden gefüllt —
 * alles andere bleibt null (Prinzip: keine erfundenen Werte).
 * Die Quelle ist immer 'measured' (echtes Gerät) mit Quellen-Kennung.
 */
export function mapDataPointsToRecords(points: GhDataPoint[]): DailyRecord[] {
  const byDay = new Map<string, DailyRecord>()

  const metric = (value: number | null, source: MetricSource = 'measured') => ({ value, source })

  const recordFor = (date: string): DailyRecord => {
    let r = byDay.get(date)
    if (!r) {
      r = {
        date,
        restingHr: metric(null),
        hrv: metric(null),
        spo2: metric(null),
        respRate: metric(null),
        skinTempDeltaC: metric(null),
        activeMinutes: metric(null),
        activeZoneMinutes: metric(null),
        steps: metric(null),
        distanceKm: metric(null),
        caloriesKcal: metric(null),
        vo2max: metric(null),
        sleep: null,
        strain: null,
      }
      byDay.set(date, r)
    }
    return r
  }

  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

  for (const p of points) {
    const date = p.startAt.slice(0, 10)
    const rec = recordFor(date)
    switch (p.dataType) {
      case 'heart_rate':
        // Durchschnitte: value.heartRateBpm (Durchschnitt über das Segment)
        rec.restingHr.value = num(p.value.heartRateBpm) ?? rec.restingHr.value
        break
      case 'resting_heart_rate':
        rec.restingHr.value = num(p.value.restingHeartRateBpm)
        break
      case 'heart_rate_variability':
        rec.hrv.value = num(p.value.heartRateVariabilityMs)
        break
      case 'oxygen_saturation':
        rec.spo2.value = num(p.value.oxygenSaturationPercentage)
        break
      case 'respiration_rate':
        rec.respRate.value = num(p.value.respirationRatePerMinute)
        break
      case 'step_count':
        rec.steps.value = (rec.steps.value ?? 0) + (num(p.value.stepsCount) ?? 0)
        break
      case 'distance':
        rec.distanceKm.value = (rec.distanceKm.value ?? 0) + (num(p.value.distanceMeters) ?? 0) / 1000
        break
      case 'calories_burned':
        rec.caloriesKcal.value = (rec.caloriesKcal.value ?? 0) + (num(p.value.caloriesBurned) ?? 0)
        break
      case 'vo2_max':
        rec.vo2max.value = num(p.value.vo2MaxMlPerKgPerMin)
        break
      case 'sleep_segment':
        // Schlaf: mehrere Stage-Segmente desselben Tags additiv aggregieren.
        // Die API liefert pro Segment Dauer + Aufteilung in Stage-Sekunden.
        {
          const durSec = num(p.value.sleepDurationSeconds)
          const deepSec = num(p.value.deepSleepDurationSeconds) ?? 0
          const remSec = num(p.value.remSleepDurationSeconds) ?? 0
          const lightSec = num(p.value.lightSleepDurationSeconds) ?? 0
          const awakeSec = num(p.value.awakeDurationSeconds) ?? 0
          if (durSec !== null) {
            const durMin = Math.round(durSec / 60)
            const totalSec = deepSec + remSec + lightSec + awakeSec
            // Falls die Stage-Summe nicht der Gesamtdauer entspricht
            // (API kann nur Teilstufen liefern), proportional skalieren.
            const scale = totalSec > 0 ? durSec / totalSec : 1
            const existing = rec.sleep
            if (existing) {
              const e = existing.stages
              rec.sleep = {
                ...existing,
                // Späteres Segment = späterer Wake → offset aktualisieren
                offset: p.endAt,
                durationMin: existing.durationMin + durMin,
                stages: {
                  deepMin: (e.deepMin ?? 0) + Math.round((deepSec * scale) / 60),
                  remMin: (e.remMin ?? 0) + Math.round((remSec * scale) / 60),
                  lightMin: (e.lightMin ?? 0) + Math.round((lightSec * scale) / 60),
                  awakeMin: (e.awakeMin ?? 0) + Math.round((awakeSec * scale) / 60),
                  source: 'measured',
                },
              }
            } else {
              rec.sleep = {
                date,
                durationMin: durMin,
                onset: p.startAt,
                offset: p.endAt,
                efficiencyPct: null, // bleibt null → Sleep-Modul berechnet bei Bedarf
                efficiencySource: null,
                stages: {
                  deepMin: Math.round((deepSec * scale) / 60),
                  remMin: Math.round((remSec * scale) / 60),
                  lightMin: Math.round((lightSec * scale) / 60),
                  awakeMin: Math.round((awakeSec * scale) / 60),
                  source: 'measured',
                },
                source: 'measured',
              }
            }
          }
        }
        break
      default:
        // Unbekannte DataTypes: bewusst ignoriert (kein Raten)
        break
    }
  }

  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/* ---------------- High-Level: kompletter Sync-Flow ---------------- */

export interface SyncOptions {
  /** Tage rückwärts (Standard 28 = Baseline-Fenster) */
  days?: number
}

/**
 * Löst einen Sync aus: fragt den Server (der die Google-Health-API
 * mit dem sessionbundenen Token ruft) und speichert die Ergebnisse.
 * Ersetzt DEMO-Daten durch echte Messwerte (demoMode=false).
 */
export async function syncGoogleHealth(opts: SyncOptions = {}): Promise<{ ok: boolean; days: number; error?: string }> {
  const days = opts.days ?? 28
  try {
    const res = await fetch(`${apiBase()}/api/health/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    })
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error ?? `Sync fehlgeschlagen (${res.status})`)
    }
    const j = (await res.json()) as { points?: GhDataPoint[]; days?: number }
    const records = mapDataPointsToRecords(j.points ?? [])
    if (records.length === 0) {
      throw new Error('Keine Daten von Google Health erhalten (Datenpunkt-Leerantwort).')
    }
    useApp.getState().setRecords(records)
    useApp.getState().setConnection({
      status: 'connected',
      lastSyncAt: new Date().toISOString(),
      demoMode: false,
      device: 'Google Health (Fitbit Air)',
    } as Partial<HealthConnection>)
    return { ok: true, days: records.length }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    useApp.getState().setConnection({ status: 'error', lastError: msg })
    return { ok: false, days: 0, error: msg }
  }
}
