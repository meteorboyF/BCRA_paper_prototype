import { useEffect, useState } from 'react'
import JSZip from 'jszip'
import { X, Archive, Loader2, Lock, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { loadWrappedPrivateKey, unwrapPrivateKey, derivePbkdf2Key, bytesToBase64 } from '../lib/crypto'
import { decryptDocumentToBytes } from '../lib/decryptDoc'
import toast from 'react-hot-toast'

interface DocItem { id: string; fileName: string; documentHash?: string; documentHashSha256?: string }

interface Props {
  caseId: string
  caseTitle: string
  onClose: () => void
}

export function CaseArchiveModal({ caseId, caseTitle, onClose }: Props) {
  const { user } = useAuthStore()
  const [documents, setDocuments] = useState<DocItem[]>([])
  const [password, setPassword] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    api.get<DocItem[]>(`/documents/by-case/${caseId}`)
      .then((r) => setDocuments(r.data ?? []))
      .catch(() => { /* empty list handled in UI */ })
  }, [caseId])

  /** AES-256-GCM encrypt bytes under a passphrase-derived key; returns iv+ciphertext bytes. */
  const encryptUnderPassphrase = async (bytes: ArrayBuffer, saltB64: string) => {
    const key = await derivePbkdf2Key(passphrase, saltB64)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes)
    const out = new Uint8Array(iv.length + ct.byteLength)
    out.set(iv, 0)
    out.set(new Uint8Array(ct), iv.length)
    return out
  }

  const build = async () => {
    setBusy(true)
    setError('')
    try {
      const stored = loadWrappedPrivateKey(user!.id)
      if (!stored) { setError('No private key on this device — log in again to provision your keys.'); setBusy(false); return }
      let privateKey: CryptoKey
      try {
        privateKey = await unwrapPrivateKey(password, stored.saltB64, stored.ivB64, stored.encryptedB64)
      } catch {
        setError('Incorrect password — your private key could not be unlocked.'); setBusy(false); return
      }

      const zip = new JSZip()
      const folder = zip.folder('documents')!
      const encrypted = passphrase.trim().length > 0
      const saltB64 = encrypted ? bytesToBase64(crypto.getRandomValues(new Uint8Array(32))) : ''

      let included = 0
      let skipped = 0
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i]
        setProgress(`Decrypting ${i + 1}/${documents.length}: ${doc.fileName}`)
        let bytes: ArrayBuffer
        try {
          bytes = await decryptDocumentToBytes(doc.id, privateKey, doc.documentHashSha256 ?? doc.documentHash)
        } catch (err: any) {
          if (err.message === 'INTEGRITY_FAILED') throw err // tampering → abort the whole archive
          skipped++ // not shared with this user / key mismatch → omit
          continue
        }
        if (encrypted) {
          folder.file(doc.fileName + '.enc', await encryptUnderPassphrase(bytes, saltB64))
        } else {
          folder.file(doc.fileName, bytes)
        }
        included++
      }
      if (included === 0) { setError('None of the case documents could be decrypted with your key.'); setBusy(false); return }

      // On-Chain Permanence Certificate (server-generated from the ledger)
      setProgress('Fetching On-Chain Permanence Certificate…')
      const certRes = await api.get(`/cases/${caseId}/archive/permanence-certificate`, { responseType: 'arraybuffer' })
      zip.file('PERMANENCE-CERTIFICATE.pdf', certRes.data)

      // Human-readable summary + decryption note
      const summary =
        `PangoChain Case Archive\n=======================\n\n` +
        `Case: ${caseTitle}\nExported: ${new Date().toISOString()}\n` +
        `Documents included: ${included}${skipped > 0 ? ` (${skipped} omitted — not shared with your key)` : ''}\n\n` +
        (encrypted
          ? `These documents are encrypted with your passphrase (AES-256-GCM, PBKDF2-SHA-256).\n` +
            `Each .enc file is [12-byte IV] + ciphertext. PBKDF2 salt (base64): ${saltB64}\n`
          : `These documents are stored decrypted. Keep this archive secure.\n`) +
        `\nVerify integrity by recomputing each document's SHA-256 and comparing it to the\n` +
        `value in PERMANENCE-CERTIFICATE.pdf, which lists the Fabric transaction IDs.\n`
      zip.file('CASE-SUMMARY.txt', summary)

      setProgress('Assembling archive…')
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `case-archive_${caseTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.zip`
      a.click()
      URL.revokeObjectURL(url)

      setDone(true)
      toast.success('Case archive downloaded')
    } catch (e: any) {
      setError(e.message === 'INTEGRITY_FAILED'
        ? 'A document failed integrity verification against the ledger — archive aborted.'
        : (e.response?.data?.detail ?? e.message ?? 'Archive generation failed'))
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-0 border border-gold-500/20 shadow-gold-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gold-500/10">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-gold-500" />
            <h2 className="font-serif font-semibold text-lg text-gold-300">Download Case Archive</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-navy-950/60 rounded-lg text-text-secondary hover:text-text-primary transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            A portable ZIP of your {documents.length} case document(s), a case summary, and an
            On-Chain Permanence Certificate listing every Fabric transaction ID for independent
            verification.
          </p>

          <div>
            <label className="label">Password (to unlock your key for decryption)</label>
            <input type="password" className="input font-mono" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <label className="label">Archive passphrase (optional — encrypts the documents)</label>
            <input type="password" className="input font-mono" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="Leave blank to store decrypted" />
          </div>

          <div className="flex items-start gap-1.5 text-[11px] text-text-secondary leading-relaxed">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gold-400" />
            Documents are decrypted in your browser and verified against the ledger hash before bundling. The server never receives plaintext.
          </div>

          {progress && <div className="flex items-center gap-2 text-sm text-gold-400"><Loader2 className="w-4 h-4 animate-spin text-gold-500" /> {progress}</div>}
          {done && <div className="flex items-center gap-2 text-sm text-emerald-400"><CheckCircle className="w-4 h-4 text-emerald-500" /> Archive downloaded.</div>}
          {error && <div className="flex items-center gap-2 text-rose-400 text-xs bg-error/15 border border-error/30 rounded-lg px-3 py-2"><AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" /> {error}</div>}
        </div>

        <div className="flex gap-3 p-5 pt-0 bg-navy-950/20">
          <button onClick={onClose} className="flex-1 btn-secondary py-2.5">Close</button>
          <button onClick={build} disabled={busy || !password} className="flex-1 btn-primary py-2.5 justify-center disabled:opacity-50">
            {busy ? <><Loader2 className="w-4 h-4 animate-spin text-navy-950" /> Building…</> : <><Lock className="w-4 h-4" /> Download Archive</>}
          </button>
        </div>
      </div>
    </div>
  )
}
