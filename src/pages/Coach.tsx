/**
 * VITAL AGE — KI-Coach
 * Chat-UI: stellt Fragen zu den eigenen Daten.
 * Engine-Anzeige: "llm <Modell>" oder "regelbasiert" (klar getrennt).
 * Der Server entscheidet: lokales LLM erreichbar -> llm, sonst rule-based.
 * Alle API-Keys bleiben serverseitig.
 */
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/useApp'
import { Card, Badge, Button, PageHeader, SourceBadge } from '../ui/components'
import { apiBase } from '../lib/api'
import type { CoachMessage } from '../lib/types'

const SUGGESTIONS = [
  'Wie ist meine Recovery heute?',
  'Wie stabil sind meine Schlafzeiten?',
  'Wie war mein Training diese Woche?',
  'Wie sieht meine Ernährung aus?',
  'Welche Daten fehlen mir noch?',
]

export default function Coach() {
  const { coachHistory, addCoachMessage, records, activities, meals, checkIns, connection } = useApp()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [coachHistory, busy])

  async function ask(question: string) {
    const q = question.trim()
    if (!q || busy) return
    setInput('')
    setBusy(true)
    setError(null)
    const userMsg: CoachMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: q,
      engine: 'rule-based',
      createdAt: new Date().toISOString(),
    }
    addCoachMessage(userMsg)
    try {
      const res = await fetch(`${apiBase()}/api/coach/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          records: records.slice(-400),
          activities,
          meals,
          checkIns,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const ai: CoachMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data.answer,
        engine: data.engine === 'llm' ? 'llm' : 'rule-based',
        createdAt: new Date().toISOString(),
      }
      addCoachMessage(ai)
      if (data.engine === 'rule-based' && data.llmAvailable === false) {
        setError('Lokales KI-Modell nicht erreichbar — diese Antwort ist regelbasiert. Modell starten: Ollama (qwen2.5vl:7b) oder LM Studio (Qwen2.5-VL).')
      }
    } catch (e) {
      setError(
        `Der Coach-Server antwortet nicht (${e instanceof Error ? e.message : String(e)}). Starte ihn mit „npm run dev:server“ — bis dahin arbeitet der Coach regelbasiert.`,
      )
      // Lokale regelbasierte Antwort als letzte Rettung (Client-seitig)
      const { ruleBasedCoach } = await import('../lib/coach/ruleEngine')
      const { computeBaseline } = await import('../lib/scoring/baseline')
      const baseline = computeBaseline(records)
      const rb = ruleBasedCoach({ records, activities, meals, checkIns, baseline, question: q })
      addCoachMessage({
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: `[Offline regelbasiert] ${rb.text}`,
        engine: 'rule-based',
        createdAt: new Date().toISOString(),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="KI-Coach"
        back="/"
        action={
          coachHistory.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => useApp.getState().clearCoachHistory()}>
              Verlauf löschen
            </Button>
          ) : undefined
        }
      />
      <div className="page" style={{ gap: 10 }}>
        {connection.demoMode && (
          <div className="demo-banner" role="status">
            <span className="icon">⚠</span>
            <span>Demo-Daten aktiv — der Coach analysiert Beispieldaten.</span>
          </div>
        )}

        {/* Chat-Feld */}
        <div className="card" style={{ padding: 10, minHeight: 200, maxHeight: 420, overflowY: 'auto' }}>
          {coachHistory.length === 0 ? (
            <div className="stack-sm" style={{ padding: 8 }}>
              <p className="muted" style={{ fontSize: 13 }}>
                Frage mich zu deinen Daten: Recovery, Schlaf, Training, Ernährung, Datenlücken.
                Ich antworte nur auf der Basis deiner tatsächlich gespeicherten Werte.
              </p>
              <div className="tag-row">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="badge badge--neutral" style={{ textTransform: 'none', cursor: 'pointer', padding: '6px 10px', fontSize: 11 }} onClick={() => ask(s)}>
                    {s}
                  </button>
                ))}
              </div>
              <p className="dim" style={{ fontSize: 11 }}>
                Kein Arzt: keine Diagnosen, keine Medikamenten-Empfehlungen.
              </p>
            </div>
          ) : (
            <div className="stack-sm">
              {coachHistory.map((m) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      maxWidth: '88%',
                      padding: '8px 12px',
                      borderRadius: 14,
                      background: m.role === 'user' ? 'var(--primary-soft)' : 'var(--card-high)',
                      border: `1px solid ${m.role === 'user' ? 'rgba(0,240,168,0.25)' : 'var(--hairline)'}`,
                      fontSize: 13,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {m.text}
                    {m.role === 'assistant' && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Badge tone={m.engine === 'llm' ? 'primary' : 'warning'}>
                          {m.engine === 'llm' ? 'KI (lokal)' : 'regelbasiert'}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div className="badge badge--neutral" style={{ padding: '8px 12px' }}>
                    <span className="pulse">●</span> analysiere deine Daten …
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {error && (
          <div className="demo-banner" role="alert" style={{ background: 'var(--error-soft)', borderColor: 'rgba(255,59,48,0.3)', color: 'var(--error)' }}>
            <span className="icon">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Eingabe */}
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Frage an deinen Coach …"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask(input)}
            aria-label="Coach-Frage"
          />
          <Button onClick={() => ask(input)} disabled={busy || !input.trim()}>
            {busy ? '…' : 'Senden'}
          </Button>
        </div>

        <Card title="So arbeitet der Coach" icon={<span>§</span>}>
          <div className="stack-sm">
            <p className="muted" style={{ fontSize: 12 }}>
              <strong>1. Lokales KI-Modell</strong> (Ollama/LM Studio, serverseitig): strukturierte Datenübergabe deiner letzten 14 Tage,
              Antworten im Stil eines Wellness-Coaches. Modellname wird bei jeder Antwort angezeigt.
            </p>
            <p className="muted" style={{ fontSize: 12 }}>
              <strong>2. Regelbasierte Engine</strong> (Fallback ohne Modell): deterministische Auswertung deiner Daten.
              Wird immer als „regelbasiert“ gekennzeichnet — keine echte KI-Analyse.
            </p>
            <p className="muted" style={{ fontSize: 12 }}>
              <strong>Sicherheit:</strong> API-Zugänge bleiben serverseitig. Der Coach erhält nur zusammengefasste Kennzahlen
              (kein Rohdaten-Dump), befolgt keine Anweisungen aus deinen Daten (Prompt-Injection-Schutz) und verweigert medizinische Fragen.
            </p>
          </div>
        </Card>
      </div>
    </>
  )
}
