import { describe, it, expect } from 'vitest'
import { FOODS, FOOD_MAP, searchFoods } from './db'
import { scaleNutrients, buildFoodItem, aggregateMacros } from './calc'
import { scoreMeal } from './mealScore'
import { demoProfile } from '../demo'
import type { Meal, FoodItem } from '../types'

describe('nutrition: Lebensmittel-DB (USDA FoodData Central, CC0)', () => {
  it('DB ist nicht leer und jede Food-ID ist eindeutig', () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(20)
    const ids = FOODS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    // jede Definition hat mindestens kcal + protein + carbs
    for (const f of FOODS) {
      expect(typeof f.n.kcal).toBe('number')
      expect(typeof f.n.protein).toBe('number')
      expect(typeof f.n.carbs).toBe('number')
      expect(f.src.length).toBeGreaterThan(0)
    }
  })

  it('searchFoods: Name & Kategorie, leere Suche -> alles', () => {
    expect(searchFoods('').length).toBe(FOODS.length)
    const hafer = searchFoods('hafer')
    expect(hafer.length).toBeGreaterThanOrEqual(1)
    expect(hafer.some((f) => f.id === 'oatmeal')).toBe(true)
    const fisch = searchFoods('Fisch')
    expect(fisch.length).toBeGreaterThanOrEqual(1)
  })
})

describe('nutrition: Skalierung & Aggregation', () => {
  it('scaleNutrients: pro 100 g -> Faktor 1; 50 g -> halbe Menge', () => {
    const oat = FOOD_MAP['oatmeal']
    const full = scaleNutrients(oat, 100, 'g')
    const half = scaleNutrients(oat, 50, 'g')
    expect(full.kcal).toBeCloseTo(oat.n.kcal, 5)
    expect(half.kcal).toBeCloseTo(oat.n.kcal / 2, 5)
  })

  it('buildFoodItem: unbekannte ID -> null (keine erfundenen Nährwerte)', () => {
    expect(buildFoodItem('existiert-nicht', 100)).toBeNull()
    const item = buildFoodItem('egg', 2, 'piece')
    expect(item).not.toBeNull()
    // Stück = 100 g => 2 Stück = 200 g
    expect(item!.nutrients['kcal']).toBeCloseTo(FOOD_MAP['egg'].n.kcal * 2, 1)
    expect(item!.nutrientSource).toBe('database')
  })

  it('aggregateMacros: Summe der Items (Macros konsistent)', () => {
    const a = buildFoodItem('chicken-breast', 150)!
    const b = buildFoodItem('rice-brown', 200)!
    const meal = aggregateMacros([a, b])
    expect(meal.proteinG).toBeCloseTo((a.nutrients['protein'] ?? 0) + (b.nutrients['protein'] ?? 0), 1)
    expect(meal.caloriesKcal).toBeGreaterThan(0)
    // fehlende Mikro-Keys bleiben null (nie 0 bei fehlenden Daten)
    expect(meal.alcoholG).toBeNull()
  })
})

describe('mealScore: Mahlzeitenscore 1–10', () => {
  const makeMeal = (items: FoodItem[], name = 'Testmahlzeit'): Meal => ({
    id: 'meal-test',
    date: '2026-10-24',
    mealType: 'lunch',
    name,
    items,
    macros: aggregateMacros(items),
    micros: {},
    method: 'manual',
    confirmed: true,
    createdAt: '2026-10-24T12:00:00Z',
  })

  it('gibt Score 1–10 mit Subscores, Gründen und Evidenz-Links', () => {
    const meal = makeMeal([
      buildFoodItem('chicken-breast', 150)!,
      buildFoodItem('broccoli', 200)!,
      buildFoodItem('rice-brown', 150)!,
    ])
    const r = scoreMeal(meal, demoProfile())
    expect(r.score).toBeGreaterThanOrEqual(1)
    expect(r.score).toBeLessThanOrEqual(10)
    expect(r.subscores).toBeDefined()
    expect(r.reasons.length).toBeGreaterThan(0)
    expect(r.evidence.length).toBeGreaterThan(0)
    for (const e of r.evidence) {
      expect(e.url).toMatch(/^https:\/\//)
    }
    expect(r.disclaimer.length).toBeGreaterThan(5)
  })

  it('leere Mahlzeit: kein Crash, Score im gültigen Bereich', () => {
    const meal = makeMeal([])
    const r = scoreMeal(meal, demoProfile())
    expect(r.score).toBeGreaterThanOrEqual(1)
    expect(r.score).toBeLessThanOrEqual(10)
  })
})
