import { useState, useEffect } from 'react'
import { alerts as alertsApi } from '../api'

export default function Alerts() {
  const [alertData, setAlertData] = useState({ alerts: [], grouped: { high: [], medium: [], low: [] }, total: 0 })
  const [loading, setLoading] = useState(true)
  const [showResolved, setShowResolved] = useState(false)

  const load = (resolved = showResolved) => {
    setLoading(true)
    alertsApi.list(resolved)
      .then(setAlertData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => load(), [showResolved])

  const handleResolve = async (id) => {
    try {
      await alertsApi.resolve(id)
      load()
    } catch (err) {
      console.error(err)
    }
  }

  const handleRunEngine = async () => {
    try {
      const result = await alertsApi.runEngine()
      alert(`Alert engine: ${result.created} new alerts across ${result.checkedVehicles} vehicles.`)
      load()
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return (
    <div className="page-wide">
      <div className="animate-pulse space-y-3">
        <div className="h-8 bg-gray-200 rounded-xl w-24" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
      </div>
    </div>
  )

  const highCount = alertData.alerts.filter(a => a.severity === 'high' && !a.resolved).length
  const medCount = alertData.alerts.filter(a => a.severity === 'medium' && !a.resolved).length
  const lowCount = alertData.alerts.filter(a => a.severity === 'low' && !a.resolved).length

  return (
    <div className="page-wide">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Alerts</h1>
          <p className="text-sm text-gray-400 mt-1">{alertData.total} alerts</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
            <input type="checkbox" checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            Show resolved
          </label>
          <button onClick={handleRunEngine} className="btn-secondary text-xs">
            ⚡ Run Engine
          </button>
        </div>
      </div>

      {/* Summary */}
      {(highCount + medCount + lowCount > 0) && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="stat-card red">
            <p className="stat-value text-red-600">{highCount}</p>
            <p className="stat-label">High</p>
          </div>
          <div className="stat-card amber">
            <p className="stat-value text-amber-600">{medCount}</p>
            <p className="stat-label">Medium</p>
          </div>
          <div className="stat-card blue">
            <p className="stat-value text-blue-600">{lowCount}</p>
            <p className="stat-label">Low</p>
          </div>
        </div>
      )}

      {/* Alerts list */}
      {alertData.alerts.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-3xl mb-3">✅</p>
          <p className="text-sm text-gray-400">
            {showResolved ? 'No alerts found.' : 'No open alerts — all clear!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alertData.alerts.map((a) => {
            const severityStyles = {
              high: 'border-l-red-500 bg-red-50/30',
              medium: 'border-l-amber-500 bg-amber-50/20',
              low: 'border-l-blue-500 bg-blue-50/20',
            }
            return (
              <div key={a.id}
                className={`card px-5 py-4 flex items-start gap-4 border-l-4 ${severityStyles[a.severity] || ''} ${a.resolved ? 'opacity-40' : ''}`}>
                <span className={`badge badge-${a.severity} mt-0.5 shrink-0`}>{a.severity}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 leading-relaxed">{a.message}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-400">
                    <span className="font-semibold text-gray-500">{a.vehicle?.vehicleNumber || 'General'}</span>
                    <span>·</span>
                    <span className="capitalize">{a.alertType.replace('_', ' ')}</span>
                    <span>·</span>
                    <span>{new Date(a.createdAt).toLocaleDateString('en-IN')}</span>
                    {a.resolved && (
                      <>
                        <span>·</span>
                        <span className="text-emerald-600 font-bold">Resolved</span>
                      </>
                    )}
                  </div>
                </div>
                {!a.resolved && (
                  <button onClick={() => handleResolve(a.id)}
                    className="shrink-0 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-all">
                    ✓ Resolve
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
