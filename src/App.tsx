/**
 * VITAL AGE — App-Shell + Routing
 * ---------------------------------------------------------------------
 * Seiten: Home, Recovery, Schlaf, Belastung, Vitalität, Ernährung
 * (Log/Foto-Scan/Detail), KI-Coach, Aktivität, Trends, Evidenz,
 * Perspektiven, Absorption, Einstellungen.
 */
import { useEffect, useRef } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { useApp } from './store/useApp'
import { handleAuthCallback } from './lib/health/googleHealth'
import { BottomNav } from './ui/BottomNav'
import Home from './pages/Home'
import Recovery from './pages/Recovery'
import Sleep from './pages/Sleep'
import Strain from './pages/Strain'
import Vitality from './pages/Vitality'
import FoodLog from './pages/food/FoodLog'
import FoodScan from './pages/food/FoodScan'
import MealDetail from './pages/food/MealDetail'
import Coach from './pages/Coach'
import Activity from './pages/Activity'
import Trends from './pages/Trends'
import Evidence from './pages/Evidence'
import Perspectives from './pages/Perspectives'
import Absorption from './pages/Absorption'
import Settings from './pages/Settings'
import { syncGoogleHealth } from './lib/health/googleHealth'

async function syncAfterConnect() {
  await syncGoogleHealth({ days: 28 })
}

export default function App() {
  const theme = useApp((s) => s.theme)

  // OAuth-Callback von Google Health am App-Start abarbeiten
  // (Redirect-URI liefert ?code=***&state=... vor dem #)
  const oauthDone = useRef(false)
  useEffect(() => {
    if (oauthDone.current) return
    oauthDone.current = true
    const s = new URL(window.location.href).search
    if (s.includes('code=') || s.includes('error=')) {
      handleAuthCallback(window.location.href).then((r) => {
        if (r.handled) {
          // Query-Params (Code!) aus der URL entfernen
          history.replaceState({}, '', window.location.pathname + window.location.hash)
          // Nach erfolgreichem OAuth direkt synchronisieren
          if (r.ok) void syncAfterConnect()
        }
      })
    }
  }, [])

  return (
    <HashRouter>
      <div className="app">
        <div className="app__inner" data-theme={theme}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/recovery" element={<Recovery />} />
            <Route path="/schlaf" element={<Sleep />} />
            <Route path="/belastung" element={<Strain />} />
            <Route path="/vitalitaet" element={<Vitality />} />
            <Route path="/food" element={<FoodLog />} />
            <Route path="/food/scan" element={<FoodScan />} />
            <Route path="/food/:id" element={<MealDetail />} />
            <Route path="/coach" element={<Coach />} />
            <Route path="/aktivitaet" element={<Activity />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/evidenz" element={<Evidence />} />
            <Route path="/perspektiven" element={<Perspectives />} />
            <Route path="/absorption" element={<Absorption />} />
            <Route path="/einstellungen" element={<Settings />} />
            <Route path="*" element={<Home />} />
          </Routes>
          <BottomNav />
        </div>
      </div>
    </HashRouter>
  )
}
