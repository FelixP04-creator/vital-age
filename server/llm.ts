/**
 * VITAL AGE — Lokale KI (Provider-Adapter)
 * =====================================================================
 * Die App-Anforderung: die KI läuft mit einem KLEINEN LOKALEN Modell,
 * das auch BILDER erkennt (Food-Scanner) und Texte (Coach).
 *
 * Architektur:
 *  - OpenAI-kompatibler Chat-Adapter (funktioniert mit Ollama,
 *    LM Studio und anderen lokalen Servern; optional remote OpenAI).
 *  - Bild-Input als base64 data-URL (Chat-Completion mit
 *    content-Array), wie es Ollama & LM Studio unterstützen.
 *  - Provider-Auflösung in Prioritätsreihenfolge:
 *      1) Ollama   (http://localhost:11434)      — Default
 *      2) LM Studio (http://192.168.56.1:1234)   — Fallback
 *      3) OPENAI_API_BASE (optional, remote)
 *  - Kein API-Key im Frontend: ALLE Calls laufen durch diesen Server.
 *  - Wenn KEIN Provider erreichbar ist: der Coach fällt auf die
 *    regelbasierte Engine zurück (Antwort wird als "regelbasiert"
 *    gekennzeichnet), der Foto-Scanner zeigt einen klaren
 *    "kein Modell" Zustand mit manueller Auswahl als Ersatz.
 *
 * Modell-Empfehlungen (klein, lokal, mit Vision):
 *  - Ollama:  qwen2.5vl:7b  |  llava:13b  |  minicpm-v  |  gemma3:12b
 *  - LM Studio: Qwen2.5-VL-7B-Instruct (GGUF Q4/Q5) — auch Text + Bild
 *  - Nur Text (keine Vision nötig für den Coach): gemma-3-4b, qwen2.5-3b
 */
import { z } from 'zod'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ChatPart[]
}
export interface ChatPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

export interface LLMConfig {
  baseUrl: string
  apiKey?: string
  model: string
  /** true wenn das Modell Bilder verstehen kann (Vision) */
  vision: boolean
  label: string
}

const env = process.env

/** Provider-Kandidaten aus Umgebungsvariablen (siehe .env.example). */
export function llmProviders(): LLMConfig[] {
  const providers: LLMConfig[] = []

  // 1) Ollama
  const ollamaBase = env.OLLAMA_BASE_URL || 'http://localhost:11434'
  const ollamaModel = env.OLLAMA_MODEL
  if (ollamaModel) {
    providers.push({
      baseUrl: ollamaBase,
      model: ollamaModel,
      vision: /vl|llava|vision|gemma3|minicpm/i.test(ollamaModel),
      label: `Ollama (${ollamaModel})`,
    })
  }
  // 2) LM Studio
  const lmBase = env.LM_STUDIO_BASE_URL || 'http://192.168.56.1:1234/v1'
  const lmModel = env.LM_STUDIO_MODEL
  if (lmModel) {
    providers.push({
      baseUrl: lmBase,
      model: lmModel,
      vision: /vl|llava|vision|gemma3|minicpm|qwen2\.5-vl/i.test(lmModel),
      label: `LM Studio (${lmModel})`,
    })
  }
  // 3) OpenAI-kompatibel (remote, optional)
  if (env.OPENAI_API_BASE && env.OPENAI_API_KEY) {
    providers.push({
      baseUrl: env.OPENAI_API_BASE,
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      vision: true,
      label: `OpenAI-kompatibel (${env.OPENAI_MODEL || 'gpt-4o-mini'})`,
    })
  }
  return providers
}

const fetchJson = async (url: string, init?: RequestInit, timeoutMs = 30000) => {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal })
    const text = await res.text()
    let json: unknown
    try { json = JSON.parse(text) } catch { json = { raw: text } }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
    return json as Record<string, unknown>
  } finally {
    clearTimeout(t)
  }
}

/** Prüft, ob ein Provider erreichbar ist; liefert verfügbare Modelle. */
export async function probeProvider(p: LLMConfig): Promise<{ ok: boolean; models: string[]; error?: string }> {
  try {
    // OpenAI-kompatible Modelle-Liste (funktioniert bei Ollama & LM Studio)
    const j = await fetchJson(`${p.baseUrl.replace(/\/$/, '')}/models`, {
      headers: p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : undefined,
    }, 3000)
    const data = (j.data ?? []) as Array<Record<string, unknown>>
    const models = data.map((m) => String(m.id ?? m.name ?? ''))
    return { ok: true, models }
  } catch (e) {
    return { ok: false, models: [], error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Chat-Completion (OpenAI-kompatibel) mit optionalem Bild-Input.
 * @throws wenn kein Provider erreichbar ist.
 */
export async function llmChat(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; provider?: LLMConfig; timeoutMs?: number } = {},
): Promise<{ text: string; provider: LLMConfig; model: string }> {
  const provider =
    opts.provider ??
    llmProviders().find((p) => p.model) ??
    llmProviders()[0]
  if (!provider) {
    throw new Error('NO_PROVIDER')
  }
  const url = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`
  const body = {
    model: provider.model,
    messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 700,
    stream: false,
  }
  try {
    const j = await fetchJson(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    }, opts.timeoutMs ?? 120000)
    const choices = j.choices as Array<{ message?: { content?: string } }> | undefined
    const text = choices?.[0]?.message?.content
    if (typeof text !== 'string') throw new Error('LEERES_MODELLANTWORT')
    return { text: text.trim(), provider, model: provider.model }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`LLM-Fehler (${provider.label}): ${msg}`)
  }
}

/**
 * Status für die UI: welche lokalen Provider sind erreichbar,
 * welches Modell ist konfiguriert, gibt es ein Vision-Modell?
 */
export async function llmStatus() {
  const providers = llmProviders()
  const out = await Promise.all(
    providers.map(async (p) => {
      const probe = await probeProvider(p)
      return {
        label: p.label,
        baseUrl: p.baseUrl,
        configuredModel: p.model,
        vision: p.vision,
        reachable: probe.ok,
        models: probe.ok ? probe.models.slice(0, 20) : [],
        error: probe.error,
      }
    }),
  )
  const active = out.find((p) => p.reachable && p.configuredModel) ?? out.find((p) => p.reachable)
  return {
    available: !!active,
    active: active ?? null,
    providers: out,
    fallback: 'rule-based',
  }
}

/* ---------------- JSON-Extraktion für strukturierte Antworten ---------------- */

export const scanResultSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().min(1),
      /** geschätzte Gramm/Milliliter */
      quantityG: z.number().positive(),
      unit: z.enum(['g', 'ml', 'piece', 'portion']).default('g'),
      /** 0–1 Konfidenz der Erkennung */
      confidence: z.number().min(0).max(1),
      /** was unsicher ist (Zutaten, Menge, Zubereitung) */
      uncertainties: z.array(z.string()).default([]),
      cookingMethod: z.string().optional(),
    }),
  ),
  /** was auf dem Bild NICHT sicher erkennbar ist */
  notVisible: z.array(z.string()).default([]),
  overallConfidence: z.number().min(0).max(1),
})

/**
 * Zwingt ein LLM zu validiertem JSON (mehrere Versuche, dann throw).
 * WICHTIG: Die KI erfindet keine Nährwerte — die come ausschließlich
 * aus der Lebensmitteldatenbank. Das LLM liefert nur: Name + Menge.
 */
export async function llmJson<T>(
  messages: ChatMessage[],
  parse: (s: string) => T,
  opts: { provider?: LLMConfig; maxAttempts?: number } = {},
): Promise<{ data: T; provider: LLMConfig }> {
  const maxAttempts = opts.maxAttempts ?? 2
  let lastErr: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const msgs: ChatMessage[] = [...messages]
    if (attempt > 0) {
      msgs.push({ role: 'assistant', content: String(lastErr) })
      msgs.push({ role: 'user', content: 'Deine Antwort war kein valides JSON. Antworte AUSSCHLIESSLICH mit dem JSON-Objekt, ohne Markdown, ohne Kommentar.' })
    }
    const { text, provider } = await llmChat(msgs, { temperature: 0.1, provider: opts.provider })
    try {
      const data = parse(extractJson(text))
      return { data, provider }
    } catch (e) {
      lastErr = e
      // nächsten Versuch
    }
  }
  throw new Error(`KI lieferte kein valides JSON nach ${maxAttempts} Versuchen: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`)
}

/**
 * Extrahiert ein JSON-Objekt aus (möglicherweise) mit Markdown
 * ummanteltem LLM-Text. Robust gegen ```-Blöcke und umgebenden Text.
 */
function extractJson(text: string): string {
  // 1) ```json ... ``` Block
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) return fence[1].trim()
  // 2) erstes { ... } oder [ ... ] Pair ausbalanciert extrahieren
  const start = text.search(/[[{]/)
  if (start === -1) return text.trim()
  const open = text[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return text.slice(start).trim()
}