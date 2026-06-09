import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck, Lock, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { DEMO_USER } from '../lib/mockData'
import { ensureUserKeys } from '../lib/provisionKeys'
import { ScalesSvg, ChainLinkSvg } from '../components/ui/SvgAssets'

type LoginStage = 'password' | 'mfa_code' | 'mfa_setup_required'

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loginStage, setLoginStage] = useState<LoginStage>('password')
  const [challengeToken, setChallengeToken] = useState('')
  const [setupToken, setSetupToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const mfaStep = loginStage === 'mfa_code'

  const handleDemo = () => {
    setAuth('demo-access-token', 'demo-refresh-token', DEMO_USER)
    toast.success('Welcome to the demo, Sarah!')
    navigate('/dashboard')
  }

  const storeAndRedirect = async (data: any) => {
    setAuth(data.accessToken, data.refreshToken, {
      id: data.userId,
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      firmId: data.firmId,
      mfaEnabled: data.mfaEnabled,
    })
    try {
      const provisioned = await ensureUserKeys(data.userId, password)
      if (provisioned) toast.success('Security keys generated for this device')
    } catch { /* non-fatal */ }
    toast.success(`Welcome back, ${data.fullName.split(' ')[0]}!`)
    navigate(data.role.startsWith('CLIENT') ? '/client/portal' : '/dashboard')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Demo shortcut
    if (email === 'demo@pangochain.com' && password === 'demo123') {
      setAuth('demo-access-token', 'demo-refresh-token', DEMO_USER)
      toast.success('Welcome to the demo!')
      navigate('/dashboard')
      return
    }

    try {
      if (loginStage === 'mfa_code') {
        if (useRecovery) {
          const { data } = await api.post('/auth/mfa/recovery', { challengeToken, recoveryCode })
          toast('Recovery code used — please set up MFA again from your profile', { icon: '🔑' })
          await storeAndRedirect(data)
          return
        }
        const { data } = await api.post('/auth/mfa/challenge', { challengeToken, totpCode })
        await storeAndRedirect(data)
        return
      }

      const { data } = await api.post('/auth/login', { email, password })

      if (data.requiresMfaCode) {
        setChallengeToken(data.challengeToken)
        setLoginStage('mfa_code')
        setTotpCode('')
        return
      }

      await storeAndRedirect(data)
    } catch (err: any) {
      const status = err.response?.status
      const body = err.response?.data

      if (status === 403 && body?.requiresMfaSetup) {
        setSetupToken(body.setupToken ?? '')
        setLoginStage('mfa_setup_required')
        return
      }
      if (status === 401 && loginStage === 'mfa_code') {
        setError(useRecovery ? 'Invalid or already-used recovery code' : 'Invalid code — try again')
        setTotpCode('')
        setRecoveryCode('')
        return
      }
      setError(body?.error ?? body?.detail ?? body?.message ?? 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-navy-950 text-text-primary selection:bg-gold-500/20 selection:text-gold-300">
      
      {/* ── Left panel: Abstract breathing geometric art ─────────────────── */}
      <div className="hidden lg:flex w-[50%] relative flex-col justify-between p-16 overflow-hidden border-r border-gold-500/10 bg-navy-900/40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(201,168,76,0.08),transparent_30rem)]" />
        
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] bg-[size:40px_40px]" />
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-950 border border-gold-500/20 p-1.5 overflow-hidden">
            <img src="/logo-mark.png" alt="PangoChain Logo" className="h-full w-auto filter-gold" />
          </div>
          <p className="font-serif text-sm font-bold text-gold-300 tracking-wide">PangoChain</p>
        </div>

        {/* Parallax breathing SVG Scales of Justice */}
        <div className="relative z-10 flex flex-col items-center justify-center py-12">
          <motion.div
            animate={{
              y: [0, -12, 0],
              rotate: [0, 0.5, -0.5, 0],
              scale: [1, 1.01, 1]
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="w-80 h-80 flex items-center justify-center"
          >
            <ScalesSvg className="w-full h-full text-gold-500/45 stroke-[1] drop-shadow-[0_0_15px_rgba(201,168,76,0.25)]" />
          </motion.div>
          
          <div className="max-w-md text-center mt-8">
            <h2 className="font-serif text-3xl font-medium text-gold-300 mb-4">Integrity, Sealed.</h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              Every case ledger transaction is cryptographically registered to prevent tampering and preserve courtroom chain-of-custody.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs font-mono text-text-secondary">
          <Lock className="w-3.5 h-3.5 text-gold-500" />
          AES-256-GCM · IPFS EVMAT MATTERS CUSTODY
        </div>
      </div>

      {/* ── Right panel: Login form ─────────────────────────────────────── */}
      <div className="flex-1 relative flex items-center justify-center p-8 bg-navy-950">
        
        {/* Decorative elements */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-0 top-0 w-80 h-80 rounded-bl-[10rem] bg-[radial-gradient(circle_at_top_right,rgba(201,168,76,0.06),transparent_24rem)]" />
          <div className="absolute left-0 bottom-0 w-64 h-64 rounded-tr-[8rem] bg-[radial-gradient(circle_at_bottom_left,rgba(26,92,74,0.04),transparent_20rem)]" />
        </div>

        <Link
          to="/"
          className="absolute left-8 top-8 z-20 inline-flex items-center gap-2 rounded-xl border border-gold-500/20 bg-navy-900/60 px-4 py-2 text-xs font-semibold text-gold-400 hover:text-gold-300 transition-all duration-300 hover:border-gold-500/40"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Portal
        </Link>

        <div className="absolute right-8 top-8 z-20">
          <ThemeToggle />
        </div>

        {/* Form panel card */}
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-gold-500/10 border-t-2 border-t-gold-500 bg-navy-900/50 p-8 shadow-card backdrop-blur-md">
          {/* Mobile logo */}
          <div className="flex justify-center lg:hidden mb-6">
            <img src="/logo.png" alt="PangoChain" className="h-9 w-auto filter-gold" />
          </div>
          
          <h1 className="font-serif text-2xl font-bold text-gold-300 mb-1">
            {loginStage === 'mfa_code' ? 'Multi-Factor Verification'
              : loginStage === 'mfa_setup_required' ? 'MFA Required'
              : 'Enterprise Access'}
          </h1>
          <p className="text-text-secondary text-sm mb-6">
            {loginStage === 'mfa_code'
              ? 'Enter the 6-digit verification code from your device.'
              : loginStage === 'mfa_setup_required'
              ? 'Your high-clearance role requires authenticator binding.'
              : 'Sign in to access your secure matters ledger.'}
          </p>

          {loginStage === 'mfa_setup_required' ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-gold-500/5 border border-gold-500/20 px-4 py-3 text-xs text-gold-300 leading-relaxed">
                For security, Managing Partners and IT Admins must enroll in Google Authenticator before accessing the system.
              </div>
              <button
                type="button"
                onClick={() => navigate('/mfa/setup', { state: { setupToken, password } })}
                disabled={!setupToken}
                className="btn-primary w-full justify-center py-3"
              >
                Set up MFA now
              </button>
              <button
                type="button"
                onClick={() => setLoginStage('password')}
                className="w-full text-xs text-text-secondary hover:text-text-primary text-center font-semibold mt-2"
              >
                Return to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {loginStage === 'password' ? (
                <>
                  <div>
                    <label className="label">E-Mail Address</label>
                    <input
                      type="email"
                      className="input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="attorney@firm.com"
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div>
                    <label className="label">Passphrase</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="input pr-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-gold-400"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : useRecovery ? (
                <div>
                  <label className="label">Fabric Recovery Code</label>
                  <input
                    type="text"
                    className="input text-center text-lg tracking-widest font-mono border-gold-500/30"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.toUpperCase().slice(0, 16))}
                    placeholder="XXXXX-XXXXX"
                    autoFocus
                    autoComplete="one-time-code"
                  />
                  <button
                    type="button"
                    onClick={() => { setUseRecovery(false); setError(''); setRecoveryCode('') }}
                    className="mt-2 text-xs text-gold-400 hover:text-gold-300 font-semibold"
                  >
                    Use authenticator code instead
                  </button>
                </div>
              ) : (
                <div>
                  <label className="label">Authenticator Pin</label>
                  <input
                    type="text"
                    className="input text-center text-2xl tracking-widest font-mono border-gold-500/30"
                    value={totpCode}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setTotpCode(v)
                    }}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { setUseRecovery(true); setError(''); setTotpCode('') }}
                    className="mt-2 text-xs text-gold-400 hover:text-gold-300 font-semibold"
                  >
                    Lost device? Use emergency recovery pin
                  </button>
                </div>
              )}

              {error && (
                <p className="text-xs text-rose-400 bg-error/10 border border-error/30 rounded-xl px-4 py-3 leading-relaxed">
                  {error}
                </p>
              )}

              <button type="submit" className="btn-primary w-full justify-center py-3 font-semibold uppercase tracking-wider text-xs shimmer-sweep" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {mfaStep ? 'Confirm Identity' : 'Secure Entry'}
              </button>
            </form>
          )}

          {/* Quick Demo Access */}
          <div className="mt-6 pt-5 border-t border-gold-500/10">
            <button
              type="button"
              onClick={handleDemo}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gold-500/20 bg-gold-500/5 text-gold-300 text-xs font-bold uppercase tracking-wider hover:bg-gold-500/10 transition-all duration-300"
            >
              <Zap className="w-4 h-4 text-gold-500 fill-current" />
              Demo Portal Access
            </button>
          </div>

          <p className="mt-5 text-center text-xs text-text-secondary font-semibold">
            Unregistered?{' '}
            <Link to="/register" className="text-gold-400 hover:text-gold-300 transition-colors duration-300">
              Establish Credentials
            </Link>
          </p>

          {/* Blockchain stamp */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-[10px] font-mono text-gold-500/50 uppercase tracking-widest border-t border-gold-500/5 pt-4">
            <ChainLinkSvg className="w-3.5 h-3.5 text-gold-500/30" />
            Secured by PangoChain Blockchain
          </div>
        </div>
      </div>
    </div>
  )
}
