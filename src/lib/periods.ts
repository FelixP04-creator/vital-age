/** Zeiträume für Trends: Heute / 7T / 30T / 90T / 1J */
export type PeriodKey = 'today' | '7d' | '30d' | '90d' | '1y'

export const PERIODS: { key: PeriodKey; label: string; days: number }[] = [
  { key: 'today', label: 'Heute', days: 1 },
  { key: '7d', label: '7T', days: 7 },
  { key: '30d', label: '30T', days: 30 },
  { key: '90d', label: '90T', days: 90 },
  { key: '1y', label: '1J', days: 365 },
]

export function periodDays(p: PeriodKey): number {
  return PERIODS.find((x) => x.key === p)?.days ?? 7
}
