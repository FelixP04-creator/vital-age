/**
 * VITAL AGE — Recovery-Score (0–100)
 * =====================================================================
 * DOKUMENTIERTE FORMEL (s. docs/RECOVERY-MODEL.md):
 *
 * Recovery = 0.45*HRV_F + 0.30*RHR_F + 0.15*Sleep_F   (mit Schlaf)
 *          = 0.55*HRV_F + 0.45*RHR_F                   (ohne Schlaf)
 *
 *   HRV_F = 100 * clamp(0.5 + (hrv/base - 1) * 4, 0, 1)
 *   RHR_F = 100 * clamp(0.5 - (rhr-base) / 20, 0, 1)
 *   Sleep_F = 0.5*EffF + 0.5*KonsF
 *     EffF  = 100 * clamp((eff - 80) / 15, 0, 1)      [80–95 %]
 *     KonsF = 100 * clamp(1 - std(onset)/120, 0, 1)   [Schlafbeginn]
 *
 * Basis = persönliche Baseline (robuster Median, 28-Tage-Window).
 * Fehlt Baseline (zu wenig Daten) -> Score null ("Nicht genügend Daten").
 * Niedriger Score = weniger Erholung als üblich, KEINE Krankheitsaussage.
 */
import type {
  DailyRecord,
  Baseline,
  RecoveryResult,
  ScoreDriver,
  Confidence,
} from '../types'
import { round1, clamp } from '../stats'
import { MIN_DAYS } from './config'

function hrvFactor(hrv: number, base: number): number {
  return 100 * clamp(0.5 + (hrv / base - 1) * 4, 0, 1)
}
function rhrFactor(rhr: number, base: number): number {
  return 100 * clamp(0.5 - (rhr - base) / 20, 0, 1)
}

export interface RecoveryInput {
  record: DailyRecord
  baseline: Baseline
  /** 0–100, Konsistenz der Schlafzeiten (7-Tage-Fenster) */
  consistencyFactor: number | null
}

export function computeRecovery({ record, baseline, consistencyFactor }: RecoveryInput): RecoveryResult {
  const date = record.date
  const drivers: ScoreDriver[] = []
  const hrvOk = record.hrv.value !== null && baseline.hrvMs !== null
  const rhrOk = record.restingHr.value !== null && baseline.restingHrBpm !== null
  const available = (hrvOk ? 1 : 0) + (rhrOk ? 1 : 0) + (record.sleep ? 1 : 0)

  if (!hrvOk && !rhrOk) {
    return {
      date,
      score: null,
      confidence: 'low',
      drivers: [],
      explanation:
        'Nicht genügend Daten: Es fehlen aktuelle HRV- oder Ruhe-Herzfrequenz-Werte im Vergleich zu deiner persönlichen Baseline.',
      requiredInputs: 2,
      availableInputs: available,
    }
  }

  const s = record.sleep
  const eff = s?.efficiencyPct ?? null
  const hasSleep = eff !== null && consistencyFactor !== null

  let score: number
  if (hrvOk && rhrOk) {
    const h = hrvFactor(record.hrv.value!, baseline.hrvMs!)
    const r = rhrFactor(record.restingHr.value!, baseline.restingHrBpm!)
    drivers.push({
      name: 'HRV (Varianz)',
      detail: `${round1(record.hrv.value!)} ms vs. ${round1(baseline.hrvMs!)} ms Baseline (${record.hrv.value! >= baseline.hrvMs! ? '+' : ''}${round1((record.hrv.value! / baseline.hrvMs! - 1) * 100)} %)`,
      direction: record.hrv.value! >= baseline.hrvMs! ? 'good' : 'bad',
      weight: hasSleep ? 0.45 : 0.55,
    })
    drivers.push({
      name: 'Ruhe-Herzfrequenz',
      detail: `${record.restingHr.value!} bpm vs. ${round1(baseline.restingHrBpm!)} bpm Baseline`,
      direction: record.restingHr.value! <= baseline.restingHrBpm! ? 'good' : 'bad',
      weight: hasSleep ? 0.3 : 0.45,
    })
    if (hasSleep) {
      const sf = (100 * clamp((eff! - 80) / 15, 0, 1) + consistencyFactor!) / 2
      drivers.push({
        name: 'Schlaf (Effizienz & Rhythmus)',
        detail: `Effizienz ${round1(eff!)} %, beginns-Konsistenz ${round1(consistencyFactor!)} %`,
        direction: sf >= 60 ? 'good' : sf >= 35 ? 'neutral' : 'bad',
        weight: 0.15,
      })
      score = 0.45 * h + 0.3 * r + 0.15 * sf
    } else {
      score = 0.55 * h + 0.45 * r
    }
  } else if (hrvOk) {
    score = hrvFactor(record.hrv.value!, baseline.hrvMs!)
    drivers.push({
      name: 'HRV (Varianz)',
      detail: `${round1(record.hrv.value!)} ms vs. ${round1(baseline.hrvMs!)} ms Baseline`,
      direction: record.hrv.value! >= baseline.hrvMs! ? 'good' : 'bad',
      weight: 1,
    })
  } else {
    score = rhrFactor(record.restingHr.value!, baseline.restingHrBpm!)
    drivers.push({
      name: 'Ruhe-Herzfrequenz',
      detail: `${record.restingHr.value!} bpm vs. ${round1(baseline.restingHrBpm!)} bpm Baseline`,
      direction: record.restingHr.value! <= baseline.restingHrBpm! ? 'good' : 'bad',
      weight: 1,
    })
  }
  score = clamp(score, 0, 100)

  let confidence: Confidence = 'medium'
  if (baseline.sampleDays >= 14 && hrvOk && rhrOk) confidence = 'high'
  else if (baseline.sampleDays < MIN_DAYS) confidence = 'low'

  const status =
    score >= 67 ? 'Optimale Erholung' : score >= 33 ? 'Gemäßigte Erholung' : 'Erholungsdefizit'
  const advice =
    score >= 67
      ? 'Guter Tag für intensive Belastung — dein Körper ist erholungsbereit.'
      : score >= 33
        ? 'Moderater Tag. Plane Belastung nach Körpergefühl und halte Puffer.'
        : 'Weniger Erholung als üblich. Ruhige Belastung und frühere Schlafenszeit sind heute sinnvoll.'
  return {
    date,
    score: round1(score),
    confidence,
    drivers,
    explanation: `${status}. ${advice}`,
    requiredInputs: 2,
    availableInputs: available,
  }
}
