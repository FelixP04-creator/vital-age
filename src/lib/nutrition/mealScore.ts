/**
 * VITAL AGE — Meal Quality Score (1–10)
 * =====================================================================
 * TRANSPARENTE, INDIVIDUELLE Bewertung. NICHT "gut/schlecht" — sondern
 * "wie gut passt diese Mahlzeit zu deinen Zielen & einer ausgewogenen
 * Versorgung".
 *
 * Teil-Scores (je 0–10, gewichtet), Gewichtungen hängen vom Ziel ab:
 *   - Proteinversorgung      w_p
 *   - Kohlenhydrat-Qualität  (Ballaststoffanteil, wenig Zucker)  w_c
 *   - Fettprofil             (wenig trans/gesättigt, genug unges.)  w_f
 *   - Mikronährstoffdichte   (Nährstoffe pro 100 kcal)           w_m
 *   - Ballaststoffe                                w_fib
 *   - Passung zu Zielen (individuelle Präferenzen) w_g
 *
 * Summe der Gewichte wird normalisiert. Fehlende Teil-Scores (keine
 * Daten) werden aus der Gewichtung entfernt und umverteilt — die
 * Bewertung wird als "vorläufig" gekennzeichnet (confidence).
 *
 * Es gibt KEINE moralische Lebensmittel-Kategorie und KEIN Verbot.
 */
import type { Meal, FoodItem, Profile } from '../types'
import { round1, round2, clamp } from '../stats'

export type MealScoreConfidence = 'provisional' | 'solid'

export interface MealScoreResult {
  score: number // 1–10
  confidence: MealScoreConfidence
  subscores: Record<string, number>
  reasons: string[]
  improvements: string[] // max 3
  evidence: { label: string; url: string }[]
  disclaimer: string
}

function proteinSub(items: FoodItem[]): number {
  const total = items.reduce((a, i) => a + (i.nutrients['protein'] ?? 0), 0)
  const kcal = items.reduce((a, i) => a + (i.nutrients['kcal'] ?? 0), 0)
  if (kcal <= 0) return 4
  // 1.6 g/kg ist sportlich; hier pro 100 kcal ~ 0.9–1.2 g Protein als "gut"
  const density = total / (kcal / 100) // g Protein / 100 kcal
  return clamp(Math.round((density / 1.1) * 5 + 3), 1, 10)
}

function carbSub(items: FoodItem[]): number {
  const carbs = items.reduce((a, i) => a + (i.nutrients['carbs'] ?? 0), 0)
  const fiber = items.reduce((a, i) => a + (i.nutrients['fiber'] ?? 0), 0)
  const sugar = items.reduce((a, i) => a + (i.nutrients['sugar'] ?? 0), 0)
  if (carbs <= 0) return 5 // neutral wenn keine KH
  const fiberShare = fiber / carbs
  const sugarShare = sugar / carbs
  let s = 5
  s += clamp(fiberShare * 20, 0, 4) // mehr Ballaststoffe -> +
  s -= clamp((sugarShare - 0.15) * 12, 0, 4) // viel Zucker -> -
  return clamp(Math.round(s), 1, 10)
}

function fatSub(items: FoodItem[]): number {
  const sat = items.reduce((a, i) => a + (i.nutrients['satFat'] ?? 0), 0)
  const trans = items.reduce((a, i) => a + (i.nutrients['transFat'] ?? 0), 0)
  const poly = items.reduce((a, i) => a + (i.nutrients['polyFat'] ?? 0), 0)
  const mono = items.reduce((a, i) => a + (i.nutrients['monoFat'] ?? 0), 0)
  const fat = items.reduce((a, i) => a + (i.nutrients['fat'] ?? 0), 0)
  if (fat <= 0) return 5
  let s = 6
  s -= clamp((sat / fat - 0.3) * 8, 0, 4)
  s -= clamp(trans * 6, 0, 4)
  s += clamp(((poly + mono) / fat - 0.4) * 6, 0, 3)
  return clamp(Math.round(s), 1, 10)
}

function microSub(items: FoodItem[]): number {
  const kcal = items.reduce((a, i) => a + (i.nutrients['kcal'] ?? 0), 0)
  if (kcal <= 0) return 4
  // Count distinct micros with meaningful amounts
  const keys = ['iron', 'magnesium', 'potassium', 'zinc', 'folate', 'vitaminC', 'vitaminA', 'vitaminB12', 'calcium', 'vitaminK']
  let rich = 0
  for (const it of items) {
    for (const k of keys) {
      if ((it.nutrients[k] ?? 0) >= 1) rich++
    }
  }
  return clamp(Math.round(3 + Math.min(rich, 8) * 0.75), 1, 10)
}

function fiberSub(items: FoodItem[]): number {
  const fiber = items.reduce((a, i) => a + (i.nutrients['fiber'] ?? 0), 0)
  const kcal = items.reduce((a, i) => a + (i.nutrients['kcal'] ?? 0), 0)
  if (kcal <= 0) return 5
  const per100 = fiber / (kcal / 100)
  return clamp(Math.round((per100 / 0.6) * 5 + 3), 1, 10)
}

function goalSub(meal: Meal, profile: Profile): number {
  let s = 6
  const goals = profile.goals
  if (goals.includes('protein') && meal.macros.proteinG < 20) s -= 1
  if (goals.includes('fiber') && meal.macros.fiberG < 8) s -= 1
  if (goals.includes('variety') && meal.items.length < 3) s -= 1
  // Allergien/Unverträglichkeiten: nur Warnung, kein harter Score-Abzug
  if (goals.includes('balanced') && meal.macros.fatG < 10) s -= 1
  return clamp(s, 1, 10)
}

export function scoreMeal(meal: Meal, profile: Profile): MealScoreResult {
  const goals = profile.goals
  // Gewichtungen je Ziel
  let w = { p: 1.5, c: 1.2, f: 1.0, m: 1.3, fib: 1.2, g: 1.4 }
  if (goals.includes('protein')) { w.p = 2.2; w.g = 1.6 }
  if (goals.includes('fiber')) { w.fib = 2.0; w.g = 1.6 }
  if (goals.includes('sport-performance')) { w.p = 2.0; w.c = 1.6 }

  const subs = {
    protein: proteinSub(meal.items),
    carbs: carbSub(meal.items),
    fat: fatSub(meal.items),
    micro: microSub(meal.items),
    fiber: fiberSub(meal.items),
    goal: goalSub(meal, profile),
  }

  const totalW = w.p + w.c + w.f + w.m + w.fib + w.g
  const score =
    (w.p * subs.protein + w.c * subs.carbs + w.f * subs.fat +
      w.m * subs.micro + w.fib * subs.fiber + w.g * subs.goal) / totalW

  // Konfidenz: unbestätigte geschätzte Items -> vorläufig
  const hasEstimated = meal.items.some((i) => i.nutrientSource === 'estimated')
  const confidence: MealScoreConfidence = hasEstimated && !meal.confirmed ? 'provisional' : 'solid'

  // Begründungen & Verbesserungen
  const reasons: string[] = []
  const improvements: string[] = []
  const top = Object.entries(subs).sort((a, b) => b[1] - a[1])[0]
  const labels: Record<string, string> = {
    protein: 'Proteinversorgung', carbs: 'Kohlenhydrat-Qualität', fat: 'Fettprofil',
    micro: 'Mikronährstoffdichte', fiber: 'Ballaststoffe', goal: 'Passung zu Zielen',
  }
  reasons.push(`Stärkster Teilaspekt: ${labels[top[0]]} (${top[1]}/10).`)
  const low = Object.entries(subs).sort((a, b) => a[1] - b[1])[0]
  if (low[1] < 6) improvements.push(`${labels[low[0]]} lässt sich z. B. durch mehr ${low[0] === 'protein' ? 'proteinreiche Lebensmittel' : low[0] === 'fiber' ? 'Gemüse, Vollkorn oder Hülsenfrüchte' : low[0] === 'micro' ? 'bunte Beilagen' : 'ausgewogene Quellen'} verbessern.`)
  if (meal.macros.fiberG < 8) improvements.push('Eine portionsweise Gemüse- oder Beilagen-Vielfalt (Obst, Vollkorn, Hülsenfrüchte) kann die Ballaststoffdichte heben.')
  if (meal.macros.proteinG < 15) improvements.push('Mehr Protein (z. B. Quark, Hülsenfrüchte, Fisch) unterstützt Sättigung und Muskelerhalt.')
  // max 3 Verbesserungen
  const imp = improvements.slice(0, 3)

  const evidence = [
    { label: 'AASM / WHO — Ausgewogene Ernährung & Makroverteilung', url: 'https://www.who.int/health-topics/nutrition' },
    { label: 'USDA FoodData Central (Datenquelle Nährwerte)', url: 'https://fdc.nal.usda.gov/' },
    { label: 'EFSA — Referenzwerte für Nährstoffzufuhr', url: 'https://www.efsa.europa.eu/' },
  ]

  const disclaimer =
    'Diese Bewertung ist ein app-eigener, individueller Richtwert — kein medizinisches Urteil. ' +
    'Eine einzelne Mahlzeit bestimmt nicht deine Gesundheit.'

  return {
    score: round1(clamp(score, 1, 10)),
    confidence,
    subscores: {
      proteinversorgung: subs.protein,
      kohlenhydratqualitaet: subs.carbs,
      fettprofil: subs.fat,
      mikronaehrstoffdichte: subs.micro,
      ballaststoffe: subs.fiber,
      ziele: subs.goal,
    },
    reasons,
    improvements: imp,
    evidence,
    disclaimer,
  }
}