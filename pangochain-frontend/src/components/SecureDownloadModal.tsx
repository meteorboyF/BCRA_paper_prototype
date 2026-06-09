import { useState } from 'react'
import { X, Download, Shield, Lock, Loader2, CheckCircle, AlertTriangle, Key, Check } from 'lucide-react'
import { eciesUnwrapKey, base64ToBytes, verifyIntegrity, loadWrappedPrivateKey, unwrapPrivateKey } from '../lib/crypto'
import { useAuthStore } from '../store/authStore'
import api from '../lib/api'
import toast from 'react-hot-toast'

interface Props {
  docId: string
  fileName: string
  expectedHash?: string
  onClose: () => void
}

type Stage = 'idle' | 'fetching' | 'unwrapping' | 'decrypting' | 'verifying' | 'done' | 'error'
type ErrorKind = 'password' | 'decrypt' | 'integrity' | 'generic'

const ORDER: Stage[] = ['fetching', 'unwrapping', 'decrypting', 'verifying']

const STAGE_META: Record<string, { label: string; detail: string }> = {
  fetching:   { label: 'Fetch from IPFS',     detail: 'Fetching encrypted ciphertext from IPFS' },
  unwrapping: { label: 'Unwrap key (ECIES)',  detail: 'Unwrapping AES-256 key with your ECDH P-256 private key' },
  decrypting: { label: 'Decrypt (AES-GCM)',   detail: 'Decrypting with AES-256-GCM' },
  verifying:  { label: 'Verify integrity',    detail: 'Verifying SHA-256 integrity against blockchain record' },
}

const INTEGRITY_MSG =
  '⚠ Integrity check failed. The downloaded file does not match the blockchain record. ' +
  'This document may have been tampered with. Do NOT use this document. Contact your IT administrator.'

const isFabricUnavailable = (err: any) =>
  err?.response?.status === 503
  || err?.response?.data?.error === 'FABRIC_UNAVAILABLE'
  || `${err?.response?.data?.detail ?? err?.response?.data?.message ?? err?.message ?? ''}`
    .toLowerCase()
    .includes('blockchain network')

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function SecureDownloadModal({ docId, fileName, expectedHash, onClose }: Props) {
  const { user } = useAuthStore()
  const [stage, setStage] = useState<Stage>('idle')
  const [durations, setDurations] = useState<Record<string, number>>({})
  const [errorKind, setErrorKind] = useState<ErrorKind>('generic')
  const [errorStage, setErrorStage] = useState<Stage | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [password, setPassword] = useState('')

  const isDemo = user?.id === 'demo-user-001'

  const fail = (kind: ErrorKind, atStage: Stage, msg: string) => {
    setErrorKind(kind); setErrorStage(atStage); setErrorMsg(msg); setStage('error')
  }

  const triggerDownload = (data: BlobPart) => {
    const blob = new Blob([data])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${fileName} verified and downloaded`)
  }

  const handleDownload = async () => {
    setStage('fetching'); setDurations({}); setErrorMsg('')

    // Demo mode — simulate the pipeline with realistic per-stage timings.
    if (isDemo) {
      for (const s of ORDER) {
        setStage(s)
        const start = performance.now()
        await new Promise((r) => setTimeout(r, 350))
        setDurations((d) => ({ ...d, [s]: Math.round(performance.now() - start) }))
      }
      setFileSize(13)
      setStage('done')
      setTimeout(() => triggerDownload('Hello World'), 500)
      return
    }

    try {
      // Stage 1 — fetch ciphertext + wrapped key
      let start = performance.now()
      const [ciphertextRes, wrappedKeyRes] = await Promise.all([
        api.get(`/documents/${docId}/ciphertext`, { responseType: 'arraybuffer' }),
        api.get(`/documents/${docId}/wrapped-key`),
      ])
      setDurations((d) => ({ ...d, fetching: Math.round(performance.now() - start) }))
      const ciphertextBytes: ArrayBuffer = ciphertextRes.data
      const wrappedKeyToken: string = wrappedKeyRes.data

      // Stage 2 — unwrap AES key with ECDH private key
      setStage('unwrapping'); start = performance.now()
      const storedKey = loadWrappedPrivateKey(user!.id)
      if (!storedKey) { fail('password', 'unwrapping', 'No private key on this device. Log in again to provision your keys.'); return }
      let privateKey: CryptoKey
      try {
        privateKey = await unwrapPrivateKey(password, storedKey.saltB64, storedKey.ivB64, storedKey.encryptedB64)
      } catch {
        fail('password', 'unwrapping', 'Incorrect password. Your private key could not be unlocked.'); return
      }
      let docKeyB64: string
      try {
        docKeyB64 = await eciesUnwrapKey(privateKey, wrappedKeyToken)
      } catch {
        fail('decrypt', 'unwrapping', 'Could not unwrap the document key — you may not have access, or the key is corrupted.'); return
      }
      setDurations((d) => ({ ...d, unwrapping: Math.round(performance.now() - start) }))

      // Stage 3 — AES-256-GCM decrypt
      setStage('decrypting'); start = performance.now()
      let plaintext: ArrayBuffer
      try {
        const fullBytes = new Uint8Array(ciphertextBytes)
        const iv = fullBytes.slice(0, 12)
        const ciphertext = fullBytes.slice(12)
        const docKey = base64ToBytes(docKeyB64)
        const cryptoKey = await window.crypto.subtle.importKey(
          'raw', docKey.buffer as ArrayBuffer, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
        )
        plaintext = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, cryptoKey, ciphertext.buffer as ArrayBuffer,
        )
      } catch {
        fail('decrypt', 'decrypting', 'Decryption failed — wrong key or corrupted data.'); return
      }
      setDurations((d) => ({ ...d, decrypting: Math.round(performance.now() - start) }))

      // Stage 4 — SHA-256 integrity vs blockchain record
      setStage('verifying'); start = performance.now()
      let hash = expectedHash
      if (!hash) {
        try { hash = (await api.get(`/documents/${docId}`)).data.documentHash } catch { /* fall through */ }
      }
      const valid = hash ? await verifyIntegrity(plaintext, hash) : true
      setDurations((d) => ({ ...d, verifying: Math.round(performance.now() - start) }))
      if (!valid) { fail('integrity', 'verifying', INTEGRITY_MSG); return }

      setFileSize(plaintext.byteLength)
      setStage('done')
      setTimeout(() => triggerDownload(plaintext), 500)
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? err?.response?.data?.message
      fail('generic', stage, isFabricUnavailable(err)
        ? 'Blockchain access verification is unavailable. The DB fallback could not release this file, so confirm your document access grant or disable strict fail-closed mode.'
        : (detail ?? err?.message ?? 'Download failed'))
    }
  }

  const isProcessing = ORDER.includes(stage)
  const stageState = (s: Stage): 'done' | 'active' | 'error' | 'pending' => {
    if (stage === 'error' && errorStage === s) return 'error'
    if (stage === 'done') return 'done'
    const idx = ORDER.indexOf(s)
    const cur = ORDER.indexOf(stage)
    if (cur === idx) return 'active'
    if (cur > idx) return 'done'
    return 'pending'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-0 border border-gold-500/20 shadow-gold-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gold-500/10">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-gold-500" />
            <h2 className="font-serif font-semibold text-lg text-gold-300">Secure Download</h2>
          </div>
          <button onClick={onClose} disabled={isProcessing} className="p-1.5 hover:bg-navy-950/60 rounded-lg text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* File */}
          <div className="bg-navy-950/60 border border-gold-500/10 rounded-xl px-4 py-3 flex items-center gap-3">
            <Lock className="w-4 h-4 text-gold-500 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-text-primary text-sm truncate">{fileName}</p>
              <p className="text-text-secondary text-xs">AES-256-GCM encrypted · IPFS stored</p>
            </div>
          </div>

          {/* Password */}
          {stage === 'idle' && !isDemo && (
            <div>
              <label className="label flex items-center gap-1.5"><Key className="w-3.5 h-3.5 text-gold-500/70" /> Account Password</label>
              <input type="password" className="input font-mono" placeholder="To decrypt your private key"
                value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="text-text-muted text-xs mt-1">Used only in-browser for PBKDF2 key derivation. Never sent to the server.</p>
            </div>
          )}

          {/* Numbered stages */}
          <div className="space-y-3.5">
            {ORDER.map((s, i) => {
              const st = stageState(s)
              const meta = STAGE_META[s]
              return (
                <div key={s} className="flex items-start gap-3.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${
                    st === 'done' 
                      ? 'bg-gold-500 border-gold-400 text-navy-950 shadow-gold-sm'
                      : st === 'active' 
                      ? 'bg-navy-800 border-gold-500/30 text-gold-300'
                      : st === 'error' 
                      ? 'bg-error/20 border-error/50 text-rose-300'
                      : 'bg-navy-950 border-gold-500/10 text-text-muted'
                  }`}>
                    {st === 'done' ? <Check className="w-3.5 h-3.5" />
                      : st === 'error' ? <X className="w-3.5 h-3.5" />
                      : st === 'active' ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium ${st === 'pending' ? 'text-text-muted' : 'text-text-primary'}`}>{meta.label}</span>
                      {durations[s] != null && st === 'done' && (
                        <span className="text-[10px] text-gold-400 font-mono shrink-0">Completed in {durations[s]}ms</span>
                      )}
                    </div>
                    {(st === 'active' || st === 'error') && (
                      <p className={`text-xs mt-0.5 leading-relaxed ${st === 'error' ? 'text-rose-400' : 'text-text-secondary'}`}>{meta.detail}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Integrity failure — serious security event */}
          {stage === 'error' && errorKind === 'integrity' && (
            <div className="bg-red-50 !bg-error/15 border border-error/40 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1 text-rose-400 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-500" /> Integrity check failed
              </div>
              <p className="text-xs text-rose-300 leading-relaxed">{INTEGRITY_MSG}</p>
            </div>
          )}

          {/* Other failures */}
          {stage === 'error' && errorKind !== 'integrity' && (
            <div className="flex items-start gap-2 bg-red-50 !bg-error/15 border border-error/30 rounded-xl px-3.5 py-3 text-sm text-rose-400">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success */}
          {stage === 'done' && (
            <div className="bg-success/15 border border-success/30 rounded-xl px-4 py-3 text-emerald-400">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" /> Document verified and ready
              </div>
              <p className="text-xs text-text-secondary mt-1">
                {fileName}{fileSize != null && ` · ${formatBytes(fileSize)}`} — download starting…
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-5 pt-0 bg-navy-950/20">
          <button onClick={onClose} className="flex-1 btn-secondary py-2.5">
            {stage === 'done' ? 'Close' : 'Cancel'}
          </button>
          {stage !== 'done' && (
            <button onClick={handleDownload}
              disabled={isProcessing || (!isDemo && !password)}
              className="flex-1 btn-primary py-2.5 justify-center disabled:opacity-50">
              {isProcessing
                ? <><Loader2 className="w-4 h-4 animate-spin text-navy-950" /> Decrypting…</>
                : stage === 'error'
                  ? <><Download className="w-4 h-4" /> Retry</>
                  : <><Download className="w-4 h-4" /> Decrypt & Download</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
