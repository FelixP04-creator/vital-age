/**
 * VITAL AGE — Lokaler API-Server
 * =====================================================================
 * Läuft auf :8787 (Vite-Proxy: /api -> hier).
 *
 * Endpunkte:
 *  GET  /api/health            — Server-Status + LLM-Status
 *  POST /api/coach/ask         — KI-Coach (lokales LLM oder regelbasiert)
 *  POST /api/food/scan         — Foto-Erkennung (lokales Vision-Modell)
 *  GET  /api/llm/status        — Erreichbare lokale LLM-Provider
 *
 * SICHERHEIT:
 *  - ALLE API-Keys (LLM, Google Health) leben AUSSCHLIESSLICH hier
 *    (.env) — nie im Frontend, nie im Quellcode.
 *  - Rate-Limiting pro Endpunkt (In-Memory).
 *  - Keine Speicherung von Gesundheitsdaten auf diesem Server —
 *    der Client hält die Daten (localStorage) oder nutzt Supabase.
 */
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { handleCoachAsk } from './coach'
import { handleFoodScan } from './foodScan'
import { llmStatus } from './llm'
import { handleOAuthToken, handleHealthSync, googleHealthConfigured } from './healthAuth'

const app = express()
app.use(cors())
// Große Payloads für Fotos (base64), aber begrenzt
app.use(express.json({ limit: '10mb' }))

/* ---------- Endpunkte ---------- */

app.get('/api/health', async (_req, res) => {
  const llm = await llmStatus()
  res.json({
    ok: true,
    app: 'vital-age-api',
    version: '0.1.0',
    llm,
    googleHealth: {
      configured: googleHealthConfigured(),
      note: 'OAuth-Flow siehe docs/GOOGLE-HEALTH-SETUP.md',
    },
  })
})

app.get('/api/llm/status', async (_req, res) => {
  res.json(await llmStatus())
})

app.post('/api/coach/ask', handleCoachAsk)
app.post('/api/food/scan', handleFoodScan)

/* Google Health (OAuth 2.0 + API-Brücke, s. server/healthAuth.ts) */
app.post('/api/health/oauth/token', handleOAuthToken)
app.post('/api/health/sync', handleHealthSync)

/* ---------- Fehler-Handler ---------- */
app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api] Unbehandelter Fehler:', _err)
  res.status(500).json({ error: 'Interner Serverfehler. Details im Server-Log.' })
})

const port = Number(process.env.API_PORT ?? 8787)
app.listen(port, () => {
  console.log(`VITAL AGE API läuft auf http://localhost:${port}`)
  console.log('LLM-Konfiguration:', process.env.OLLAMA_MODEL ? `Ollama ${process.env.OLLAMA_MODEL}` : process.env.LM_STUDIO_MODEL ? `LM Studio ${process.env.LM_STUDIO_MODEL}` : 'kein Modell konfiguriert -> regelbasierte Fallbacks')
})

export default app
