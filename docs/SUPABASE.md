# VITAL AGE — Supabase-Setup

Supabase (PostgreSQL + Auth + RLS) für Multi-User-Betrieb und Persistenz.
Ohne Konfiguration läuft die App im **lokalen Browser-Modus** (localStorage) —
Gesundheitsdaten verlassen in dem Fall nie das Gerät.

## 1. Projekt anlegen

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New Project**
   (Region nach Wahl, Password sicher speichern).
2. **Settings → API**: `Project URL` + `anon public key` kopieren.
3. In `.env`:
   ```env
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...  # Public-Key — darf im Frontend stehen
   ```

## 2. Migration anwenden

```bash
# Option A: CLI (empfohlen)
supabase login
supabase link --project-ref <ref>
supabase db push          # spielt supabase/migrations/0001_initial_schema.sql ab

# Option B: SQL-Editor
# Dashboard → SQL Editor → Datei-Content einfügen → Run
```

## 3. Tabellen & RLS

| Tabelle | Inhalt | RLS |
| --- | --- | --- |
| `profiles` | 1:1 zu `auth.users`, Auto-Create via Trigger | nur eigene Zeile |
| `daily_records` | Tages-Metriken (JSONB mit Source-Flags) | nur eigene Zeilen |
| `meals` / `food_items` | Ernährungs-Log (USDA-basiert) | nur eigene Zeilen |
| `baselines` | 28-Tage-Baselines (Median/MAD) | nur eigene Zeilen |
| `health_oauth` | Google-Health-Tokens | Refresh-Token nie schreibbar vom Client; Server nutzt `service_role` |

**Prinzipien:**
- **RLS auf JEDER Tabelle** aktiviert (`enable row level security`).
- Anonyme Zugriffe: keine.
- `service_role`-Key (Server-Secret, NIE im Frontend, NIE im Repo) umgeht RLS —
  wird nur für Server-Logik gebraucht (z. B. Token-Refresh aus `health_oauth`).

## 4. Auth-Flow (geplant)

```
Browser → supabase.auth.signInWithOAuth (Google)
        → Trigger on_auth_user_created legt profiles-Zeile an
        → App lädt daily_records / meals / baselines (RLS filtert automatisch)
```

Die lokale Browser-Variante bleibt als Fallback — die Store-Aktionen sind
storage-agnostisch designed (`src/store/useApp.ts`), das Backend wird als
Adapter angeschlossen, ohne UI-Änderungen.

## 5. Edge Functions (optional)

Für serverlose KI-Anfragen (falls der Express-Server nicht gehostet wird):
`supabase/functions deploy` — die Prompt-/Schemas-Logik aus `server/`
1:1 übertragbar (gleiche Funktionen, anderes Runtime-Wrapper).
