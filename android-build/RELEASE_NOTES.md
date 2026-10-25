# VITAL AGE v0.1.0 — Erster Test-Build

Erste vollständige Version: PWA + native Android-App (iOS-Quellcode mit dabei).

## Android: So testest du die APK auf dem Handy
1. **`vital-age-debug.apk`** von dieser Release-Seite herunterladen
2. Auf dem Handy öffnen → **„Unbekannte Quellen erlauben"** (einmalig, je nach Android-Version)
3. Installieren → **VITAL AGE** öffnen
4. App startet im **Demo-Modus** mit 28 Tagen Beispieldaten
5. Für echte KI: Server starten (`npm run dev`) und in **Einstellungen → API-Basis** die
   Adresse deines Rechners eintragen (z. B. `http://192.168.178.42:5175`)
6. Für echte Google-Health-Daten: OAuth-Client anlegen
   (**docs/GOOGLE-HEALTH-SETUP.md**) und in der App verbinden

> ⚠️ Debug-APK: nur für eigenes Testen (Debug-Signierung, kein Play-Store).

## iOS
Quellcode liegt unter `ios/` — Build auf einem Mac mit Xcode 15+:
`cd ios/App && xcodebuild -scheme App -destination 'generic/platform=iOS'`
Details: **docs/MOBILE.md**

## Enthalten
- 15 Seiten (Home, Recovery, Strain, Schlaf, Vitalität, Trends, Aktivität,
  Coach, Ernährung, Evidence, Perspektiven, Aufnahme, Einstellungen)
- Berechnungs-Engine: Recovery, Strain, Schlaf-Score, Vitalität, Baselines
  (66 Unit-Tests, alle grün)
- Lokale KI: Ollama/LM-Studio (Text + Bilderkennung), regelbasierter Fallback
- Ernährung: USDA-Datenbank (CC0), Meal-Score 1–10, Foto-Scanner
- Google Health API (v4beta) + OAuth 2.0
- Supabase-Schema (Postgres, RLS auf allen Tabellen)
