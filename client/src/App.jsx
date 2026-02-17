import { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { auth as authApi } from './api'
import { LanguageProvider } from './context/LanguageContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Vehicles from './pages/Vehicles'
import VehicleDetail from './pages/VehicleDetail'
import Trips from './pages/Trips'
import TripDetail from './pages/TripDetail'
import QuickAddTrip from './pages/QuickAddTrip'
import Reconcile from './pages/Reconcile'
import FleetHealth from './pages/FleetHealth'
import Renewals from './pages/Renewals'
import RenewalDetail from './pages/RenewalDetail'
import Drivers from './pages/Drivers'
import Revenue from './pages/Revenue'
import AIChat from './pages/AIChat'
import InsuranceOptimizer from './pages/InsuranceOptimizer'
import Settings from './pages/Settings'
import DocumentGenerator from './pages/DocumentGenerator'
import FASTag from './pages/FASTag'

// ── Auth context ────────────────────────────────────────────
const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

function App() {
  const [user, setUser] = useState(undefined) // undefined = loading, null = not logged in

  useEffect(() => {
    authApi
      .me()
      .then((u) => {
        // If user has a tenantId, they're fully onboarded
        if (u.tenantId) {
          setUser(u)
        } else {
          // Logged in but needs onboarding — treat as unauthenticated for routing
          setUser(null)
        }
      })
      .catch(() => setUser(null))
  }, [])

  const requestOtp = async (email) => {
    return await authApi.requestOtp(email)
  }

  const verifyOtp = async (email, otp) => {
    const res = await authApi.verifyOtp(email, otp)
    if (!res.needsOnboarding && res.user) {
      setUser(res.user)
    }
    return res
  }

  const onboard = async (fleetName, ownerName) => {
    const res = await authApi.onboard(fleetName, ownerName)
    if (res.user) {
      setUser(res.user)
    }
    return res
  }

  const logout = async () => {
    await authApi.logout()
    setUser(null)
  }

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400 text-sm font-medium">Loading...</div>
      </div>
    )
  }

  return (
    <LanguageProvider>
      <AuthContext.Provider value={{ user, requestOtp, verifyOtp, onboard, logout }}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          <Route element={user ? <Layout /> : <Navigate to="/login" />}>
            <Route index element={<Dashboard />} />
            <Route path="trips" element={<Trips />} />
            <Route path="trips/:id" element={<TripDetail />} />
            <Route path="vehicles" element={<Vehicles />} />
            <Route path="vehicles/:id" element={<VehicleDetail />} />
            <Route path="drivers" element={<Drivers />} />
            <Route path="fleet-health" element={<FleetHealth />} />
            <Route path="renewals" element={<Renewals />} />
            <Route path="renewals/:id" element={<RenewalDetail />} />
            <Route path="reconcile" element={<Reconcile />} />
            <Route path="quick-add" element={<QuickAddTrip />} />
            <Route path="revenue" element={<Revenue />} />
            <Route path="ai-chat" element={<AIChat />} />
            <Route path="insurance" element={<InsuranceOptimizer />} />
            <Route path="settings" element={<Settings />} />
            <Route path="documents" element={<DocumentGenerator />} />
            <Route path="fastag" element={<FASTag />} />
            <Route path="alerts" element={<Navigate to="/fleet-health" replace />} />
            <Route path="maintenance" element={<Navigate to="/fleet-health" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthContext.Provider>
    </LanguageProvider>
  )
}

export default App
