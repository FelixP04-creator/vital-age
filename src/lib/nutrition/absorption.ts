/**
 * VITAL AGE — Nutrient Absorption Intelligence (Bioverfügbarkeit)
 * =====================================================================
 * Erklärt wissenschaftlich gut untersuchte Mechanismen, die die
 * Aufnahme von Nährstoffen aus einer Mahlzeit beeinflussen.
 *
 * Evidenz-Stufen (s. auch evidence.ts):
 *  - "human": in Humanstudien nachgewiesen
 *  - "mechanistic": mechanistisch plausibel / Zell- oder Tiermodell
 *
 * Jeder Eintrag nennt: Mechanismus, Evidenz, praktischer Effekt
 * (konservativ), Unsicherheit und eine einfache Lebensmittel-Kombination.
 * Keine Aussagen wie "wird überhaupt nicht aufgenommen".
 */
import type { FoodItem, Meal } from '../types'

export interface AbsorptionInsight {
  id: string
  title: string
  mechanism: string
  evidenceLevel: 'human' | 'mechanistic'
  effect: string
  uncertainty: string
  combination: string
  source: string
  /** Stimmt der Kontext der Mahlzeit? (deterministischer Trigger) */
  applicable: boolean
  detail: string
}

const has = (items: FoodItem[], keys: string[], min = 0.5): boolean =>
  items.some((it) => keys.some((k) => (it.nutrients[k] ?? 0) >= min))

export function absorptionInsights(meal: Meal): AbsorptionInsight[] {
  const items = meal.items
  const out: AbsorptionInsight[] = []

  // 1. Vitamin C verbessert Nicht-Häm-Eisen (pflanzlich)
  const hasVegIron = has(items, ['iron'], 2)
  const hasVitC = has(items, ['vitaminC'], 20)
  if (hasVegIron && hasVitC) {
    out.push({
      id: 'vitc-iron',
      title: 'Vitamin C & Eisen',
      mechanism:
        'Vitamin C (Ascorbat) reduziert Ferric (Fe³⁺) zu Ferrous (Fe²⁺) und hält es in Lösung — die Dünndarm-Aufnahme von Nicht-Häm-Eisen (pflanzlich, z. B. Hülsenfrüchte, Getreide) steigt dadurch deutlich.',
      evidenceLevel: 'human',
      effect: 'In Humanstudien verdoppelt sich die Nicht-Häm-Eisen-Aufnahme häufig durch vitamin-C-reiche Begleitung (~+50–100 %).',
      uncertainty: 'Größe des Effekts hängt von der Eisenzufuhr und -speichersituation der Person ab; bei Eisenmangel größer.',
      combination: 'Diese Mahlzeit kombiniert eisenhaltige und vitamin-C-reiche Lebensmittel — eine sinnvolle Kombination.',
      source: 'Pigman & Hurrell 1980, Am J Clin Nutr (klassische Humanstudie); EFSA Claims (Eisen, Ascorbinsäure)',
      applicable: true,
      detail: `${items.filter((i) => (i.nutrients['iron'] ?? 0) >= 2).map((i) => i.name).join(', ')} liefern Eisen, ${items.filter((i) => (i.nutrients['vitaminC'] ?? 0) >= 20).map((i) => i.name).join(', ')} liefern Vitamin C.`,
    })
  } else if (hasVegIron && !hasVitC) {
    out.push({
      id: 'vitc-iron-missing',
      title: 'Eisen ohne Vitamin C',
      mechanism:
        'Nicht-Häm-Eisen aus pflanzlichen Quellen wird schlechter aufgenommen als Häm-Eisen (Fleisch/Fisch). Vitamin C, organische Säuren oder Fleisch in der gleichen Mahlzeit verbessern die Aufnahme.',
      evidenceLevel: 'human',
      effect: 'Fleisch/Fisch/Felder in derselben Mahlzeit erhöht die Eisen-Aufnahme um ~1.5–3×.',
      uncertainty: 'Individuell stark abhängig von Eisenstatus, Zyklus, Schwangerschaft.',
      combination: 'Eine vitamin-C-reiche Beilage (Paprika, Brokkoli, Zitrus) oder eine kleine Portion Fisch/Fleisch würde diese Mahlzeit ergänzen.',
      source: 'EFSA Scientific Opinion on iron & ascorbic acid; Hurrell 2003, Nutr Rev',
      applicable: true,
      detail: 'Eisen-Quelle ohne begleitende Vitamin-C-Quelle erkannt.',
    })
  }

  // 2. Fettlösliche Vitamine brauchen Nahrungsfett
  const fatSol = (['vitaminA', 'vitaminD', 'vitaminE', 'vitaminK'] as const).filter((k) =>
    items.some((i) => (i.nutrients[k] ?? 0) > 0),
  )
  const totalFat = items.reduce((a, i) => a + (i.nutrients['fat'] ?? 0), 0)
  if (fatSol.length > 0 && totalFat < 5) {
    out.push({
      id: 'fatsol-fat',
      title: 'Fettlösliche Vitamine ohne Fett',
      mechanism:
        'Vitamin A, D, E und K werden im Dünndarm in Mizelle eingebaut — dafür ist Gallensäure UND Nahrungsfett nötig. In fettarmen Mahlzeiten sinkt die Resorption dieser Vitamine.',
      evidenceLevel: 'human',
      effect: 'Fettzugabe (z. B. 10–20 g) in eine ansonsten fettarme Mahlzeit erhöht die Aufnahme fettlöslicher Vitamine deutlich (je nach Studie 2–5×).',
      uncertainty: 'Ab einem gewissen Fettgehalt der Gesamtdiät spielt es weniger Rolle; ein einzelner fettarmer Tag ist unkritisch.',
      combination: `Ein Klecks Öl, Nüsse oder ein fettreicher Begleiter (z. B. Avocado, Lachs) zu ${fatSol.map((k) => k.replace('vitamin', 'Vitamin ')).join(', ')} verbessert die Aufnahme.`,
      source: 'Bastida et al. 1997 (β-Carotin & Fett); EFSA Vitamin D Opinion',
      applicable: true,
      detail: `Mahlzeit enthält ${fatSol.join(', ')} aber nur ${totalFat.toFixed(1)} g Fett.`,
    })
  }

  // 3. Phytat & Mineralstoffe
  const hasPhytate = items.some((i) => /hafer|vollkorn|linsen|kicher|nuss|mandel|chia|getreide/i.test(i.name))
  const hasMinerals = has(items, ['zinc', 'iron', 'magnesium', 'calcium'], 2)
  if (hasPhytate && hasMinerals) {
    out.push({
      id: 'phytate',
      title: 'Phytat bindet Mineralstoffe',
      mechanism:
        'Phytinsäure in Getreide, Hülsenfrüchten und Nüssen bildet unlösbare Komplexe mit Zink, Eisen, Calcium und Magnesium und senkt deren Absorption im Dünndarm.',
      evidenceLevel: 'human',
      effect: 'In Mahlzeiten mit hohem Phytat-Gehalt kann die Mineralstoff-Aufnahme um 20–60 % sinken (stark abhängig von Zubereitung: Einweichen, Sauerteig, Keimung reduzieren Phytat).',
      uncertainty: 'In einer insgesamt guten Ernährung (Mehrmahlzeiten, ausreichende Zufuhr) ist der Effekt meist klinisch unbedeutend; relevant vor allem bei einseitiger pflanzlicher Kost oder Mangel.',
      combination: 'Sauerteig, Einweichen oder fermentierte Getreideprodukte reduzieren den Phytat-Gehalt; eine vitamin-C- oder Proteinquelle in derselben Mahlzeit puffert ab.',
      source: 'Hurrell & Egli 2004, Am J Clin Nutr (Phytate & Micromineral Absorption); EFSA',
      applicable: true,
      detail: 'Phytathaltige Lebensmittel (Vollkorn/Hülsenfrüchte/Nüsse) kombiniert mit mineralstoffhaltigen Quellen erkannt.',
    })
  }

  // 4. Calcium & Oxalsäure
  if (has(items, ['vitaminK'], 200) && has(items, ['calcium'], 50)) {
    out.push({
      id: 'oxalate-calcium',
      title: 'Calcium & Oxalsäure (Grünes Gemüse)',
      mechanism:
        'Oxalat (in Spinat, Mangold, Rhabarber) bindet Calcium im Darm zu unlöslichem Calciumoxalat — die Calcium-Aufnahme aus dieser Quelle sinkt, aber oxalatarmes Calcium aus derselben Mahlzeit (Milch, Milchprodukte) wird kaum betroffen.',
      evidenceLevel: 'human',
      effect: 'Calcium aus oxalatreichem Gemüse selbst wird nur ~5 % resorbiert; Gesamtcium-Zufuhr der Diät bleibt aber der relevante Maßstab.',
      uncertainty: 'Kein Problem bei ausgewogener Versorgung; bei Nierensteinneigung oxalatarme Varianten bevorzugen.',
      combination: 'Calcium zusätzlich aus Milchprodukten, Tofu (Calcium-tofu) oder kalziumreichem Wasser beziehen — das bleibt verfügbar.',
      source: 'Heinig et al. 2004, J Nutr; EFSA Calcium Opinion',
      applicable: true,
      detail: 'Oxalat-reiches Gemüse + Calcium-Quelle in derselben Mahlzeit.',
    })
  }

  // 5. Koffein & Eisen
  const hasCaffeine = items.some((i) => /kaffee|tee|espresso|energie|cola/i.test(i.name))
  if (hasCaffeine && hasVegIron) {
    out.push({
      id: 'caffeine-iron',
      title: 'Koffein & Eisen-Aufnahme',
      mechanism:
        'Koffein (und Tannine in Tee) hemmen die Aufnahme von Nicht-Häm-Eisen — vermutlich über chelatbildende Polyphenole bzw. Kalzium-ähnliche Bindungswege.',
      evidenceLevel: 'human',
      effect: 'Tee zu einer Mahlzeit kann die Eisen-Aufnahme um ~20–60 % senken; Kaffee schwächer (~5–25 %).',
      uncertainty: 'Relevant vor allem bei niedriger Eisenzufuhr; bei guter Versorgung klinisch meist unbedeutend.',
      combination: 'Kaffee/Tee besser 30–60 min nach der Mahlzeit trinken statt dazu.',
      source: 'Ward et al. 1980, Br J Nutr; EFSA (Koffein & Eisen)',
      applicable: true,
      detail: 'Koffeinhaltiges Getränk zusammen mit eisenhaltiger Mahlzeit erkannt.',
    })
  }

  // 6. Protein & Bioverfügbarkeit (Leucin-Schwelle)
  const leu = items.reduce((a, i) => a + (i.proteinQuality?.leucinGPer100 ?? 0) * ((i.quantity * (i.unit === 'g' ? 1 : i.unit === 'ml' ? 1 : 1.5)) / 100), 0)
  const prot = items.reduce((a, i) => a + (i.nutrients['protein'] ?? 0), 0)
  if (prot >= 15 && leu < 2.5) {
    out.push({
      id: 'leucine-threshold',
      title: 'Protein & Leucin-Schwelle',
      mechanism:
        'Die Muskelprotein-Synthese (MPS) wird stark durch Leucin getrieben. ~2–3 g Leucin pro Mahlzeit gelten als grobe Schwelle, um die MPS bei Erwachsenen (ca. 20–40 g Protein) deutlich anzuregen; pflanzliche Proteine enthalten relativ weniger Leucin.',
      evidenceLevel: 'human',
      effect: 'Mischungen aus pflanzlichen Quellen (z. B. Hülsenfrüchte + Getreide) nähern sich tierischen Werten; isolierte Leucin-Zugabe hebt pflanzliche Profile an.',
      uncertainty: 'Die "Schwelle" ist ein Modellwert, keine starre Grenze; Gesamtnetz der Aminosäuren & Gesamtkontext zählen.',
      combination: 'Proteinquellen mit höherem Leucin-Gehalt (Milchprodukte, Eier, Soja, Quorn) ergänzen pflanzliche Mahlzeiten gut.',
      source: 'Moore et al. 2015, Adv Nutr (Leucine threshold); Phillips & Loumaye 2020',
      applicable: true,
      detail: `~${prot.toFixed(0)} g Protein, aber nur ~${leu.toFixed(1)} g Leucin geschätzt.`,
    })
  }

  // 7. Häm- vs. Nicht-Häm-Eisen (Info wenn Fisch/Fleisch vorhanden)
  if (has(items, ['vitaminB12'], 0.3)) {
    out.push({
      id: 'hem-iron',
      title: 'Häm-Eisen (Fisch/Fleisch/Eier)',
      mechanism:
        'Häm-Eisen (in tierischen Quellen) wird über einen eigenen Dünndarm-Transporter aufgenommen und ist weitaus weniger anfällig für Phytat, Polyphenole & Co. als Nicht-Häm-Eisen.',
      evidenceLevel: 'human',
      effect: 'Die Häm-Eisen-Aufnahme (~15–35 %) ist 2–3× höher als die von Nicht-Häm-Eisen (~5–12 %); zusätzlich steigtier Fleisch selbst die Nicht-Häm-Eisen-Aufnahme (MEF-Faktor).',
      uncertainty: '—',
      combination: 'Diese Mahlzeit enthält tierische Eisen-Quellen — günstige Eisen-Basis.',
      source: 'Hurrell 2003, Nutr Rev; EFSA',
      applicable: true,
      detail: 'Vitamin-B12-Indikator für tierische Quelle erkannt.',
    })
  }

  if (out.length === 0) {
    out.push({
      id: 'none',
      title: 'Keine besonderen Aufnahme-Faktoren',
      mechanism: 'Für diese Mahlzeitzusammensetzung sind keine der kuratierten Bioverfügbarkeits-Mechanismen relevant.',
      evidenceLevel: 'mechanistic',
      effect: '—',
      uncertainty: 'Weitere (hier nicht kuratierte) Mechanismen können immer eine Rolle spielen.',
      combination: 'Die Mahlzeit ist aus Aufnahmesicht unauffällig.',
      source: '—',
      applicable: true,
      detail: '',
    })
  }
  return out
}
