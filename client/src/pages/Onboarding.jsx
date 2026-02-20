import { useState } from 'react'
import { auth as authApi } from '../api'

export default function Onboarding({ onComplete }) {
  const [fleetName, setFleetName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.onboard(fleetName, ownerName)
      if (res.user) onComplete(res.user)
    } catch (err) {
      setError(err.message || 'Onboarding failed')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3 shadow-lg shadow-blue-500/30">
            F
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Welcome to Fleetsure</h1>
          <p className="text-sm text-slate-400 mt-1">Let's set up your fleet</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-2xl shadow-black/20">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 mb-4 border border-red-100">
              {error}
            </div>
          )}

          <h2 className="text-lg font-bold text-slate-900 mb-1">Setup Your Fleet</h2>
          <p className="text-sm text-slate-500 mb-5">Tell us about your fleet to get started</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Fleet / Company Name</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                value={fleetName}
                onChange={(e) => setFleetName(e.target.value)}
                placeholder="Sharma Transport"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Your Name</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Rajesh Sharma"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !fleetName.trim() || !ownerName.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg py-2.5 transition"
            >
              {loading ? 'Setting up...' : 'Start Using Fleetsure'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
