export default function HealthScore({ score = 0, size = 120, segments = [] }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="health-score flex flex-col items-center">
      <svg width={size} height={size} className="score-ring">
        {/* Background ring */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#e2e8f0" strokeWidth={8}
        />
        {/* Score ring */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        {/* Center text */}
        <text
          x={size / 2} y={size / 2 - 6}
          textAnchor="middle" dominantBaseline="middle"
          className="text-2xl font-bold" fill={color}
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
        >
          {score}
        </text>
        <text
          x={size / 2} y={size / 2 + 12}
          textAnchor="middle" dominantBaseline="middle"
          className="text-[10px] font-medium" fill="#94a3b8"
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
        >
          / 100
        </text>
      </svg>

      {segments.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                seg.value >= 80 ? 'bg-emerald-500' : seg.value >= 50 ? 'bg-amber-500' : 'bg-red-500'
              }`} />
              <span className="text-slate-500">{seg.label}</span>
              <span className="font-semibold text-slate-700">{seg.value}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
