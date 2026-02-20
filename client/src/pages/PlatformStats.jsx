import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'

const API = '/api/admin/stats'

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    emerald: 'from-emerald-500 to-emerald-600',
    violet: 'from-violet-500 to-violet-600',
    amber: 'from-amber-500 to-amber-600',
    rose: 'from-rose-500 to-rose-600',
    cyan: 'from-cyan-500 to-cyan-600',
    indigo: 'from-indigo-500 to-indigo-600',
    slate: 'from-slate-500 to-slate-600',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</div>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-bold bg-gradient-to-r ${colors[color]} bg-clip-text text-transparent`}>
          {value?.toLocaleString?.() ?? value}
        </span>
        {sub && <span className="text-xs text-slate-400 mb-1">{sub}</span>}
      </div>
    </div>
  )
}

export default function PlatformStats() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(API, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error(r.status === 403 ? 'Admin access required' : 'Failed to load')
        return r.json()
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-slate-200 rounded w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-slate-200 rounded-xl" />)}
      </div>
    </div>
  )

  if (error) return (
    <div className="text-center py-20">
      <div className="text-4xl mb-3">🔒</div>
      <div className="text-lg font-semibold text-slate-700">{error}</div>
      <p className="text-sm text-slate-400 mt-1">This page is restricted to platform admins.</p>
    </div>
  )

  const { totals, growth, planBreakdown, tenants, recentLeads } = data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Overview"
        subtitle="Real-time stats across all tenants"
      />

      {/* Top-level numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Tenants" value={totals.tenantCount} color="blue" />
        <StatCard label="Users" value={totals.userCount} color="violet" />
        <StatCard label="Vehicles" value={totals.vehicleCount} color="emerald" />
        <StatCard label="Drivers" value={totals.driverCount} color="cyan" />
        <StatCard label="Trips" value={totals.tripCount} color="amber" />
        <StatCard label="Documents" value={totals.documentCount} color="indigo" />
        <StatCard label="Alerts" value={totals.alertCount} color="rose" />
        <StatCard label="Leads" value={totals.leadCount} color="slate" />
      </div>

      {/* Growth section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="New Tenants (30d)" value={growth.newTenantsMonth} sub="signups" color="blue" />
        <StatCard label="New Tenants (7d)" value={growth.newTenantsWeek} sub="signups" color="blue" />
        <StatCard label="Trips (30d)" value={growth.tripsMonth} sub="logged" color="amber" />
        <StatCard label="Trips (7d)" value={growth.tripsWeek} sub="logged" color="amber" />
      </div>

      {/* Plan breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Plan Distribution</h3>
        <div className="flex flex-wrap gap-3">
          {planBreakdown.map(p => (
            <div key={p.plan} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className={`w-2.5 h-2.5 rounded-full ${p.plan === 'pro' ? 'bg-blue-500' : 'bg-slate-400'}`} />
              <span className="text-sm font-medium text-slate-700 capitalize">{p.plan}</span>
              <span className="text-sm font-bold text-slate-900">{p.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* All Tenants */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">All Tenants ({tenants.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3">Tenant</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">City</th>
                <th className="px-5 py-3 text-center">Users</th>
                <th className="px-5 py-3 text-center">Vehicles</th>
                <th className="px-5 py-3 text-center">Drivers</th>
                <th className="px-5 py-3 text-center">Trips</th>
                <th className="px-5 py-3 text-center">Docs</th>
                <th className="px-5 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenants.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-800">{t.name}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      t.plan === 'pro' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                    }`}>{t.plan}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{t.city || '-'}</td>
                  <td className="px-5 py-3 text-center font-medium">{t._count.users}</td>
                  <td className="px-5 py-3 text-center font-medium">{t._count.vehicles}</td>
                  <td className="px-5 py-3 text-center font-medium">{t._count.drivers}</td>
                  <td className="px-5 py-3 text-center font-medium">{t._count.trips}</td>
                  <td className="px-5 py-3 text-center font-medium">{t._count.documents}</td>
                  <td className="px-5 py-3 text-slate-400 text-xs">{new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-8 text-center text-slate-400">No tenants yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Leads */}
      {recentLeads.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Recent Leads</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">City</th>
                  <th className="px-5 py-3">Fleet Size</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentLeads.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-800">{l.name}</td>
                    <td className="px-5 py-3 text-slate-600">{l.phone}</td>
                    <td className="px-5 py-3 text-slate-500">{l.city}</td>
                    <td className="px-5 py-3">{l.fleetSize}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{new Date(l.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
