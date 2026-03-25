import { Outlet } from 'react-router-dom'
import { useAuth } from '../App'
import { useLang } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import {
  BarChartIcon,
  LogOutIcon,
  SunIcon,
  MoonIcon,
} from './Icons'
import { adminOps as adminOpsApi } from '../api'

export default function AdminLayout({ children } = {}) {
  const auth = useAuth()
  const user = auth?.user
  const clerkLogout = auth?.logout
  const { lang, toggleLang, t } = useLang()
  const { isDark, toggleTheme } = useTheme()

  const handleLogout = async () => {
    try {
      if (clerkLogout) {
        await clerkLogout()
        return
      }
      await adminOpsApi.logout()
      window.location.href = '/performance'
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] dark:bg-slate-900">
      <header className="sticky top-0 z-20 bg-white dark:bg-slate-800 h-14 flex items-center px-4 sm:px-6 gap-4 border-b border-slate-200/80 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#0d9488]/10 dark:bg-white/10 flex items-center justify-center text-teal-700 dark:text-teal-200">
            <BarChartIcon className="w-5 h-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-slate-800 dark:text-white">Performance</div>
            <div className="text-[11px] text-teal-700/70 dark:text-teal-200/70">
              {user?.email || user?.name || 'Platform admin'}
            </div>
          </div>
        </div>

        <div className="flex-1" />

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleLang}
          className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-all"
          title={lang === 'en' ? 'हिंदी में बदलो' : 'Switch to English'}
        >
          {lang === 'en' ? 'हिं' : 'EN'}
        </button>

        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
          title="Logout"
        >
          <LogOutIcon className="w-5 h-5" />
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {children ?? <Outlet />}
      </main>
    </div>
  )
}
