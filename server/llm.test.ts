/**
 * Tests für den LLM-Provider-Adapter (server/llm.ts).
 * Alle Tests nutzen einen gemockten globalen fetch — kein echter
 * Netz-Call, keine echten Keys. Provider-Konfiguration kommt
 * ausschließlich aus process.env (gesetzt & geräumt pro Test).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { llmProviders, llmChat, llmStatus, llmJson, scanResultSchema } from './llm'

const REAL_ENV: Record<string, string | undefined> = {}
const ENV_KEYS = ['OLLAMA_BASE_URL', 'OLLAMA_MODEL', 'LM_STUDIO_BASE_URL', 'LM_STUDIO_MODEL', 'OPENAI_API_BASE', 'OPENAI_API_KEY', 'OPENAI_MODEL']

function setEnv(vars: Record<string, string>) {
  for (const k of ENV_KEYS) {
    if (!(k in REAL_ENV)) REAL_ENV[k] = process.env[k]
    if (k in vars) process.env[k] = vars[k]
    else delete process.env[k]
  }
}

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (REAL_ENV[k] === undefined) delete process.env[k]
    else process.env[k] = REAL_ENV[k]
  }
  vi.unstubAllGlobals()
})

/** Baut eine fetch-Mock, die OpenAI-Chat-Responses liefert. */
function mockChatFetch(respond: (callIdx: number, url: string) => unknown) {
  let calls = 0
  const mock = vi.fn(async (url: string) => {
    const i = calls++
    const body = respond(i, String(url))
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

const chatResponse = (content: string) => ({
  choices: [{ message: { role: 'assistant', content } }],
})

describe('llm: Provider-Auflösung (Ollama → LM Studio → remote)', () => {
  it('ohne Konfiguration: keine Provider', () => {
    setEnv({})
    expect(llmProviders()).toHaveLength(0)
  })

  it('Ollama zuerst, LM Studio als Fallback', () => {
    setEnv({ OLLAMA_MODEL: 'qwen2.5vl:7b', LM_STUDIO_MODEL: 'gemma-3-4b-it' })
    const ps = llmProviders()
    expect(ps).toHaveLength(2)
    expect(ps[0].label).toMatch(/Ollama/)
    expect(ps[0].model).toBe('qwen2.5vl:7b')
    expect(ps[0].baseUrl).toBe('http://localhost:11434')
    expect(ps[0].vision).toBe(true) // qwen2.5vl => Vision
    expect(ps[1].label).toMatch(/LM Studio/)
    expect(ps[1].baseUrl).toBe('http://192.168.56.1:1234/v1')
  })

  it('Vision-Erkennung: Text-Modell ohne vl/llava -> vision false', () => {
    setEnv({ OLLAMA_MODEL: 'mistral-7b-instruct-v0.3' })
    expect(llmProviders()[0].vision).toBe(false)
  })

  it('remote OpenAI-kompatibel nur mit BASE + KEY', () => {
    setEnv({ OPENAI_API_BASE: 'https://api.example.com/v1', OPENAI_MODEL: 'gpt-4o-mini' })
    expect(llmProviders()).toHaveLength(0) // nur BASE, kein KEY
    setEnv({ OPENAI_API_BASE: 'https://api.example.com/v1', OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'gpt-4o-mini' })
    const ps = llmProviders()
    expect(ps).toHaveLength(1)
    expect(ps[0].apiKey).toBe('test-key')
  })
})

describe('llm: Chat-Completion (OpenAI-kompatibel, kein Key im Frontend)', () => {
  it('ruft /chat/completions des konfigurierten Providers auf', async () => {
    setEnv({ OLLAMA_MODEL: 'llava:13b' })
    const fetchMock = mockChatFetch(() => chatResponse('Alles klar, dein HRV-Trend ist stabil.'))
    const res = await llmChat([{ role: 'user', content: 'Wie ist mein Trend?' }])
    expect(res.text).toBe('Alles klar, dein HRV-Trend ist stabil.')
    expect(res.model).toBe('llava:13b')
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toBe('http://localhost:11434/chat/completions')
  })

  it('Bild-Input: content-Array mit image_url-Teil', async () => {
    setEnv({ LM_STUDIO_MODEL: 'qwen2.5-vl-7b' })
    const seen: { body: any } = {}
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
      seen.body = JSON.parse(String(init.body))
      return new Response(JSON.stringify(chatResponse('ok')), { status: 200 })
    }))
    await llmChat([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Was ist auf dem Foto?' },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAA' } },
        ],
      },
    ])
    const last = seen.body.messages.at(-1)
    expect(Array.isArray(last.content)).toBe(true)
    expect(last.content.some((p: any) => p.type === 'image_url')).toBe(true)
  })

  it('ohne Provider: klarer NO_PROVIDER-Fehler (kein leiser Fallback im Adapter)', async () => {
    setEnv({})
    await expect(llmChat([{ role: 'user', content: 'Hi' }])).rejects.toThrow('NO_PROVIDER')
  })

  it('leere Modellantwort -> Lesbarer Fehler', async () => {
    setEnv({ OLLAMA_MODEL: 'llava:13b' })
    mockChatFetch(() => ({ choices: [{ message: {} }] }))
    await expect(llmChat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(/LEERES_MODELLANTWORT|LLM-Fehler/)
  })
})

describe('llm: JSON-Zwang (llmJson) — KI liefert nur Namen/Mengen, keine Nährwerte', () => {
  it('parse-Callback validiert; 1. Versuch kaputt, 2. valid => Erfolg', async () => {
    setEnv({ OLLAMA_MODEL: 'qwen2.5vl:7b' })
    const fetchMock = mockChatFetch((callIdx) =>
      callIdx === 0
        ? chatResponse('Hier ist das Ergebnis: {"items": [{"name": "Lachs", "quantityG": 120, "confidence": 0.8}]}')
        : chatResponse('```json\n{"items":[{"name":"Lachs","quantityG":120,"unit":"g","confidence":0.8,"uncertainties":[]}],"notVisible":[],"overallConfidence":0.75}\n```'),
    )
    const schema = scanResultSchema
    const { data } = await llmJson(
      [{ role: 'user', content: 'scan' }],
      (s) => schema.parse(JSON.parse(s)),
    )
    expect(data.items[0].name).toBe('Lachs')
    expect(data.overallConfidence).toBe(0.75)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('nach 2 Fehlversuchen: deutlicher Fehler (kein halbes Ergebnis)', async () => {
    setEnv({ OLLAMA_MODEL: 'qwen2.5vl:7b' })
    mockChatFetch(() => chatResponse('Ich verstehe deine Frage nicht.'))
    await expect(
      llmJson([{ role: 'user', content: 'scan' }], (s) => scanResultSchema.parse(JSON.parse(s)), { maxAttempts: 2 }),
    ).rejects.toThrow(/kein valides JSON/)
  })

  it('scanResultSchema: gültiges Scan-JSON passt, ungültiges wird abgelehnt', () => {
    const good = {
      items: [{ name: 'Brokkoli', quantityG: 150, unit: 'g', confidence: 0.9, uncertainties: [] }],
      notVisible: [],
      overallConfidence: 0.9,
    }
    expect(() => scanResultSchema.parse(good)).not.toThrow()

    // keine negativen Mengen, Konfidenz 0–1
    expect(() => scanResultSchema.parse({ ...good, items: [{ ...good.items[0], quantityG: -5 }] })).toThrow()
    expect(() => scanResultSchema.parse({ ...good, overallConfidence: 4.2 })).toThrow()
  })
})

describe('llm: Status-Abfrage für die UI', () => {
  it('erreichbarer Provider => available true, mit Modellen', async () => {
    setEnv({ OLLAMA_MODEL: 'llava:13b' })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url)
      if (u.endsWith('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'llava:13b' }, { id: 'llava:7b' }] }), { status: 200 })
      }
      throw new Error('unexpected: ' + u)
    }))
    const st = await llmStatus()
    expect(st.available).toBe(true)
    expect(st.active?.label).toMatch(/Ollama/)
    expect(st.providers[0].reachable).toBe(true)
    expect(st.providers[0].models).toContain('llava:13b')
  })

  it('kein Provider erreichbar => available false, Fallback-Kennzeichnung', async () => {
    setEnv({ OLLAMA_MODEL: 'llava:13b', LM_STUDIO_MODEL: 'gemma-3-4b-it' })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED') }))
    const st = await llmStatus()
    expect(st.available).toBe(false)
    expect(st.fallback).toBe('rule-based')
  })
})
