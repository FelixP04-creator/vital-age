# VITAL AGE — Mobile (Android & iOS) via Capacitor

Die VITAL AGE PWA wird mit **Capacitor** in native Apps gehüllt:
identisches Web-Bundle, native Shell (WebView). Dadurch: installierbar als
echte App, Homescreen-Icon, Vollbild, Offline-Cache (Service Worker).

- **Android:** Debug-APK direkt installierbar (kein Play-Store nötig).
- **iOS:** Xcode-Projekt wird generiert — der Build braucht einen Mac mit Xcode
  (Apple-Policy: iOS-Apps können nur auf Apple-Toolchain gebaut werden).
  Alternativen ohne Mac: (a) CI auf GitHub Actions (macOS-Runner),
  (b) PWA-Installation auf dem iPhone (Safari → „Zur Startansicht“).

## Voraussetzungen

- **Android-Build:** Java 21 (JDK), Android SDK (platform-tools + build-tools).
  Auf diesem Rechner bereits vorhanden: `LOCALAPPDATA/Android/Sdk`.
- **iOS-Build:** macOS + Xcode (oder GitHub-Actions-macOS-Runner).

## Setup (einmalig)

```bash
npm install @capacitor/core
npm install -D @capacitor/cli
npx cap init "VITAL AGE" "de.felix.vitalage" --web-dir=dist
npx cap add android
npx cap add ios
```

## App-Build & Sync

```bash
npm run build     # Vite → dist/
npx cap sync      # dist/ in android/ und ios/ kopieren + native Plugins
```

## Android-APK bauen (Test auf dem Handy)

```bash
cd android
./gradlew assembleDebug
```

**Ergebnis:** `android/app/build/outputs/apk/debug/app-debug.apk`

**Installation:**
1. APK aufs Handy kopieren (USB, Cloud, direkt aus dem
   [GitHub-Release](../../releases) — dort als Asset hinterlegt).
2. Auf dem Handy antippen → „Unbekannte Quellen erlauben“ (einmalig).
3. App-Icon „VITAL AGE“ auf dem Homescreen.

> Die Debug-APK ist mit dem **Android-Debug-Key** signiert (lokal, kein Secret
> im Repo — es ist der Standard-Debug-Key für Entwicklung, nicht für den Store).
> Für einen Play-Upload später: eigener Upload-Key via `keytool` erzeugen und
> `android/key.properties` setzen (NICHT committen — steht in `.gitignore`).

## iOS

```bash
cd ios
open VitalAge.xcworkspace   # Mac + Xcode
# Xcode: Team wählen (gratis-Developer-Account reicht für Gerät-Test)
# Run (▶) aufs verbundene iPhone
```

**CI-Option (ohne eigenen Mac):** GitHub Actions mit `macos-latest`-Runner:
`xcodebuild -workspace ios/VitalAge.xcworkspace -scheme VitalAge
 -configuration Debug -destination 'generic/platform=iOS' build`

**PWA-Alternative:** iOS 16.4+ unterstützt installierbare PWAs (Safari →
Share → „Zur Startansicht“) — für den schnellen Funktionstest ohne Xcode.

## Was die Native-Shell bietet

- Vollbild (kein Browser-Leisten-Rest), natives Icon/Splash
- Service-Worker-Offline-Cache (PWA-Mechanik bleibt erhalten)
- Push-Notifications (später via `@capacitor/push-notifications`)
- Deep Links, File-Access (Food-Scanner nutzt bereits `<input type=file>`,
  funktioniert nativ)

## Repository-Layout

```
vital-age/
├── android/          # Generiertes Capacitor/Gradle-Projekt (wird gecommittet)
├── ios/              # Generiertes Xcode-Projekt (wird gecommittet)
└── android-build/    # FERTIGE Debug-APK (Release-Asset, wird gecommittet)
```

Die generierten Ordner sind Teil des Repos, damit du auf **jedem** Rechner
ohne das Capacitor-CLI sofort neu bauen kannst (`./gradlew assembleDebug`).
