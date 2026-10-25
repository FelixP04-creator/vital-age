/**
 * VITAL AGE — zentrale API-Basis für Coach & Food-Scanner
 * =====================================================================
 * - PC-Browser (Dev/Preview, gleiche Herkunft): leerer Prefix —
 *   Vite leitet /api per Proxy an den lokalen Express-Server weiter.
 * - Native App (Capacitor-WebView, file://) oder Handy-Browser:
 *   explizite LAN-IP des PCs.
 * - Immer übersteuerbar in den Einstellungen (localStorage-Key
 *   `vitalage_api_base`) — z. B. falls die PC-IP wechselt.
 */
export const DEFAULT_API_BASE = 'http://192.168.56.1:8787'

export function apiBase(): string {
  try {
    const stored = localStorage.getItem('vitalage_api_base')
    if (stored && stored.trim()) return stored.trim().replace(/\/+$/, '')
  } catch {
    /* Storage nicht verfügbar — Standard nehmen */
  }
  const proto = window.location.protocol
  const host = window.location.hostname
  if (proto === 'file:' || proto === 'capacitor:' || host === '') return DEFAULT_API_BASE
  return ''
}
