import { useEffect, useMemo, useState } from 'react'
import { admin as adminApi, adminOps as adminOpsApi } from '../api'

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-5 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
    </div>
  )
}

function LoginCard({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState(null)

  return (
    <div className="max-w-md mx-auto mt-2">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Platform login</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
        Enter Ops admin credentials to view cross-platform performance.
      </p>

      <form
        className="mt-6 space-y-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-5 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault()
          setErr(null)
          setSubmitting(true)
          try {
            await onLogin({ email, password })
          } catch (e) {
            setErr(e?.message || 'Login failed')
          } finally {
            setSubmitting(false)
          }
        }}
      >
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="mt-2 w-full rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm text-slate-800 dark:text-slate-100 p-2.5"
            placeholder="admin@company.com"
            autoComplete="username"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            className="mt-2 w-full rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm text-slate-800 dark:text-slate-100 p-2.5"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        {err && <div className="text-sm text-red-600 dark:text-red-400">{err}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 rounded-xl font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

export default function Performance() {
  const [opsMe, setOpsMe] = useState(null)
  const [opsErr, setOpsErr] = useState(null)
  const [loading, setLoading] = useState(true)

  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [perfLoading, setPerfLoading] = useState(false)

  const [dangerOpen, setDangerOpen] = useState(false)
  const [dangerTenant, setDangerTenant] = useState(null)
  const [dangerSummary, setDangerSummary] = useState(null)
  const [dangerLoading, setDangerLoading] = useState(false)
  const [dangerDeleting, setDangerDeleting] = useState(false)
  const [dangerConfirm, setDangerConfirm] = useState('')
  const [dangerErr, setDangerErr] = useState(null)
  const [dangerDone, setDangerDone] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await adminOpsApi.me()
        if (!cancelled) {
          setOpsMe(me)
          setOpsErr(null)
        }
      } catch (e) {
        if (!cancelled) {
          setOpsMe({ loggedIn: false })
          setOpsErr(e?.message || 'Failed to check login')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const isAuthed = Boolean(opsMe?.loggedIn)

  const fetchPerf = async () => {
    setPerfLoading(true)
    setErr(null)
    try {
      const d = await adminApi.performance()
      setData(d)
    } catch (e) {
      setErr(e?.message || 'Failed to load')
    } finally {
      setPerfLoading(false)
    }
  }

  useEffect(() => {
    if (loading) return
    if (isAuthed) fetchPerf()
  }, [loading, isAuthed])

  const o = data?.overview
  const nps = data?.nps
  const tenants = data?.tenants || []

  const showLogin = !loading && !isAuthed

  const content = useMemo(() => {
    if (loading || perfLoading) {
      return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          <div className="animate-pulse text-slate-400 text-sm font-medium">Loading platform metrics…</div>
        </div>
      )
    }

    if (err) {
      return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Performance</h1>
          <p className="text-red-600 dark:text-red-400 text-sm">{err}</p>
        </div>
      )
    }

    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Platform performance</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Internal metrics · generated {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : '—'}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Tenants" value={o?.tenants ?? '—'} />
          <StatCard
            label="Users onboarded"
            value={o?.usersOnboarded ?? '—'}
            sub={`${o?.usersPendingOnboarding ?? 0} pending fleet setup`}
          />
          <StatCard label="Vehicles" value={o?.vehicles ?? '—'} />
          <StatCard
            label="Trips"
            value={o?.trips ?? '—'}
            sub={`${o?.totalTripDistanceKm?.toLocaleString?.('en-IN') ?? o?.totalTripDistanceKm} km total distance`}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white mb-3">NPS</h2>
            {nps?.responses ? (
              <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                <li>
                  Responses: <span className="font-semibold tabular-nums">{nps.responses}</span>
                </li>
                <li>
                  Average score (0–10): <span className="font-semibold tabular-nums">{nps.averageScore ?? '—'}</span>
                </li>
                <li>
                  NPS (−100 to 100): <span className="font-semibold tabular-nums">{nps.npsScore ?? '—'}</span>
                </li>
              </ul>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No NPS responses yet.</p>
            )}
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white mb-3">Trips by status</h2>
            <pre className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-mono">
              {JSON.stringify(o?.tripsByStatus || {}, null, 2)}
            </pre>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Tenants</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Users, vehicles, trips, and GPS-tracked trip minutes (from driving scores)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-5 py-3 font-semibold">Fleet</th>
                  <th className="px-3 py-3 font-semibold">Plan</th>
                  <th className="px-3 py-3 font-semibold tabular-nums">Users</th>
                  <th className="px-3 py-3 font-semibold tabular-nums">Vehicles</th>
                  <th className="px-3 py-3 font-semibold tabular-nums">Trips</th>
                  <th className="px-3 py-3 font-semibold tabular-nums">Tracked min</th>
                  <th className="px-5 py-3 font-semibold">Since</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr
                    key={t.tenantId}
                    className="border-b border-slate-100 dark:border-slate-700/80 hover:bg-slate-50/80 dark:hover:bg-slate-700/40"
                  >
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{t.name}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{t.plan}</td>
                    <td className="px-3 py-3 tabular-nums text-slate-700 dark:text-slate-200">{t.users}</td>
                    <td className="px-3 py-3 tabular-nums text-slate-700 dark:text-slate-200">{t.vehicles}</td>
                    <td className="px-3 py-3 tabular-nums text-slate-700 dark:text-slate-200">{t.trips}</td>
                    <td className="px-3 py-3 tabular-nums text-slate-700 dark:text-slate-200">{t.trackedTripMinutes}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        onClick={async () => {
                          setDangerErr(null)
                          setDangerDone(null)
                          setDangerConfirm('')
                          setDangerSummary(null)
                          setDangerTenant(t)
                          setDangerOpen(true)
                        setDangerLoading(true)
                        setDangerDeleting(false)
                          try {
                            const s = await adminApi.tenantSummary(t.tenantId)
                            setDangerSummary(s)
                          } catch (e) {
                            setDangerErr(e?.message || 'Failed to load summary')
                          } finally {
                            setDangerLoading(false)
                          }
                        }}
                      >
                        Delete fleet…
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tenants.length === 0 && <div className="px-5 py-8 text-center text-slate-500 text-sm">No tenants yet.</div>}
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 dark:text-white mb-3">Platform transactions</h2>
          <pre className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-mono">
            {JSON.stringify(o?.platformTransactionsByStatus || {}, null, 2)}
          </pre>
        </div>
      </div>
    )
  }, [loading, perfLoading, err, data, o, nps, tenants])

  if (showLogin) {
    return (
      <LoginCard
        onLogin={async ({ email, password }) => {
          await adminOpsApi.login({ email, password })
          const me = await adminOpsApi.me()
          setOpsMe(me)
        }}
      />
    )
  }

  if (opsErr) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Performance</h1>
        <p className="text-red-600 dark:text-red-400 text-sm">{opsErr}</p>
      </div>
    )
  }

  return (
    <>
      {content}
      <DangerModal
        open={dangerOpen}
        onClose={() => {
          if (dangerDeleting) return
          setDangerOpen(false)
          setDangerTenant(null)
          setDangerSummary(null)
          setDangerConfirm('')
          setDangerErr(null)
          setDangerDone(null)
        }}
        tenant={dangerTenant}
        summary={dangerSummary}
        loading={dangerLoading}
        err={dangerErr}
        confirmValue={dangerConfirm}
        setConfirmValue={setDangerConfirm}
        deleting={dangerDeleting}
        done={dangerDone}
        onDelete={async () => {
          if (!dangerTenant?.tenantId) return
          setDangerErr(null)
          setDangerDeleting(true)
          try {
            const resp = await adminApi.deleteTenant(dangerTenant.tenantId, 'DELETE')
            setDangerDone(resp)
            await fetchPerf()
          } catch (e) {
            setDangerErr(e?.message || 'Delete failed')
          } finally {
            setDangerDeleting(false)
          }
        }}
      />
    </>
  )
}

function DangerModal({
  open,
  onClose,
  tenant,
  summary,
  loading,
  err,
  confirmValue,
  setConfirmValue,
  onDelete,
  deleting,
  done,
}) {
  if (!open) return null

  const counts = summary?.counts || null
  const canDelete = confirmValue === 'DELETE' && !deleting

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-2xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
              Dangerous action
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              Delete fleet: {tenant?.name || '—'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              This permanently deletes this tenant’s users, vehicles, trips and related data. This cannot be undone.
            </p>
          </div>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-4">
          {loading ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Loading fleet summary…</div>
          ) : counts ? (
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-700 dark:text-slate-200">
              {Object.entries(counts).slice(0, 10).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">{k}</span>
                  <span className="font-semibold tabular-nums">{v}</span>
                </div>
              ))}
              <div className="col-span-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                (Showing some counts; delete will remove all tenant-scoped records.)
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-400">No summary available.</div>
          )}
        </div>

        {err && <div className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</div>}
        {done && (
          <div className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
            Deleted. Vehicles: {done?.deleted?.vehicles ?? '—'}, Users: {done?.deleted?.users ?? '—'}.
          </div>
        )}

        <div className="mt-4">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Type <span className="text-red-600">DELETE</span> to confirm
          </label>
          <input
            value={confirmValue}
            onChange={(e) => setConfirmValue(e.target.value)}
            className="mt-2 w-full rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm text-slate-800 dark:text-slate-100 p-2.5"
            placeholder="DELETE"
            autoComplete="off"
          />
        </div>

        <div className="mt-5 flex gap-2 justify-end">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary !bg-red-600 hover:!bg-red-700"
            disabled={!canDelete}
            onClick={onDelete}
          >
            {deleting ? 'Deleting…' : 'Delete fleet'}
          </button>
        </div>
      </div>
    </div>
  )
}
