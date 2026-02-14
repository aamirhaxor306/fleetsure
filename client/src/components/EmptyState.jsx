export default function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="text-center py-12 px-4">
      {Icon && (
        <div className="mx-auto w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center mb-3">
          <Icon className="w-6 h-6 text-slate-400" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {subtitle && <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
