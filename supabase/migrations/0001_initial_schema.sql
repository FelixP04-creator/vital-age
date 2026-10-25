-- =====================================================================
-- VITAL AGE — Supabase Migration 0001: Basis-Schema
-- ---------------------------------------------------------------------
-- PostgreSQL-Schema für VITAL AGE:
--   * profiles            (1:1 zu auth.users)
--   * daily_records       (Messwerte pro Tag, JSONB metrikbezogen)
--   * meals               (Ernährungs-Logs)
--   * food_items          (Einzelteile pro Mahlzeit, USDA-basiert)
--   * baselines           (berechnete Baselines, Rolling Window)
--   * health_oauth        (Google-Health-Token-Sitzungen)
--
-- DATENPRINZIP (aus src/lib/types.ts):
--   Jeder Messwert trägt einen Source-Flag:
--     'measured' | 'computed' | 'estimated'
--   Fehlende Daten = NULL, NIEMALS 0.
--
-- RLS: Jede Tabelle ist row-level secured — ein Nutzer sieht NUR
-- seine eigenen Zeilen. Anonyme Zugriffe: KEINE (außer explicit).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) pro...s (Profile)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  birth_date date,
  sex text check (sex in ('male', 'female', 'other')),
  height_cm numeric,
  weight_kg numeric,
  nutrition_goal text default 'general-health',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profile_read_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profile_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profile_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profile_delete_own"
  on public.profiles for delete
  using (auth.uid() = id);

-- Auto-Create: Profile wird bei Registration automatisch angelegt
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2) daily_records (Messwerte)
-- ---------------------------------------------------------------------
-- Metrik-JSONB-Struktur (spiegelt src/lib/types.ts):
--   "restingHr":       { "value": 58.0, "source": "measured" }
--   "hrv":             { "value": 62.5, "source": "measured" }
--   "spo2":            { "value": 97.0, "source": "measured" }
--   "respRate":        { "value": 14.0, "source": "measured" }
--   "skinTempDeltaC":  { "value": 0.05, "source": "measured" }
--   "activeMinutes":   { "value": 45.0, "source": "computed" }
--   "activeZoneMinutes":{ "value": 20.0, "source": "computed" }
--   "steps":           { "value": 8200, "source": "measured" }
--   "distanceKm":      { "value": 6.2,  "source": "measured" }
--   "caloriesKcal":    { "value": 2350, "source": "computed" }
--   "vo2max":          { "value": 38.0, "source": "computed" }
--   "sleep":           { "durationMin": 420, "onset": "...", "offset": "...",
--                        "stages": { "deepMin": 90, "remMin": 100,
--                                    "lightMin": 200, "awakeMin": 30 },
--                        "source": "measured" }
--   "strain":          { "total": 8.5, "workout": 3.0, "activity": 5.5,
--                        "workoutMinutes": 30, "source": "computed" }
create table if not exists public.daily_records (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_daily_records_user_date
  on public.daily_records (user_id, date desc);

alter table public.daily_records enable row level security;

create policy "daily_read_own"
  on public.daily_records for select
  using (auth.uid() = user_id);

create policy "daily_insert_own"
  on public.daily_records for insert
  with check (auth.uid() = user_id);

create policy "daily_update_own"
  on public.daily_records for update
  using (auth.uid() = user_id);

create policy "daily_delete_own"
  on public.daily_records for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 3) meals + food_items (Ernährung)
-- ---------------------------------------------------------------------
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  label text not null default '',
  score numeric check (score between 1 and 10),
  scan_source text check (scan_source in ('manual', 'photo-llm', 'usda-db')),
  created_at timestamptz not null default now()
);

create index if not exists idx_meals_user_date on public.meals (user_id, date desc);

alter table public.meals enable row level security;

create policy "meals_read_own"  on public.meals for select  using (auth.uid() = user_id);
create policy "meals_insert_own" on public.meals for insert  with check (auth.uid() = user_id);
create policy "meals_update_own" on public.meals for update  using (auth.uid() = user_id);
create policy "meals_delete_own" on public.meals for delete  using (auth.uid() = user_id);

-- USDA FoodData Central: CC0 1.0 Universal — keine Genehmigung nötig.
create table if not exists public.food_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  usda_fdc_id bigint,
  name text not null,
  grams numeric not null default 0,
  kcal numeric not null default 0,
  protein_g numeric not null default 0,
  fat_g numeric not null default 0,
  carb_g numeric not null default 0,
  fiber_g numeric,
  sugar_g numeric,
  note text
);

create index if not exists idx_food_items_meal on public.food_items (meal_id);
create index if not exists idx_food_items_user on public.food_items (user_id);

alter table public.food_items enable row level security;

create policy "food_read_own"  on public.food_items for select  using (auth.uid() = user_id);
create policy "food_insert_own" on public.food_items for insert  with check (auth.uid() = user_id);
create policy "food_update_own" on public.food_items for update  using (auth.uid() = user_id);
create policy "food_delete_own" on public.food_items for delete  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 4) baselines (berechnete Baselines, Rolling Window)
-- ---------------------------------------------------------------------
create table if not exists public.baselines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  as_of date not null,
  window_days int not null default 28,
  hrv_median numeric,
  hrv_mad numeric,
  resting_hr_median numeric,
  resting_hr_mad numeric,
  spo2_median numeric,
  resp_rate_median numeric,
  sleep_duration_median numeric,
  created_at timestamptz not null default now(),
  unique (user_id, as_of)
);

create index if not exists idx_baselines_user_asof on public.baselines (user_id, as_of desc);

alter table public.baselines enable row level security;

create policy "baselines_read_own"  on public.baselines for select  using (auth.uid() = user_id);
create policy "baselines_insert_own" on public.baselines for insert  with check (auth.uid() = user_id);
create policy "baselines_update_own" on public.baselines for update  using (auth.uid() = user_id);
create policy "baselines_delete_own" on public.baselines for delete  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 5) health_oauth (Google-Health-Sitzungen)
-- ---------------------------------------------------------------------
-- FÜR PRODUKTION: Tokens persistent (aktuell In-Memory im Express-Server).
-- Refresh-Token = SECRET → NUR via RLS lesbar, NIE im Frontend exponiert.
create table if not exists public.health_oauth (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'google_health',
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.health_oauth enable row level security;

-- WICHTIG: refresh_token ist SECRET. RLS erlaubt nur SELECT auf die
-- Spalten, die das Frontend braucht (provider, status). Der Server
-- nutzt den service_role-Key (bypasses RLS) für Token-Refresh.
create policy "oauth_read_own_status"
  on public.health_oauth for select
  using (auth.uid() = user_id);

-- Schreibzugriff NUR via service_role (Server) — kein Client-Insert.
-- (RLS für Insert/Update/Update wird nicht angelegt → Client kann nicht
--  tokens schreiben; nur der Server mit service_role umgeht RLS.)

-- ---------------------------------------------------------------------
-- 6) updated_at-Auto-Update
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_daily_records_touch on public.daily_records;
create trigger trg_daily_records_touch
  before update on public.daily_records
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_health_oauth_touch on public.health_oauth;
create trigger trg_health_oauth_touch
  before update on public.health_oauth
  for each row execute function public.touch_updated_at();
