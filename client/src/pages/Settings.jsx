import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { auth as authApi } from '../api'
import PageHeader from '../components/PageHeader'

const ROLES = { owner: 'Owner', manager: 'Manager', viewer: 'Viewer' }

// ── Settings API ────────────────────────────────────────────
const settingsApi = {
  getProfile: () => fetch('/api/settings/profile', { credentials: 'include' }).then(r => r.json()),
  updateProfile: (data) => fetch('/api/settings/profile', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  updateCompany: (data) => fetch('/api/settings/company', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  getTeam: () => fetch('/api/settings/team', { credentials: 'include' }).then(r => r.json()),
  inviteUser: (data) => fetch('/api/settings/team/invite', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  removeUser: (id) => fetch(`/api/settings/team/${id}`, { method: 'DELETE', credentials: 'include' }).then(r => r.json()),
  updateUserRole: (id, role) => fetch(`/api/settings/team/${id}/role`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) }).then(r => r.json()),
}

// ── Section Card ────────────────────────────────────────────
function Section({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

export default function Settings() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState('profile')
  const [profile, setProfile] = useState({ name: '', email: '' })
  const [company, setCompany] = useState({ name: '', plan: '', address: '', city: '', gstin: '', phone: '' })
  const [team, setTeam] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const p = await settingsApi.getProfile()
      setProfile({ name: p.name || '', email: p.email || '' })
      setCompany({ name: p.tenantName || '', plan: p.plan || 'free', address: p.tenantAddress || '', city: p.tenantCity || '', gstin: p.tenantGstin || '', phone: p.tenantPhone || '' })
      const t = await settingsApi.getTeam()
      setTeam(Array.isArray(t) ? t : [])
    } catch {}
  }

  const flash = (msg, isError = false) => {
    if (isError) { setError(msg); setSuccess('') }
    else { setSuccess(msg); setError('') }
    setTimeout(() => { setSuccess(''); setError('') }, 3000)
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await settingsApi.updateProfile({ name: profile.name })
      flash('Profile updated')
    } catch (e) { flash(e.message, true) }
    setSaving(false)
  }

  const handleSaveCompany = async () => {
    setSaving(true)
    try {
      await settingsApi.updateCompany({ name: company.name, address: company.address, city: company.city, gstin: company.gstin, phone: company.phone })
      flash('Company updated')
    } catch (e) { flash(e.message, true) }
    setSaving(false)
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail || !inviteEmail.includes('@')) return
    setSaving(true)
    try {
      const res = await settingsApi.inviteUser({ email: inviteEmail, role: inviteRole })
      if (res.error) throw new Error(res.error)
      flash('User invited')
      setInviteEmail('')
      loadData()
    } catch (e) { flash(e.message, true) }
    setSaving(false)
  }

  const handleRemoveUser = async (id) => {
    if (!confirm('Remove this team member?')) return
    try {
      await settingsApi.removeUser(id)
      flash('User removed')
      loadData()
    } catch (e) { flash(e.message, true) }
  }

  const handleRoleChange = async (id, newRole) => {
    try {
      await settingsApi.updateUserRole(id, newRole)
      flash('Role updated')
      loadData()
    } catch (e) { flash(e.message, true) }
  }

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'company', label: 'Company' },
    ...(user?.role === 'owner' ? [{ id: 'team', label: 'Team' }] : []),
    { id: 'preferences', label: 'Preferences' },
    { id: 'danger', label: 'Account' },
  ]

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your account, company, and team" />

      {/* Flash messages */}
      {success && <div className="bg-emerald-50 text-emerald-700 text-sm rounded-lg px-4 py-2 mb-4 border border-emerald-200">{success}</div>}
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2 mb-4 border border-red-100">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-5 max-w-2xl">
        {/* ── Profile Tab ── */}
        {tab === 'profile' && (
          <>
            <Section title="Personal Information" subtitle="Your name and contact details">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={profile.name}
                    onChange={e => setProfile({ ...profile, name: e.target.value })}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500"
                    value={profile.email}
                    disabled
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Email cannot be changed (used for login)</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    {ROLES[user?.role] || user?.role}
                  </span>
                </div>
                <div className="pt-2">
                  <button onClick={handleSaveProfile} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg px-5 py-2 transition">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </Section>
          </>
        )}

        {/* ── Company Tab ── */}
        {tab === 'company' && (
          <>
            <Section title="Company Details" subtitle="Your fleet's business information">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Company / Fleet Name</label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={company.name}
                    onChange={e => setCompany({ ...company, name: e.target.value })}
                    placeholder="Sharma Transport"
                    disabled={user?.role !== 'owner'}
                  />
                  {user?.role !== 'owner' && <p className="text-[11px] text-slate-400 mt-1">Only the owner can change the company name</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={company.address}
                    onChange={e => setCompany({ ...company, address: e.target.value })}
                    placeholder="123, Industrial Area, Sector 5"
                    disabled={user?.role !== 'owner'}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      value={company.city}
                      onChange={e => setCompany({ ...company, city: e.target.value })}
                      placeholder="Mumbai"
                      disabled={user?.role !== 'owner'}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      value={company.phone}
                      onChange={e => setCompany({ ...company, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      disabled={user?.role !== 'owner'}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">GSTIN</label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                    value={company.gstin}
                    onChange={e => setCompany({ ...company, gstin: e.target.value.toUpperCase() })}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                    disabled={user?.role !== 'owner'}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Your GST Identification Number (appears on invoices)</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Plan</label>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold ${company.plan === 'pro' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                      {company.plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
                    </span>
                    {company.plan !== 'pro' && (
                      <span className="text-xs text-slate-400">Upgrade for advanced features</span>
                    )}
                  </div>
                </div>
                {user?.role === 'owner' && (
                  <div className="pt-2">
                    <button onClick={handleSaveCompany} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg px-5 py-2 transition">
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>
            </Section>

            <Section title="Quick Stats" subtitle="Overview of your fleet data">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg px-3 py-2.5">
                  <div className="text-[11px] text-slate-500 font-medium">Tenant ID</div>
                  <div className="text-xs font-mono text-slate-700 mt-0.5 truncate">{user?.tenantId || '-'}</div>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2.5">
                  <div className="text-[11px] text-slate-500 font-medium">User ID</div>
                  <div className="text-xs font-mono text-slate-700 mt-0.5 truncate">{user?.id || '-'}</div>
                </div>
              </div>
            </Section>
          </>
        )}

        {/* ── Team Tab (owner only) ── */}
        {tab === 'team' && user?.role === 'owner' && (
          <>
            <Section title="Team Members" subtitle="Manage who has access to your fleet dashboard">
              {team.length === 0 ? (
                <p className="text-sm text-slate-400">No team members yet. Invite someone below.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {team.map(m => (
                    <div key={m.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold">
                          {m.name?.[0]?.toUpperCase() || m.email?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">{m.name || 'Unnamed'}</div>
                          <div className="text-xs text-slate-500">{m.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.id === user.id ? (
                          <span className="text-xs text-slate-400 font-medium">You</span>
                        ) : (
                          <>
                            <select
                              value={m.role}
                              onChange={e => handleRoleChange(m.id, e.target.value)}
                              className="text-xs border border-slate-200 rounded-md px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                            >
                              <option value="manager">Manager</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <button
                              onClick={() => handleRemoveUser(m.id)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Invite Team Member" subtitle="Add a manager or viewer to your fleet">
              <form onSubmit={handleInvite} className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Email Address</label>
                  <input
                    type="email"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="team@company.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="manager">Manager</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={saving || !inviteEmail.includes('@')}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg px-5 py-2 transition whitespace-nowrap"
                >
                  Invite
                </button>
              </form>
              <p className="text-[11px] text-slate-400 mt-2">The invited user will see your fleet data when they log in with this email.</p>
            </Section>
          </>
        )}

        {/* ── Preferences Tab ── */}
        {tab === 'preferences' && (
          <Section title="Preferences" subtitle="Customize your experience">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-slate-900">Telegram Bots</div>
                  <div className="text-xs text-slate-500 mt-0.5">Connect driver and owner bots for real-time updates</div>
                </div>
                <a href="https://t.me/fleetsure_manager_bot" target="_blank" rel="noopener" className="text-xs text-blue-600 hover:underline font-medium">
                  Open Owner Bot
                </a>
              </div>
              <div className="border-t border-slate-100" />
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-slate-900">Fleet Invite Code</div>
                  <div className="text-xs text-slate-500 mt-0.5">Share this code with your drivers to link them to your fleet</div>
                </div>
                <code className="bg-slate-100 px-3 py-1 rounded text-xs font-mono font-bold text-slate-700">FLEET-7X2K</code>
              </div>
              <div className="border-t border-slate-100" />
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-slate-900">Driver Bot</div>
                  <div className="text-xs text-slate-500 mt-0.5">Share with your drivers for trip logging and GPS tracking</div>
                </div>
                <a href="https://t.me/fleetsure_driver_bot" target="_blank" rel="noopener" className="text-xs text-blue-600 hover:underline font-medium">
                  Open Driver Bot
                </a>
              </div>
            </div>
          </Section>
        )}

        {/* ── Account / Danger Zone Tab ── */}
        {tab === 'danger' && (
          <Section title="Account Actions" subtitle="Manage your session">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-slate-900">Sign Out</div>
                  <div className="text-xs text-slate-500 mt-0.5">Sign out of your account on this device</div>
                </div>
                <button onClick={logout} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg px-4 py-2 transition">
                  Sign Out
                </button>
              </div>
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
