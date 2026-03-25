import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../App'
import { auth as authApi, settings as settingsApi } from '../api'
import PageHeader from '../components/PageHeader'

const ROLES = { owner: 'Owner', manager: 'Manager', viewer: 'Viewer' }

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
 const [tab, setTab] = useState('business')
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
 if (res.emailSent) {
 flash(`Invitation email sent to ${inviteEmail}`)
 } else {
 flash(res.emailNote || 'User added. Share the login link manually.')
 }
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
 { id: 'business', label: 'My Business' },
 ...(user?.role === 'owner' ? [{ id: 'team', label: 'Team' }] : []),
 { id: 'connections', label: 'Connections' },
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
 {/* ── My Business Tab (merged Profile + Company) ── */}
 {tab === 'business' && (
 <>
 <Section title="Your Details" subtitle="Your name and login info">
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
 {saving ? 'Saving...' : 'Save Name'}
 </button>
 </div>
 </div>
 </Section>

 <Section title="Company Details" subtitle="Your fleet business information (shown on invoices)">
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
 <label className="block text-xs font-medium text-slate-600 mb-1">GSTIN <span className="text-slate-400 font-normal">(your GST number — shows on invoices)</span></label>
 <input
 type="text"
 className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
 value={company.gstin}
 onChange={e => setCompany({ ...company, gstin: e.target.value.toUpperCase() })}
 placeholder="22AAAAA0000A1Z5"
 maxLength={15}
 disabled={user?.role !== 'owner'}
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Plan</label>
 <div className="flex items-center gap-3">
 <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold ${company.plan === 'pro' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
 {company.plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
 </span>
 </div>
 </div>
 {user?.role === 'owner' && (
 <div className="pt-2">
 <button onClick={handleSaveCompany} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg px-5 py-2 transition">
 {saving ? 'Saving...' : 'Save Company'}
 </button>
 </div>
 )}
 </div>
 </Section>

 {/* Sign Out at bottom of My Business */}
 <Section title="Sign Out" subtitle="Sign out of your account on this device">
 <button onClick={logout} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg px-4 py-2 transition">
 Sign Out
 </button>
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
 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${m.name ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
 {m.name?.[0]?.toUpperCase() || m.email?.[0]?.toUpperCase()}
 </div>
 <div>
 <div className="flex items-center gap-2">
 <span className="text-sm font-medium text-slate-900">{m.name || m.email.split('@')[0]}</span>
 {!m.name && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">Invited</span>}
 </div>
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
 <p className="text-[11px] text-slate-400 mt-2">
 An invitation email will be sent via Clerk. The user can sign in with Google or phone number too.
 </p>
 </Section>
 </>
 )}

 {/* ── Connections Tab ── */}
 {tab === 'connections' && (
 <ConnectionsTab flash={flash} />
 )}
 </div>
 </div>
 )
}

// ── Telegram Bot Connections Component ─────────────────────────────────────────
function ConnectionsTab() {
 const inviteCode = 'FLEET-7X2K'

 return (
 <>
 <Section title="Telegram Owner Bot" subtitle="Get real-time fleet updates via Telegram">
 <div className="space-y-4">
 <div className="flex items-start gap-3 py-2">
 <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
 <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
 </div>
 <div className="flex-1">
 <div className="text-sm font-medium text-slate-900">Fleet Manager Bot</div>
 <div className="text-xs text-slate-500 mt-0.5">
 Get trip start/end alerts, fuel anomaly warnings, P&L reports, and daily fleet summary at 9 PM
 </div>
 <div className="mt-3">
 <a
 href="https://t.me/fleetsure_manager_bot"
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg px-4 py-2 transition"
 >
 Open @fleetsure_manager_bot
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
 </a>
 </div>
 <div className="mt-2 text-[11px] text-slate-400">
 Open the bot in Telegram and press /start to connect
 </div>
 </div>
 </div>
 </div>
 </Section>

 <Section title="Driver Telegram Bot" subtitle="Share with drivers so they can log trips via Telegram">
 <div className="space-y-4">
 <div className="flex items-center justify-between py-2">
 <div>
 <div className="text-sm font-medium text-slate-900">Driver Bot</div>
 <div className="text-xs text-slate-500 mt-0.5">
 Drivers message @fleetsure_driver_bot to register, log trips, and track expenses
 </div>
 </div>
 <code className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border border-blue-200">
 @fleetsure_driver_bot
 </code>
 </div>
 <div className="border-t border-slate-100" />
 <div className="flex items-center justify-between py-2">
 <div>
 <div className="text-sm font-medium text-slate-900">Fleet Invite Code</div>
 <div className="text-xs text-slate-500 mt-0.5">Give this code to drivers so they can join your fleet</div>
 </div>
 <code className="bg-slate-100 px-3 py-1 rounded text-xs font-mono font-bold text-slate-700">{inviteCode}</code>
 </div>
 <div className="border-t border-slate-100" />
 <div className="bg-slate-50 rounded-lg p-3">
 <div className="text-xs font-medium text-slate-700 mb-1.5">Quick Setup for Drivers</div>
 <ol className="text-[11px] text-slate-500 space-y-1 list-decimal list-inside">
 <li>Share the bot link: <code className="font-mono font-bold">t.me/fleetsure_driver_bot</code></li>
 <li>Driver opens the bot and presses /start</li>
 <li>Driver enters their name, phone, and fleet code: <code className="font-mono font-bold">{inviteCode}</code></li>
 <li>Done! Driver can log trips, fuel, toll, and expenses via buttons</li>
 </ol>
 </div>
 </div>
 </Section>
 </>
 )
}
