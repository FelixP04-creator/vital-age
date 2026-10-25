/**
 * VITAL AGE — Regelbasierte Coach-Engine (Fallback ohne LLM)
 * =====================================================================
 * Erzeugt verständliche, datenbasierte Antworten NUR aus tatsächlich
 * vorhandenen Daten (keine erfundenen Messwerte, keine Diagnosen).
 * Jede Antwort trägt den Kennzeichnung "regelbasiert" — sie ist KEINE
 * echte KI-Analyse.
 *
 * Die Engine:
 *  - vergleicht die letzten Tage mit dem persönlichen Durchschnitt
 *  - erkennt Datenlücken und benennt sie offen
 *  - beantwortet Standard-Fragen (Recovery, Schlaf, Strain, Trends)
 *  - schlägt vorsichtige, begründete nächste Schritte vor
 *  - verweigert medizinische Fragen klar
 */
import type { DailyRecord, Activity, Meal, DailyCheckIn, Baseline } from '../types'
import { mean, linearTrend, fmt, fmtMin, clamp } from '../stats'
import { computeBaseline } from '../scoring/baseline'
import { summarizeSleep } from '../scoring/sleep'

export interface CoachContext {
  records: DailyRecord[]
  activities: Activity[]
  meals: Meal[]
  checkIns: DailyCheckIn[]
  baseline: Baseline
  question: string
}

export interface CoachAnswer {
  text: string
  engine: 'rule-based'
  dataUsed: string[]
  gaps: string[]
}

const MEDICAL_RE =
  /(krank|diagnos|medikament|medizinisch|arzt|schilddrüse|diabetes|herzinfarkt|krebs|blutdruck senken|pillen|supplement empfehlen|dosis|therapie|antibiotikum)/i

export function ruleBasedCoach(ctx: CoachContext): CoachAnswer {
  const { records, baseline, question } = ctx
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  const gaps: string[] = []
  const dataUsed: string[] = []

  // Medizinische Frage -> klare Verweigerung (keine Sicherheit vortäuschen)
  if (MEDICAL_RE.test(question)) {
    return {
      engine: 'rule-based',
      dataUsed: [],
      gaps: [],
      text:
        'Ich bin ein regelbasierter Wellness-Assistent und kein medizinisches Gerät: Ich kann keine Krankheiten diagnostizieren, keine Medikamente empfehlen und keinen Arzt ersetzen. ' +
        'Bei gesundheitlichen Beschwerden bitte die ärztliche Hauspraxis oder den 116117-Notruf aufsuchen. ' +
        'Ich kann dir aber gern deine TRAININGS-, SCHLAF- UND ERHOLUNGSDATEN erklären — etwa „Wie ist meine Recovery die letzten Tage?“ oder „Wie stabil sind meine Schlafzeiten?“',
    }
  }

  if (sorted.length < 3) {
    return {
      engine: 'rule-based',
      dataUsed: [],
      gaps: ['Zu wenige Tage mit Messdaten für jede Auswertung'],
      text:
        'Bisher liegen mir nur ' + sorted.length + ' Tage an Messdaten vor — für zuverlässige Aussagen brauche ich mindestens 7 Tage. ' +
        'Währenddessen: Achte auf regelmäßige Schlaf- und Aufwachzeiten und bewege dich täglich 20–30 Minuten. ' +
        'Sobald mehr Daten da sind, kann ich deine Trends vergleichen.',
    }
  }

  const last7 = sorted.slice(-7)
  const today = sorted[sorted.length - 1]
  const q = question.toLowerCase()

  // ---------- TREND / ALLGEMEIN ----------
  if (/trend|verlauf|woche|entwicklung|wie geht|gesamt|überblick/.test(q)) {
    const hrvVals = last7.map((r) => r.hrv.value).filter((v): v is number => v !== null)
    const rhrVals = last7.map((r) => r.restingHr.value).filter((v): v is number => v !== null)
    const sleepVals = last7.filter((r) => r.sleep).map((r) => r.sleep!.durationMin)
    if (hrvVals.length < 3) gaps.push('HRV: unter 3 gültigen Werten in den letzten 7 Tagen')
    if (rhrVals.length < 3) gaps.push('Ruhe-Herzfrequenz: unter 3 gültigen Werten')
    if (sleepVals.length < 3) gaps.push('Schlaf: unter 3 Nächte mit Daten')

    const parts: string[] = []
    if (hrvVals.length >= 3) {
      dataUsed.push('HRV (7 Tage)')
      const t = linearTrend(hrvVals)
      const avg = mean(hrvVals)!
      parts.push(
        `Deine nächtliche HRV lag diese Woche im Schnitt bei ${fmt(avg, 0)} ms (Baseline ${baseline.hrvMs ? fmt(baseline.hrvMs, 0) : '–'} ms). ` +
          (t !== null && Math.abs(t) > 0.5
            ? t > 0
              ? `Sie steigt leicht an (+${fmt(t, 1)} ms/Tag) — das deutet auf bessere Erholung hin.`
              : `Sie sinkt leicht ab (${fmt(t, 1)} ms/Tag) — möglicherweise mehr Belastung oder Stress in der Woche.`
            : 'Sie ist diese Woche weitgehend stabil.'),
      )
    }
    if (rhrVals.length >= 3) {
      dataUsed.push('Ruhe-Herzfrequenz (7 Tage)')
      const avg = mean(rhrVals)!
      const base = baseline.restingHrBpm
      if (base) {
        const diff = avg - base
        parts.push(
          `Deine Ruheherzfrequenz liegt im 7-Tage-Schnitt bei ${fmt(avg, 0)} bpm, also ${diff >= 0 ? 'etwas über' : 'unter'} deiner Baseline (${fmt(base, 0)} bpm). ` +
            (Math.abs(diff) <= 3 ? 'Das ist eine normale, persönliche Variation.' : diff > 3 ? 'Werte dauerhaft über der Baseline können auf erhöhte Belastung, unzureichende Erholung oder auch Krankheit hindeuten — ich beobachte das weiter, eine Diagnose kann ich nicht stellen.' : 'Das ist ein günstiges Zeichen für gute Erholung.'),
        )
      }
    }
    if (sleepVals.length >= 3) {
      dataUsed.push('Schlaf (7 Tage)')
      const s = summarizeSleep(records, today.date)
      parts.push(
        `Du hast diese Woche im Schnitt ${fmtMin(mean(sleepVals))} geschlafen. ` +
          (s.consistencyScore !== null
            ? `Die Regelmäßigkeit deiner Schlafzeiten liegt bei ${fmt(s.consistencyScore, 0)} % (100 % = perfekt stabil). `
            : '') + s.routineNote,
      )
    }
    // Aktivität
    const acts = ctx.activities.filter((a) => last7.some((r) => r.date === a.date))
    if (acts.length > 0) {
      dataUsed.push('Aktivitäten (7 Tage)')
      const totalMin = acts.reduce((a, x) => a + x.durationMin, 0)
      const imported = acts.filter((a) => a.source === 'imported').length
      parts.push(
        `In der letzten Woche: ${acts.length} Trainings (${fmtMin(totalMin)} gesamt, davon ${imported} vom Wearable importiert, ${acts.length - imported} manuell erfasst).`,
      )
    }
    // Check-in
    const ci = ctx.checkIns.filter((c) => last7.some((r) => r.date === c.date))
    const stressVals = ci.map((c) => c.stress).filter((v): v is number => v !== null)
    if (stressVals.length >= 3) {
      dataUsed.push('Stress-Check-ins (7 Tage)')
      const sAvg = mean(stressVals)!
      parts.push(`Deine subjektive Stress-Selbsteinschätzung liegt im Schnitt bei ${fmt(sAvg, 1)}/10 (persönlicher Eindruck, kein gemessener Wert).`)
    }
    // Ernährung
    const meals = ctx.meals.filter((m) => last7.some((r) => r.date === r.date && last7.some((x) => x.date === m.date)))
    if (meals.length > 0) {
      dataUsed.push('Ernährungstagebuch (7 Tage)')
      const fiber = mean(meals.map((m) => m.macros.fiberG))
      parts.push(
        `Im Ernährungstagebuch stehen ${meals.length} Mahlzeiten. ` +
          (fiber !== null && fiber < 12 ? 'Die Ballaststoffzufuhr ist bislang eher niedrig — mehr Gemüse, Obst, Vollkorn oder Hülsenfrüchte wären ein einfacher Hebel.' : 'Die Ballaststoffzufuhr sieht bislang ordentlich aus.'),
      )
    }
    if (parts.length === 0) {
      return {
        engine: 'rule-based',
        dataUsed,
        gaps,
        text:
          'Für eine wöchentliche Zusammenfassung fehlen noch genügend Messwerte. Für eine zuverlässigere Trendanalyse fehlen noch einige Nächte mit HRV- und Schlafdaten.',
      }
    }
    return {
      engine: 'rule-based',
      dataUsed,
      gaps,
      text:
        'Wochenüberblick (regelbasierte Auswertung deiner eigenen Daten):\n\n' +
        parts.join('\n\n') +
          (gaps.length > 0 ? '\n\nDatenlücken: ' + gaps.join('; ') : '') +
          '\n\nHinweis: Das ist eine regelbasierte Zusammenfassung, keine medizinische Beurteilung.',
    }
  }

  // ---------- SCHLAF ----------
  if (/schlaf|bett|aufwachen|schlafzeit|ins bett/.test(q)) {
    const s = summarizeSleep(records, today.date)
    dataUsed.push('Schlafdaten + persönlicher 14-Tage-Schnitt')
    const lines: string[] = []
    lines.push(`Letzte Nacht: ${fmtMin(s.durationMin)} Schlaf, Effizienz ${s.efficiencyPct !== null ? fmt(s.efficiencyPct, 0) + ' %' : 'unbekannt'}.`)
    if (s.avgOnsetMin !== null && s.avgOffsetMin !== null) {
      const onset = s.avgOnsetMin!
      const offset = s.avgOffsetMin!
      const on = clock(onset), off = clock(offset)
      lines.push(`Dein persönlicher Rhythmus: ins Bett um ca. ${on}, Aufwachen um ca. ${off}.`)
    }
    lines.push(s.routineNote)
    if (s.deficitMin !== null) {
      const deficitValue = s.deficitMin
      if (deficitValue > 45) {
        lines.push(`Diese Nacht lagst du um ${fmtMin(deficitValue)} unter deinem eigenen Schnitt. Einmalig völlig normal — über mehrere Tage in Folge würde ich einen früheren Schlafbeginn prüfen.`)
      }
    }
    lines.push('Allgemeine Empfehlung für Erwachsene (AASM): 7–9 Stunden. Wie viel DIR guttut, siehst du am besten an deiner eigenen Tagesform und deinen HRV-/RHR-Werten.')
    return { engine: 'rule-based', dataUsed, gaps, text: 'Schlaf (regelbasiert):\n\n' + lines.join('\n\n') }
  }

  // ---------- RECOVERY ----------
  if (/recovery|erholung|regeneration|belastbar|fit für/.test(q)) {
    dataUsed.push('HRV & Ruhe-HF vs. Baseline, Schlaf')
    const rec = today
    const hrvOk = rec.hrv.value !== null && baseline.hrvMs !== null
    const rhrOk = rec.restingHr.value !== null && baseline.restingHrBpm !== null
    if (!hrvOk && !rhrOk) {
      return {
        engine: 'rule-based',
        dataUsed,
        gaps: ['Keine aktuellen HRV/RHR-Daten'],
        text: 'Nicht genügend Daten für eine Recovery-Einschätzung heute. Es fehlen die nächtlichen HRV- oder Ruhe-Herzfrequenz-Werte.',
      }
    }
    const parts: string[] = []
    if (hrvOk) {
      const d = rec.hrv.value! / baseline.hrvMs! - 1
      parts.push(`HRV heute: ${fmt(rec.hrv.value!, 0)} ms (${d >= 0 ? '+' : ''}${fmt(d * 100, 0)} % zur Baseline) — ${d >= 0 ? 'dein vegetatives Nervensystem hat sich gut erholt.' : 'unter deiner Baseline, dein System hat mehr Erholungsbedarf.'}`)
    }
    if (rhrOk) {
      const d = rec.restingHr.value! - baseline.restingHrBpm!
      parts.push(`Ruheherzfrequenz: ${rec.restingHr.value!} bpm (${d >= 0 ? '+' : ''}${fmt(d, 0)} bpm zur Baseline).`)
    }
    const sl = rec.sleep
    if (sl) parts.push(`Schlaf: ${fmtMin(sl!.durationMin)}, Effizienz ${sl!.efficiencyPct !== null ? fmt(sl!.efficiencyPct, 0) + ' %' : 'unbekannt'}.`)
    const better = (hrvOk && rec.hrv.value! >= baseline.hrvMs!) || (rhrOk && rec.restingHr.value! <= baseline.restingHrBpm!)
    parts.push(
      better
        ? 'Grobe Einordnung: gut erholt. Wenn dein Körpergefühl mitspielt, ist heute ein intensiverer Trainingstag möglich — der Score entscheidet aber nicht, ob du DARF.'
        : 'Grobe Einordnung: erhöhte Erholungsbedarfs-Signale. Ein ruhigerer Tag, frühere Schlafenszeit und entspanntes Training wären heute sinnvoll. Ein niedriger Wert bedeutet NICHT automatisch Krankheit.',
    )
    return { engine: 'rule-based', dataUsed, gaps, text: 'Recovery heute (regelbasiert):\n\n' + parts.join('\n\n') }
  }

  // ---------- BELASTUNG / TRAINING ----------
  if (/strain|belastung|training|workout|kraft|lauf|trainieren/.test(q)) {
    dataUsed.push('Aktivitäten + aktive Minuten (7 Tage)')
    const acts = ctx.activities.filter((a) => last7.some((r) => r.date === a.date))
    if (acts.length === 0) {
      return {
        engine: 'rule-based',
        dataUsed,
        gaps: ['Keine Aktivitäten in den letzten 7 Tagen'],
        text:
          'In den letzten 7 Tagen stehen keine Trainings im Journal. Wenn du trainieren möchtest: 2–3 Einheiten pro Woche (1× Kraft + 1–2× Ausdauer) sind ein solider, evidenzbasierter Rhythmus für allgemeine Fitness. Beginne moderat und steigere jede Woche nicht mehr als ~10 % Volumen.',
      }
    }
    const totalMin = acts.reduce((a, x) => a + x.durationMin, 0)
    const rpes = acts.map((a) => a.rpe).filter((v): v is number => v !== null)
    const avgRpe = rpes.length ? mean(rpes)! : null
    const lines = [
      `Diese Woche: ${acts.length} Einheiten, ${fmtMin(totalMin)} gesamt.`,
      avgRpe !== null ? `Durchschnittliche Anstrengung (RPE): ${fmt(avgRpe, 1)}/10.` : '',
      ...acts.slice(-3).map((a) => `• ${a.date}: ${a.name} (${a.durationMin} min, ${a.source === 'imported' ? 'importiert' : 'manuell'})${a.notes ? ` — ${a.notes}` : ''}`),
    ].filter(Boolean)
    const rpeVal = avgRpe
    const overreached = rpeVal !== null && rpeVal! >= 8
    lines.push(
      overreached
        ? 'Die Anstrengung war diese Woche hoch. Plane bewusst einen ruhigen Tag ein — Regeneration ist Teil des Trainings, nicht dessen Gegenteil.'
        : 'Das Volumen sieht moderat aus. Steigerung sollte an Trainingstagen schrittweise geschehen (Progressive Overload), nicht an jedem Tag.',
    )
    return { engine: 'rule-based', dataUsed, gaps, text: 'Training (regelbasiert):\n\n' + lines.join('\n\n') }
  }

  // ---------- ERNÄHRUNG ----------
  if (/ernährung|essen|mahlzeit|protein|kalorien|wasser|nährstoff|fiber|ballaststoff/.test(q)) {
    dataUsed.push('Ernährungstagebuch (7 Tage)')
    const meals = ctx.meals.filter((m) => last7.some((x) => x.date === m.date))
    if (meals.length === 0) {
      return {
        engine: 'rule-based',
        dataUsed,
        gaps: ['Keine Mahlzeiten im Journal (7 Tage)'],
        text:
          'Dein Ernährungstagebuch ist für die letzten 7 Tage leer — das heißt NICHT, dass du nichts gegessen hast, nur dass nichts erfasst wurde. ' +
          'Sobald du Mahlzeiten einträgst (manuell, per Foto oder per Chat-Eingabe), kann ich Protein, Ballaststoffe, Fettquellen und Mikronährstoffe zusammenfassen.',
      }
    }
    const proto = mean(meals.map((m) => m.macros.proteinG))!
    const fib = mean(meals.map((m) => m.macros.fiberG))!
    const kcal = mean(meals.map((m) => m.macros.caloriesKcal))!
    const lines = [
      `${meals.length} Mahlzeiten in der letzten Woche erfasst.`,
      `Durchschnittlich: ${fmt(proto, 0)} g Protein, ${fmt(fib, 0)} g Ballaststoffe, ${fmt(kcal, 0)} kcal pro Mahlzeit.`,
    ]
    if (fib < 12) lines.push('Ballaststoffe: eher niedrig. Einfache Hebel: Obst + Gemüse bei 2 Mahlzeiten, Vollkorn statt Weißmehl, gelegentlich Hülsenfrüchte.')
    const unconfirmed = meals.filter((m) => m.method === 'photo' && !m.confirmed).length
    if (unconfirmed > 0) lines.push(`Achtung: ${unconfirmed} Foto-Ernährungseinträge sind noch unbestätigte KI-Schätzungen — bitte prüfen, bevor du Trends ziehst.`)
    lines.push('Ich bewerte keine Lebensmittel moralisch und zähle nicht auf Kalorien-Defizite hin — Ziel ist eine für dich passende, abwechslungsreiche Versorgung.')
    return { engine: 'rule-based', dataUsed, gaps, text: 'Ernährung (regelbasiert):\n\n' + lines.join('\n\n') }
  }

  // ---------- WASSER ----------
  if (/wasser|trinken|hydrat/.test(q)) {
    dataUsed.push('Wasser-Check-ins (7 Tage)')
    const ci = ctx.checkIns.filter((c) => last7.some((r) => r.date === c.date) && c.waterMl > 0)
    if (ci.length < 3) {
      return { engine: 'rule-based', dataUsed, gaps: ['Zu wenige Wasser-Einträge'], text: 'Zu wenige Wasser-Einträge für eine Aussage. Als Faustregel: ~30–35 ml pro kg Körpergewicht pro Tag, mehr bei Training und Hitze.' }
    }
    const avg = mean(ci.map((c) => c.waterMl))!
    return { engine: 'rule-based', dataUsed, gaps, text: `Du trinkst im 7-Tage-Schnitt ${fmt(avg, 0)} ml pro Tag. Faustregel: ~30–35 ml/kg KG/Tag; bei Training und warmer Umgebung mehr. Hör auf Durst und Urinfarbe (hellgelb = gut).` }
  }

  // ---------- STRESS ----------
  if (/stress|stimmung|energie|wohlbefinden|relax|atem/.test(q)) {
    dataUsed.push('Selbsteinschätzungen (7 Tage)')
    const ci = ctx.checkIns.filter((c) => last7.some((r) => r.date === c.date))
    const stress = ci.map((c) => c.stress).filter((v): v is number => v !== null)
    const energy = ci.map((c) => c.energy).filter((v): v is number => v !== null)
    if (stress.length < 3) {
      return { engine: 'rule-based', dataUsed, gaps: ['Zu wenige Check-ins'], text: 'Zu wenige tägliche Check-ins für eine Stress-Aussage. Mach 1–2 Minuten am Abend: Stress, Energie, Stimmung von 1–10 notieren — dann sehe ich Muster zwischen Selbsteinschätzung, Schlaf und Aktivität.' }
    }
    const sAvg = mean(stress)!, eAvg = energy.length ? mean(energy)! : null
    const lines = [`Stress im Schnitt: ${fmt(sAvg, 1)}/10.`, eAvg !== null ? `Energie im Schnitt: ${fmt(eAvg, 1)}/10.` : '']
    if (sAvg >= 7) lines.push('Dein subjektiver Stress ist hoch. Bewährte, niederschwellige Hebel: 10 min Spaziergang, Boxenatmung (4 s ein — 6 s aus, 5 Runden), feste Abschaltzeit abends. Das sind Wellness-Strategien, keine Therapie.')
    lines.push('Hinweis: Wearable-Stress-Schätzungen (z. B. über HRV) sind indirekte Größen und ersetzen nicht deine eigene Einschätzung.')
    return { engine: 'rule-based', dataUsed, gaps, text: 'Stress & Wohlbefinden (regelbasiert):\n\n' + lines.filter(Boolean).join('\n\n') }
  }

  // ---------- FALLBACK ----------
  return {
    engine: 'rule-based',
    dataUsed: [],
    gaps,
    text:
      'Ich habe deine Frage mit meiner regelbasierten Auswertung beantwortet, was ich kann: Trends (Recovery, Schlaf, Training, Ernährung), Datenlücken und vorsichtige nächste Schritte. ' +
      'Für medizinische Fragen: bitte Arztpraxis. Versuche z. B.: „Wie ist meine Recovery heute?“ · „Wie stabil sind meine Schlafzeiten?“ · „Wie war mein Training diese Woche?“ · „Wie sieht meine Ernährung aus?“',
  }
}

function clock(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const mm = Math.round(m % 60)
  return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
}