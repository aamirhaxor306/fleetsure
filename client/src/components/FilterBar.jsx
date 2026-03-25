import { SearchIcon } from './Icons'

export default function FilterBar({ search, onSearch, placeholder = 'Search...', tabs, activeTab, onTabChange, children }) {
 return (
 <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
 {/* Search */}
 {onSearch && (
 <div className="relative flex-1 max-w-xs">
 <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input
 type="text"
 value={search || ''}
 onChange={(e) => onSearch(e.target.value)}
 placeholder={placeholder}
 className="inp pl-9"
 />
 </div>
 )}

 {/* Tabs */}
 {tabs && (
 <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
 {tabs.map((tab) => (
 <button
 key={tab.value}
 onClick={() => onTabChange(tab.value)}
 className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
 activeTab === tab.value
 ? 'bg-white text-slate-900 shadow-sm'
 : 'text-slate-500 hover:text-slate-700'
 }`}
 >
 {tab.label}
 {tab.count !== undefined && (
 <span className="ml-1 text-slate-400">({tab.count})</span>
 )}
 </button>
 ))}
 </div>
 )}

 {/* Extra filters */}
 {children}
 </div>
 )
}
