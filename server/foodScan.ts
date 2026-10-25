/**
 * VITAL AGE — Foto-Scanner-Server
 * =====================================================================
 * POST /api/food/scan  { imageBase64 (data-URL), mealType?, note? }
 * -> { available, items[], notVisible[], overallConfidence, provider, model }
 *
 * WICHTIGE ARCHITEKTUR-REGEL (anti-Halluzination):
 *  - Das LLM erkennt NUR Lebensmittel + schätzt Mengen (Name, Menge).
 *  - ALLE Nährwerte werden danach DETERMINISTISCH aus der
 *    Lebensmitteldatenbank (src/lib/nutrition/db.ts) berechnet.
 *  - Erkannte Namen werden gegen die DB gematcht (Fuzzy); was nicht
 *    gematcht wird, bleibt ohne Nährwerte und wird als
 *    "nicht in Datenbank" markiert — es werden KEINE Werte erfunden.
 *  - Ohne erreichbares Vision-Modell: { available:false } — die UI
 *    zeigt dann einen klaren Status + manuelle Auswahl. Es wird NIEMALS
 *    eine erfolgreiche Erkennung simuliert.
 */
import type { Request, Response } from 'express'
import { z } from 'zod'
import { llmChat, llmStatus, llmProviders, llmJson, scanResultSchema, type ChatMessage } from './llm'
import { FOODS, FOOD_MAP, searchFoods } from '../src/lib/nutrition/db'

const scanSchema = z.object({
  image: z.string().min(100).max(8_000_000), // base64 data-URL, max ~8 MB
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  note: z.string().max(500).optional(),
})

/** Deutsches Vokabular -> FoodDef-IDs (bestmöglicher Match). */
function matchFood(name: string): { id: string; confidence: number } | null {
  const n = name.toLowerCase()
  const rules: Array<[RegExp, string]> = [
    [/hafer|oat/, 'oatmeal'],
    [/omelett|omelette|ei(er)?\b|\beier\b/, 'egg'],
    [/käse|kase|cheese|feta/, 'cheese-cheddar'],
    [/quark|yog(h)urt/, 'yogurt-greek'],
    [/milch|buttermilch/, 'milk-skim'],
    [/banan/, 'banana'],
    [/apfel/, 'apple'],
    [/blaubeer|beere|blueberry/, 'blueberries'],
    [/spinat/, 'spinach'],
    [/brokkoli/, 'broccoli'],
    [/tomat/, 'tomato'],
    [/hähn|huhn|chicken/, 'chicken-breast'],
    [/rind|steak|beef|hack/, 'beef-lean'],
    [/lachs|salmon/, 'salmon'],
    [/thun|tuna|fisch/, 'tuna'],
    [/linse|lentil/, 'lentils'],
    [/kicher|chickpea|hummus/, 'chickpeas'],
    [/braunreis|vollkornreis/, 'rice-brown'],
    [/reis/, 'rice-brown'],
    [/brot|toast|semmel|brötchen/, 'bread-whole'],
    [/nudel|pasta|spaghetti|lasagne/, 'pasta-cooked'],
    [/kartoffel|pomme|frites/, 'potato'],
    [/avocado/, 'avocado'],
    [/olivenöl|olive/, 'olive-oil'],
    [/rapsöl/, 'rapeseed-oil'],
    [/sonnenblumen/, 'sunflower-oil'],
    [/butter|margarine/, 'butter'],
    [/mandel/, 'almonds'],
    [/walnuss/, 'walnuts'],
    [/chia|leinsamen/, 'chia'],
    [/kokos/, 'coconut-oil'],
    [/schokolade|kakao|choco/, 'dark-chocolate'],
    [/honig|sirop|syrup/, 'honey'],
    [/kaffee|espresso|americano/, 'coffee-black'],
    [/bier|beer/, 'beer'],
    [/tofu|seitan/, 'tofu'],
  ]
  for (const [re, id] of rules) {
    if (re.test(n)) return { id, confidence: 0.9 }
  }
  // Fuzzy: Name aus DB direkt vergleichen
  const found = searchFoods(n).find((f) => f.name.toLowerCase() === n)
  if (found) return { id: found.id, confidence: 0.7 }
  return null
}

const SCAN_PROMPT = (mealType?: string, note?: string) =>
  `Du bist ein Lebensmittel-Erkennungssystem. Analysiere das Foto der Mahlzeit und antworte AUSSCHLIESSLICH mit einem JSON-Objekt in dieser Form (kein Markdown, kein Text drumherum):
{"items":[{"name":"<Lebensmittel auf Deutsch>","quantityG":"<geschätzte Gramm/Milliliter, Zahl>","unit":"g|ml|piece|portion","confidence":0.0-1.0,"uncertainties":["<was unsicher ist>"],"cookingMethod":"<optional>"}],"notVisible":["<was nicht sichtbar ist, z.B. Öle, Soßen, versteckte Zutaten>"],"overallConfidence":0.0-1.0}
Regeln:
- Nenne NUR erkennbare Lebensmittel. Unklare Zutaten in uncertainties bzw. notVisible.
- Mengen sind GROBE Schätzungen (typische Portion).
- Öle, Soßen, Salz und versteckte Zutaten gehören in notVisible, NICHT in items.
${mealType ? `- Mahlzeit: ${mealType}` : ''}
${note ? `- Zusatzinfo vom Nutzer: ${note}` : ''}`

/** Handler für POST /api/food/scan */
export async function handleFoodScan(req: Request, res: Response): Promise<void> {
  const parsed = scanSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Ungültiges Bild/format', details: parsed.error.issues })
    return
  }
  const { image, mealType, note } = parsed.data

  // 1) Vision-Modell verfügbar?
  const status = await llmStatus()
  const visionProvider =
    status.active && status.active.vision
      ? llmProviders().find((p) => p.label === status.active!.label)
      : null
  if (!visionProvider) {
    res.json({
      available: false,
      reason:
        'Kein lokales Vision-Modell erreichbar. Bitte Ollama oder LM Studio mit einem Bild-Modell (z. B. qwen2.5vl:7b) starten — oder Lebensmittel manuell auswählen.',
      items: [],
      notVisible: [],
      overallConfidence: 0,
    })
    return
  }

  // 2) LLM-Scan (Namen + Mengen NUR)
  try {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: SCAN_PROMPT(mealType, note) },
          { type: 'image_url', image_url: { url: image } },
        ],
      },
    ]
    const { data } = await llmJson(messages, (s) => scanResultSchema.parse(JSON.parse(s)), { provider: visionProvider, maxAttempts: 2 })

    // 3) Deterministisches DB-Matching (anti-Halluzination)
    const items = data.items.map((it) => {
      const m = matchFood(it.name)
      return {
        rawName: it.name,
        matchedId: m?.id ?? null,
        matchedLabel: m ? FOOD_MAP[m.id].name : null,
        quantity: it.quantityG,
        unit: it.unit,
        confidence: m ? it.confidence : 0,
        uncertainties: it.uncertainties,
        cookingMethod: it.cookingMethod,
        inDatabase: !!m,
      }
    })

    res.json({
      available: true,
      items,
      notVisible: data.notVisible,
      overallConfidence: data.overallConfidence,
      provider: visionProvider.label,
      model: visionProvider.model,
      note: 'Namen/Mengen sind KI-Schätzungen. Nährwerte werden aus der Lebensmitteldatenbank berechnet und vor dem Speichern von dir bestätigt.',
    })
  } catch (e) {
    res.json({
      available: true,
      scanFailed: true,
      error: e instanceof Error ? e.message : String(e),
      items: [],
      notVisible: [],
      overallConfidence: 0,
      note: 'Erkennung fehlgeschlagen — bitte manuell auswählen oder Foto erneut versuchen.',
    })
  }
}