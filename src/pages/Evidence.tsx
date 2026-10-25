/**
 * VITAL AGE — Evidenz-Transparenz
 * =====================================================================
 * Zeigt, WOHER die Werte & Aussagen der App kommen und wie stark die
 * Evidenz dahinter ist. Keine "Science-Washing"-Box: jede Methode ist
 * mit Quelle + Evidenzstufe gekennzeichnet, inkl. klaren Grenzen.
 */
import { Card, Badge, PageHeader } from '../ui/components'

interface EvidenceEntry {
  area: string
  what: string
  how: string
  evidence: 'human' | 'consensus' | 'model' | 'heuristic'
  source: string
  limit: string
}

const STAGE: Record<EvidenceEntry['evidence'], { label: string; tone: string }> = {
  human: { label: 'Humanstudien', tone: 'primary' },
  consensus: { label: 'Leitlinien-Konsens', tone: 'primary' },
  model: { label: 'Modell / Schätzung', tone: 'warning' },
  heuristic: { label: 'App-heuristik', tone: 'neutral' },
}

const ENTRIES: EvidenceEntry[] = [
  {
    area: 'Recovery-Score',
    what: '0–100-Index für Erholung',
    how: 'Wichtet HRV-Trend, Ruhepuls, Schlafqualität & subjektives Check-in gegen deine persönliche Rolling-Baseline.',
    evidence: 'model',
    source: 'Eigene Gewichtung auf Basis von HRV-/RHR-Literatur (u. a. HRV-Recovery-Studien); keine 1:1-Äquivalenz zu kommerziellen Scores.',
    limit: 'Heuristisches Modell — Trend ist aussagekräftiger als der absolute Wert.',
  },
  {
    area: 'Strain',
    what: '0–21-Index für Belastung',
    how: 'Kumulierte Trainingsbelastung (Dauer × Intensität, HR-basiert) relativ zur 28-Tage-Basislinie.',
    evidence: 'model',
    source: 'Aufbau analog zu Trainings-Last-Modellen; bewusst nicht WHOOP-äquivalent.',
    limit: 'Bewertet Volumen/Intensität, nicht Regenerationskontext.',
  },
  {
    area: 'Schlafanalyse',
    what: 'Phasen, Effizienz, Stabilität',
    how: 'Aus Wearable-Schlafdaten; Effizienz = Schlafzeit/Zeit im Bett, Stabilität über HRV-Variabilität.',
    evidence: 'human',
    source: 'Standardisierte Schlafmetriken (AASM-terminologisch); Phasengrenzen geräteabhängig.',
    limit: 'Wearable-Phasenerkennung ist Näherung — kein Polysomnografie-Ersatz.',
  },
  {
    area: 'Vitalität / physiologischer Altersindikator',
    what: '0–100-Index',
    how: 'Multi-Parameter-Indikator (HRV, RHR, Schlaf, Aktivität) gegen Populations-/Altersbezug.',
    evidence: 'model',
    source: 'App-eigener Indikator; bewusst kein "biologisches Alter" im klinischen Sinne.',
    limit: 'Relative Einordnung, keine medizinische Altersdiagnose.',
  },
  {
    area: 'Nährwerte (Lebensmittel)',
    what: 'kcal, Makros, Mikros pro 100 g',
    how: 'Deterministische Werte aus kuratierter DB (Basis: USDA FoodData Central), skaliert auf erfasste Menge.',
    evidence: 'consensus',
    source: 'USDA FoodData Central, CC0 1.0 Universal — https://fdc.nal.usda.gov/',
    limit: 'Durchschnittswerte; reale Mahlzeiten (Zubereitung, Sorte) variieren.',
  },
  {
    area: 'Meal-Score',
    what: '1–10 für eine Mahlzeit',
    how: 'Bewertet Eiweiß, KH-Qualität, Fettprofil, Mikrodichte, Ballaststoffe & Ziele (transparent, subscore-basiert).',
    evidence: 'heuristic',
    source: 'App-eigene, nachvollziehbare Gewichtung; Leitlinien-Bezug: WHO/EFSA Referenzwerte.',
    limit: 'App-eigener Richtwert — keine medizinische Bewertung.',
  },
  {
    area: 'Bioverfügbarkeit',
    what: 'Aufnahme-Effekte (z. B. Vitamin C & Eisen)',
    how: 'Kuratierte, gut untersuchte Mechanismen mit deterministischen Trigger-Regeln auf der Mahlzeit.',
    evidence: 'human',
    source: 'Pigman & Hurrell 1980; Hurrell 2003; Hurrell & Egli 2004; EFSA-Opinions (siehe Absorption-Seite).',
    limit: 'Konservative Effektschätzungen; individuell variabel.',
  },
  {
    area: 'KI-Coach & Foto-Scanner',
    what: 'Antwort / Lebensmittel-Erkennung',
    how: 'Lokales, bildfähiges Modell (Ollama/LM Studio). Nährwerte NIE vom Modell — immer aus DB. Ohne Modell: klar gekennzeichnete Regel-Engine.',
    evidence: 'model',
    source: 'Lokale Provider (keine Cloud-Daten); Fallback ohne Simulation.',
    limit: 'Erkennung/Schätzung — Mengen sind grob, vor Speichern prüfen.',
  },
]

export default function Evidence() {
  return (
    <>
      <PageHeader title="Evidenz & Quellen" back="/" />
      <div className="page">
        <Card>
          <p className="muted" style={{ fontSize: 13 }}>
            VITAL AGE rechnet nicht im Dunkeln: jede Kennzahl trägt eine{' '}
            <strong>Quellen-Kennzeichnung</strong> (gemessen / berechnet / geschätzt) und jede
            Methode eine <strong>Evidenzstufe</strong>. So siehst du, wo du auf Daten bauen kannst
            und wo du nachschlagen solltest.
          </p>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <Badge tone="primary">Humanstudien</Badge>
            <Badge tone="primary">Leitlinien-Konsens</Badge>
            <Badge tone="warning">Modell / Schätzung</Badge>
            <Badge tone="neutral">App-heuristik</Badge>
          </div>
        </Card>

        <div className="stack">
          {ENTRIES.map((e) => {
            const st = STAGE[e.evidence]
            return (
              <Card key={e.area}>
                <div className="row-between" style={{ alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{e.area}</span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <p className="dim" style={{ fontSize: 12, marginTop: 4 }}>{e.what}</p>
                <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                  <strong style={{ color: 'var(--fg)' }}>So wird's berechnet:</strong> {e.how}
                </p>
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  <strong style={{ color: 'var(--fg)' }}>Quelle:</strong> {e.source}
                </p>
                <p className="dim" style={{ fontSize: 12, marginTop: 6, fontStyle: 'italic' }}>
                  Grenze: {e.limit}
                </p>
              </Card>
            )
          })}
        </div>

        <Card>
          <p className="dim" style={{ fontSize: 12 }}>
            <strong style={{ color: 'var(--fg)' }}>Datenquellen:</strong> USDA FoodData Central
            (CC0 1.0, https://fdc.nal.usda.gov/) · EFSA (https://www.efsa.europa.eu/) · WHO
            (https://www.who.int/health-topics/nutrition) · Wearable: Google Health / Fitbit Air
            (eigene Freigaben via OAuth 2.0).
          </p>
          <p className="dim" style={{ fontSize: 12, marginTop: 8 }}>
            VITAL AGE ist kein Medizinprodukt und stellt keine Diagnosen. Bei gesundheitlichen
            Fragen wende dich an ärztliches Fachpersonal.
          </p>
        </Card>
      </div>
    </>
  )
}
