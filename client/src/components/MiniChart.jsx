import { AreaChart, Area, ResponsiveContainer } from 'recharts'

export default function MiniChart({ data = [], dataKey = 'value', color = '#3b82f6', height = 32, width = 64 }) {
 if (!data.length) return null
 return (
 <div style={{ width, height }}>
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
 <defs>
 <linearGradient id={`mini-${color}`} x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stopColor={color} stopOpacity={0.3} />
 <stop offset="100%" stopColor={color} stopOpacity={0} />
 </linearGradient>
 </defs>
 <Area
 type="monotone"
 dataKey={dataKey}
 stroke={color}
 strokeWidth={1.5}
 fill={`url(#mini-${color})`}
 dot={false}
 isAnimationActive={false}
 />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 )
}
