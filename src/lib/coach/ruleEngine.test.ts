import { describe, it, expect } from 'vitest'
import { ruleBasedCoach } from './ruleEngine'
import { generateDemoRecords, generateDemoActivities, generateDemoCheckIns, demoBaseline } from '../demo'
import { computeBaseline } from '../scoring/baseline'

function ctx(question: string) {
  const records = generateDemoRecords(new Date('2026-10-24T12:00:00'))
  return {
    records,
    activities: generateDemoActivities(records),
    meals: [],
    checkIns: generateDemoCheckIns(records),
    baseline: computeBaseline(records),
    question,
  }
}

describe('ruleEngine: regelbasierter Coach (Fallback ohne LLM)', () => {
  it('jede Antwort ist als regelbasiert gekennzeichnet (keine Fake-KI)', () => {
    const a = ruleBasedCoach(ctx('Wie ist meine Recovery?'))
    expect(a.engine).toBe('rule-based')
    expect(a.text.length).toBeGreaterThan(30)
    expect(a.gaps).toBeDefined()
    expect(a.dataUsed).toBeDefined()
  })

  it('Recovery-Frage nutzt HRV/RHR-Daten', () => {
    const a = ruleBasedCoach(ctx('Wie ist meine Recovery die letzten Tage?'))
    expect(a.dataUsed.join(' ')).toMatch(/hrv|rhr|herz|erholung|recovery/i)
  })

  it('Schlaf-Frage erkennt Schlaf-Defizite aus den eigenen Daten', () => {
    const a = ruleBasedCoach(ctx('Wie ist mein Schlaf?'))
    expect(a.text.length).toBeGreaterThan(30)
    expect(a.dataUsed.length).toBeGreaterThan(0)
  })

  it('Trend-Frage funktioniert (Trend-Block darf nicht alles absorbieren)', () => {
    const trend = ruleBasedCoach(ctx('Zeig mir meinen Trend'))
    const sleep = ruleBasedCoach(ctx('Wie schläft es sich?'))
    // beide liefern Antworten; die Schlaf-Antwort muss schlafbezogen sein
    expect(trend.text.length).toBeGreaterThan(30)
    expect(sleep.text.toLowerCase()).toMatch(/schlaf|nacht|stunden|zeit/)
  })

  it('medizinische Fragen werden klar abgelehnt (keine Diagnosen)', () => {
    const a = ruleBasedCoach(ctx('Kann ich bei Schilddrüsen-Problem dieses Medikament nehmen?'))
    expect(a.text).toMatch(/nicht.*(diagnostizier|Medizinisches Gerät)|kein medizinisches Gerät/i)
    expect(a.dataUsed).toHaveLength(0)
  })

  it('Demo-Daten liefern plausible Kontextwerte', () => {
    const recs = generateDemoRecords(new Date('2026-10-24T12:00:00'))
    expect(recs.length).toBeGreaterThanOrEqual(60)
    const b = demoBaseline(recs)
    expect(b.hrvMs).not.toBeNull()
    expect(b.restingHrBpm).not.toBeNull()
    // Determinismus: zweiter Lauf mit gleichem Datum => identisch
    const recs2 = generateDemoRecords(new Date('2026-10-24T12:00:00'))
    expect(recs2.map((r) => r.hrv.value)).toEqual(recs.map((r) => r.hrv.value))
  })
})
