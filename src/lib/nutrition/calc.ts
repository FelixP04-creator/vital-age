/**
 * VITAL AGE — Ernährungsberechnung
 * =====================================================================
 * Deterministische Berechnung aus Lebensmittel-Items:
 *  - Makros (pro Mahlzeit + Tag)
 *  - Mikronährstoffe
 *  - Meal Quality Score 1–10 (transparent, individuell, s. mealScore.ts)
 *  - Fettquellen-Analyse (s. fatSources.ts)
 *
 * Regeln:
 *  - Mengen werden über den Faktor (quantity/100) skaliert.
 *  - "piece"/"portion" nutzen definierte Standardmengen (s. UNITS).
 *  - Fehlende Nährwerte bleiben null/undefiniert — werden NICHT zu 0
 *    addiert und nicht als "0 mg aufgenommen" interpretiert.
 *  - Quelle des Werts wird pro Item getrackt (label/database/estimated).
 */
import type { FoodItem, MealMacros, Meal } from '../types'
import { FOOD_MAP, type FoodDef, type FatSourceId } from './db'
import { clamp, round1, round2 } from '../stats'

/** Standardmengen für nicht-gramm-basierte Einheiten. */
export const UNITS: Record<string, { label: string; grams: number }> = {
  g: { label: 'g', grams: 1 },
  ml: { label: 'ml', grams: 1 },
  piece: { label: 'Stück', grams: 100 },
  portion: { label: 'Portion', grams: 150 },
}

/** Skaliert Nährwerte einer Definition auf eine Menge. */
export function scaleNutrients(def: FoodDef, quantity: number, unit: FoodItem['unit']): Record<string, number> {
  const g = UNITS[unit]?.grams ?? 1
  const factor = (quantity * g) / 100
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(def.n)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = round2(v * factor)
  }
  return out
}

/** Erzeugt ein FoodItem aus DB + Menge. */
export function buildFoodItem(
  foodId: string,
  quantity: number,
  unit: FoodItem['unit'] = 'g',
  source: FoodItem['nutrientSource'] = 'database',
  overrides?: Partial<FoodItem>,
): FoodItem | null {
  const def = FOOD_MAP[foodId]
  if (!def) return null
  return {
    id: `${foodId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: def.name,
    quantity,
    unit,
    nutrients: scaleNutrients(def, quantity, unit),
    nutrientSource: source,
    fatSources: def.fatSources,
    proteinQuality: def.proteinQuality
      ? {
          leucinGPer100: def.proteinQuality.leucinGPer100,
          digestibility: def.proteinQuality.digestibility,
        }
      : undefined,
    ...overrides,
  }
}

/** Summiert Makros aus Items (fehlende Werte werden übersprungen, nicht 0). */
export function aggregateMacros(items: FoodItem[]): MealMacros {
  const sum = (key: string): number => {
    let s = 0
    for (const it of items) {
      const v = it.nutrients[key]
      if (v !== undefined && v !== null) s += v
    }
    return s
  }
  const sumNullable = (key: string): number | null => {
    let s = 0
    let any = false
    for (const it of items) {
      const v = it.nutrients[key]
      if (v !== undefined && v !== null) {
        s += v
        any = true
      }
    }
    return any ? s : null
  }
  return {
    proteinG: round1(sum('protein')),
    carbsG: round1(sum('carbs')),
    fiberG: round1(sum('fiber')),
    sugarG: round1(sum('sugar')),
    addedSugarG: sumNullable('addedSugar'),
    fatG: round1(sum('fat')),
    satFatG: sumNullable('satFat'),
    monoFatG: sumNullable('monoFat'),
    polyFatG: sumNullable('polyFat'),
    omega3G: sumNullable('omega3'),
    omega6G: sumNullable('omega6'),
    transFatG: sumNullable('transFat'),
    alcoholG: sumNullable('alcohol'),
    caloriesKcal: Math.round(sum('kcal')),
  }
}

/** Summiert Mikronährstoffe über Items. */
export function aggregateMicros(items: FoodItem[]): Record<string, number> {
  const out: Record<string, number> = {}
  const MICRO_KEYS = [
    'iron', 'magnesium', 'potassium', 'calcium', 'phosphorus', 'zinc', 'copper',
    'manganese', 'selenium', 'iodine', 'sodium', 'choline', 'vitaminA', 'vitaminB1',
    'vitaminB2', 'vitaminB3', 'vitaminB5', 'vitaminB6', 'vitaminB7', 'vitaminB9',
    'folate', 'vitaminB12', 'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK',
    'epa', 'dha', 'ala', 'linoleic', 'creatinine',
  ]
  for (const key of MICRO_KEYS) {
    let s = 0
    let any = false
    for (const it of items) {
      const v = it.nutrients[key]
      if (v !== undefined && v !== null) {
        s += v
        any = true
      }
    }
    if (any) out[key] = round2(s)
  }
  return out
}

/** Protein-Qualitätsanalyse einer Mahlzeit. */
export function proteinQuality(items: FoodItem[]): {
  totalG: number
  leucinG: number | null
  avgDigestibility: number | null
  animalShare: number | null
} {
  const totalG = items.reduce((a, i) => a + (i.nutrients['protein'] ?? 0), 0)
  let leu = 0, leuAny = false, digSum = 0, digN = 0, animal = 0
  for (const it of items) {
    const p = it.proteinQuality
    const prot = it.nutrients['protein'] ?? 0
    if (p?.leucinGPer100 !== undefined) {
      leu += (p.leucinGPer100 * (UNITS[it.unit]?.grams ?? 1) * it.quantity) / 100
      leuAny = true
    }
    if (p?.digestibility !== undefined) {
      digSum += p.digestibility * prot
      digN += prot
    }
    // Tierisch = Eier, Fleisch, Fisch, Milchprodukte (Kategorien als Heuristik)
    const t = (it.name.match(/ei|fleisch|rind|hähn|huhn|lachs|fisch|thun|milch|joghurt|käse|cheddar|buttermilch/i) ?? []).length > 0
    if (t) animal += prot
  }
  return {
    totalG: round1(totalG),
    leucinG: leuAny ? round1(leu) : null,
    avgDigestibility: digN > 0 ? round2(digSum / digN) : null,
    animalShare: totalG > 0 ? round2(animal / totalG) : null,
  }
}
