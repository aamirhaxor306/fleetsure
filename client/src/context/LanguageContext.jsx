import { createContext, useContext, useState, useCallback } from 'react'
import translations from '../i18n'

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
 const [lang, setLang] = useState(() => {
 try {
 return localStorage.getItem('fleetsure_lang') || 'en'
 } catch {
 return 'en'
 }
 })

 const toggleLang = useCallback(() => {
 setLang((prev) => {
 const next = prev === 'en' ? 'hi' : 'en'
 try { localStorage.setItem('fleetsure_lang', next) } catch {}
 return next
 })
 }, [])

 const setLanguage = useCallback((l) => {
 setLang(l)
 try { localStorage.setItem('fleetsure_lang', l) } catch {}
 }, [])

 /**
 * t('key') — get translated string
 * t('key', { count: 5, total: 10 }) — with interpolation
 */
 const t = useCallback(
 (key, params) => {
 const dict = translations[lang] || translations.en
 let str = dict[key] || translations.en[key] || key

 if (params) {
 Object.entries(params).forEach(([k, v]) => {
 str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
 })
 }

 return str
 },
 [lang]
 )

 return (
 <LanguageContext.Provider value={{ lang, toggleLang, setLanguage, t }}>
 {children}
 </LanguageContext.Provider>
 )
}

export function useLang() {
 const ctx = useContext(LanguageContext)
 if (!ctx) throw new Error('useLang must be used inside LanguageProvider')
 return ctx
}
