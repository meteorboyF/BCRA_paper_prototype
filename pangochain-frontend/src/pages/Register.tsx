import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Key, CheckCircle, Loader2, Eye, EyeOff, ArrowLeft, Briefcase } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import api from '../lib/api'
import { useAuthStore, roleLabel, type UserRole, LEGAL_ROLES, CLIENT_ROLES } from '../store/authStore'
import {
  generateEciesKeypair, storeWrappedPrivateKey,
  generateEcdsaKeypair, storeWrappedEcdsaKey,
} from '../lib/crypto'
import toast from 'react-hot-toast'
import { ScalesSvg, GavelSvg } from '../components/ui/SvgAssets'

type Step = 'account' | 'keypair' | 'role' | 'review'

const ROLE_OPTIONS: UserRole[] = [...LEGAL_ROLES, ...CLIENT_ROLES]

export default function Register() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const [step, setStep] = useState<Step>('account')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Form fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('ASSOCIATE_JUNIOR')
  const [roleCategory, setRoleCategory] = useState<'LAWYER' | 'CLIENT'>('LAWYER')

  // Keypair state
  const [keypairStatus, setKeypairStatus] = useState<'idle' | 'generating' | 'done'>('idle')
  const [generatedPubKeyJwk, setGeneratedPubKeyJwk] = useState<string>('')
  const [generatedSigningPubKeyJwk, setGeneratedSigningPubKeyJwk] = useState<string>('')
  const [encryptedPrivKey, setEncryptedPrivKey] = useState<{ enc: string; salt: string; iv: string } | null>(null)
  const [encryptedSigningKey, setEncryptedSigningKey] = useState<{ enc: string; salt: string; iv: string } | null>(null)

  const generateKeypair = async () => {
    if (!password) {
      setError('Please enter your password before generating keys.')
      return
    }
    setKeypairStatus('generating')
    setError('')
    try {
      const [ecies, ecdsa] = await Promise.all([
        generateEciesKeypair(password),
        generateEcdsaKeypair(password),
      ])
      setGeneratedPubKeyJwk(JSON.stringify(ecies.publicKeyJwk))
      setEncryptedPrivKey({ enc: ecies.privateKeyEncryptedB64, salt: ecies.saltB64, iv: ecies.ivB64 })
      setGeneratedSigningPubKeyJwk(JSON.stringify(ecdsa.publicKeyJwk))
      setEncryptedSigningKey({ enc: ecdsa.privateKeyEncryptedB64, salt: ecdsa.saltB64, iv: ecdsa.ivB64 })
      setKeypairStatus('done')
    } catch (e) {
      setError('Key generation failed. Please try again.')
      setKeypairStatus('idle')
    }
  }

  const handleSubmit = async () => {
    if (!encryptedPrivKey || !encryptedSigningKey) {
      setError('Please generate your security keypairs first.')
      return
    }
    setLoading(true)
    setError('')

    try {
      const { data } = await api.post('/auth/register', {
        email,
        password,
        fullName,
        role,
        publicKeyJwk: generatedPubKeyJwk,
        signingPublicKeyJwk: generatedSigningPubKeyJwk,
      })

      storeWrappedPrivateKey(data.userId, {
        encryptedB64: encryptedPrivKey.enc,
        saltB64: encryptedPrivKey.salt,
        ivB64: encryptedPrivKey.iv,
      })
      storeWrappedEcdsaKey(data.userId, {
        encryptedB64: encryptedSigningKey.enc,
        saltB64: encryptedSigningKey.salt,
        ivB64: encryptedSigningKey.iv,
      })

      setAuth(data.accessToken, data.refreshToken, {
        id: data.userId,
        email: data.email,
        fullName: data.fullName,
        role: data.role,
        firmId: data.firmId,
        mfaEnabled: data.mfaEnabled,
      })

      toast.success('Account created! Your encryption keys are ready.')
      navigate(data.role.startsWith('CLIENT') ? '/client/portal' : '/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const stepsList: Step[] = ['account', 'keypair', 'role', 'review']
  const stepIdx = stepsList.indexOf(step)

  const slideVariants = {
    enter: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1, transition: { duration: 0.3 } },
    exit: { x: -40, opacity: 0, transition: { duration: 0.25 } }
  }

  return (
    <div className="min-h-screen flex bg-navy-950 text-text-primary selection:bg-gold-500/20 selection:text-gold-300">
      
      {/* ── Left panel: Abstract breathing geometric art ─────────────────── */}
      <div className="hidden lg:flex w-[50%] relative flex-col justify-between p-16 overflow-hidden border-r border-gold-500/10 bg-navy-900/40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(201,168,76,0.08),transparent_30rem)]" />
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] bg-[size:40px_40px]" />
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-950 border border-gold-500/20 p-1.5 overflow-hidden">
            <img src="/logo-mark.png" alt="PangoChain Logo" className="h-full w-auto filter-gold" />
          </div>
          <p className="font-serif text-sm font-bold text-gold-300 tracking-wide">PangoChain</p>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center py-12">
          <motion.div
            animate={{
              y: [0, -10, 0],
              scale: [1, 1.01, 1]
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="w-80 h-80 flex items-center justify-center"
          >
            <ScalesSvg className="w-full h-full text-gold-500/45 stroke-[1] drop-shadow-[0_0_15px_rgba(201,168,76,0.25)]" />
          </motion.div>
          
          <div className="max-w-md text-center mt-8">
            <h2 className="font-serif text-3xl font-medium text-gold-300 mb-4">Establish Credential Node</h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              Define your clearance level and provision local decryption profiles to verify transaction histories.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs font-mono text-text-secondary">
          <Key className="w-3.5 h-3.5 text-gold-500" />
          ECIES Cryptography P-256 Enabled
        </div>
      </div>

      {/* ── Right panel: Registration wizard ─────────────────────────────── */}
      <div className="flex-1 relative flex items-center justify-center p-8 bg-navy-950 overflow-y-auto">
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

        <div className="relative z-10 w-full max-w-lg mt-16 mb-8">
          {/* Mobile logo */}
          <div className="flex justify-center lg:hidden mb-8">
            <img src="/logo.png" alt="PangoChain" className="h-9 w-auto filter-gold" />
          </div>
          
          {/* Custom Step indicator: gold dots connected by a line, active dot pulses */}
          <div className="relative flex items-center justify-between mb-10 px-4">
            <div className="absolute left-6 right-6 top-1/2 h-0.5 bg-gold-500/10 -translate-y-1/2 z-0" />
            <div
              className="absolute left-6 top-1/2 h-0.5 bg-gold-500 transition-all duration-500 -translate-y-1/2 z-0"
              style={{ width: `${(stepIdx / (stepsList.length - 1)) * 91}%` }}
            />

            {stepsList.map((s, i) => {
              const active = i === stepIdx
              const done = i < stepIdx
              return (
                <div key={s} className="relative z-10 flex flex-col items-center">
                  <button
                    disabled={i > stepIdx && keypairStatus !== 'done'}
                    onClick={() => {
                      if (i <= stepIdx) setStep(s)
                      else if (keypairStatus === 'done') setStep(s)
                    }}
                    className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-mono font-bold transition-all duration-300 ${
                      done ? 'bg-gold-500 text-navy-950 shadow-gold-sm'
                        : active ? 'bg-navy-900 border-2 border-gold-500 text-gold-300 shadow-gold-md'
                        : 'bg-navy-900 border border-gold-500/20 text-text-secondary'
                    }`}
                  >
                    {done ? '✓' : i + 1}
                  </button>
                  {active && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gold-500"></span>
                    </span>
                  )}
                  <span className="absolute bottom-[-20px] text-[8px] font-bold uppercase tracking-widest text-text-secondary mt-1 whitespace-nowrap">
                    {s}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Form card wizard with AnimatePresence slide transitions */}
          <div className="relative rounded-2xl border border-gold-500/10 bg-navy-900/50 p-8 shadow-card backdrop-blur-md overflow-hidden min-h-[420px] flex flex-col justify-between">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-6 flex-1 flex flex-col justify-between"
              >
                {/* Step 1: Account Setup */}
                {step === 'account' && (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div>
                        <h2 className="font-serif text-xl font-bold text-gold-300">Identity Details</h2>
                        <p className="text-text-secondary text-xs">Set up your credentials for PangoChain access.</p>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="label">Full Legal Name</label>
                          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)}
                            placeholder="Sarah Sterling" />
                        </div>
                        <div>
                          <label className="label">E-Mail Address</label>
                          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)}
                            placeholder="partner@firm.com" />
                        </div>
                        <div>
                          <label className="label">Passphrase</label>
                          <div className="relative">
                            <input type={showPassword ? 'text' : 'password'} className="input pr-10"
                              value={password} onChange={(e) => setPassword(e.target.value)}
                              placeholder="Min. 8 characters" />
                            <button type="button" onClick={() => setShowPassword((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-gold-400">
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn-primary w-full justify-center py-3 uppercase tracking-wider text-xs font-bold mt-4"
                      disabled={!email || !password || !fullName || password.length < 8}
                      onClick={() => setStep('keypair')}
                    >
                      Next Step
                    </button>
                  </div>
                )}

                {/* Step 2: Keypair Generation */}
                {step === 'keypair' && (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div>
                        <h2 className="font-serif text-xl font-bold text-gold-300">Evidentiary Key Ring</h2>
                        <p className="text-text-secondary text-xs">
                          Secure your account using client-side cryptographic key generation.
                        </p>
                      </div>

                      <div className="bg-gold-500/5 rounded-xl border border-gold-500/20 p-5 space-y-3">
                        <div className="flex items-start gap-3">
                          <Key className="w-5 h-5 text-gold-400 flex-shrink-0 mt-0.5" />
                          <div className="text-xs text-text-secondary space-y-2">
                            <p className="font-bold text-gold-300">E2E Decryption Key Ring</p>
                            <ul className="space-y-1 list-disc list-inside">
                              <li>Generated completely inside this browser session</li>
                              <li>Protected by your primary passphrase</li>
                              <li>Required to decrypt case file uploads</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 mt-4">
                      {keypairStatus === 'idle' && (
                        <button className="btn-primary w-full justify-center py-3 uppercase tracking-wider text-xs font-bold" onClick={generateKeypair}>
                          <Key className="w-4 h-4 mr-1.5" /> Generate Secure Keys
                        </button>
                      )}

                      {keypairStatus === 'generating' && (
                        <div className="flex items-center justify-center gap-3 py-6 text-gold-300">
                          <Loader2 className="w-5 h-5 animate-spin text-gold-500" />
                          <span className="text-xs font-semibold uppercase tracking-wider">Deriving keys...</span>
                        </div>
                      )}

                      {keypairStatus === 'done' && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-emerald-400 bg-success/10 border border-success/30 rounded-xl px-4 py-3 text-xs font-medium">
                            <CheckCircle className="w-4 h-4 flex-shrink-0" />
                            Security key ring generated and ready.
                          </div>
                          <button className="btn-primary w-full justify-center py-3 uppercase tracking-wider text-xs font-bold" onClick={() => setStep('role')}>
                            Next Step
                          </button>
                        </div>
                      )}

                      {error && <p className="text-xs text-rose-400 bg-error/10 border border-error/30 rounded-xl px-3 py-2">{error}</p>}
                    </div>
                  </div>
                )}

                {/* Step 3: Role Selection Card */}
                {step === 'role' && (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div>
                        <h2 className="font-serif text-xl font-bold text-gold-300">Select clearance level</h2>
                        <p className="text-text-secondary text-xs">
                          Legal Professional accounts require managing partner approval.
                        </p>
                      </div>

                      {/* Lawyer vs Client Large cards */}
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => {
                            setRoleCategory('LAWYER')
                            setRole('ASSOCIATE_JUNIOR')
                          }}
                          className={`flex flex-col items-center justify-center p-5 rounded-xl border text-center transition-all duration-300 ${
                            roleCategory === 'LAWYER'
                              ? 'border-gold-500 bg-gold-500/5 shadow-gold-sm text-gold-300'
                              : 'border-gold-500/10 bg-navy-950/40 text-text-secondary hover:border-gold-500/20'
                          }`}
                        >
                          <GavelSvg className="w-10 h-10 mb-3 text-gold-400" />
                          <span className="text-xs font-bold uppercase tracking-wider">Lawyer / Staff</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRoleCategory('CLIENT')
                            setRole('CLIENT_PRIMARY')
                          }}
                          className={`flex flex-col items-center justify-center p-5 rounded-xl border text-center transition-all duration-300 ${
                            roleCategory === 'CLIENT'
                              ? 'border-gold-500 bg-gold-500/5 shadow-gold-sm text-gold-300'
                              : 'border-gold-500/10 bg-navy-950/40 text-text-secondary hover:border-gold-500/20'
                          }`}
                        >
                          <Briefcase className="w-10 h-10 mb-3 text-gold-400" />
                          <span className="text-xs font-bold uppercase tracking-wider">Client / Advisory</span>
                        </button>
                      </div>

                      {/* Dropdown for specific role */}
                      <div className="space-y-1">
                        <label className="label">Clearance Designation</label>
                        <select
                          value={role}
                          onChange={(e) => setRole(e.target.value as UserRole)}
                          className="w-full rounded-xl border border-gold-500/20 bg-navy-950/80 px-4 py-3 text-xs text-text-primary focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                        >
                          {roleCategory === 'LAWYER'
                            ? LEGAL_ROLES.map((r) => <option key={r} value={r} className="bg-navy-950">{roleLabel(r)}</option>)
                            : CLIENT_ROLES.map((r) => <option key={r} value={r} className="bg-navy-950">{roleLabel(r)}</option>)
                          }
                        </select>
                      </div>
                    </div>

                    <button className="btn-primary w-full justify-center py-3 uppercase tracking-wider text-xs font-bold mt-4" onClick={() => setStep('review')}>
                      Next Step
                    </button>
                  </div>
                )}

                {/* Step 4: Review */}
                {step === 'review' && (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div>
                        <h2 className="font-serif text-xl font-bold text-gold-300">Clearance Verification</h2>
                        <p className="text-text-secondary text-xs">Verify your ledger parameters before creation.</p>
                      </div>
                      
                      <div className="rounded-xl border border-gold-500/15 bg-navy-950/60 p-4 space-y-3 text-xs leading-relaxed font-mono">
                        <div className="flex justify-between border-b border-gold-500/5 pb-2">
                          <span className="text-text-secondary">FULL NAME</span>
                          <span className="font-semibold text-gold-300 truncate max-w-[200px]">{fullName}</span>
                        </div>
                        <div className="flex justify-between border-b border-gold-500/5 pb-2">
                          <span className="text-text-secondary">E-MAIL</span>
                          <span className="font-semibold text-gold-300 truncate max-w-[200px]">{email}</span>
                        </div>
                        <div className="flex justify-between border-b border-gold-500/5 pb-2">
                          <span className="text-text-secondary">ROLE</span>
                          <span className="font-semibold text-gold-300">{roleLabel(role)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">DECRYPTION STATUS</span>
                          <span className="font-semibold text-emerald-400 flex items-center gap-1">
                            ✓ ACTIVE KEYS
                          </span>
                        </div>
                      </div>

                      {error && (
                        <p className="text-xs text-rose-400 bg-error/10 border border-error/30 rounded-xl px-4 py-3 leading-relaxed">{error}</p>
                      )}
                    </div>

                    <button
                      className="btn-primary w-full justify-center py-3 uppercase tracking-wider text-xs font-bold mt-4 shimmer-sweep"
                      onClick={handleSubmit}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                          PROVISIONING...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-1.5" />
                          Establish Node
                        </>
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <p className="mt-6 text-center text-xs text-text-secondary font-semibold">
            Already established?{' '}
            <Link to="/login" className="text-gold-400 hover:text-gold-300 transition-colors duration-300">Sign in to node</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
