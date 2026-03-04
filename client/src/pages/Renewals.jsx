import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { renewals as renewalsApi, documents as documentsApi, vehicles as vehiclesApi } from '../api'
import PageHeader from '../components/PageHeader'
import KPICard from '../components/KPICard'
import StatusDot from '../components/StatusDot'
import EmptyState from '../components/EmptyState'
import { RefreshIcon, AlertTriangleIcon } from '../components/Icons'

export default function Renewals() {
  const navigate = useNavigate()
  const [renewalList, setRenewalList] = useState([])
  const [expiring, setExpiring] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      renewalsApi.list(),
      renewalsApi.expiring(),
      vehiclesApi.list(),
    ]).then(([r, e, v]) => {
      if (r.status === 'fulfilled') setRenewalList(r.value)
      if (e.status === 'fulfilled') setExpiring(e.value)
      if (v.status === 'fulfilled') setVehicles(v.value)
      setLoading(false)
    })
  }, [])

  const active = renewalList.filter(r => ['pending', 'quotes_received', 'confirmed'].includes(r.status))
  const completed = renewalList.filter(r => r.status === 'renewed')

  const startRenewal = async (doc) => {
    try {
      const renewal = await renewalsApi.create({
        vehicleId: doc.vehicleId,
        documentId: doc.id,
        documentType: doc.documentType,
      })
      navigate(`/renewals/${renewal.id}`)
    } catch (err) { alert(err.message) }
  }

  const statusLabel = (s) => {
    const map = { pending: 'Pending', quotes_received: 'Quotes Ready', confirmed: 'Confirmed', renewed: 'Renewed' }
    return map[s] || s
  }

  if (loading) return <div className="animate-pulse"><div className="h-8 bg-slate-200 rounded w-48 mb-4" /><div className="h-64 bg-slate-200 rounded-lg" /></div>

  return (
    <div>
      <PageHeader
        title="Renewals"
        subtitle="Manage document renewals"
        breadcrumbs={[{ label: 'Fleet Health', to: '/fleet-health' }, { label: 'Renewals' }]}
      />

      {/* Info banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <RefreshIcon className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-teal-900">Compare quotes from your agents</h4>
            <p className="text-xs text-teal-700 mt-0.5">Start a renewal, then add quotes you received from agents or brokers. We'll compare them side-by-side and recommend the best one.</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard label="Expiring Soon" value={expiring.length} color="amber" />
        <KPICard label="In Progress" value={active.length} color="blue" />
        <KPICard label="Completed" value={completed.length} color="emerald" />
        <KPICard label="Total Renewals" value={renewalList.length} color="violet" />
      </div>

      {/* Expiring Documents */}
      {expiring.length > 0 && (
        <div className="card overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Documents Needing Renewal</h3>
          </div>
          <table className="data-table">
            <thead><tr><th>Vehicle</th><th>Type</th><th>Expiry</th><th>Days Left</th><th>Action</th></tr></thead>
            <tbody>
              {expiring.map(doc => {
                const exp = new Date(doc.expiryDate)
                const now = new Date()
                const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24))
                const veh = vehicles.find(v => v.id === doc.vehicleId)
                return (
                  <tr key={doc.id}>
                    <td className="font-mono text-xs">{veh?.vehicleNumber || '-'}</td>
                    <td><span className="uppercase font-medium text-xs">{doc.documentType}</span></td>
                    <td className="text-xs">{exp.toLocaleDateString()}</td>
                    <td><span className={`badge ${daysLeft < 0 ? 'badge-high' : 'badge-medium'}`}>{daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d`}</span></td>
                    <td><button onClick={() => startRenewal(doc)} className="text-xs text-blue-600 hover:text-blue-800 font-semibold">Start Renewal</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Active Renewals */}
      {active.length > 0 && (
        <div className="card overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Active Renewals</h3>
          </div>
          <table className="data-table">
            <thead><tr><th>Vehicle</th><th>Type</th><th>Status</th><th>Started</th><th></th></tr></thead>
            <tbody>
              {active.map(r => (
                <tr key={r.id} onClick={() => navigate(`/renewals/${r.id}`)} className="cursor-pointer">
                  <td className="font-mono text-xs">{r.vehicle?.vehicleNumber || '-'}</td>
                  <td><span className="uppercase text-xs">{r.documentType}</span></td>
                  <td><span className="badge badge-pending">{statusLabel(r.status)}</span></td>
                  <td className="text-xs text-slate-400">{new Date(r.requestedAt).toLocaleDateString()}</td>
                  <td className="text-xs text-blue-600 font-medium">View</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Completed Renewals</h3>
          </div>
          <table className="data-table">
            <thead><tr><th>Vehicle</th><th>Type</th><th>Status</th><th>Renewed</th></tr></thead>
            <tbody>
              {completed.map(r => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.vehicle?.vehicleNumber || '-'}</td>
                  <td><span className="uppercase text-xs">{r.documentType}</span></td>
                  <td><span className="badge badge-success">Renewed</span></td>
                  <td className="text-xs text-slate-400">{r.renewedAt ? new Date(r.renewedAt).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {renewalList.length === 0 && expiring.length === 0 && (
        <EmptyState icon={RefreshIcon} title="No renewals" subtitle="Documents that need renewal will appear here" />
      )}
    </div>
  )
}
