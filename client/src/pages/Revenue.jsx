import { useState, useEffect } from 'react'
import { revenue as revenueApi } from '../api'
import PageHeader from '../components/PageHeader'
import KPICard from '../components/KPICard'
import { DollarIcon } from '../components/Icons'

export default function Revenue() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    revenueApi.summary().then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

  if (loading) return <div className="animate-pulse"><div className="h-8 bg-slate-200 rounded w-48 mb-4" /><div className="h-64 bg-slate-200 rounded-lg" /></div>

  const summary = data?.summary || {}
  const byType = data?.byDocumentType || []
  const ledger = data?.ledger || []

  return (
    <div>
      <PageHeader
        title="Platform Revenue"
        subtitle="Internal commission tracking (admin only)"
      />

      <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 mb-6 text-xs text-slate-500">
        This page is for internal Fleetsure revenue tracking. It is not visible in the main navigation.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard label="Total Commission" value={inr(summary.totalCommission)} color="blue" />
        <KPICard label="Pending" value={inr(summary.pendingCommission)} color="amber" />
        <KPICard label="Collected" value={inr(summary.collectedCommission)} color="emerald" />
        <KPICard label="Quote Value" value={inr(summary.totalQuoteValue)} color="violet" />
      </div>

      {byType.length > 0 && (
        <div className="card overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">By Document Type</h3>
          </div>
          <table className="data-table">
            <thead><tr><th>Type</th><th>Transactions</th><th>Commission</th></tr></thead>
            <tbody>
              {byType.map((row, i) => (
                <tr key={i}>
                  <td className="uppercase font-medium text-xs">{row.documentType}</td>
                  <td>{row.count}</td>
                  <td className="font-medium">{inr(row.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ledger.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Commission Ledger</h3>
          </div>
          <table className="data-table">
            <thead><tr><th>Vehicle</th><th>Type</th><th>Partner</th><th>Amount</th><th>Commission</th><th>Status</th></tr></thead>
            <tbody>
              {ledger.map((tx) => (
                <tr key={tx.id}>
                  <td className="font-mono text-xs">{tx.vehicleNumber}</td>
                  <td className="uppercase text-xs">{tx.documentType}</td>
                  <td className="text-xs">{tx.partnerName}</td>
                  <td className="text-xs">{inr(tx.quoteAmount)}</td>
                  <td className="font-medium text-xs">{inr(tx.commissionAmount)}</td>
                  <td><span className={`badge ${tx.status === 'collected' ? 'badge-success' : 'badge-pending'}`}>{tx.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
