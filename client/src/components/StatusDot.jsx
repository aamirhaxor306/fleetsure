export default function StatusDot({ status, label, className = '' }) {
 const colorMap = {
 active: 'green', idle: 'gray', reconciled: 'green', logged: 'amber',
 pending: 'amber', high: 'red', medium: 'amber', low: 'blue',
 expired: 'red', expiring: 'amber', valid: 'green', good: 'green',
 warn: 'amber', replace: 'red', burst: 'red', resolved: 'green',
 }
 const color = colorMap[status] || 'gray'
 return (
 <span className={`inline-flex items-center gap-1.5 ${className}`}>
 <span className={`status-dot ${color}`} />
 {label && <span className="text-sm text-slate-700">{label}</span>}
 </span>
 )
}
