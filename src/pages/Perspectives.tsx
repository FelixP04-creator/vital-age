/**
 * VITAL AGE — Perspektiven
 * =====================================================================
 * Zeigt dieselben Kennzahlen aus verschiedenen, legitimen Blickwinkeln
 * (Leistung / Nachhaltigkeit / Schlaf / Ernährung) — und benennt die
 * Spannungsfelder, statt nur einen Score zu preisen. Ehrlich über
 * Zielkonflikte (z. B. "mehr Strain" vs. "mehr Recovery").
 */
import { Card, Badge, PageHeader, LinearTrack } from '../ui/components'
import { useApp } from '../store/useApp'
import { computeDayScores } from '../lib/scoring'
import { fmt } from '../lib/stats'

export default function Perspectives() {
  const { records } = useApp()
  const days = records.length
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  const last = sorted[sorted.length - 1]
  const day = last ? computeDayScores(sorted, last.date) : null
  const recoveryScore = day?.recovery.score ?? null

  const perspectives = [
    {
      icon: '⚡',
      title: 'Leistungsperspektive',
      tone: 'primary',
      text:
        'Optimiert auf maximale Trainingseffekte und Spitzenleistung. Hier zählt der Strain: genug Reiz, um Anpassung zu erzwingen — Recovery wird nur so weit optimiert, wie sie den nächsten starken Block ermöglicht.',
      pros: 'Schnelle Fortschritte, klare Trainingssteuerung.',
      cons: 'Kann zu zu viel Volumen/Intensität neigen, wenn Recovery ignoriert wird.',
    },
    {
      icon: '🌱',
      title: 'Nachhaltigkeitsperspektive',
      tone: 'neutral',
      text:
        'Optimiert auf langfristige Konsistenz und Gesundheit über Jahre. Belastung wird moderat gehalten, Erholung und Schlaf priorisiert — lieber dauerhaft gut als kurzfristig maximal.',
      pros: 'Robust gegen Übertraining, schützt Gesundheit & Adhärenz.',
      cons: 'Scheint in Leistungsblöcken zu "wenig" Ambition.',
    },
    {
      icon: '🌙',
      title: 'Schlafperspektive',
      tone: 'warning',
      text:
        'Sieht Schlaf als primären Hebel: Erholung, kognitive Leistung und hormonelle Balance hängen stark an Schlafqualität & -regelmäßigkeit. Belastung und Ernährung werden an den Schlaf ausgerichtet.',
      pros: 'Größter einzelner Hebel für Recovery & Vitalität.',
      cons: 'Verliert bei schlechtem Schlaf den Bezug zum Trainingsreiz.',
    },
    {
      icon: '🥗',
      title: 'Ernährungsperspektive',
      tone: 'primary',
      text:
        'Fokus auf Nährstoffdichte, Ballaststoffe und Mikronährstoffversorgung. Mahlzeiten werden als Treiber von Energie, Erholung und Langfristgesundheit gelesen — nicht nur als Kalorienbilanz.',
      pros: 'Stabilisiert Energie & Erholung über den Tag.',
      cons: 'Kann zu rigiden Optimierungsdenken führen.',
    },
  ]

  const tension =
    days >= 7
      ? `Über die letzten ${days} Tage bewegt sich deine Kombination aus Belastung (Strain) und Erholung (Recovery) im Takt — die App zeigt beide Pole, damit du den für dich richtigen Kompromiss triffst, statt einen einzigen Score zu glattbügeln.`
      : 'Sobald ≥ 7 Tage Daten vorliegen, zeigt VITAL AGE dir die Spannung zwischen Belastung und Erholung — damit du deinen persönlichen Balancepunkt findest.'

  return (
    <>
      <PageHeader title="Perspektiven" back="/" />
      <div className="page">
        <Card>
          <p className="muted" style={{ fontSize: 13 }}>
            Dieselben Daten, vier Blickwinkel. VITAL AGE zwingt dir keine einzige Perspektive auf —
            du wählst, was zu deinem Ziel passt.
          </p>
          {recoveryScore !== null && (
            <div style={{ marginTop: 12 }}>
              <div className="row-between" style={{ fontSize: 12, marginBottom: 4 }}>
                <span className="dim">Heutiger Erholungswert</span>
                <span className="mono" style={{ color: 'var(--primary)' }}>
                  {fmt(recoveryScore, 0)} / 100
                </span>
              </div>
              <LinearTrack pct={recoveryScore} />
            </div>
          )}
        </Card>

        <div className="stack">
          {perspectives.map((p) => (
            <Card key={p.title}>
              <div className="row-between" style={{ alignItems: 'center' }}>
                <span style={{ fontSize: 18 }}>{p.icon}</span>
                <Badge tone={p.tone}>Blickwinkel</Badge>
              </div>
              <h3 style={{ margin: '8px 0 6px', fontSize: 15 }}>{p.title}</h3>
              <p className="muted" style={{ fontSize: 13 }}>{p.text}</p>
              <p className="dim" style={{ fontSize: 12, marginTop: 8 }}>
                <strong style={{ color: 'var(--fg)' }}>+ </strong>
                {p.pros}
              </p>
              <p className="dim" style={{ fontSize: 12, marginTop: 4 }}>
                <strong style={{ color: 'var(--fg)' }}>− </strong>
                {p.cons}
              </p>
            </Card>
          ))}
        </div>

        <Card>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Spannungsfelder</h3>
          <p className="muted" style={{ fontSize: 13 }}>{tension}</p>
        </Card>
      </div>
    </>
  )
}
