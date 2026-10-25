/**
 * VITAL AGE — Bioverfügbarkeit (Absorption)
 * =====================================================================
 * Info-Page: erklärt die kuratierten Mechanismen, die die Aufnahme von
 * Nährstoffen aus einer Mahlzeit beeinflussen. Jeder Eintrag:
 * Mechanismus, Evidenzstufe, Effekt (konservativ), Unsicherheit,
 * praktische Kombination + Quelle. Die meal-spezifische Auswertung
 * liegt in MealDetail (absorptionInsights()).
 */
import { Card, Badge, PageHeader } from '../ui/components'

interface Mech {
  id: string
  title: string
  stage: 'human' | 'mechanistic'
  mechanism: string
  effect: string
  uncertainty: string
  combo: string
  source: string
}

const STAGE: Record<Mech['stage'], { label: string; tone: string }> = {
  human: { label: 'Humanstudien', tone: 'primary' },
  mechanistic: { label: 'Mechanistisch', tone: 'neutral' },
}

const MECHS: Mech[] = [
  {
    id: 'vitc-iron',
    title: 'Vitamin C verbessert Nicht-Häm-Eisen',
    stage: 'human',
    mechanism:
      'Ascorbat reduziert Ferric (Fe³⁺) zu Ferrous (Fe²⁺) und hält es in Lösung — die Dünndarm-Aufnahme von pflanzlichem Eisen steigt deutlich.',
    effect: 'Nicht-Häm-Eisen-Aufnahme häufig ~+50–100 % bei vitamin-C-reicher Begleitung.',
    uncertainty: 'Abhängig von Eisenzufuhr & -speicher; bei Mangel größer.',
    combo: 'Hülsenfrüchte/Getreide + Paprika, Brokkoli, Zitrus.',
    source: 'Pigman & Hurrell 1980, Am J Clin Nutr; EFSA Claims',
  },
  {
    id: 'fatsol',
    title: 'Fettlösliche Vitamine brauchen Fett',
    stage: 'human',
    mechanism:
      'Vitamin A, D, E, K werden in Mizellen eingebaut — dafür sind Gallensäure UND Nahrungsfett nötig. Fettarme Mahlzeiten senken die Resorption.',
    effect: '10–20 g Fett in eine fettarme Mahlzeit: je nach Studie 2–5× bessere Aufnahme.',
    uncertainty: 'Bei fettetricher Gesamtdiät spielt der einzelne Tag weniger.',
    combo: 'Gemüse mit Öl, Nüssen, Avocado oder fettem Fisch.',
    source: 'Bastida et al. 1997; EFSA Vitamin D Opinion',
  },
  {
    id: 'phytate',
    title: 'Phytat bindet Mineralstoffe',
    stage: 'human',
    mechanism:
      'Phytinsäure (Getreide, Hülsenfrüchte, Nüsse) komplexiert Zink, Eisen, Calcium, Magnesium und senkt deren Absorption.',
    effect: 'In phytatreichen Mahlzeiten 20–60 % weniger Aufnahme (zubereitungsabhängig).',
    uncertainty: 'In ausgewogener Ernährung meist klinisch unbedeutend.',
    combo: 'Sauerteig, Einweichen, Keimung; Vitamin C/Protein in der Mahlzeit puffert.',
    source: 'Hurrell & Egli 2004, Am J Clin Nutr; EFSA',
  },
  {
    id: 'oxalate',
    title: 'Oxalsäure bindet Calcium',
    stage: 'human',
    mechanism:
      'Oxalat (Spinat, Mangold, Rhabarber) bildet unlösliches Calciumoxalat — Calcium aus oxalatreichem Gemüse selbst wird kaum resorbiert.',
    effect: 'Calcium aus oxalatreichem Gemüse ~5 % Resorption; oxalatarmes Calcium bleibt verfügbar.',
    uncertainty: 'Bei ausgewogener Versorgung unkritisch; bei Nierensteinneigung oxalatarme Wahl.',
    combo: 'Calcium zusätzlich aus Milchprodukten, Calcium-Tofu, kalziumreichem Wasser.',
    source: 'Heinig et al. 2004, J Nutr; EFSA Calcium Opinion',
  },
  {
    id: 'caffeine',
    title: 'Koffein & Tannine hemmen Eisen',
    stage: 'human',
    mechanism:
      'Koffein (und Tee-Tannine) senken die Aufnahme von Nicht-Häm-Eisen, vermutlich über chelatbildende Polyphenole.',
    effect: 'Tee zu Mahlzeit ~20–60 % weniger Eisen; Kaffee ~5–25 %.',
    uncertainty: 'Relevant vor allem bei niedriger Eisenzufuhr.',
    combo: 'Kaffee/Tee 30–60 min nach der Mahlzeit.',
    source: 'Ward et al. 1980, Br J Nutr; EFSA',
  },
  {
    id: 'leucine',
    title: 'Leucin-Schwelle für Proteinsynthese',
    stage: 'human',
    mechanism:
      'Muskelprotein-Synthese wird stark durch Leucin getrieben; ~2–3 g pro Mahlzeit gelten als grobe Schwelle bei 20–40 g Protein. Pflanzliche Proteine haben relativ weniger Leucin.',
    effect: 'Mischungen (Hülsenfrüchte + Getreide) nähern sich tierischen Profilen an.',
    uncertainty: '"Schwelle" ist Modellwert, keine starre Grenze.',
    combo: 'Milchprodukte, Eier, Soja, Quorn ergänzen pflanzliche Mahlzeiten.',
    source: 'Moore et al. 2015, Adv Nutr; Phillips & Loumaye 2020',
  },
  {
    id: 'hem-iron',
    title: 'Häm-Eisen ist robuster',
    stage: 'human',
    mechanism:
      'Häm-Eisen (Fleisch/Fisch/Eier) wird über eigenen Transporter aufgenommen — weit weniger anfällig für Phytat/Polyphenole. Zusätzlich steigert tierisches Protein die Nicht-Häm-Aufnahme (MEF).',
    effect: 'Häm-Eisen ~15–35 % Aufnahme vs. ~5–12 % bei Nicht-Häm (2–3×).',
    uncertainty: '—',
    combo: 'Tierische Quellen als Eisen-Basis; Mischkost nutzt beide Wege.',
    source: 'Hurrell 2003, Nutr Rev; EFSA',
  },
]

export default function Absorption() {
  return (
    <>
      <PageHeader title="Bioverfügbarkeit" back="/" />
      <div className="page">
        <Card>
          <p className="muted" style={{ fontSize: 13 }}>
            Nicht alles, was du isst, kommt an. Diese kuratierten Mechanismen zeigen, welche
            Kombinationen die Aufnahme nachweisbar verbessern — und welche sie senken.{' '}
            <strong>Wichtig:</strong> VITAL AGE sagt nie, ein Nährstoff "wird nicht aufgenommen" —
            Effekte sind konservativ geschätzt und individuell unterschiedlich.
          </p>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <Badge tone="primary">Humanstudien</Badge>
            <Badge tone="neutral">Mechanistisch plausibel</Badge>
          </div>
        </Card>

        <div className="stack">
          {MECHS.map((m) => {
            const st = STAGE[m.stage]
            return (
              <Card key={m.id}>
                <div className="row-between" style={{ alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{m.title}</span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>{m.mechanism}</p>
                <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  <strong style={{ color: 'var(--fg)' }}>Effekt:</strong> {m.effect}
                </p>
                <p className="dim" style={{ fontSize: 12, marginTop: 4 }}>
                  <strong style={{ color: 'var(--fg)' }}>Unsicherheit:</strong> {m.uncertainty}
                </p>
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  <strong style={{ color: 'var(--primary)' }}>Kombination:</strong> {m.combo}
                </p>
                <p className="dim" style={{ fontSize: 11, marginTop: 6, fontStyle: 'italic' }}>
                  {m.source}
                </p>
              </Card>
            )
          })}
        </div>

        <Card>
          <p className="dim" style={{ fontSize: 12 }}>
            Für deine konkreten Mahlzeiten wertet VITAL AGE diese Mechanismen automatisch aus —
            siehe <strong style={{ color: 'var(--fg)' }}>Mahlzeitendetail</strong> ("Bioverfügbarkeit").
            Dort werden nur die Mechanismen angezeigt, die auf die Zutaten deiner Mahlzeit
            zutreffen (deterministische Trigger).
          </p>
        </Card>
      </div>
    </>
  )
}
