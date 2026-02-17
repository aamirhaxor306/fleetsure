import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../App'

const STEP_EMAIL = 'email'
const STEP_OTP = 'otp'
const STEP_ONBOARD = 'onboard'

export default function Login() {
  const { requestOtp, verifyOtp, onboard } = useAuth()

  const [step, setStep] = useState(STEP_EMAIL)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [fleetName, setFleetName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const otpRefs = useRef([])

  // ── Countdown timer ───────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  // ── STEP 1: Request OTP ─────────────────────────────────
  const handleRequestOtp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await requestOtp(email)
      setStep(STEP_OTP)
      setCountdown(60)
    } catch (err) {
      setError(err.message || 'Failed to send OTP')
    }
    setLoading(false)
  }

  // ── STEP 2: Verify OTP ──────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e?.preventDefault()
    const code = otp.join('')
    if (code.length !== 6) return
    setError('')
    setLoading(true)

    try {
      const res = await verifyOtp(email, code)
      if (res.needsOnboarding) {
        setStep(STEP_ONBOARD)
      }
    } catch (err) {
      setError(err.message || 'Verification failed')
    }
    setLoading(false)
  }

  // ── STEP 3: Onboard ──────────────────────────────────────
  const handleOnboard = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onboard(fleetName, ownerName)
    } catch (err) {
      setError(err.message || 'Onboarding failed')
    }
    setLoading(false)
  }

  // ── OTP input handlers ────────────────────────────────────
  const handleOtpChange = (idx, value) => {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[idx] = value.slice(-1)
    setOtp(newOtp)
    if (value && idx < 5) otpRefs.current[idx + 1]?.focus()
    if (newOtp.every((d) => d !== '') && newOtp.join('').length === 6) {
      setTimeout(() => handleVerifyOtp(), 100)
    }
  }

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setOtp(pasted.split(''))
      otpRefs.current[5]?.focus()
      setTimeout(() => handleVerifyOtp(), 100)
    }
  }

  const resendOtp = async () => {
    if (countdown > 0) return
    setError('')
    setLoading(true)
    try {
      await requestOtp(email)
      setCountdown(60)
    } catch (err) {
      setError(err.message || 'Failed to resend OTP')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3 shadow-lg shadow-blue-500/30">
            F
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Fleetsure</h1>
          <p className="text-sm text-slate-400 mt-1">Fleet Management Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl shadow-black/20">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 mb-4 border border-red-100">
              {error}
            </div>
          )}

          {/* ── EMAIL STEP ── */}
          {step === STEP_EMAIL && (
            <>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Welcome</h2>
              <p className="text-sm text-slate-500 mb-5">Enter your email to get started</p>
              <form onSubmit={handleRequestOtp}>
                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !email.includes('@')}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg py-2.5 transition"
                >
                  {loading ? 'Sending...' : 'Get OTP'}
                </button>
              </form>
            </>
          )}

          {/* ── OTP STEP ── */}
          {step === STEP_OTP && (
            <>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Check your email</h2>
              <p className="text-sm text-slate-500 mb-5">
                Enter the 6-digit code sent to <span className="font-medium text-slate-700">{email}</span>
              </p>
              <form onSubmit={handleVerifyOtp}>
                <div className="flex gap-2 mb-4 justify-center" onPaste={handleOtpPaste}>
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className="w-11 h-12 text-center text-lg font-bold border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      autoFocus={idx === 0}
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={loading || otp.join('').length !== 6}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg py-2.5 transition mb-3"
                >
                  {loading ? 'Verifying...' : 'Verify'}
                </button>
              </form>
              <div className="flex items-center justify-between text-xs">
                <button
                  onClick={() => { setStep(STEP_EMAIL); setOtp(['', '', '', '', '', '']); setError('') }}
                  className="text-blue-600 hover:underline"
                >
                  Change email
                </button>
                <button
                  onClick={resendOtp}
                  disabled={countdown > 0 || loading}
                  className={`${countdown > 0 ? 'text-slate-400' : 'text-blue-600 hover:underline'}`}
                >
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                </button>
              </div>
            </>
          )}

          {/* ── ONBOARD STEP ── */}
          {step === STEP_ONBOARD && (
            <>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Setup Your Fleet</h2>
              <p className="text-sm text-slate-500 mb-5">Tell us about your fleet to get started</p>
              <form onSubmit={handleOnboard} className="space-y-4">
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
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Enterprise-grade fleet operations platform
        </p>
      </div>
    </div>
  )
}
