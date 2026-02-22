import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../App'
import { useLang } from '../context/LanguageContext'
import { alerts as alertsApi } from '../api'
import {
  DashboardIcon, TruckIcon, RouteIcon, UserIcon, ShieldIcon,
  BellIcon, SparkleIcon, HeartPulseIcon, MenuIcon,
  PlusIcon, LogOutIcon, SidebarCollapseIcon,
  RefreshIcon, SettingsIcon, FileTextIcon, FasTagIcon, BarChartIcon,
  FuelIcon, ServiceIcon,
} from './Icons'

const NAV_ITEMS = [
  { to: '/', icon: DashboardIcon, key: 'navHome', exact: true },
  { to: '/vehicles', icon: TruckIcon, key: 'navVehicles' },
  { to: '/drivers', icon: UserIcon, key: 'navDrivers' },
  { to: '/trips', icon: RouteIcon, key: 'navTrips' },
  { to: '/services', icon: ServiceIcon, key: 'navServices' },
  { to: '/fuel', icon: FuelIcon, key: 'navFuel' },
  { to: '/fastag', icon: FasTagIcon, key: 'navFasTag' },
  { to: '/fleet-health', icon: HeartPulseIcon, key: 'navFleetHealth', badge: true },
  { to: '/renewals', icon: RefreshIcon, key: 'navRenewals' },
  { to: '/insurance', icon: ShieldIcon, key: 'navInsurance' },
  { to: '/ai-chat', icon: SparkleIcon, key: 'navAIChat' },
  { to: '/documents', icon: FileTextIcon, key: 'navDocuments' },
  { to: '/settings', icon: SettingsIcon, key: 'navSettings' },
  { to: '/admin', icon: BarChartIcon, key: 'navAdmin' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const { lang, toggleLang, t } = useLang()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    alertsApi.list().then((res) => {
      const arr = res?.alerts || res || []
      setAlertCount(Array.isArray(arr) ? arr.filter(x => !x.resolved).length : 0)
    }).catch(() => {})
  }, [location.pathname])

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const isActive = (to, exact) =>
    exact ? location.pathname === to : location.pathname.startsWith(to)

  const initials = (user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* User profile section */}
      <div className={`px-4 pt-6 pb-4 shrink-0 ${collapsed ? 'px-2 pt-4 pb-3' : ''}`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{user?.name || 'User'}</div>
              <div className="text-[11px] text-teal-100/60 truncate">{user?.tenantName || 'Fleet Owner'}</div>
            </div>
          )}
        </div>
      </div>

      <div className={`mx-3 border-t border-white/10 ${collapsed ? 'mx-2' : ''}`} />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5">
        <div className="space-y-1">
          {NAV_ITEMS.map(({ to, icon: Icon, key, exact, badge }) => {
            const active = isActive(to, exact)
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all relative ${
                  active
                    ? 'bg-white text-teal-800 shadow-sm shadow-black/5'
                    : 'text-teal-50/80 hover:bg-white/10 hover:text-white'
                } ${collapsed ? 'justify-center px-2' : ''}`}
                title={collapsed ? t(key) : undefined}
              >
                <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-teal-600' : ''}`} />
                {!collapsed && <span>{t(key)}</span>}
                {badge && alertCount > 0 && (
                  <span className={`${collapsed ? 'absolute -top-0.5 -right-0.5' : 'ml-auto'} bg-red-500 text-white text-[10px] font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center`}>
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* Bottom actions */}
      <div className="px-2.5 py-3 space-y-1.5 shrink-0">
        <NavLink
          to="/quick-add"
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-teal-900 bg-white/90 hover:bg-white transition-all shadow-sm ${collapsed ? 'justify-center px-2' : ''}`}
        >
          <PlusIcon className="w-4 h-4" />
          {!collapsed && <span>{t('navQuickAdd')}</span>}
        </NavLink>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-teal-100/40 hover:text-teal-50 hover:bg-white/10 transition-all w-full ${collapsed ? 'justify-center' : ''}`}
        >
          <SidebarCollapseIcon className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 transition-all duration-200 fixed inset-y-0 left-0 z-30 ${
          collapsed ? 'w-[68px]' : 'w-60'
        }`}
        style={{ background: 'linear-gradient(180deg, #0d9488 0%, #0f766e 50%, #115e59 100%)' }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden" onClick={() => setMobileOpen(false)} />
          <aside
            className="fixed inset-y-0 left-0 w-64 shadow-2xl z-50 md:hidden"
            style={{ background: 'linear-gradient(180deg, #0d9488 0%, #0f766e 50%, #115e59 100%)' }}
          >
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Main Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${collapsed ? 'md:ml-[68px]' : 'md:ml-60'}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-white h-14 flex items-center px-4 sm:px-6 gap-4 border-b border-slate-200/80">
          <button onClick={() => setMobileOpen(true)} className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            <MenuIcon className="w-5 h-5" />
          </button>

          {/* Search bar */}
          <div className="hidden sm:flex items-center flex-1 max-w-md">
            <div className="relative w-full">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                readOnly
              />
            </div>
          </div>

          <div className="flex-1 sm:hidden" />

          {/* Right actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleLang}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-all"
              title={lang === 'en' ? 'हिंदी में बदलो' : 'Switch to English'}
            >
              {lang === 'en' ? 'हिं' : 'EN'}
            </button>

            <NavLink to="/fleet-health" className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
              <BellIcon className="w-5 h-5" />
              {alertCount > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {alertCount > 9 ? '!' : alertCount}
                </span>
              )}
            </NavLink>

            <button onClick={logout} className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Logout">
              <LogOutIcon className="w-4.5 h-4.5" />
            </button>
          </div>
        </header>

        <main className="flex-1 page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
