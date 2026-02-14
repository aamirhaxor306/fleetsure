import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../App'
import { useLang } from '../context/LanguageContext'
import { alerts as alertsApi } from '../api'
import {
  DashboardIcon, TruckIcon, RouteIcon, UserIcon, ShieldIcon,
  BellIcon, SparkleIcon, ClipboardIcon, HeartPulseIcon, MenuIcon,
  PlusIcon, LogOutIcon, ChevronLeftIcon, SearchIcon, SidebarCollapseIcon,
  RefreshIcon,
} from './Icons'

/* ── Navigation structure: outcome-grouped ────────────────── */
const NAV_GROUPS = [
  {
    label: 'COMMAND CENTER',
    items: [
      { to: '/', icon: DashboardIcon, key: 'navHome', exact: true },
    ],
  },
  {
    label: 'PROFITABILITY',
    items: [
      { to: '/trips', icon: RouteIcon, key: 'navTrips' },
      { to: '/reconcile', icon: ClipboardIcon, key: 'navReconcile' },
    ],
  },
  {
    label: 'FLEET HEALTH',
    items: [
      { to: '/fleet-health', icon: HeartPulseIcon, key: 'navFleetHealth' },
      { to: '/renewals', icon: RefreshIcon, key: 'navRenewals' },
      { to: '/insurance', icon: ShieldIcon, key: 'navInsurance' },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { to: '/vehicles', icon: TruckIcon, key: 'navVehicles' },
      { to: '/drivers', icon: UserIcon, key: 'navDrivers' },
    ],
  },
  {
    label: 'AI ASSISTANT',
    items: [
      { to: '/ai-chat', icon: SparkleIcon, key: 'navAIChat' },
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
      <div className={`flex items-center gap-2.5 px-4 h-14 border-b border-slate-200 shrink-0 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          F
        </div>
        {!collapsed && <span className="text-sm font-bold text-slate-900 tracking-tight">Fleetsure</span>}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-3">
            {!collapsed && (
              <div className="section-title px-3 py-1.5">{group.label}</div>
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
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    } ${collapsed ? 'justify-center' : ''}`}
                    title={collapsed ? t(key) : undefined}
                  >
                    {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-600 rounded-r" />}
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    {!collapsed && <span>{t(key)}</span>}
                    {/* Alert badge for Fleet Health */}
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
      <div className="border-t border-slate-200 px-2 py-2 space-y-1 shrink-0">
        <NavLink
          to="/quick-add"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          <PlusIcon className="w-4 h-4" />
          {!collapsed && <span>{t('navQuickAdd')}</span>}
        </NavLink>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all w-full ${collapsed ? 'justify-center' : ''}`}
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
        className={`hidden md:flex flex-col bg-white border-r border-slate-200 shrink-0 transition-all duration-200 fixed inset-y-0 left-0 z-30 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ──────────────────────────── */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-60 bg-white shadow-xl z-50 md:hidden">
            <SidebarContent />
          </aside>
        </>
      )}

      {/* ── Main Area ───────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${collapsed ? 'md:ml-16' : 'md:ml-60'}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 h-14 flex items-center px-4 sm:px-6 gap-4">
          {/* Mobile menu */}
          <button onClick={() => setMobileOpen(true)} className="md:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <MenuIcon className="w-5 h-5" />
          </button>

          {/* Breadcrumbs */}
          <nav className="hidden sm:flex items-center gap-1 text-xs text-slate-400 min-w-0">
            <NavLink to="/" className="hover:text-slate-600">Home</NavLink>
            {breadcrumbs.map((b) => (
              <span key={b.to} className="flex items-center gap-1">
                <span>/</span>
                <NavLink to={b.to} className="hover:text-slate-600 truncate">{b.label}</NavLink>
              </span>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <NavLink to="/fleet-health" className="relative p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
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
              className="px-2 py-1 rounded-md text-xs font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              title={lang === 'en' ? 'हिंदी में बदलो' : 'Switch to English'}
            >
              {lang === 'en' ? 'हिं' : 'EN'}
            </button>

            {/* User + logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                {user?.email?.[0]?.toUpperCase() || 'A'}
              </div>
              <button onClick={logout} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Logout">
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
