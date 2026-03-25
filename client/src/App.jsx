import { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ClerkProvider, SignedIn, SignedOut, useUser, useAuth as useClerkAuth } from '@clerk/clerk-react'
import { auth as authApi, setClerkGetToken } from './api'
import { LanguageProvider } from './context/LanguageContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Vehicles from './pages/Vehicles'
import VehicleDetail from './pages/VehicleDetail'
import Trips from './pages/Trips'
import TripDetail from './pages/TripDetail'
import QuickAddTrip from './pages/QuickAddTrip'
import FleetHealth from './pages/FleetHealth'
import Renewals from './pages/Renewals'
import RenewalDetail from './pages/RenewalDetail'
import Drivers from './pages/Drivers'
import Settings from './pages/Settings'
import DocumentGenerator from './pages/DocumentGenerator'
import FASTag from './pages/FASTag'
import ServiceManager from './pages/ServiceManager'
import FuelManager from './pages/FuelManager'
import InstallPrompt from './components/InstallPrompt'
import { PENDING_NAV_TOUR_KEY } from './constants/firstTimeTour'

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

function AuthenticatedApp() {
 const { getToken, signOut } = useClerkAuth()
 const { user: clerkUser } = useUser()
 const [user, setUser] = useState(undefined)

 useEffect(() => {
 setClerkGetToken(() => getToken())
 }, [getToken])

 useEffect(() => {
 if (!clerkUser) return
 const sync = async () => {
 try {
 const u = await authApi.me()
 if (u.tenantId) {
 setUser(u)
 } else {
 setUser(null)
 }
 } catch {
 setUser(null)
 }
 }
 sync()
 }, [clerkUser])

 const logout = async () => {
 try { await authApi.logout() } catch { }
 await signOut()
 setUser(null)
 }

 const handleOnboardComplete = (u) => {
 try {
 if (u?.id) localStorage.setItem(PENDING_NAV_TOUR_KEY, u.id)
 } catch { /* ignore */ }
 setUser(u)
 }

 if (user === undefined) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-slate-50">
 <div className="animate-pulse text-slate-400 text-sm font-medium">Loading...</div>
 </div>
 )
 }

 if (user === null) {
 return <Onboarding onComplete={handleOnboardComplete} />
 }

 return (
 <AuthContext.Provider value={{ user, logout }}>
 <InstallPrompt />
 <Routes>
 <Route element={<Layout />}>
 <Route index element={<Dashboard />} />
 <Route path="trips" element={<Trips />} />
 <Route path="trips/:id" element={<TripDetail />} />
 <Route path="vehicles" element={<Vehicles />} />
 <Route path="vehicles/:id" element={<VehicleDetail />} />
 <Route path="drivers" element={<Drivers />} />
 <Route path="fleet-health" element={<FleetHealth />} />
 <Route path="renewals" element={<Renewals />} />
 <Route path="renewals/:id" element={<RenewalDetail />} />
 <Route path="quick-add" element={<QuickAddTrip />} />
 <Route path="insurance" element={<Navigate to="/renewals?tab=insights" replace />} />
 <Route path="settings" element={<Settings />} />
 <Route path="documents" element={<DocumentGenerator />} />
 <Route path="fastag" element={<FASTag />} />
 <Route path="services" element={<ServiceManager />} />
 <Route path="fuel" element={<FuelManager />} />
 <Route path="revenue" element={<Navigate to="/" replace />} />
 <Route path="admin" element={<Navigate to="/" replace />} />
 <Route path="alerts" element={<Navigate to="/fleet-health" replace />} />
 <Route path="maintenance" element={<Navigate to="/fleet-health" replace />} />
 <Route path="invoices" element={<Navigate to="/" replace />} />
 </Route>
 <Route path="*" element={<Navigate to="/" />} />
 </Routes>
 </AuthContext.Provider>
 )
}

function App() {
 if (!CLERK_KEY) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-slate-900">
 <div className="text-center text-white">
 <p className="text-lg font-semibold mb-2">Clerk not configured</p>
 <p className="text-sm text-slate-400">Set VITE_CLERK_PUBLISHABLE_KEY in your environment</p>
 </div>
 </div>
 )
 }

 return (
 <ClerkProvider publishableKey={CLERK_KEY}>
 <ThemeProvider>
 <LanguageProvider>
 <SignedOut>
 <Login />
 </SignedOut>
 <SignedIn>
 <AuthenticatedApp />
 </SignedIn>
 </LanguageProvider>
 </ThemeProvider>
 </ClerkProvider>
 )
}

export default App
