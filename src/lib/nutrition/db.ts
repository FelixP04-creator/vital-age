/**
 * VITAL AGE — Lebensmitteldatenbank (Auszug)
 * =====================================================================
 * Werte pro 100 g (roh, sofern nicht anders angegeben), gerundet.
 * Quellen: USDA FoodData Central (Public Domain, CC0) +
 * Bundeslebensmittelschlüssel (BLS, DGE) als europäische Ergänzung.
 * Jede Zeile dokumentiert ihre Quelle in `src`.
 *
 * Nährschlüssel: Makros in g; Kalium/Magnesium/Calcium/Iron/Zink/Selen
 * in mg (Eisen in mg); Vitamine A in µg RAE, C in mg, D in µg, K in µg.
 *
 * WICHTIG: Dies ist ein kuratierter Auszug für die Demo/Offline-Nutzung.
 * Für die Produktion wird die FDC-API (https://fdc.nal.usda.gov/api-guide/)
 * serverseitig angebunden (s. server/api/food-api.ts).
 */
import type { FoodItem } from '../types'

export interface FoodDef {
  id: string
  name: string
  category: string
  /** Nährwerte pro 100 g/ml. Kalorien in kcal. */
  n: Record<string, number>
  fatSources?: string[]
  proteinQuality?: { leucinGPer100: number; digestibility: number }
  src: string
}

// Fettquellen-Taxonomie (für die Fettquellen-Analyse, s. fatSources.ts)
export type FatSourceId =
  | 'dairy-fat'
  | 'egg'
  | 'red-meat'
  | 'fish'
  | 'olive-oil'
  | 'rapeseed-oil'
  | 'sunflower-oil'
  | 'soy-oil'
  | 'nuts-seeds'
  | 'avocado'
  | 'coconut'
  | 'butter-cream'
  | 'other'

export const FOODS: FoodDef[] = [
  {
    id: 'oatmeal', name: 'Haferflocken', category: 'Getreide',
    n: { kcal: 379, protein: 13.2, carbs: 58.7, fiber: 10.6, sugar: 1, fat: 6.9, satFat: 1.2, monoFat: 0.8, polyFat: 3.8, omega6: 3.6, omega3: 0.12, iron: 3.9, magnesium: 139, phosphorus: 438, zinc: 3.5, folate: 90, copper: 0.88, manganese: 3.7, calcium: 54, potassium: 392, choline: 43 },
    proteinQuality: { leucinGPer100: 1.2, digestibility: 0.68 },
    src: 'USDA FDC 16961 (Oat flour/rolled oats)',
  },
  {
    id: 'egg', name: 'Ei (ganz, gekocht)', category: 'Eier',
    n: { kcal: 155, protein: 12.6, carbs: 0.7, fiber: 0, sugar: 1.1, fat: 10.6, satFat: 3.3, monoFat: 4.1, polyFat: 1.6, omega6: 1.2, omega3: 0.07, iron: 1.8, zinc: 1.3, selenium: 30, choline: 294, calcium: 56, potassium: 138, phosphorus: 198, vitaminB12: 0.9, vitaminA: 83 },
    fatSources: ['egg'],
    proteinQuality: { leucinGPer100: 0.93, digestibility: 0.94 },
    src: 'USDA FDC 10071235 (egg, whole, cooked)',
  },
  {
    id: 'milk-skim', name: 'Milch 1,5 %', category: 'Milchprodukte',
    n: { kcal: 50, protein: 3.4, carbs: 4.8, fiber: 0, sugar: 4.8, fat: 1.5, satFat: 1, monoFat: 0.45, polyFat: 0.09, iron: 0.02, calcium: 120, potassium: 150, phosphorus: 94, vitaminB12: 0.45, vitaminA: 26, magnesium: 11 },
    fatSources: ['dairy-fat'],
    proteinQuality: { leucinGPer100: 0.27, digestibility: 0.91 },
    src: 'USDA FDC 1008797 / BLS 105',
  },
  {
    id: 'yogurt-greek', name: 'Joghurt (griechisch, 2 %)', category: 'Milchprodukte',
    n: { kcal: 97, protein: 9, carbs: 3.6, fiber: 0, sugar: 3.6, fat: 0.5, satFat: 0.32, monoFat: 0.1, iron: 0.06, calcium: 111, potassium: 155, phosphorus: 144, vitaminB12: 0.52, vitaminA: 15 },
    fatSources: ['dairy-fat'],
    proteinQuality: { leucinGPer100: 0.71, digestibility: 0.91 },
    src: 'USDA FDC 168236',
  },
  {
    id: 'banana', name: 'Banane', category: 'Obst',
    n: { kcal: 89, protein: 1.1, carbs: 22.8, fiber: 2.6, sugar: 12.2, fat: 0.3, satFat: 0.05, monoFat: 0.05, polyFat: 0.05, potassium: 358, magnesium: 27, vitaminC: 8.7, vitaminB6: 0.37, folate: 20, manganese: 0.26, calcium: 5 },
    src: 'USDA FDC 17111 (banana, raw)',
  },
  {
    id: 'apple', name: 'Apfel', category: 'Obst',
    n: { kcal: 52, protein: 0.3, carbs: 13.8, fiber: 2.4, sugar: 10.4, fat: 0.2, potassium: 107, vitaminC: 4.6, calcium: 6, magnesium: 5 },
    src: 'USDA FDC 170212 (apple, raw)',
  },
  {
    id: 'blueberries', name: 'Blaubeeren', category: 'Obst',
    n: { kcal: 57, protein: 0.7, carbs: 14.5, fiber: 2.4, sugar: 10, fat: 0.3, vitaminC: 9.7, potassium: 77, vitaminK: 16.3, calcium: 6, magnesium: 6 },
    src: 'USDA FDC 172505',
  },
  {
    id: 'spinach', name: 'Spinat (roh)', category: 'Gemüse',
    n: { kcal: 23, protein: 2.9, carbs: 3.6, fiber: 2.2, sugar: 0.4, fat: 0.4, iron: 2.7, magnesium: 79, calcium: 99, vitaminC: 28.1, vitaminK: 483, folate: 194, potassium: 558, vitaminA: 469 },
    src: 'USDA FDC 10012668',
  },
  {
    id: 'broccoli', name: 'Brokkoli (gedünstet)', category: 'Gemüse',
    n: { kcal: 25, protein: 2.1, carbs: 4.6, fiber: 2.6, sugar: 1.7, fat: 0.3, iron: 0.7, calcium: 47, vitaminC: 51, vitaminK: 102, folate: 63, potassium: 313, magnesium: 21, manganese: 0.44 },
    src: 'USDA FDC 16771 (broccoli, boiled)',
  },
  {
    id: 'tomato', name: 'Tomate', category: 'Gemüse',
    n: { kcal: 18, protein: 0.9, carbs: 3.9, fiber: 1.2, sugar: 2.6, fat: 0.2, potassium: 237, vitaminC: 13.7, vitaminA: 42, magnesium: 11 },
    src: 'USDA FDC 170606',
  },
  {
    id: 'chicken-breast', name: 'Hähnchenbrust (gebraten)', category: 'Fleisch',
    n: { kcal: 238, protein: 31, carbs: 0, fiber: 0, sugar: 0, fat: 12, satFat: 3.3, monoFat: 4, polyFat: 1.8, omega6: 1.4, iron: 1, zinc: 0.9, selenium: 27, phosphorus: 228, potassium: 332, vitaminB12: 0.3, choline: 135 },
    fatSources: ['red-meat'],
    proteinQuality: { leucinGPer100: 2.7, digestibility: 0.94 },
    src: 'USDA FDC 166562 (chicken breast, roasted)',
  },
  {
    id: 'beef-lean', name: 'Rind (mager, Steak)', category: 'Fleisch',
    n: { kcal: 217, protein: 26.6, carbs: 0, fiber: 0, sugar: 0, fat: 11.7, satFat: 4.8, monoFat: 4.4, polyFat: 0.6, omega6: 0.5, iron: 2.6, zinc: 5.8, selenium: 26, phosphorus: 225, potassium: 351, vitaminB12: 2.5, choline: 45, magnesium: 21 },
    fatSources: ['red-meat'],
    proteinQuality: { leucinGPer100: 2.9, digestibility: 0.94 },
    src: 'USDA FDC 10109480 (beef, top round, grilled)',
  },
  {
    id: 'salmon', name: 'Lachs (gegrillt)', category: 'Fisch',
    n: { kcal: 208, protein: 20.4, carbs: 0, fiber: 0, sugar: 0, fat: 13.4, satFat: 3.1, monoFat: 3.2, polyFat: 2.2, omega3: 2.0, omega6: 0.3, iron: 0.8, zinc: 0.4, selenium: 34.4, phosphorus: 301, potassium: 398, vitaminB12: 3.2, vitaminA: 45, calcium: 12, magnesium: 29, choline: 390 },
    fatSources: ['fish'],
    proteinQuality: { leucinGPer100: 1.9, digestibility: 0.93 },
    src: 'USDA FDC 10064500 (salmon, Atlantic, grilled)',
  },
  {
    id: 'tuna', name: 'Thunfisch (Dose, in Wasser)', category: 'Fisch',
    n: { kcal: 116, protein: 26, carbs: 0, fiber: 0, sugar: 0, fat: 0.8, satFat: 0.2, monoFat: 0.2, polyFat: 0.2, omega3: 0.1, iron: 1.3, zinc: 1.1, selenium: 48, phosphorus: 249, potassium: 253, vitaminB12: 2.1, choline: 197 },
    fatSources: ['fish'],
    proteinQuality: { leucinGPer100: 2.5, digestibility: 0.93 },
    src: 'USDA FDC 163362 (tuna, light, canned)',
  },
  {
    id: 'lentils', name: 'Linsen (gekocht)', category: 'Hülsenfrüchte',
    n: { kcal: 116, protein: 9, carbs: 20.1, fiber: 7.9, sugar: 1.8, fat: 0.4, iron: 3.3, magnesium: 36, phosphorus: 180, zinc: 1.3, folate: 181, potassium: 369, manganese: 0.54, calcium: 19, choline: 31 },
    proteinQuality: { leucinGPer100: 0.61, digestibility: 0.66 },
    src: 'USDA FDC 16775 (lentils, cooked)',
  },
  {
    id: 'chickpeas', name: 'Kichererbsen (gekocht)', category: 'Hülsenfrüchte',
    n: { kcal: 164, protein: 8.9, carbs: 27.4, fiber: 7.6, sugar: 4.8, fat: 2.6, iron: 2.9, magnesium: 48, phosphorus: 168, zinc: 1.5, folate: 171, potassium: 291, calcium: 49, manganese: 0.61 },
    proteinQuality: { leucinGPer100: 0.55, digestibility: 0.73 },
    src: 'USDA FDC 16774 (chickpeas, cooked)',
  },
  {
    id: 'rice-brown', name: 'Brareis (gekocht)', category: 'Getreide',
    n: { kcal: 111, protein: 2.6, carbs: 23.2, fiber: 1.8, sugar: 0.1, fat: 0.6, satFat: 0.1, monoFat: 0.1, polyFat: 0.2, iron: 0.4, magnesium: 43, phosphorus: 110, zinc: 0.9, manganese: 1.1, calcium: 10, potassium: 59, folate: 16 },
    src: 'USDA FDC 16822 (rice, brown, cooked)',
  },
  {
    id: 'bread-whole', name: 'Vollkornbrot', category: 'Getreide',
    n: { kcal: 247, protein: 13, carbs: 41, fiber: 7, sugar: 6, fat: 3.4, satFat: 0.6, monoFat: 0.5, polyFat: 1.2, iron: 3, magnesium: 93, phosphorus: 260, zinc: 2.3, folate: 39, calcium: 36, potassium: 200, selenium: 14 },
    src: 'BLS 300 / USDA FDC 10153714 (whole grain bread)',
  },
  {
    id: 'pasta-cooked', name: 'Pasta (gekocht)', category: 'Getreide',
    n: { kcal: 158, protein: 5.8, carbs: 30.9, fiber: 1.8, sugar: 0.6, fat: 0.8, satFat: 0.1, monoFat: 0.1, polyFat: 0.2, iron: 1.1, magnesium: 35, phosphorus: 150, zinc: 1, folate: 38, calcium: 13, potassium: 130 },
    src: 'USDA FDC 16111 (spaghetti, cooked)',
  },
  {
    id: 'potato', name: 'Kartoffel (gekocht)', category: 'Gemüse',
    n: { kcal: 87, protein: 1.9, carbs: 17.5, fiber: 2.2, sugar: 0.8, fat: 0.1, potassium: 421, vitaminC: 19.7, magnesium: 23, phosphorus: 51, vitaminB6: 0.45, folate: 15, calcium: 8 },
    src: 'USDA FDC 16131 (potato, boiled)',
  },
  {
    id: 'avocado', name: 'Avocado', category: 'Obst/Fett',
    n: { kcal: 160, protein: 2, carbs: 8.5, fiber: 6.7, sugar: 0.7, fat: 14.7, satFat: 2.1, monoFat: 9.8, polyFat: 1.8, omega6: 0.6, omega3: 0.2, potassium: 485, magnesium: 29, vitaminK: 21, folate: 81, vitaminC: 10, calcium: 12 },
    fatSources: ['avocado'],
    src: 'USDA FDC 172067 (avocado, raw)',
  },
  {
    id: 'olive-oil', name: 'Olivenöl (extra virgin)', category: 'Öle',
    n: { kcal: 884, protein: 0, carbs: 0, fiber: 0, sugar: 0, fat: 100, satFat: 14, monoFat: 73, polyFat: 11, omega6: 9.5, omega3: 0.6, vitaminE: 14.4, vitaminK: 62 },
    fatSources: ['olive-oil'],
    src: 'USDA FDC 16084 (olive oil)',
  },
  {
    id: 'rapeseed-oil', name: 'Rapsöl', category: 'Öle',
    n: { kcal: 884, protein: 0, carbs: 0, fiber: 0, sugar: 0, fat: 100, satFat: 7, monoFat: 61, polyFat: 21, omega6: 16, omega3: 9.3, vitaminE: 16.8, vitaminK: 33 },
    fatSources: ['rapeseed-oil'],
    src: 'USDA FDC 16120 (canola oil)',
  },
  {
    id: 'sunflower-oil', name: 'Sonnenblumenöl', category: 'Öle',
    n: { kcal: 884, protein: 0, carbs: 0, fiber: 0, sugar: 0, fat: 100, satFat: 10.6, monoFat: 19.3, polyFat: 68.1, omega6: 64, omega3: 0.1, vitaminE: 56 },
    fatSources: ['sunflower-oil'],
    src: 'USDA FDC 16125 (sunflower oil)',
  },
  {
    id: 'butter', name: 'Butter', category: 'Fette',
    n: { kcal: 717, protein: 0.4, carbs: 0.1, fiber: 0, sugar: 0.1, fat: 81.1, satFat: 50.4, monoFat: 21.3, polyFat: 2.9, omega6: 2.3, omega3: 0.1, vitaminA: 388, vitaminE: 1.8, calcium: 24, vitaminK: 13 },
    fatSources: ['butter-cream', 'dairy-fat'],
    src: 'USDA FDC 10035748 (butter, salted)',
  },
  {
    id: 'cheese-cheddar', name: 'Cheddar', category: 'Milchprodukte',
    n: { kcal: 403, protein: 24.9, carbs: 1.3, fiber: 0, sugar: 1.3, fat: 33.1, satFat: 21.4, monoFat: 8.5, polyFat: 1, iron: 0.2, calcium: 731, phosphorus: 483, zinc: 3, vitaminB12: 1.2, vitaminA: 200, potassium: 98, magnesium: 14, vitaminK: 0.4 },
    fatSources: ['dairy-fat'],
    proteinQuality: { leucinGPer100: 2, digestibility: 0.85 },
    src: 'USDA FDC 16954 (cheese, cheddar)',
  },
  {
    id: 'almonds', name: 'Mandeln', category: 'Nüsse/Samen',
    n: { kcal: 579, protein: 21.2, carbs: 21.6, fiber: 12.5, sugar: 4.4, fat: 49.9, satFat: 3.8, monoFat: 30.2, polyFat: 13.3, omega6: 12, omega3: 0.27, magnesium: 270, vitaminE: 25.6, calcium: 269, phosphorus: 484, zinc: 3.1, folate: 51, manganese: 2.5, potassium: 733, choline: 52 },
    fatSources: ['nuts-seeds'],
    proteinQuality: { leucinGPer100: 1.05, digestibility: 0.75 },
    src: 'USDA FDC 17018 (almonds, raw)',
  },
  {
    id: 'walnuts', name: 'Walnüsse', category: 'Nüsse/Samen',
    n: { kcal: 654, protein: 15.2, carbs: 13.7, fiber: 6.7, sugar: 2.6, fat: 65.2, satFat: 6.1, monoFat: 11.1, polyFat: 47.1, omega6: 33.7, omega3: 9.1, magnesium: 158, phosphorus: 346, vitaminE: 0.7, zinc: 3.1, folate: 95, manganese: 2.4, potassium: 441 },
    fatSources: ['nuts-seeds'],
    src: 'USDA FDC 17015 (walnuts, raw)',
  },
  {
    id: 'chia', name: 'Chiasamen', category: 'Nüsse/Samen',
    n: { kcal: 486, protein: 16.5, carbs: 42.1, fiber: 34.4, sugar: 0, fat: 30.7, satFat: 3.3, monoFat: 2.8, polyFat: 22.3, omega6: 4.8, omega3: 17.5, calcium: 631, magnesium: 335, phosphorus: 860, iron: 7.7, zinc: 4.6, manganese: 2.7, potassium: 407 },
    fatSources: ['nuts-seeds'],
    src: 'USDA FDC 173820 (chia seed, raw)',
  },
  {
    id: 'coconut-oil', name: 'Kokosöl', category: 'Öle',
    n: { kcal: 862, protein: 0, carbs: 0, fiber: 0, sugar: 0, fat: 100, satFat: 82.5, monoFat: 6.3, polyFat: 2, omega6: 0.2, omega3: 0 },
    fatSources: ['coconut'],
    src: 'USDA FDC 16892 (coconut oil)',
  },
  {
    id: 'dark-chocolate', name: 'Schokolade (85 % Kakao)', category: 'Sonstiges',
    n: { kcal: 598, protein: 7.8, carbs: 45.9, fiber: 10.9, sugar: 24, fat: 42.6, satFat: 25.2, monoFat: 8, polyFat: 3.3, iron: 11.9, magnesium: 228, zinc: 3.3, phosphorus: 711, manganese: 3.8, copper: 4.1, potassium: 715, calcium: 73, folate: 31 },
    fatSources: ['butter-cream', 'other'],
    src: 'USDA FDC 16925 (chocolate, dark, 85 %)',
  },
  {
    id: 'honey', name: 'Honig', category: 'Sonstiges',
    n: { kcal: 304, protein: 0.3, carbs: 82.4, fiber: 0.2, sugar: 82, fat: 0, potassium: 52, vitaminC: 0.2, magnesium: 2 },
    src: 'USDA FDC 1001559 (honey, raw)',
  },
  {
    id: 'coffee-black', name: 'Kaffee (schwarz, gebrüht)', category: 'Getränke',
    n: { kcal: 2, protein: 0.1, carbs: 0, fiber: 0, sugar: 0, fat: 0, potassium: 67, magnesium: 3, calcium: 5 },
    src: 'USDA FDC 1006690 (coffee, brewed)',
  },
  {
    id: 'beer', name: 'Bier (5 %)', category: 'Getränke',
    n: { kcal: 43, protein: 0.5, carbs: 3.6, fiber: 0, sugar: 2.6, fat: 0, alcohol: 4.5, iron: 0.1, phosphorus: 11, magnesium: 5, potassium: 14, folate: 2, zinc: 0.1 },
    src: 'USDA FDC 1004161 (beer, brewed)',
  },
  {
    id: 'tofu', name: 'Tofu (fest)', category: 'Hülsenfrüchte',
    n: { kcal: 144, protein: 16.2, carbs: 2.8, fiber: 0.3, sugar: 0.6, fat: 8.7, satFat: 1.2, monoFat: 1, polyFat: 4.5, omega6: 3.8, iron: 5.4, calcium: 350, phosphorus: 235, magnesium: 66, zinc: 1.8, manganese: 1.5, potassium: 108, choline: 25 },
    fatSources: ['soy-oil'],
    proteinQuality: { leucinGPer100: 0.85, digestibility: 0.8 },
    src: 'USDA FDC 16862 (tofu, firm)',
  },
]

export const FOOD_MAP: Record<string, FoodDef> = Object.fromEntries(
  FOODS.map((f) => [f.id, f]),
)

export function searchFoods(query: string): FoodDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return FOODS
  return FOODS.filter(
    (f) => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q),
  )
}
