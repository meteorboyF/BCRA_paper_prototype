import { useEffect, useState } from 'react'
import { X, PenTool, Loader2, CheckCircle2, Circle, Download, Plus, AlertCircle, ArrowUp } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore, isClient } from '../store/authStore'
import { loadWrappedEcdsaKey, unwrapEcdsaPrivateKey, signDocumentHash, bytesToBase64 } from '../lib/crypto'
import toast from 'react-hot-toast'

interface Signer {
  id: string
  signerId: string
  signerName: string
  signerEmail: string
  signOrder: number
  status: 'PENDING' | 'SIGNED' | 'DECLINED'
  signedAt?: string
  isYourTurn: boolean
}
interface Workflow {
  id: string
  documentId: string
  caseId?: string
  title: string
  documentHashB64: string
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED'
  createdAt: string
  completedAt?: string
  signers: Signer[]
}
interface Member { userId: string; fullName: string; email: string; hasPublicKey: boolean }

interface Props {
  docId: string
  caseId: string
  fileName: string
  onClose: () => void
}

export function SignatureWorkflowModal({ docId, caseId, fileName, onClose }: Props) {
  const { user } = useAuthStore()
  const canInitiate = user ? !isClient(user.role) : false
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [orderedSigners, setOrderedSigners] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [signingId, setSigningId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const [wfRes, memRes] = await Promise.all([
        api.get<Workflow[]>(`/signing-workflows/by-document/${docId}`),
        api.get<Member[]>(`/cases/${caseId}/members`).catch(() => ({ data: [] as Member[] })),
      ])
      setWorkflows(wfRes.data ?? [])
      setMembers((memRes.data ?? []).filter((m) => m.hasPublicKey))
    } catch {
      setError('Failed to load signing workflows')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [docId, caseId])

  const toggleSigner = (id: string) =>
    setOrderedSigners((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const initiate = async () => {
    if (!title.trim() || orderedSigners.length === 0) return
    setBusy('create')
    try {
      await api.post('/signing-workflows', { documentId: docId, caseId, title, signerIds: orderedSigners })
      setTitle(''); setOrderedSigners([]); setCreating(false)
      toast.success('Signing workflow started')
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Failed to start workflow')
    } finally {
      setBusy(null)
    }
  }

  const sign = async (wf: Workflow) => {
    if (!password) { setError('Enter your password to unlock your signing key'); return }
    setBusy(wf.id)
    setError('')
    try {
      const stored = loadWrappedEcdsaKey(user!.id)
      if (!stored) throw new Error('No signing key on this device — re-register to enable ECDSA signing.')
      const ecdsaKey = await unwrapEcdsaPrivateKey(password, stored.saltB64, stored.ivB64, stored.encryptedB64)

      // Composite must match the server: SHA-256( documentHashB64 | workflowId | signerId )
      const composite = `${wf.documentHashB64}|${wf.id}|${user!.id}`
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(composite))
      const compositeB64 = bytesToBase64(new Uint8Array(digest))
      const signatureB64 = await signDocumentHash(compositeB64, ecdsaKey)

      await api.post(`/signing-workflows/${wf.id}/sign`, { signatureB64 })
      setPassword(''); setSigningId(null)
      toast.success('Signed')
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail ?? e.message ?? 'Signing failed')
    } finally {
      setBusy(null)
    }
  }

  const downloadCertificate = async (wf: Workflow) => {
    try {
      const res = await api.get(`/signing-workflows/${wf.id}/certificate`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url; a.download = `signing-certificate_${wf.id.slice(0, 8)}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to download certificate')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg max-h-[90vh] flex flex-col p-0 border border-gold-500/20 shadow-gold-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gold-500/10">
          <div className="flex items-center gap-2 min-w-0">
            <PenTool className="w-5 h-5 text-gold-500 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-serif font-semibold text-lg text-gold-300 truncate">Signature Workflow</h2>
              <p className="text-xs text-text-secondary truncate">{fileName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-navy-950/60 rounded-lg text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
          {error && (
            <div className="flex items-center gap-2 text-rose-400 text-xs bg-error/15 border border-error/30 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" /> {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gold-500" /></div>
          ) : (
            <>
              {canInitiate && (
                creating ? (
                  <div className="border border-gold-500/20 rounded-xl p-4 space-y-3 bg-navy-950/40">
                    <div>
                      <label className="label">Workflow title</label>
                      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Settlement agreement execution" />
                    </div>
                    <div>
                      <label className="label">Signatories (click in signing order)</label>
                      <div className="border border-gold-500/15 rounded-lg divide-y divide-gold-500/10 max-h-44 overflow-y-auto scrollbar-thin">
                        {members.length === 0 && <p className="text-text-muted text-xs p-2">No case members with keys.</p>}
                        {members.map((m) => {
                          const idx = orderedSigners.indexOf(m.userId)
                          return (
                            <button key={m.userId} onClick={() => toggleSigner(m.userId)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${idx >= 0 ? 'bg-gold-500/10' : 'hover:bg-navy-900/40'}`}>
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                idx >= 0 
                                  ? 'bg-gold-500 text-navy-950 shadow-gold-sm' 
                                  : 'bg-navy-950 border border-gold-500/20 text-text-muted'
                              }`}>
                                {idx >= 0 ? idx + 1 : ''}
                              </span>
                              <span className="truncate text-text-secondary hover:text-text-primary transition-colors">{m.fullName}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setCreating(false); setOrderedSigners([]) }} className="btn-secondary py-2 flex-1">Cancel</button>
                      <button onClick={initiate} disabled={busy === 'create' || !title.trim() || orderedSigners.length === 0} className="btn-primary py-2 flex-1 justify-center disabled:opacity-50">
                        {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Workflow'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setCreating(true)} className="btn-primary w-full justify-center py-2.5">
                    <Plus className="w-4 h-4" /> New Signing Workflow
                  </button>
                )
              )}

              {workflows.length === 0 && !creating && (
                <p className="text-text-secondary text-sm text-center py-4">No signing workflows on this document.</p>
              )}

              {workflows.map((wf) => (
                <div key={wf.id} className="border border-gold-500/10 bg-navy-950/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-text-primary text-sm">{wf.title}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      wf.status === 'COMPLETED' 
                        ? 'bg-success/15 text-emerald-400 border-success/30' 
                        : 'bg-gold-500/10 text-gold-300 border-gold-500/20'
                    }`}>{wf.status}</span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {wf.signers.map((s) => (
                      <div key={s.id} className="flex items-center gap-2.5 text-sm">
                        <span className="w-5 h-5 rounded-full bg-navy-950 border border-gold-500/20 text-gold-400 flex items-center justify-center text-[10px] font-bold shrink-0">{s.signOrder + 1}</span>
                        {s.status === 'SIGNED'
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          : <Circle className="w-4 h-4 text-gold-500/30 shrink-0" />}
                        <span className="text-text-secondary truncate flex-1">{s.signerName}</span>
                        {s.isYourTurn && <span className="flex items-center gap-1 text-[10px] font-bold text-gold-400 animate-pulse"><ArrowUp className="w-3 h-3 text-gold-500" /> Your turn</span>}
                      </div>
                    ))}
                  </div>

                  {wf.signers.some((s) => s.isYourTurn) && (
                    <div className="mt-3 space-y-2">
                      {signingId === wf.id ? (
                        <>
                          <input type="password" className="input font-mono" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password to unlock signing key" />
                          <div className="flex gap-2">
                            <button onClick={() => { setSigningId(null); setPassword('') }} className="btn-secondary py-1.5 flex-1 text-sm">Cancel</button>
                            <button onClick={() => sign(wf)} disabled={busy === wf.id || !password} className="btn-primary py-1.5 flex-1 justify-center text-sm disabled:opacity-50">
                              {busy === wf.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><PenTool className="w-3.5 h-3.5" /> Sign</>}
                            </button>
                          </div>
                        </>
                      ) : (
                        <button onClick={() => setSigningId(wf.id)} className="btn-primary w-full justify-center py-1.5 text-sm">
                          <PenTool className="w-3.5 h-3.5" /> Sign Now
                        </button>
                      )}
                    </div>
                  )}

                  {wf.status === 'COMPLETED' && (
                    <button onClick={() => downloadCertificate(wf)} className="mt-3 btn-secondary w-full justify-center py-1.5 text-sm flex gap-2">
                      <Download className="w-3.5 h-3.5" /> Signing Certificate
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
