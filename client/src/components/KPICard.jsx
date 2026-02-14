import { ArrowUpIcon, ArrowDownIcon } from './Icons'

export default function KPICard({ label, value, trend, trendLabel, color = 'blue', sparkline, onClick }) {
  return (
    <div className={`kpi-card ${color} ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="kpi-value">{value}</div>
          <div className="kpi-label">{label}</div>
          {(trend !== undefined || trendLabel) && (
            <div className={`kpi-trend flex items-center gap-0.5 ${trend > 0 ? 'up' : trend < 0 ? 'down' : 'text-slate-400'}`}>
              {trend > 0 && <ArrowUpIcon className="w-3 h-3" />}
              {trend < 0 && <ArrowDownIcon className="w-3 h-3" />}
              <span>{trendLabel || `${Math.abs(trend)}%`}</span>
            </div>
          )}
        </div>
        {sparkline && <div className="shrink-0 ml-2">{sparkline}</div>}
      </div>
    </div>
  )
}
