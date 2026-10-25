/**
 * VITAL AGE — Google-Health-Server-Modul (OAuth 2.0 + API-Brücke)
 * =====================================================================
 * Endpunkte (in server/index.ts gemountet):
 *  POST /api/health/oauth/token  — Autorisierungscode → Access-Token
 *  POST /api/health/sync         — DataPoints von der Google Health API holen
 *
 * SICHERHEIT:
 *  - GOOGLE_HEALTH_CLIENT_SECRET lebt NUR hier (.env) — nie im Frontend.
 *  - Access-Tokens: In-Memory-Store (Session-Map), keine Persistenz,
 *    kein Token im Browser (der Client holt Daten immer über diesen Server).
 *  - Der Server speichert KEINE Gesundheitsdaten — nur kurzlebiges
 *    Token + ein 1:1-Forward der API-Antwort an den Client.
 *
 * API: Google Health API v4beta — https://health.googleapis.com
 *      (aktuelle API; die alte Fitbit-Web-API wird NICHT verwendet)
 */
import express from 'express'

const API_BASE = 'https://health.googleapis.com/v4beta'

/* ---------------- Token-Store (In-Memory, pro Server-Instanz) ---------------- */

interface GhSession {
  accessToken: string
  refreshToken: string
  expiresAt: number // Epoch-Ms
}

// Bewusst minimal: 1 Nutzer pro Server-Instanz (Lokal-Server).
// Für mehrere Nutzer: Key = session/userId, hier: 'default'.
const sessions = new Map<string, GhSession>()
const KEY = 'default'

function env(): NodeJS.ProcessEnv {
  return process.env
}

export function googleHealthConfigured(): boolean {
  const e = env()
  return !!e.GOOGLE_HEALTH_CLIENT_ID && !!e.GOOGLE_HEALTH_CLIENT_SECRET
}

async function ensureFreshToken(): Promise<string | null> {
  const s = sessions.get(KEY)
  if (!s) return null
  // 60 s Puffer vor Ablauf
  if (Date.now() < s.expiresAt - 60_000) return s.accessToken
  const e = env()
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: e.GOOGLE_HEALTH_CLIENT_ID ?? '',
        client_secret: e.GOOGLE_HEALTH_CLIENT_SECRET ?? '',
        refresh_token: s.refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    if (!res.ok) return null
    const j = (await res.json()) as {
      access_token: string
      expires_in: number
      refresh_token?: string
    }
    const next: GhSession = {
      accessToken: j.access_token,
      refreshToken: j.refresh_token ?? s.refreshToken,
      expiresAt: Date.now() + j.expires_in * 1000,
    }
    sessions.set(KEY, next)
    return next.accessToken
  } catch {
    return null
  }
}

/* ---------------- POST /api/health/oauth/token ---------------- */

export const handleOAuthToken: express.RequestHandler = async (req, res) => {
  const { code, redirectUri } = (req.body ?? {}) as { code?: string; redirectUri?: string }
  const e = env()

  if (!googleHealthConfigured()) {
    res.status(503).json({ error: 'Google Health nicht konfiguriert (Client-ID/Secret fehlen im Server .env).' })
    return
  }
  if (!code || typeof code !== 'string' || code.length < 20) {
    res.status(400).json({ error: 'Ungültiger Autorisierungscode.' })
    return
  }

  try {
    const res2 = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: e.GOOGLE_HEALTH_CLIENT_ID ?? '',
        client_secret: e.GOOGLE_HEALTH_CLIENT_SECRET ?? '',
        redirect_uri: redirectUri ?? '',
        grant_type: 'authorization_code',
      }),
    })
    if (!res2.ok) {
      const j = (await res2.json().catch(() => ({}))) as { error_description?: string }
      throw new Error(j.error_description ?? `Token-Austausch fehlgeschlagen (${res2.status})`)
    }
    const j = (await res2.json()) as {
      access_token: string
      refresh_token?: string
      expires_in: number
    }
    sessions.set(KEY, {
      accessToken: j.access_token,
      refreshToken: j.refresh_token ?? '',
      expiresAt: Date.now() + j.expires_in * 1000,
    })
    // Der Browser bekommt NICHT den Token — nur Bestätigung.
    res.json({ ok: true })
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Token-Austausch fehlgeschlagen.' })
  }
}

/* ---------------- POST /api/health/sync ---------------- */

/** Von der App gewünschte DataTypes (Google Health v4beta-Strings). */
const DATA_TYPES = [
  'resting_heart_rate',
  'heart_rate',
  'heart_rate_variability',
  'oxygen_saturation',
  'respiration_rate',
  'step_count',
  'distance',
  'calories_burned',
  'vo2_max',
  'sleep_segment',
]

interface GhDataPoint {
  dataType: string
  startAt: string
  endAt: string
  value: Record<string, unknown>
}

/**
 * Holt für eine Liste von DataTypes die DataPoints des letzten `days`-Fensters.
 * Liefert flach normalisierte Punkte (value-Objekt bereits entpackt).
 */
async function fetchDataType(token: string, dataType: string, startAt: string, endAt: string): Promise<GhDataPoint[]> {
  const out: GhDataPoint[] = []
  let pageToken: string | undefined
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({
      pageSize: '500',
      startTimeZone: 'Europe/Berlin',
      endTimeZone: 'Europe/Berlin',
      startTime: startAt,
      endTime: endAt,
    })
    if (pageToken) params.set('pageToken', pageToken)
    const url = `${API_BASE}/users/me/dataTypes/${encodeURIComponent(dataType)}/dataPoints?${params}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      const body = (await res.text().catch(() => '')) as string
      throw new Error(`Google Health ${dataType}: HTTP ${res.status} ${body.slice(0, 160)}`)
    }
    const j = (await res.json()) as {
      dataPoints?: {
        type?: string
        timeRange?: { startTime?: string; endTime?: string }
        metrics?: Record<string, { value?: { floatValue?: number } }>
      }[]
      nextPageToken?: string
    }
    for (const dp of j.dataPoints ?? []) {
      // Metriken flach in ein value-Objekt (floatValue-Extraktion)
      const value: Record<string, unknown> = {}
      for (const [k, m] of Object.entries(dp.metrics ?? {})) {
        if (m && typeof m.value?.floatValue === 'number') value[k] = m.value.floatValue
      }
      if (dp.timeRange?.startTime && dp.timeRange?.endTime) {
        out.push({
          dataType: dp.type ?? dataType,
          startAt: dp.timeRange.startTime,
          endAt: dp.timeRange.endTime,
          value,
        })
      }
    }
    pageToken = j.nextPageToken
    if (!pageToken) break
  }
  return out
}

export const handleHealthSync: express.RequestHandler = async (req, res) => {
  const { days } = (req.body ?? {}) as { days?: number }
  const window = Math.min(Math.max(Number(days) || 28, 1), 90)

  if (!googleHealthConfigured()) {
    res.status(503).json({ error: 'Google Health nicht konfiguriert.' })
    return
  }
  const token = await ensureFreshToken()
  if (!token) {
    res.status(401).json({ error: 'Keine aktive Google-Health-Sitzung. Bitte neu verbinden.' })
    return
  }

  const end = new Date()
  const start = new Date(end.getTime() - window * 86_400_000)
  const fmt = (d: Date) => d.toISOString()

  try {
    // Sequenziell (Rate-Limit-schonend), Fehler pro DataType isoliert
    const all: GhDataPoint[] = []
    const errors: string[] = []
    for (const dt of DATA_TYPES) {
      try {
        const pts = await fetchDataType(token, dt, fmt(start), fmt(end))
        all.push(...pts)
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err))
      }
    }
    res.json({ points: all, days: window, errors })
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Sync fehlgeschlagen.' })
  }
}
