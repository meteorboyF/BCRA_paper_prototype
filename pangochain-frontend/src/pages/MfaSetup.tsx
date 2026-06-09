import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Shield, QrCode, Loader2, CheckCircle, AlertCircle, Copy, KeyRound, Download } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { ensureUserKeys } from '../lib/provisionKeys'

type Stage = 'idle' | 'loading' | 'scan' | 'verify' | 'recovery' | 'done' | 'error'

export default function MfaSetup() {
  const navigate = useNavigate()
  const location = useLocation()
  const setupState = location.state as { setupToken?: string; password?: string } | null
  const setupToken = setupState?.setupToken ?? ''
  const setupPassword = setupState?.password ?? ''
  const { user, updateUser, setAuth } = useAuthStore()
  const [stage, setStage] = useState<Stage>('idle')
  const [qrUri, setQrUri] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])

  const handleSetup = async () => {
    setStage('loading')
    setError('')
    try {
      const { data } = await api.post('/auth/mfa/setup', setupToken ? { setupToken } : {})
      setQrUri(data.qrUri)
      setSecret(data.secret)
      setStage('scan')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Setup failed')
      setStage('error')
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setStage('loading')
    setError('')
    try {
      const { data } = await api.post('/auth/mfa/verify', setupToken ? { code, setupToken } : { code })
      if (data.accessToken && data.refreshToken) {
        setAuth(data.accessToken, data.refreshToken, {
          id: data.userId,
          email: data.email,
          fullName: data.fullName,
          role: data.role,
          firmId: data.firmId,
          mfaEnabled: true,
        })
        if (setupPassword) {
          try { await ensureUserKeys(data.userId, setupPassword) } catch { /* non-fatal */ }
        }
      } else {
        updateUser({ mfaEnabled: true })
      }
      toast.success('Two-factor authentication enabled!')
      if (Array.isArray(data?.recoveryCodes) && data.recoveryCodes.length > 0) {
        setRecoveryCodes(data.recoveryCodes)
        setStage('recovery')
      } else {
        setStage('done')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Invalid code')
      setStage('scan')
    }
  }

  const copySecret = () => {
    navigator.clipboard.writeText(secret)
    toast.success('Secret copied to clipboard')
  }

  const copyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'))
    toast.success('Recovery codes copied')
  }

  const downloadRecoveryCodes = () => {
    const blob = new Blob(
      [`PangoChain recovery codes for ${user?.email ?? 'your account'}\n`
        + `Generated ${new Date().toISOString()}\n`
        + `Each code works once. Keep them somewhere safe and offline.\n\n`
        + recoveryCodes.join('\n') + '\n'],
      { type: 'text/plain' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pangochain-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (user?.mfaEnabled && stage !== 'done') {
    return (
      <div className="card max-w-md mx-auto mt-16 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-6 h-6 text-gold-500" />
          <h2 className="font-serif font-bold text-xl text-gold-300">Two-Factor Authentication</h2>
        </div>
        <div className="flex items-center gap-2 text-emerald-400 bg-success/15 border border-success/30 rounded-xl px-4 py-3">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500" />
          <span className="text-sm font-medium">MFA is already enabled on this account.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="card max-w-md mx-auto mt-8 space-y-5">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-gold-500" />
        <div>
          <h2 className="font-serif font-bold text-xl text-gold-300">Enable Two-Factor Auth</h2>
          <p className="text-text-secondary text-sm">Required for Managing Partner and IT Admin roles</p>
        </div>
      </div>

      {stage === 'idle' && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Secure your account with TOTP-based two-factor authentication (RFC 6238).
            You'll need Google Authenticator, Authy, or any compatible TOTP app.
          </p>
          <button
            onClick={handleSetup}
            className="btn-primary w-full justify-center py-2.5"
          >
            <QrCode className="w-4 h-4" />
            Generate QR Code
          </button>
        </div>
      )}

      {stage === 'loading' && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-gold-500" />
        </div>
      )}

      {(stage === 'scan' || stage === 'error') && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Scan the QR code below with your authenticator app, then enter the 6-digit code to confirm.
          </p>

          {qrUri && (
            <div className="flex flex-col items-center gap-3 bg-navy-950/60 border border-gold-500/10 rounded-xl p-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUri)}`}
                alt="TOTP QR Code"
                className="rounded-lg border border-gold-500/20"
                width={180}
                height={180}
              />
              <div className="w-full">
                <p className="text-xs text-text-secondary mb-1">Manual entry key:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-navy-950 border border-gold-500/20 rounded-lg px-2.5 py-1.5 font-mono break-all text-gold-300">
                    {secret}
                  </code>
                  <button onClick={copySecret} className="p-1.5 hover:bg-navy-900 rounded-lg border border-gold-500/20 text-gold-400 hover:text-gold-300 transition-colors">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-3">
            <div>
              <label className="label">Enter 6-digit code from app</label>
              <input
                type="text"
                className="input text-center text-2xl tracking-widest text-gold-300 font-mono"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                autoFocus
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-rose-400 bg-error/15 border border-error/30 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={code.length < 6}
              className="btn-primary w-full justify-center py-2.5 disabled:opacity-50"
            >
              Verify & Enable MFA
            </button>
          </form>
        </div>
      )}

      {stage === 'recovery' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-gold-400">
            <KeyRound className="w-5 h-5 text-gold-500" />
            <p className="font-semibold text-text-primary">Save your recovery codes</p>
          </div>
          <div className="rounded-xl bg-gold-500/10 border border-gold-500/20 px-4 py-3 text-sm text-gold-300 leading-relaxed">
            Store these somewhere safe. Each code works <strong>once</strong> and lets you sign in if you
            lose your authenticator. They will <strong>not</strong> be shown again.
          </div>
          <div className="grid grid-cols-2 gap-2 bg-navy-950/60 border border-gold-500/10 rounded-xl p-4">
            {recoveryCodes.map((c) => (
              <code key={c} className="text-sm font-mono text-gold-300 tracking-wide text-center py-1">{c}</code>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={copyRecoveryCodes} className="btn-secondary flex-1 justify-center py-2">
              <Copy className="w-4 h-4" /> Copy
            </button>
            <button onClick={downloadRecoveryCodes} className="btn-secondary flex-1 justify-center py-2">
              <Download className="w-4 h-4" /> Download
            </button>
          </div>
          <button onClick={() => setupToken ? navigate('/dashboard') : setStage('done')} className="btn-primary w-full justify-center py-2.5">
            I've saved my recovery codes
          </button>
        </div>
      )}

      {stage === 'done' && (
        <div className="flex flex-col items-center gap-3 py-4">
          <CheckCircle className="w-12 h-12 text-emerald-400" />
          <p className="font-semibold text-text-primary">MFA enabled successfully!</p>
          <p className="text-sm text-text-muted text-center">
            You'll be asked for a 6-digit code from your authenticator app each time you log in.
          </p>
          {setupToken && (
            <button onClick={() => navigate('/dashboard')} className="btn-primary w-full justify-center py-2.5 mt-2">
              Continue to Dashboard
            </button>
          )}
        </div>
      )}
    </div>
  )
}
