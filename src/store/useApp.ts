/**
 * VITAL AGE — App-Store (Zustand)
 * =====================================================================
 * Lokal-first: Alle Daten leben im Browser (localStorage) und werden
 * NIEMALS ohne Nutzerentscheidung an einen Server gesendet.
 *
 * Modi:
 *  - demoMode=true  -> Demo-Daten (klar gekennzeichnet)
 *  - connected      -> echte Google-Health-Daten (nach OAuth, s. Phase 4)
 *
 * Der Store hält: Profil, Tagesdaten, Aktivitäten, Mahlzeiten,
 * Check-ins, Gewohnheiten, Coach-Verlauf, Theme, Connection.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  DailyRecord,
  Activity,
  Meal,
  DailyCheckIn,
  Habit,
  Profile,
  HealthConnection,
  CoachMessage,
} from '../lib/types'
import {
  generateDemoRecords,
  generateDemoActivities,
  generateDemoCheckIns,
  demoHabits,
  demoProfile,
  demoConnection,
} from '../lib/demo'
import type { PeriodKey } from '../lib/periods'

interface AppState {
  // Daten
  profile: Profile
  records: DailyRecord[]
  activities: Activity[]
  meals: Meal[]
  checkIns: DailyCheckIn[]
  habits: Habit[]
  coachHistory: CoachMessage[]
  connection: HealthConnection
  theme: 'dark' | 'light'
  period: PeriodKey
  // Actions
  setTheme: (t: 'dark' | 'light') => void
  setPeriod: (p: PeriodKey) => void
  addActivity: (a: Activity) => void
  deleteActivity: (id: string) => void
  addMeal: (m: Meal) => void
  updateMeal: (m: Meal) => void
  deleteMeal: (id: string) => void
  saveCheckIn: (c: DailyCheckIn) => void
  addCoachMessage: (m: CoachMessage) => void
  clearCoachHistory: () => void
  toggleHabit: (id: string) => void
  updateProfile: (p: Partial<Profile>) => void
  setConnection: (c: Partial<HealthConnection>) => void
  /** Echte Google-Health-Tagesdaten einladen (ersetzt DEMO-Records). */
  setRecords: (r: DailyRecord[]) => void
  resetDemoData: () => void
  wipeAllData: () => void
}

function demoSeed() {
  const records = generateDemoRecords()
  return {
    profile: demoProfile(),
    records,
    activities: generateDemoActivities(records),
    meals: [] as Meal[],
    checkIns: generateDemoCheckIns(records),
    habits: demoHabits(),
    coachHistory: [] as CoachMessage[],
    connection: demoConnection(),
  }
}

const initial = demoSeed()

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      ...initial,
      theme: 'dark',
      period: '7d',
      setTheme: (theme) => {
        set({ theme })
        document.documentElement.setAttribute('data-theme', theme)
      },
      setPeriod: (period) => set({ period }),
      addActivity: (a) => set((s) => ({ activities: [a, ...s.activities] })),
      deleteActivity: (id) => set((s) => ({ activities: s.activities.filter((x) => x.id !== id) })),
      addMeal: (m) => set((s) => ({ meals: [m, ...s.meals] })),
      updateMeal: (m) => set((s) => ({ meals: s.meals.map((x) => (x.id === m.id ? m : x)) })),
      deleteMeal: (id) => set((s) => ({ meals: s.meals.filter((x) => x.id !== id) })),
      saveCheckIn: (c) =>
        set((s) => {
          const rest = s.checkIns.filter((x) => x.date !== c.date)
          return { checkIns: [...rest, c] }
        }),
      addCoachMessage: (m) => set((s) => ({ coachHistory: [...s.coachHistory.slice(-99), m] })),
      clearCoachHistory: () => set({ coachHistory: [] }),
      toggleHabit: (id) =>
        set((s) => ({
          habits: s.habits.map((h) =>
            h.id === id
              ? { ...h, targetDays: h.targetDays }
              : h,
          ),
        })),
      updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      setConnection: (c) => set((s) => ({ connection: { ...s.connection, ...c } })),
      setRecords: (records) => set({ records }),
      resetDemoData: () => set(demoSeed()),
      wipeAllData: () =>
        set({
          profile: demoProfile(),
          records: [],
          activities: [],
          meals: [],
          checkIns: [],
          habits: [],
          coachHistory: [],
          connection: demoConnection(),
        }),
    }),
    {
      name: 'vital-age-v1',
      // Theme wird auch auf <html> angewendet
      onRehydrateStorage: () => (state) => {
        if (state?.theme) document.documentElement.setAttribute('data-theme', state.theme)
      },
    },
  ),
)

// Initiales Theme direkt anwenden
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', 'dark')
}
