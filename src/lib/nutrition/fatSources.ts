/**
 * VITAL AGE — Fettquellen-Analyse (Animal Fats & Seed Oils)
 * =====================================================================
 * Ordnet Fette ihrer LEbensmittelquelle zu und respektiert persönliche
 * Präferenzen (nur dokumentiert, keine pauschale Bewertung).
 *
 * WICHTIGE WISSENSCHAFTLICHE VORGABE (s. docs/FAT-SCIENCE.md):
 *  - Keine pauschale Einstufung aller "Seed Oils" als giftig oder
 *    grundsätzlich entzündungsfördernd.
 *  - Evidenz: Austausch gesättigter gegen (pflanzlich) ungesättigte
 *    Fettsäuren senkt kardiovaskuläres Risiko — Metaanalysen
 *    (Mozaffarian et al. 2014, Circulation; WHO-Guideline 2023,
 *    ISBN 978-92-4-007363-0: <10 % E aus SFA, <1 % E aus trans-Fettsäuren).
 *  - Verarbeitung (wiederholte Erhitzung, Ranzigkeit), Lagerung und das
 *    Gesamt-Mahlzeitmuster sind mindestens so relevant wie die
 *    Fettsäure-Zusammensetzung eines einzelnen Öls.
 */
import type { FoodItem, Meal } from '../types'
import type { FatSourceId } from './db'
import { round1 } from '../stats'

export interface FatSourceInfo {
  id: FatSourceId
  label: string
  group: 'animal' | 'vegetable-oil' | 'other'
  desc: string
}

export const FAT_SOURCES: Record<FatSourceId, FatSourceInfo> = {
  'dairy-fat': { id: 'dairy-fat', label: 'Käse & Milchprodukte', group: 'animal', desc: 'Käse, Joghurt, Milch' },
  'butter-cream': { id: 'butter-cream', label: 'Butter & Sahne', group: 'animal', desc: 'Butter, Sahne, Crème' },
  'egg': { id: 'egg', label: 'Eier', group: 'animal', desc: 'Ganze Eier, Eigelb' },
  'red-meat': { id: 'red-meat', label: 'Fleisch', group: 'animal', desc: 'Rind, Huhn, Schwein (inkl. Haut)' },
  'fish': { id: 'fish', label: 'Fisch & Meeresfrüchte', group: 'animal', desc: 'Omega-3-reich (EPA/DHA)' },
  'olive-oil': { id: 'olive-oil', label: 'Olivenöl', group: 'vegetable-oil', desc: 'Hoher MUFA-Anteil, polyphenolreich (kaltgepresst)' },
  'rapeseed-oil': { id: 'rapeseed-oil', label: 'Rapsöl', group: 'vegetable-oil', desc: 'Gutes Omega-3/6-Verhältnis, hoher MUFA' },
  'sunflower-oil': { id: 'sunflower-oil', label: 'Sonnenblumenöl', group: 'vegetable-oil', desc: 'Hoher Omega-6-Anteil — vorwiegend kalt verwenden' },
  'soy-oil': { id: 'soy-oil', label: 'Sojaöl', group: 'vegetable-oil', desc: 'Hoher Omega-6-Anteil' },
  'nuts-seeds': { id: 'nuts-seeds', label: 'Nüsse & Samen', group: 'other', desc: 'Mandeln, Walnüsse, Chia, Leinsamen' },
  'avocado': { id: 'avocado', label: 'Avocado', group: 'other', desc: 'MUFA-reich, mit Ballaststoffen & Kalium' },
  'coconut': { id: 'coconut', label: 'Kokosfett', group: 'other', desc: 'Sehr hoher SFA-Anteil (~82 %), Mittelkettige KAs' },
  'other': { id: 'other', label: 'Andere Fette', group: 'other', desc: 'Kakao, Mischfette, unklar' },
}

export interface FatBreakdown {
  totalFatG: number
  bySource: Record<string, number> // FatSourceId -> g Fett
  satG: number | null
  monoG: number | null
  polyG: number | null
  omega3G: number | null
  omega6G: number | null
  omega6to3: number | null // Verhältnis (n-6 : n-3)
  preferenceNotes: string[]
}

/**
 * Analysiert die Fettquellen einer Mahlzeit.
 * @param preferences IDs, die der Nutzer beobachten/reduzieren will.
 */
export function analyzeFats(meal: Meal, preferences: string[] = []): FatBreakdown {
  const sum = (k: string): number | null => {
    let s = 0, any = false
    for (const it of meal.items) {
      const v = it.nutrients[k]
      if (typeof v === 'number') { s += v; any = true }
    }
    return any ? s : null
  }
  const bySource: Record<string, number> = {}
  for (const it of meal.items) {
    const fat = it.nutrients['fat'] ?? 0
    const sources = it.fatSources?.length ? it.fatSources : ['other']
    // Fett auf die Quellen verteilen
    for (const s of sources) {
      bySource[s] = (bySource[s] ?? 0) + fat / sources.length
    }
  }
  const notes: string[] = []
  for (const pref of preferences) {
    const g = bySource[pref]
    if (g !== undefined && g >= 5) {
      notes.push(`Beobachtet: ${round1(g)} g Fett aus „${FAT_SOURCES[pref as FatSourceId]?.label ?? pref}“ (persönliche Präferenz).`)
    }
  }
  const o3 = sum('omega3'), o6 = sum('omega6')
  return {
    totalFatG: round1(sum('fat') ?? 0),
    bySource: Object.fromEntries(Object.entries(bySource).map(([k, v]) => [k, round1(v)])),
    satG: sum('satFat'),
    monoG: sum('monoFat'),
    polyG: sum('polyFat'),
    omega3G: o3,
    omega6G: o6,
    omega6to3: o3 && o6 && o3 > 0 ? round1(o6 / o3) : null,
    preferenceNotes: notes,
  }
}

/**
 * Kontextuelle Einordnung der n-6:n-3-Ratio (KEIN Grenzwert-Judgment):
 * Moderne westliche Diäten liegen oft bei 10:1–20:1; die Evidenz für
 * eine optimale feste Ratio ist schwach — relevant ist vor allem der
 * absolute Omega-3-Anteil und der Ersatz von SFA.
 */
export function omegaRatioContext(ratio: number | null): string {
  if (ratio === null) return 'Nicht ausreichend Omega-3/6-Daten für diese Mahlzeit.'
  if (ratio < 5) return 'Günstiges Verhältnis — hoher Omega-3-Anteil (z. B. Fisch, Walnüsse, Rapsöl).'
  if (ratio < 10) return 'Mittleres Verhältnis — typisch für westliche Mischkost.'
  return 'Hohes n-6:n-3-Verhältnis. Einmalig unbedenklich; über Wochen betrachtet lohnt sich mehr Omega-3 (fetter Fisch, Walnüsse, Leinsamen, Rapsöl).'
}
