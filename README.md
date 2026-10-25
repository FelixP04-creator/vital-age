# VITAL AGE

> Premium Health-, Fitness- & Longevity-Dashboard im Obsidian-Biometrics-Stil.
> Web-First PWA + iOS-/Android-App (Capacitor).

VITAL AGE bündelt biometrische Messwerte (HRV, Ruhe-HF, SpO₂, Atmung, Skin-Temp,
Schlaf, Aktivität) in einen täglichen **Recovery-**, **Strain-** und **Vitality-Score** —
mit dokumentierter, getesteter Berechnungslogik, lokaler KI (Text + Bild),
Ernährungs-Tracking auf USDA-Basis und echter Anbindung an **Google Health**
(Nachfolger-API für Fitbit-Daten — die veraltete Fitbit-Web-API wird NICHT genutzt).

**Kein Medical-Device.** Alle Scores sind Kennzahlen & Trends — keine Diagnose.
Jeder Wert trägt eine Quellen-Kennzeichnung: `measured` (gemessen) / `computed`
(berechnet) / `estimated` (geschätzt). Fehlende Daten = `null`, **niemals** `0`.

---

## Features

| Bereich | Was |
| --- | --- |
| **Recovery** | 0–100 aus HRV/Ruhe-HF-Abweichung (Baseline, Rolling Window, robuste Statistik) + Schlaf + Regeneration |
| **Strain** | 0–21 aus Aktivität (Minuten, Intensitätszonen) + Workout-Last |
| **Sleep** | Dauer, Stages (Tiefschlaf/REM/Licht/ Wach), Onset/Offset-Routine, Konsistenz — über Mitternacht korrekt behandelt |
| **Vitality** | 0–100 aus Fitness (VO₂max), Aktivität, Ruhe-Parameter |
| **Baselines** | Median + MAD (robust) über 28-Tage-Fenster; nie aus <2 Datenpunkten geschätzt |
| **KI-Coach** | Kleines **lokales** Modell (Ollama → LM Studio → optional remote, OpenAI-kompatibel) mit **Bilderkennung** (Food-Scanner); Prompt-Injection-Schutz; regelbasierter Fallback ohne simulierte Antworten |
| **Ernährung** | Food-Log, Foto-Scan (LLM erkennt nur Name/Menge → Nährwerte deterministisch aus USDA-DB, CC0), Meal Score 1–10, Makros, Evidenz- & Perspektiven-Seiten |
| **Google Health** | OAuth 2.0 (Authorization Code + state), Read-only-Scopes, Token-Tausch serverseitig, 28-Tage-Sync, `measured`-Badge |
| **Daten** | Demo-Modus (deterministischer Seed-RNG) klar gekennzeichnet; Supabase-Ready (Postgres, RLS) |

## Tech-Stack

- **Frontend:** React 19 + Vite 7 + TypeScript, Zustand, React Router (HashRouter), `vite-plugin-pwa`
- **Design:** Custom Dark-Theme „Obsidian Biometrics“ (`#0B0F12` BG, Mint `#00F0A8`, Sensor-Punkt `#70FF00`), CSS-Var-Tokens in `src/styles/tokens.css`
- **KI-Server:** Express (Port 8787) — Provider-Adapter-Muster (`server/llm.ts`), JSON-Zwang via Schema-Extraktion, Rate-Limit 15/min/IP auf `/api/coach/ask`
- **Berechnungs-Engine:** `src/lib/scoring/*` (modular, jede Formel getest)
- **Ernährung:** `src/lib/nutrition/*` (USDA FoodData Central, CC0 1.0 Universal)
- **Mobile:** Capacitor (Android-APK + iOS-Projekt)
- **Persistence:** localStorage (PWA) / Supabase (Postgres + RLS + Edge-Functions-ready)
- **Tests:** Vitest (66 Tests: Scoring, Stats, Ernährung, Rule-Engine, LLM-Adapter)

---

## Projektstruktur

```
vital-age/
├── src/
│   ├── lib/
│   │   ├── types.ts          # Kern-Typen (DailyRecord, SleepData, Baseline, …)
│   │   ├── stats.ts          # Robuste Statistik (Median, MAD, stdDev n-1, fmt*)
│   │   ├── demo.ts           # Deterministische Demo-Daten (mulberry32)
│   │   ├── api.ts            # API-Basis (Settings-Config)
│   │   ├── health/googleHealth.ts  # OAuth-Flow + DataPoint→Record-Mapping
│   │   ├── scoring/          # baseline, recovery, strain, sleep, vitality, index
│   │   ├── nutrition/        # db (USDA), calc, mealScore, fatSources, absorption
│   │   └── coach/ruleEngine.ts     # Regelbasierter Fallback (keine Fake-KI)
│   ├── pages/                # 15 Seiten: Home, Recovery, Sleep, Strain, Vitality,
│   │   │                     #   Trends, Activity, Coach, FoodLog, MealDetail,
│   │   │                     #   FoodScan, Evidence, Perspectives, Absorption, Settings
│   ├── store/useApp.ts       # Zustand-Store
│   └── ui/                   # Komponenten (ScoreRing, SourceBadge, Cards, Nav)
├── server/                   # Express-API (KI + Google-Health-Brücke)
│   ├── llm.ts                # Provider-Adapter (Ollama/LM-Studio/remote, Vision, JSON)
│   ├── coach.ts / coachData.ts  # /api/coach/ask (Rate-Limit, Injection-Schutz)
│   ├── foodScan.ts           # /api/food/scan (LLM → USDA-DB-deterministisch)
│   ├── healthAuth.ts         # /api/health/oauth/token + /api/health/sync
│   └── index.ts              # :8787, CORS, 10MB JSON
├── supabase/migrations/      # 0001_initial_schema.sql (RLS auf allen Tabellen)
├── docs/
│   └── GOOGLE-HEALTH-SETUP.md  # 7-Schritte-Setup + Troubleshooting
├── android/  (Capacitor)     # Android-Gradle-Projekt → Debug-APK
├── ios/      (Capacitor)     # Xcode-Projekt (Build: Mac/Xcode nötig)
├── android-build/            # Artefakt: vital-age-debug.apk
├── scripts/gen-icons.mjs     # PWA-Icon-Generator
├── vitest.config.ts          # Standalone-Test-Config (ohne PWA-Plugin)
└── .env.example              # Nur Platzhalter — KEINE echten Geheimnisse!
```

---

## Schnellstart

### Voraussetzungen
- Node.js ≥ 20 (entwickelt mit 22.x)
- Optional: Ollama oder LM Studio für die lokale KI
- Optional: Android Studio / SDK + Java 21 für den APK-Build

### 1. Setup
```bash
npm install
cp .env.example .env       # Werte nach Bedarf füllen (alle optional für Demo)
```

### 2. Entwicklung
```bash
npm run dev        # PWA auf http://localhost:5173
npm run server     # Express-KI/Health-Server auf http://localhost:8787
```
Ohne `.env`-Werte läuft die App im **Demo-Modus** (deterministische Daten,
klar gekennzeichnet). Coach/Scanner fallen ohne erreichbares lokales Modell
auf die **regelbasierte Engine** zurück (klar als „regelbasiert“ markiert).

### 3. Tests & Build
```bash
npm test           # 66 Tests (Vitest)
npm run build      # Produktions-Build → dist/
npm run server     # danach: PWA lokal servieren (z. B. `npx serve dist`)
```

### 4. Lokale KI (empfohlen)
```bash
# Ollama (Default)
ollama pull qwen2.5vl:7b        # Vision-Modell (Text + Bild)
# → OLLAMA_MODEL=qwen2.5vl:7b in .env

# oder LM Studio:
# Qwen2.5-VL-7B-Instruct (GGUF Q4/Q5) laden, Server auf Port 1234,
# → LM_STUDIO_BASE_URL=http://<ip>:1234/v1 in .env
```
Provider-Auflösung: **Ollama → LM Studio → remote** (nur wenn konfiguriert).
Vision-Erkennung: Modellnamen-Match auf `vl`/`llava`/`vision`.

### 5. Google Health (Fitbit Air)
**→ [docs/GOOGLE-HEALTH-SETUP.md](docs/GOOGLE-HEALTH-SETUP.md)** (7 Schritte, ~15 min)
Kurz: Cloud-Projekt → Google Health API aktivieren → OAuth-Web-Client mit
Redirect `http://localhost:5173/oauth/health/callback` → Client-ID (Frontend `.env`)
+ Client-Secret (Server `.env`) → in der App „Mit Google Health verbinden“.

### 6. Supabase (optional, Multi-User/Persistenz)
```bash
# Projekt in Supabase anlegen, dann Migration anwenden
supabase db push      # oder SQL-Editor: supabase/migrations/0001_initial_schema.sql
# VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env
```
Jede Tabelle ist RLS-secured (nur eigene Zeilen). Details:
[docs/SUPABASE.md](docs/SUPABASE.md)

### 7. Mobile (Android / iOS)
```bash
npm run build                    # dist/ erzeugen
npx cap sync                     # Web-Build in Native-Projects kopieren
```
**Android:** `cd android && ./gradlew assembleDebug` →
`android/app/build/outputs/apk/debug/app-debug.apk` (im Repo unter `android-build/`)
→ APK aufs Handy laden & installieren (unsigniert → „unbekannte Quelle“ erlauben).

**iOS:** `cd ios && open VitalAge.xcworkspace` → Xcode (Mac) → Build & Run.
Kein Mac? Die PWA-Installation (Browser → „Zum Homescreen“ / „Zur Startansicht“)
bietet identische Funktionalität.

Details: [docs/MOBILE.md](docs/MOBILE.md)

---

## API-Referenz (Express, :8787)

| Methode | Pfad | Body | Antwort |
| --- | --- | --- | --- |
| `POST` | `/api/coach/ask` | `{ question, context? }` | `{ answer, engine: 'llm'\|'rule-based', model?, gaps, dataUsed }` |
| `POST` | `/api/food/scan` | `{ image (base64), mealType, note? }` | `{ available, items, confidence, provider }` |
| `GET` | `/api/health` | — | `{ status:'ok', llm:{ available, provider, model }, googleHealth:{ configured } }` |
| `POST` | `/api/health/oauth/token` | `{ code, state }` | `{ ok }` (Tokens bleiben serverseitig) |
| `POST` | `/api/health/sync` | `{ days? }` | `{ points: [RawDataPoint], errors? }` |

**Sicherheit:** Client-Secret & Tokens nur serverseitig; `state` = CSRF-Schutz;
System-Prompt verbietet Anweisungen aus dem Datenblock (Prompt-Injection);
Rate-Limit 15/min/IP.

---

## Berechnungslogik (kurz)

- **Recovery 0–100:** HRV & Ruhe-HF vs. 28-Tage-Baseline (Median/MAD, robust gegen
  Ausreißer). Abweichung nach unten = Belastung. Schlaf-Mangel/ -Qualität zieht
  zusätzlich. Keine Daten → `null` (nie 0, nie geschätzt).
- **Strain 0–21:** Skalierte Aktivitätsminuten (Intensitätszonen gewichtet) +
  Workout-Last. WHOOP-kompatible Skala.
- **Sleep:** Onset/Offset mit Mitternachts-Übergang (Modulo-1440-Logik),
  Stage-Summe ≠ Gesamtdauer → proportionale Korrektur. Konsistenz nur ab ≥2 Nächten.
- **Vitality 0–100:** VO₂max-Trend, aktive Minuten, Ruhe-Parameter gegen Baseline.
- **Meal Score 1–10:** Makro-Balance, Fettquellen (un-/gesättigt), Zucker,
  Ballaststoffe, Proteinzufuhr.

Alle Formeln in `src/lib/scoring/` mit Vitest-Tests abgedeckt.

---

## Medizinischer Hinweis

VITAL AGE ist **kein Medizinprodukt** und ersetzt keine ärztliche Beratung.
Scores und Trends sind zu Informationszwecken. Bei Gesundheitsfragen: Arzt.

## Lizenz & Daten

- Eigenentwickelte UI (kein WHOOP-Design, kein geschütztes Material).
- Ernährungsdaten: **USDA FoodData Central** — CC0 1.0 Universal (keine Genehmigung nötig).
- Google-Health-Anbindung: Read-only-Scopes, Daten bleiben im eigenen Konto.
- **Keine echten Geheimnisse im Repository.** `.env.example` enthält nur Platzhalter.
