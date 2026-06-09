import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, FileStack, Loader2, Lock, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { loadWrappedPrivateKey, unwrapPrivateKey, bytesToBase64 } from '../lib/crypto'
import { decryptDocumentToBytes, bytesToTextIfPrintable } from '../lib/decryptDoc'
import toast from 'react-hot-toast'

interface DocItem {
  id: string
  fileName: string
  ipfsCid?: string
  documentHash?: string
  documentHashSha256?: string
}

interface Props {
  caseId: string
  documents: DocItem[]
  onClose: () => void
}

const BUNDLE_TYPES = ['Evidence Bundle', 'Discovery Bundle']
const isDemoDoc = (doc?: DocItem) => !!doc?.ipfsCid?.startsWith('QmDemo')

async function describeApiError(error: any): Promise<string> {
  const data = error?.response?.data
  if (data instanceof Blob) {
    try {
      const text = await data.text()
      const parsed = JSON.parse(text)
      return parsed.detail ?? parsed.message ?? parsed.error ?? error.message ?? 'Request failed'
    } catch {
      return error.message ?? 'Request failed'
    }
  }
  return data?.detail ?? data?.message ?? data?.error ?? error?.message ?? 'Request failed'
}

function canIncludeByReference(error: any) {
  const status = error?.response?.status
  return status === 403 || status === 503 || error?.message === 'Network Error'
}

export function CourtBundleModal({ caseId, documents, onClose }: Props) {
  const { user } = useAuthStore()
  const safeDocuments = Array.isArray(documents) ? documents.filter((doc): doc is DocItem => !!doc?.id) : []
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bundleType, setBundleType] = useState(BUNDLE_TYPES[0])
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const generate = async () => {
    if (selected.size === 0) { setError('Select at least one document'); return }
    setBusy(true)
    setError('')
    try {
      // Decrypt each selected document locally; send plaintext only for textual docs
      const items: { documentId: string; plaintextBase64: string | null }[] = []
      const picks = safeDocuments.filter((d) => selected.has(d.id))
      if (picks.length === 0) { setError('Select at least one document'); setBusy(false); return }
      const realEncryptedPicks = picks.filter((d) => !isDemoDoc(d))
      let privateKey: CryptoKey | null = null
      if (realEncryptedPicks.length > 0) {
        const stored = user ? loadWrappedPrivateKey(user.id) : null
        if (!stored) { setError('No private key on this device — log in again to provision your keys.'); setBusy(false); return }
        try {
          privateKey = await unwrapPrivateKey(password, stored.saltB64, stored.ivB64, stored.encryptedB64)
        } catch {
          setError('Incorrect password — your private key could not be unlocked.'); setBusy(false); return
        }
      }
      const referenced: string[] = []
      for (let i = 0; i < picks.length; i++) {
        const doc = picks[i]
        if (isDemoDoc(doc)) {
          setProgress(`Adding reference ${i + 1}/${picks.length}: ${doc.fileName}`)
          items.push({ documentId: doc.id, plaintextBase64: null })
        } else {
          setProgress(`Decrypting ${i + 1}/${picks.length}: ${doc.fileName}`)
          try {
            const bytes = await decryptDocumentToBytes(doc.id, privateKey!, doc.documentHashSha256 ?? doc.documentHash)
            const text = bytesToTextIfPrintable(bytes)
            items.push({ documentId: doc.id, plaintextBase64: text != null ? bytesToBase64(new Uint8Array(bytes)) : null })
          } catch (docError: any) {
            if (docError?.message === 'INTEGRITY_FAILED') throw docError
            if (!canIncludeByReference(docError)) throw docError
            referenced.push(doc.fileName || 'Untitled document')
            items.push({ documentId: doc.id, plaintextBase64: null })
          }
        }
      }

      setProgress('Assembling court-ready PDF…')
      const res = await api.post('/bundles', { caseId, bundleType, items }, { responseType: 'blob' })
      const disposition = res.headers['content-disposition'] as string | undefined
      const fileName = disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? 'bundle.pdf'
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url; a.download = fileName; a.click()
      URL.revokeObjectURL(url)

      setDone(true)
      toast.success('Court bundle generated')
      if (referenced.length > 0) {
        toast(`Included ${referenced.length} document(s) by reference because encrypted content was unavailable.`)
      }
    } catch (e: any) {
      setError(e.message === 'INTEGRITY_FAILED'
        ? 'A document failed integrity verification against the ledger — bundle aborted.'
        : await describeApiError(e))
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  const selectedRealCount = safeDocuments.filter((d) => selected.has(d.id) && !isDemoDoc(d)).length

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[90vh] flex flex-col p-0 border border-gold-500/20 shadow-gold-md overflow-hidden bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gold-500/10">
          <div className="flex items-center gap-2">
            <FileStack className="w-5 h-5 text-gold-500" />
            <h2 className="font-serif font-semibold text-lg text-gold-300">Court-Ready Bundle</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-navy-950/60 rounded-lg text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto scrollbar-thin">
          <div>
            <label className="label">Bundle type</label>
            <select className="input bg-navy-950 text-text-primary border-gold-500/20" value={bundleType} onChange={(e) => setBundleType(e.target.value)}>
              {BUNDLE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Documents ({selected.size} selected)</label>
            <div className="border border-gold-500/15 rounded-xl divide-y divide-gold-500/10 bg-navy-950/40 max-h-52 overflow-y-auto scrollbar-thin">
              {safeDocuments.length === 0 && <p className="text-text-secondary text-sm p-3">No documents on this case.</p>}
              {safeDocuments.map((d) => (
                <label key={d.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-navy-900/40 transition-colors">
                  <input type="checkbox" className="rounded border-gold-500/30 text-gold-500 focus:ring-gold-500/30 bg-navy-950" checked={selected.has(d.id)} onChange={() => toggle(d.id)} />
                  <span className="text-sm text-text-primary truncate">{d.fileName || 'Untitled document'}</span>
                  {isDemoDoc(d) && <span className="text-[9px] text-gold-300 border border-gold-500/20 rounded px-1">reference</span>}
                </label>
              ))}
            </div>
          </div>

          <div className={selectedRealCount === 0 ? 'opacity-60' : ''}>
            <label className="label">Password (to unlock your key for decryption)</label>
            <input type="password" className="input font-mono" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={selectedRealCount === 0 ? 'not needed for reference docs' : '••••••••'} disabled={selectedRealCount === 0} />
          </div>

          <div className="flex items-start gap-1.5 text-[11px] text-text-secondary leading-relaxed">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gold-400" />
            Uploaded encrypted documents are decrypted in your browser. Demo/reference documents are bundled by metadata and integrity hash so the court packet still downloads cleanly.
          </div>

          {progress && <div className="flex items-center gap-2 text-sm text-gold-400"><Loader2 className="w-4 h-4 animate-spin text-gold-500" /> {progress}</div>}
          {done && <div className="flex items-center gap-2 text-sm text-emerald-400"><CheckCircle className="w-4 h-4 text-emerald-500" /> Bundle downloaded.</div>}
          {error && <div className="flex items-center gap-2 text-rose-400 text-xs bg-error/15 border border-error/30 rounded-lg px-3 py-2"><AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" /> {error}</div>}
        </div>

        <div className="flex gap-3 p-5 pt-0 bg-navy-950/20">
          <button onClick={onClose} className="flex-1 btn-secondary py-2.5">Close</button>
          <button onClick={generate} disabled={busy || selected.size === 0 || (selectedRealCount > 0 && !password)} className="flex-1 btn-primary py-2.5 justify-center disabled:opacity-50">
            {busy ? <><Loader2 className="w-4 h-4 animate-spin text-navy-950" /> Generating…</> : <><Lock className="w-4 h-4" /> Generate Bundle</>}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
