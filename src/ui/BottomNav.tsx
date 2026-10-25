/**
 * VITAL AGE — Bottom-Navigation (5 Hauptbereiche)
 * Home / Recovery / Schlaf / Belastung / Vitalität
 * Weitere Bereiche (Food Log, KI-Coach, Aktivität, Trends, Datenquellen,
 * Einstellungen) sind über das Menü in Home/Settings erreichbar.
 */
import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Home', icon: '⌂', end: true },
  { to: '/recovery', label: 'Recovery', icon: '♡', end: false },
  { to: '/schlaf', label: 'Schlaf', icon: '☾', end: false },
  { to: '/belastung', label: 'Belastung', icon: '⚡', end: false },
  { to: '/vitalitaet', label: 'Vitalität', icon: '✦', end: false },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Hauptnavigation">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {n.icon === '⌂' && <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>}
            {n.icon === '♡' && <path d="M12 20s-7-4.6-9.3-9.1C1 7.5 3 4.5 6.2 4.5c2 0 3.4 1 4.3 2.4.4.6 1 .6 1.4 0 .9-1.4 2.3-2.4 4.3-2.4 3.2 0 5.2 3 3.5 6.4C19 15.4 12 20 12 20Z" />}
            {n.icon === '☾' && <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />}
            {n.icon === '⚡' && <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />}
            {n.icon === '✦' && <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2Z" />}
          </svg>
          <span>{n.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
