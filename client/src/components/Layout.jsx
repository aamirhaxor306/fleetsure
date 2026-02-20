import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../App'
import { useLang } from '../context/LanguageContext'
import { alerts as alertsApi } from '../api'
import {
  DashboardIcon, TruckIcon, RouteIcon, UserIcon, ShieldIcon,
  BellIcon, SparkleIcon, HeartPulseIcon, MenuIcon,
  PlusIcon, LogOutIcon, ChevronLeftIcon, SearchIcon, SidebarCollapseIcon,
  RefreshIcon, SettingsIcon, FileTextIcon, FasTagIcon, BarChartIcon,
} from './Icons'

/* ── Navigation structure: simplified 4-group layout ──────── */
const NAV_GROUPS = [
  {
    label: 'HOME',
    items: [
      { to: '/', icon: DashboardIcon, key: 'navHome', exact: true },
    ],
  },
  {
    label: 'MY FLEET',
    items: [
      { to: '/vehicles', icon: TruckIcon, key: 'navVehicles' },
      { to: '/drivers', icon: UserIcon, key: 'navDrivers' },
      { to: '/trips', icon: RouteIcon, key: 'navTrips' },
      { to: '/fastag', icon: FasTagIcon, key: 'navFasTag' },
    ],
  },
  {
    label: 'SAFETY & RENEWALS',
    items: [
      { to: '/fleet-health', icon: HeartPulseIcon, key: 'navFleetHealth' },
      { to: '/renewals', icon: RefreshIcon, key: 'navRenewals' },
      { to: '/insurance', icon: ShieldIcon, key: 'navInsurance' },
    ],
  },
  {
    label: 'TOOLS',
    items: [
      { to: '/ai-chat', icon: SparkleIcon, key: 'navAIChat' },
      { to: '/documents', icon: FileTextIcon, key: 'navDocuments' },
      { to: '/settings', icon: SettingsIcon, key: 'navSettings' },
      { to: '/admin', icon: BarChartIcon, key: 'navAdmin' },
    ],
  },
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

  /* ── Breadcrumbs from path ───────────────────────────────── */
  const pathSegments = location.pathname.split('/').filter(Boolean)
  const breadcrumbs = pathSegments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
    to: '/' + pathSegments.slice(0, i + 1).join('/'),
  }))

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-4 h-14 border-b border-white/10 shrink-0 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-white font-bold text-sm shrink-0">
          F
        </div>
        {!collapsed && <span className="text-sm font-bold text-white tracking-tight">Fleetsure</span>}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-3">
            {!collapsed && (
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-blue-300/60">{group.label}</div>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, key, exact }) => {
                const active = isActive(to, exact)
                return (
                  <NavLink
                    key={to}
                    to={to}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all relative ${
                      active
                        ? 'bg-white/15 text-white'
                        : 'text-blue-100/70 hover:bg-white/10 hover:text-white'
                    } ${collapsed ? 'justify-center' : ''}`}
                    title={collapsed ? t(key) : undefined}
                  >
                    {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white rounded-r" />}
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    {!collapsed && <span>{t(key)}</span>}
                    {to === '/fleet-health' && alertCount > 0 && (
                      <span className={`${collapsed ? 'absolute -top-0.5 -right-0.5' : 'ml-auto'} bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center`}>
                        {alertCount > 9 ? '9+' : alertCount}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Quick Add + Collapse */}
      <div className="border-t border-white/10 px-2 py-2 space-y-1 shrink-0">
        <NavLink
          to="/quick-add"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold text-white bg-blue-500 hover:bg-blue-400 transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          <PlusIcon className="w-4 h-4" />
          {!collapsed && <span>{t('navQuickAdd')}</span>}
        </NavLink>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-blue-200/50 hover:text-blue-100 hover:bg-white/10 transition-all w-full ${collapsed ? 'justify-center' : ''}`}
        >
          <SidebarCollapseIcon className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* ── Desktop Sidebar ─────────────────────────────────── */}
      <aside
        className={`hidden md:flex flex-col bg-[#0f172a] shrink-0 transition-all duration-200 fixed inset-y-0 left-0 z-30 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ──────────────────────────── */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-[#0f172a] shadow-2xl z-50 md:hidden">
            <SidebarContent />
          </aside>
        </>
      )}

      {/* ── Main Area ───────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${collapsed ? 'md:ml-16' : 'md:ml-60'}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-[#0f172a] h-14 flex items-center px-4 sm:px-6 gap-4">
          {/* Mobile menu */}
          <button onClick={() => setMobileOpen(true)} className="md:hidden p-1.5 rounded-lg text-blue-200/60 hover:bg-white/10 hover:text-white">
            <MenuIcon className="w-5 h-5" />
          </button>

          {/* Breadcrumbs */}
          <nav className="hidden sm:flex items-center gap-1 text-xs text-blue-200/50 min-w-0">
            <NavLink to="/" className="hover:text-white transition-colors">Home</NavLink>
            {breadcrumbs.map((b) => (
              <span key={b.to} className="flex items-center gap-1">
                <span>/</span>
                <NavLink to={b.to} className="hover:text-white transition-colors truncate">{b.label}</NavLink>
              </span>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <NavLink to="/fleet-health" className="relative p-1.5 rounded-lg text-blue-200/60 hover:bg-white/10 hover:text-white transition-colors">
              <BellIcon className="w-5 h-5" />
              {alertCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </NavLink>

            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className="px-2 py-1 rounded-md text-xs font-bold text-blue-200/60 hover:text-white hover:bg-white/10 transition-all"
              title={lang === 'en' ? 'हिंदी में बदलो' : 'Switch to English'}
            >
              {lang === 'en' ? 'हिं' : 'EN'}
            </button>

            {/* User + logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <NavLink to="/settings" className="flex items-center gap-2 hover:bg-white/10 rounded-lg px-1.5 py-1 transition-colors">
                <div className="w-7 h-7 rounded-full bg-blue-500/30 flex items-center justify-center text-blue-200 text-xs font-bold">
                  {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="hidden lg:block text-right">
                  <div className="text-xs font-semibold text-white leading-tight">{user?.name || 'User'}</div>
                  {user?.tenantName && <div className="text-[10px] text-blue-200/50 leading-tight">{user.tenantName}</div>}
                </div>
              </NavLink>
              <button onClick={logout} className="p-1.5 rounded-lg text-blue-200/50 hover:bg-white/10 hover:text-white transition-colors" title="Logout">
                <LogOutIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
