import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../App'
import { useLang } from '../context/LanguageContext'
import { PENDING_NAV_TOUR_KEY, TOUR_DONE_PREFIX } from '../constants/firstTimeTour'

const STEP_KEYS = [
 { title: 'firstTourStep1Title', body: 'firstTourStep1Body' },
 { title: 'firstTourStep2Title', body: 'firstTourStep2Body' },
 { title: 'firstTourStep3Title', body: 'firstTourStep3Body' },
 { title: 'firstTourStep4Title', body: 'firstTourStep4Body' },
 { title: 'firstTourStep5Title', body: 'firstTourStep5Body' },
]

function markTourFinished(userId) {
 try {
 localStorage.removeItem(PENDING_NAV_TOUR_KEY)
 if (userId) localStorage.setItem(TOUR_DONE_PREFIX + userId, '1')
 } catch { /* ignore */ }
}

/**
 * One-time guided tour after first fleet signup (pending flag from onboarding).
 * Dismiss sets completion so it never auto-shows again for this user.
 */
export default function FirstTimeTour() {
 const { user } = useAuth()
 const { t } = useLang()
 const [open, setOpen] = useState(false)
 const [step, setStep] = useState(0)

 useEffect(() => {
 if (!user?.id) return
 let pending = false
 try {
 pending = localStorage.getItem(PENDING_NAV_TOUR_KEY) === user.id
 } catch { return }
 let alreadyDone = false
 try {
 alreadyDone = localStorage.getItem(TOUR_DONE_PREFIX + user.id) === '1'
 } catch { /* ignore */ }
 if (pending && !alreadyDone) {
 setStep(0)
 setOpen(true)
 }
 }, [user?.id])

 const close = useCallback(() => {
 if (user?.id) markTourFinished(user.id)
 setOpen(false)
 }, [user?.id])

 const next = useCallback(() => {
 if (step >= STEP_KEYS.length - 1) {
 close()
 return
 }
 setStep((s) => s + 1)
 }, [step, close])

 if (!open) return null

 const total = STEP_KEYS.length
 const { title, body } = STEP_KEYS[step]

 return createPortal(
 <div
 className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 sm:p-6"
 role="dialog"
 aria-modal="true"
 aria-labelledby="first-tour-title"
 aria-describedby="first-tour-body"
 >
 <button
 type="button"
 className="absolute inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-[2px]"
 aria-label={t('firstTourCloseBackdrop')}
 onClick={close}
 />
 <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-2xl p-5 sm:p-6">
 <div className="flex items-center justify-between gap-2 mb-3">
 <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
 {t('firstTourBadge')}
 </span>
 <span className="text-xs text-slate-400 tabular-nums">
 {step + 1}/{total}
 </span>
 </div>
 <h2 id="first-tour-title" className="text-lg font-bold text-slate-900 dark:text-white mb-2">
 {t(title)}
 </h2>
 <p id="first-tour-body" className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
 {t(body)}
 </p>
 <div className="flex flex-wrap items-center justify-between gap-2">
 <button
 type="button"
 className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1.5 -ml-2"
 onClick={close}
 >
 {t('firstTourSkip')}
 </button>
 <div className="flex gap-2 ml-auto">
 {step > 0 && (
 <button type="button" className="btn-secondary text-sm !py-2" onClick={() => setStep((s) => Math.max(0, s - 1))}>
 {t('firstTourBack')}
 </button>
 )}
 <button type="button" className="btn-primary text-sm !py-2" onClick={next}>
 {step >= total - 1 ? t('firstTourDone') : t('firstTourNext')}
 </button>
 </div>
 </div>
 </div>
 </div>,
 document.body
 )
}
