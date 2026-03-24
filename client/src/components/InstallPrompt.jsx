import { useState, useEffect } from 'react'

let deferredPrompt = null

export default function InstallPrompt() {
 const [show, setShow] = useState(false)
 const [isIOS, setIsIOS] = useState(false)

 useEffect(() => {
 // Don't show if already installed (standalone mode)
 if (window.matchMedia('(display-mode: standalone)').matches) return
 if (window.navigator.standalone === true) return

 // Don't show if user dismissed it before (respect for 7 days)
 const dismissed = localStorage.getItem('pwa-install-dismissed')
 if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return

 // Detect iOS
 const ua = navigator.userAgent
 const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
 setIsIOS(isiOS)

 if (isiOS) {
 // iOS doesn't fire beforeinstallprompt — show manual instructions
 setShow(true)
 return
 }

 const handler = (e) => {
 e.preventDefault()
 deferredPrompt = e
 setShow(true)
 }

 window.addEventListener('beforeinstallprompt', handler)
 return () => window.removeEventListener('beforeinstallprompt', handler)
 }, [])

 const handleInstall = async () => {
 if (!deferredPrompt) return
 deferredPrompt.prompt()
 const result = await deferredPrompt.userChoice
 if (result.outcome === 'accepted') {
 setShow(false)
 }
 deferredPrompt = null
 }

 const handleDismiss = () => {
 setShow(false)
 localStorage.setItem('pwa-install-dismissed', String(Date.now()))
 }

 if (!show) return null

 return (
 <div className="fixed bottom-0 inset-x-0 z-[100] p-3 sm:p-4 animate-slide-up">
 <div className="max-w-md mx-auto bg-white rounded-2xl shadow-2xl shadow-black/15 border border-slate-200 overflow-hidden">
 <div className="p-4 flex items-start gap-3">
 {/* App icon */}
 <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-lg shadow-blue-600/30">
 F
 </div>

 <div className="flex-1 min-w-0">
 <h3 className="text-sm font-bold text-slate-900">Install Fleetsure</h3>
 {isIOS ? (
 <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
 Tap <span className="inline-flex items-center"><ShareIcon className="w-3.5 h-3.5 mx-0.5 text-blue-600" /></span> then <strong>"Add to Home Screen"</strong>
 </p>
 ) : (
 <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
 Add to your home screen for quick access — works offline too!
 </p>
 )}
 </div>

 {/* Close */}
 <button onClick={handleDismiss} className="p-1 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors shrink-0 -mt-0.5 -mr-1">
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 {/* Action buttons */}
 <div className="px-4 pb-4 flex gap-2">
 {!isIOS && (
 <button
 onClick={handleInstall}
 className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
 >
 Install App
 </button>
 )}
 <button
 onClick={handleDismiss}
 className={`py-2.5 px-4 text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-sm font-medium rounded-xl transition-colors ${isIOS ? 'flex-1' : ''}`}
 >
 {isIOS ? 'Got it' : 'Not now'}
 </button>
 </div>
 </div>
 </div>
 )
}

function ShareIcon({ className }) {
 return (
 <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
 </svg>
 )
}
