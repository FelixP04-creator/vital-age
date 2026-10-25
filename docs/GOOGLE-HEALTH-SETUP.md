# VITAL AGE — Google Health API Setup (OAuth 2.0)

Echte Anbindung der App an **Google Health** (die Nachfolger-API, auf die
Fitbit-Daten seit 2024 migriert sind). Die **veraltete Fitbit-Web-API wird
NICHT** verwendet. Fitbit-Air-Geräte liefern ihre Messwerte über den
verbundenen Google-Konto — über diese API lesen wir sie aus.

- **API-Referenz:** https://developers.google.com/health
- **REST v4beta:** `https://health.googleapis.com/v4beta/users/me/...`
- **OAuth-Provider:** Google (accounts.google.com / oauth2.googleapis.com)

> ⚠️ **Hinweis:** Die Google Health API ist zum Teil in **Public Preview** —
> Endpunkte können sich ändern. Die App liest die Daten defensiv (unbekannte
> Felder → `null`, nie erfundene Werte).

---

## Architektur (so läuft der Flow)

```
 Browser            Google                Express-Server            Google Health API
    │  (1) Redirect   │                        │                           │
    ├─────────────────►│ Login + Consent        │                           │
    │  (2) ?code=***&state=…  │                        │                           │
    │◄─────────────────┤                        │                           │
    │  (3) POST /api/health/oauth/token {code}   │                           │
    ├───────────────────────────────────────────►│                           │
    │                                            │ (4) code→tokens           │
    │                                            ├──────────────────────────►│
    │                                            │◄──────────────────────────┤
    │  (5) ok:true  (Tokens bleiben auf dem Server)                        │
    │◄───────────────────────────────────────────┤                           │
    │  (6) POST /api/health/sync {days: 28}      │                           │
    ├───────────────────────────────────────────►│ (7) dataPoints (paginiert)│
    │                                            ├──────────────────────────►│
    │                                            │◄──────────────────────────┤
    │  (8) {points: […]}  → mapDataPointsToRecords() → Store                │
    │◄───────────────────────────────────────────┤                           │
```

**Sicherheitsmodell:**
- Das **Client-Secret** liegt NUR im Express-Server (`.env`) — nie im Frontend,
  nie im Bundle, nie im Git.
- **Access/Refresh-Tokens** bleiben auf dem Server (In-Memory-Store).
  Der Browser erhält sie nicht → kein localStorage-Token-Leak.
- **`state`-Parameter** = CSRF-Schutz (strikt im Callback verglichen, 10 min TTL).
- Ohne konfigurierte Client-ID ist der Adapter inaktiv: Die UI zeigt
  Setup-Hinweis und Demo-Modus bleibt aktiv (klar gekennzeichnet).

---

## Setup-Checkliste (einmalig, ca. 15 min)

### 1. Google-Cloud-Projekt anlegen
1. [console.cloud.google.com](https://console.cloud.google.com) → neues Projekt
   (z. B. `vital-age`).
2. **APIs & Dienste → APIs & Dienste aktivieren** → **Google Health API** aktivieren.
3. **Authifizierungs-Bildschirme** → **OAuth-Zustimmungsformular**:
   - Produktname: `Vital Age (dev)`
   - Nutzer-Typ: **Intern** (für den eigenen Account reicht das — keine
     Google-Prüfung nötig, solange du der einzige Nutzer bist)
   - Scope `health.data.read`: bei internem Typ keine zusätzliche Freigabe.

### 2. OAuth-Client anlegen
**Authifizierungs-Bildschirme → Anmeldeanmeldedaten → OAuth 2.0-Client-ID:**
- Anwendungstyp: **Webanwendung**
- Autorisierte JavaScript-Quell-URIs: `http://localhost:5173`
- Autorisierte Weiterleitungs-URIs: `http://localhost:5173/oauth/health/callback`
- Client-ID + Client-Secret kopieren.

> Für Produktion (Hosting): Weiterleitungs-URI und JS-URI auf die echte
> Domain ändern (z. B. `https://app.deine-domain.de/...`).

### 3. Server konfigurieren
In `server/.env` (oder `.env` im Projektroot — **wird nicht gecommittet**):

```env
# Google Health OAuth (SECRET — niemals in Git!)
GOOGLE_HEALTH_CLIENT_ID=paste-die-client-id-hier.apps.googleusercontent.com
GOOGLE_HEALTH_CLIENT_SECRET=paste-das-secret-hier
```

Beide Variablen stehen bereits als Platzhalter in `.env.example`.

### 4. Frontend konfigurieren
In `.env` (root):

```env
# Öffentlich (darf im Frontend stehen) — muss zu Schritt 2 passen
VITE_GOOGLE_HEALTH_CLIENT_ID=paste-die-client-id-hier.apps.googleusercontent.com
VITE_GOOGLE_HEALTH_REDIRECT_URI=http://localhost:5173/oauth/health/callback
```

> Die **Default-Redirect-URI** ist `http://localhost:5173/oauth/health/callback`
> (Vite-Dev-Port). In Produktion: eigene URL.

### 5. Starten
```bash
npm run dev        # Frontend auf :5173
npm run server     # Express-Server auf :8787 (mit .env-Laden)
```

### 6. Verbinden
1. App öffnen → **Einstellungen** → Karte „Google Health (Fitbit Air)“.
2. **„Mit Google Health verbinden“** → Google-Login + Consent.
3. Nach dem Redirect automatisch: Token-Tausch + **Sync der letzten 28 Tage**
   (Baseline-Fenster). Status wird „verbunden“, `demoMode` geht auf `false`.

### 7. Prüfen
- Karte zeigt „verbunden“ + Letzter-Sync-Zeitstempel.
- **Daten-Quelle:** Alle echten Werte tragen das Badge `measured`
  (vs. `Demo`/`computed`/`estimated`).
- Trennen: „Trennen“-Button → Demo-Modus (klar gekennzeichnet).

---

## Welche Daten werden gelesen?

| DataType (v4beta)        | Feld (Metrik)                    | → DailyRecord-Feld  |
| ------------------------ | -------------------------------- | ------------------- |
| `resting_heart_rate`     | `restingHeartRateBpm`            | `restingHr`         |
| `heart_rate`             | `heartRateBpm` (Ø des Segments)  | `restingHr` (Fallback) |
| `heart_rate_variability` | `heartRateVariabilityMs`         | `hrv`               |
| `oxygen_saturation`      | `oxygenSaturationPercentage`     | `spo2`              |
| `respiration_rate`       | `respirationRatePerMinute`       | `respRate`          |
| `step_count`             | `stepsCount` (Σ je Tag)          | `steps`             |
| `distance`               | `distanceMeters` (Σ je Tag)      | `distanceKm`        |
| `calories_burned`        | `caloriesBurned` (Σ je Tag)      | `caloriesKcal`      |
| `vo2_max`                | `vo2MaxMlPerKgPerMin`            | `vo2max`            |
| `sleep_segment`          | `sleepDurationSeconds`, `deepSleepDurationSeconds`, `remSleepDurationSeconds`, `lightSleepDurationSeconds`, `awakeDurationSeconds` | `sleep` (Stages) |

- **Zeitzone:** `Europe/Berlin` (Server-Sync).
- **Fenster:** 1–90 Tage (Default 28).
- **Pagination:** 500 Punkte/Seite, max. 10 Seiten pro DataType.
- **Fehler pro DataType sind isoliert** (ein leerer Feed blockt den Rest nicht;
  Fehlerliste kommt mit in der Antwort).

> **Korrektur-Vermerk:** Die exakten Metrik-Strings (z. B. `restingHeartRateBpm`)
> folgen der v4beta-Referenz `DataType`/`Metrics`-Doku. Sobald die API
> produktiv erreichbar ist, evtl. per Debug-Header (`x-goog-request-...`) oder
> via `dataTypes`-List-Endpoint verifizieren. Der Mapper wirft unbekannte
> Felder kontrolliert weg → **keine falschen Werte, nur null**.

---

## Produktions-Notizen

1. **Redirect-URI muss exakt stimmen** (inkl. Scheme + Port + Pfad).
2. **HTTPS** ab dem ersten öffentlichen Hosting (Google verlangt das für
   Nicht-Lokale Redirects).
3. **Token-Store:** aktuell In-Memory (Server-Neustart = neu verbinden).
   Für Multi-User/Persistenz: in Supabase (`sessions`-Table, siehe
   `supabase/migrations/`) verschieben — Schema-Platzhalter ist vorhanden.
4. **Rate-Limits:** Google Health API hat pro-DatenTyp-Limits; der Server
   ruft sequenziell (nicht parallel) und paginiert → bereits schonend.
5. **Keine Medizin-Diagnosen:** Die App zeigt Kennzahlen + Trends, keine
   Diagnostik (siehe `docs/MEDICAL-DISCLAIMER.md` / Evidence-Page).

---

## Troubleshooting

| Symptom | Ursache | Fix |
| --- | --- | --- |
| „Client-ID fehlt im Build“ in Settings | `VITE_GOOGLE_HEALTH_CLIENT_ID` leer | `.env` setzen + Vite-Dev-Server neustarten |
| `redirect_uri_mismatch` bei Google | Redirect-URI passt nicht zur Console | Schritt 2 + 4 exakt abgleichen (Port, Pfad) |
| `STATE_MISMATCH` nach Callback | State verloren (Tab geschlossen, 10+ min) | Neu verbinden (Button) |
| „Keine Daten von Google Health erhalten“ | Konto hat keine Health-Daten / Fitbit nicht verbunden | Fitbit-App → Google-Health-Verbindung prüfen; Daten in der Google-Health-App prüfen |
| `invalid_grant` beim Token-Tausch | Code schon verbraucht / abgelaufen | Neu verbinden |
| 503 „nicht konfiguriert“ vom Server | `GOOGLE_HEALTH_CLIENT_SECRET` fehlt im Server `.env` | Schritt 3 + Server neustarten |
