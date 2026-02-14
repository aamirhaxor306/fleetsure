import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../App'
import { auth, RecaptchaVerifier, signInWithPhoneNumber } from '../lib/firebase'

const STEP_PHONE = 'phone'
const STEP_OTP = 'otp'
const STEP_ONBOARD = 'onboard'

export default function Login() {
  const { firebaseLogin, onboard } = useAuth()

  const [step, setStep] = useState(STEP_PHONE)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [fleetName, setFleetName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [confirmationResult, setConfirmationResult] = useState(null)

  const otpRefs = useRef([])
  const recaptchaRef = useRef(null)

  // ── Countdown timer ───────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  // ── Setup invisible reCAPTCHA ─────────────────────────────
  const setupRecaptcha = () => {
    if (recaptchaRef.current) return // already set up

    recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved — will proceed with signInWithPhoneNumber
      },
      'expired-callback': () => {
        setError('reCAPTCHA expired. Please try again.')
        recaptchaRef.current = null
      },
    })
  }

  // ── STEP 1: Send OTP via Firebase ─────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      setupRecaptcha()
      const fullPhone = `+91${phone}`
      const result = await signInWithPhoneNumber(auth, fullPhone, recaptchaRef.current)
      setConfirmationResult(result)
      setStep(STEP_OTP)
      setCountdown(30)
    } catch (err) {
      console.error('Firebase phone auth error:', err)
      // Reset reCAPTCHA on error
      recaptchaRef.current = null
      if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait and try again.')
      } else if (err.code === 'auth/invalid-phone-number') {
        setError('Invalid phone number. Please check and retry.')
      } else {
        setError(err.message || 'Failed to send OTP')
      }
    }
    setLoading(false)
  }

  // ── STEP 2: Verify OTP via Firebase → send token to backend ─
  const handleVerifyOtp = async (e) => {
    e?.preventDefault()
    const code = otp.join('')
    if (code.length !== 6 || !confirmationResult) return
    setError('')
    setLoading(true)

    try {
      // Verify OTP with Firebase
      const userCredential = await confirmationResult.confirm(code)
      // Get the Firebase ID token
      const idToken = await userCredential.user.getIdToken()
      // Send to our backend
      const res = await firebaseLogin(idToken)
      if (res.needsOnboarding) {
        setStep(STEP_ONBOARD)
      }
      // If not needsOnboarding, firebaseLogin sets user in context → redirect
    } catch (err) {
      console.error('OTP verify error:', err)
      if (err.code === 'auth/invalid-verification-code') {
        setError('Wrong OTP. Please check and try again.')
      } else if (err.code === 'auth/code-expired') {
        setError('OTP expired. Please request a new one.')
      } else {
        setError(err.message || 'Verification failed')
      }
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
      // Reset reCAPTCHA for resend
      recaptchaRef.current = null
      setupRecaptcha()
      const fullPhone = `+91${phone}`
      const result = await signInWithPhoneNumber(auth, fullPhone, recaptchaRef.current)
      setConfirmationResult(result)
      setCountdown(30)
    } catch (err) {
      setError(err.message || 'Failed to resend OTP')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      {/* Invisible reCAPTCHA container */}
      <div id="recaptcha-container"></div>

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

          {/* ── PHONE STEP ── */}
          {step === STEP_PHONE && (
            <>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Welcome</h2>
              <p className="text-sm text-slate-500 mb-5">Enter your phone number to get started</p>
              <form onSubmit={handleSendOtp}>
                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Phone Number</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">+91</span>
                    <input
                      type="tel"
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="98765 43210"
                      maxLength={10}
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || phone.length < 10}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg py-2.5 transition"
                >
                  {loading ? 'Sending OTP...' : 'Get OTP'}
                </button>
              </form>
            </>
          )}

          {/* ── OTP STEP ── */}
          {step === STEP_OTP && (
            <>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Verify OTP</h2>
              <p className="text-sm text-slate-500 mb-5">
                Enter the 6-digit code sent to <span className="font-medium text-slate-700">+91 {phone}</span>
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
                  onClick={() => { setStep(STEP_PHONE); setOtp(['', '', '', '', '', '']); setError(''); setConfirmationResult(null) }}
                  className="text-blue-600 hover:underline"
                >
                  Change number
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
