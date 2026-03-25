import { ChevronRightIcon } from './Icons'
import { Link } from 'react-router-dom'

export default function PageHeader({ title, subtitle, breadcrumbs = [], actions }) {
 return (
 <div className="mb-6">
 {breadcrumbs.length > 0 && (
 <nav className="flex items-center gap-1 text-xs text-slate-400 mb-2">
 {breadcrumbs.map((b, i) => (
 <span key={i} className="flex items-center gap-1">
 {i > 0 && <ChevronRightIcon className="w-3 h-3" />}
 {b.to ? (
 <Link to={b.to} className="hover:text-slate-600 transition-colors">{b.label}</Link>
 ) : (
 <span className="text-slate-600">{b.label}</span>
 )}
 </span>
 ))}
 </nav>
 )}
 <div className="flex items-start justify-between gap-4">
 <div>
 <h1 className="text-xl font-bold text-slate-900">{title}</h1>
 {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
 </div>
 {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
 </div>
 </div>
 )
}
