/**
 * VITAL AGE — UI-Bausteine (Designsystem "Obsidian Biometrics")
 * Wiederverwendbare Komponenten: Cards, Badges, Gauges, Charts,
 * Segmented Control, Sheet, Sync-Bar, Skeleton, EmptyState.
 */
import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

/* ------------------------------- Badges ------------------------------- */
const badgeTone = (tone: string) => `badge badge--${tone}`

export function SourceBadge({ source, title }: { source: 'measured' | 'computed' | 'estimated' | 'label' | 'database'; title?: string }) {
  const map = {
    measured: { label: 'Gemessen', tone: 'measured' },
    computed: { label: 'Berechnet', tone: 'computed' },
    estimated: { label: 'Geschätzt', tone: 'estimated' },
    label: { label: 'Etikett', tone: 'computed' },
    database: { label: 'Datenbank', tone: 'measured' },
  } as const
  const m = map[source]
  return (
    <span className={badgeTone(m.tone)} title={title ?? `Wert: ${m.label.toLowerCase()}`}>
      {m.label}
    </span>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: string; children: React.ReactNode }) {
  return <span className={badgeTone(tone)}>{children}</span>
}

/* ------------------------------- Card ------------------------------- */
export function Card({
  title,
  icon,
  action,
  children,
  className = '',
}: {
  title?: React.ReactNode
  icon?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`card ${className}`}>
      {title !== undefined && (
        <div className="card-title">
          <div className="row" style={{ gap: 8 }}>
            {icon}
            <h2>{title}</h2>
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

/* ------------------------------- Buttons ------------------------------ */
export function Button({
  variant = 'primary',
  size = 'md',
  block,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  block?: boolean
}) {
  return (
    <button
      className={`btn btn--${variant} ${size === 'sm' ? 'btn--sm' : ''} ${block ? 'btn--block' : ''} ${className}`}
      {...rest}
    />
  )
}

/* --------------------------- Segmented (Tage) --------------------------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------- Gauge (Ring) ------------------------------ */
export function ScoreRing({
  score,
  size = 132,
  color = 'var(--primary)',
  label,
  sub,
  trackColor = 'rgba(255,255,255,0.06)',
}: {
  score: number | null
  size?: number
  color?: string
  label?: string
  sub?: React.ReactNode
  trackColor?: string
}) {
  const r = 42
  const c = 2 * Math.PI * r
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score))
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke={trackColor} strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          style={{
            transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease',
            filter: `drop-shadow(0 0 8px ${color === 'var(--primary)' ? 'rgba(0,240,168,0.4)' : 'transparent'})`,
            opacity: score === null ? 0.25 : 1,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ position: 'absolute' }}>
        <span className="t-metric" style={{ fontSize: size * 0.26, color: score === null ? 'var(--text-dim)' : 'var(--text)' }}>
          {score === null ? '–' : Math.round(score)}
        </span>
        {label && (
          <span className="t-label" style={{ color: 'var(--text-variant)', marginTop: 2 }}>
            {label}
          </span>
        )}
        {sub}
      </div>
    </div>
  )
}

/* --------------------------- Linear Track --------------------------- */
export function LinearTrack({
  pct,
  color = 'var(--primary)',
  height = 6,
}: {
  pct: number
  color?: string
  height?: number
}) {
  return (
    <div className="track" style={{ height }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  )
}

/* --------------------------- Sparkline (SVG) --------------------------- */
export function Sparkline({
  values,
  width = 280,
  height = 64,
  color = 'var(--primary)',
  fill = true,
  baseline,
}: {
  values: (number | null)[]
  width?: number
  height?: number
  color?: string
  fill?: boolean
  baseline?: number
}) {
  const nums = values.filter((v): v is number => v !== null)
  if (nums.length < 2) return <EmptyMini text="Noch nicht genügend Daten" />
  const min = Math.min(...nums, baseline ?? Infinity)
  const max = Math.max(...nums, baseline ?? -Infinity)
  const range = max - min || 1
  const pad = 4
  const step = (width - pad * 2) / (values.length - 1)
  const pts = values.map((v, i) => {
    if (v === null) return null
    const x = pad + i * step
    const y = pad + (1 - (v - min) / range) * (height - pad * 2)
    return [x, y] as const
  })
  const path = pts
    .filter((p): p is readonly [number, number] => p !== null)
    .map((p, i) => `${i === 0 || pts[i - 1] === null ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(' ')
  const last = pts.filter(Boolean).at(-1)!
  const first = pts.filter(Boolean)[0]!
  const areaPath = `${path} L${last[0].toFixed(1)},${height - pad} L${first[0].toFixed(1)},${height - pad} Z`
  const baseY = baseline !== undefined ? pad + (1 - (baseline - min) / range) * (height - pad * 2) : null
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Trend-Verlauf">
      {fill && <path d={areaPath} fill={color} opacity="0.12" />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      {baseY !== null && (
        <line x1={pad} x2={width - pad} y1={baseY} y2={baseY} stroke="var(--text-dim)" strokeDasharray="3 4" strokeWidth="1" opacity="0.6" />
      )}
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  )
}

function EmptyMini({ text }: { text: string }) {
  return (
    <div className="muted" style={{ fontSize: 12, padding: '8px 0' }}>
      {text}
    </div>
  )
}

/* --------------------------- Schlafphasen-Track --------------------------- */
export function SleepStageBar({
  stages,
  totalMin,
}: {
  stages: { deepMin: number | null; remMin: number | null; lightMin: number | null; awakeMin: number | null }
  totalMin: number
}) {
  const segs = [
    { k: 'Deep', min: stages.deepMin, color: 'var(--secondary)' },
    { k: 'REM', min: stages.remMin, color: 'var(--primary)' },
    { k: 'Light', min: stages.lightMin, color: 'var(--text-dim)' },
    { k: 'Wach', min: stages.awakeMin, color: 'var(--error)' },
  ].filter((s) => s.min !== null)
  if (segs.length === 0 || totalMin <= 0) return <EmptyMini text="Schlafphasen von diesem Gerät nicht verfügbar" />
  return (
    <div>
      <div className="flex overflow-hidden rounded" style={{ height: 10, display: 'flex', background: 'var(--card-high)' }}>
        {segs.map((s) => (
          <div key={s.k} title={`${s.k}: ${Math.round(s.min!)} min`} style={{ width: `${(s.min! / totalMin) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className="tag-row" style={{ marginTop: 8 }}>
        {segs.map((s) => (
          <span key={s.k} className="mono" style={{ fontSize: 11, color: 'var(--text-variant)' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: s.color, marginRight: 4 }} />
            {s.k} {Math.round((s.min! / 60) * 10) / 10} h
          </span>
        ))}
      </div>
    </div>
  )
}

/* --------------------------- Sync-Status-Bar --------------------------- */
export function SyncBar({
  device,
  lastSyncAt,
  status,
  demoMode,
}: {
  device: string
  lastSyncAt: string | null
  status: 'connected' | 'disconnected' | 'expired' | 'error'
  demoMode: boolean
}) {
  const dot = status === 'connected' ? 'sync-dot' : status === 'error' ? 'sync-dot--error' : 'sync-dot--offline'
  const rel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'nie'
  return (
    <div className="sync-bar">
      <div className="row" style={{ gap: 8, minWidth: 0 }}>
        <span className={dot} />
        <span className="truncate" style={{ minWidth: 0 }}>
          {demoMode ? 'Demo-Daten' : device} · Sync: {rel}
        </span>
      </div>
      <span className="t-badge" style={{ color: demoMode ? 'var(--warning)' : status === 'connected' ? 'var(--primary)' : 'var(--warning)' }}>
        {demoMode ? 'DEMO' : status === 'connected' ? 'LIVE' : status === 'error' ? 'FEHLER' : 'OFFLINE'}
      </span>
    </div>
  )
}

/* --------------------------- Sheet (Modal) --------------------------- */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) {
      const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
      window.addEventListener('keydown', onKey)
      ref.current?.focus()
      return () => window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="row-between" style={{ marginBottom: 12 }}>
          <h2 className="t-headline" style={{ fontSize: 18 }}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* --------------------------- Skeleton & Empty --------------------------- */
export function Skeleton({ h = 16, w = '100%' }: { h?: number; w?: string | number }) {
  return <div className="skeleton" style={{ height: h, width: w }} />
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>◎</div>
      <div className="t-headline" style={{ fontSize: 16 }}>{title}</div>
      {hint && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{hint}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  )
}

/* --------------------------- Page-Header --------------------------- */
export function PageHeader({ title, back, action }: { title: string; back?: string; action?: React.ReactNode }) {
  return (
    <div className="topbar" style={{ padding: '12px 16px 0' }}>
      <div className="row" style={{ gap: 8 }}>
        {back && (
          <Link to={back} className="icon-btn" aria-label="Zurück">←</Link>
        )}
        <div>
          <h1>{title}</h1>
        </div>
      </div>
      {action}
    </div>
  )
}

/* --------------------------- Delta (Trend-Pfeil) --------------------------- */
export function Delta({ value, unit = '', invert = false }: { value: number | null; unit?: string; invert?: boolean }) {
  if (value === null || Number.isNaN(value) || Math.abs(value) < 0.05) {
    return <span className="mono dim" style={{ fontSize: 11 }}>±0{unit}</span>
  }
  const good = invert ? value < 0 : value > 0
  const color = good ? 'var(--primary)' : 'var(--warning)'
  return (
    <span className="mono" style={{ fontSize: 11, color }}>
      {value > 0 ? '▲' : '▼'} {Math.abs(value).toLocaleString('de-DE', { maximumFractionDigits: 1 })}
      {unit}
    </span>
  )
}
