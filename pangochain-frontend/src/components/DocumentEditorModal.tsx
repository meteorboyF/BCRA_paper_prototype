import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Eye, Loader2, Lock, CheckCircle, AlertCircle, Save } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { loadWrappedPrivateKey, unwrapPrivateKey, encryptDocument, eciesWrapKey, verifyIntegrity } from '../lib/crypto'
import { decryptDocumentToBytes } from '../lib/decryptDoc'
import { extractEditableText, type SourceFormat } from './RedactionModal'
import toast from 'react-hot-toast'

interface Props {
  docId: string
  caseId: string
  fileName: string
  category?: string
  version?: number
  documentHashSha256?: string
  onClose: () => void
  onSaved?: () => void
}

type Stage = 'unlock' | 'editing' | 'saving' | 'done' | 'error'

function normalizeEditedName(fileName: string, nextVersion: number, format: SourceFormat) {
  const cleaned = fileName
    .replace(/\s+v\d+\s+(edited|redacted)/ig, '')
    .replace(/\s*\((edited|redacted)\)/ig, '')
  const base = cleaned.replace(/\.[^.]+$/, '')
  const ext = format === 'docx' ? '.txt' : (cleaned.match(/(\.[^.]+)$/)?.[1] ?? '.txt')
  return `${base} v${nextVersion} edited${ext}`
}

export function DocumentEditorModal({
  docId, caseId, fileName, category, version = 1, documentHashSha256, onClose, onSaved,
}: Props) {
  const { user } = useAuthStore()
  const [password, setPassword] = useState('')
  const [stage, setStage] = useState<Stage>('unlock')
  const [text, setText] = useState('')
  const [originalText, setOriginalText] = useState('')
  const [sourceFormat, setSourceFormat] = useState<SourceFormat>('text')
  const [error, setError] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)

  const open = async () => {
    setError('')
    try {
      const stored = loadWrappedPrivateKey(user!.id)
      if (!stored) { setError('No private key on this device. Log in again to provision your keys.'); return }
      let privateKey: CryptoKey
      try {
        privateKey = await unwrapPrivateKey(password, stored.saltB64, stored.ivB64, stored.encryptedB64)
      } catch {
        setError('Incorrect password. Your private key could not be unlocked.'); return
      }
      const bytes = await decryptDocumentToBytes(docId, privateKey, documentHashSha256)
      const extracted = await extractEditableText(bytes, fileName)
      setText(extracted.text)
      setOriginalText(extracted.text)
      setSourceFormat(extracted.format)
      setStage('editing')
      setTimeout(() => taRef.current?.focus(), 50)
    } catch (e: any) {
      setError(e.message === 'INTEGRITY_FAILED'
        ? 'Document failed integrity verification against the ledger.'
        : (e.response?.data?.detail ?? e.message ?? 'Failed to open document'))
      setStage('error')
    }
  }

  const save = async () => {
    if (text === originalText) { setError('Make an edit before saving a new version.'); return }
    setStage('saving')
    setError('')
    try {
      const buffer = new TextEncoder().encode(text).buffer as ArrayBuffer
      const encrypted = await encryptDocument(buffer)
      if (documentHashSha256 && await verifyIntegrity(buffer, documentHashSha256)) {
        setStage('editing')
        setError('The edited copy has the same hash as the original. Change the document before saving.')
        return
      }

      let wrappedKeyToken = encrypted.keyB64
      try {
        const pkRes = await api.get(`/users/${user!.id}/public-key`)
        const ownerPubKeyJwk: JsonWebKey = JSON.parse(pkRes.data.publicKeyJwk)
        wrappedKeyToken = await eciesWrapKey(ownerPubKeyJwk, encrypted.keyB64)
      } catch { /* demo raw-key fallback */ }

      await api.post('/documents/upload', {
        caseId,
        fileName: normalizeEditedName(fileName, version + 1, sourceFormat),
        ciphertextBase64: encrypted.ciphertextB64,
        ivBase64: encrypted.ivB64,
        documentHashSha256: encrypted.hashB64,
        wrappedKeyTokenForOwner: wrappedKeyToken,
        previousVersionId: docId,
        category: category ?? 'GENERAL',
      })

      setStage('done')
      toast.success('Edited version saved with a new hash')
      onSaved?.()
    } catch (e: any) {
      setStage('error')
      setError(e.response?.data?.detail ?? e.message ?? 'Failed to save edited version')
    }
  }

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="card w-full max-w-3xl max-h-[92vh] flex flex-col p-0 border border-gold-500/20 shadow-gold-md overflow-hidden bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gold-500/10">
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="w-5 h-5 text-gold-500 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-serif font-semibold text-lg text-gold-300 truncate">Browser Document Editor</h2>
              <p className="text-xs text-text-secondary truncate">{fileName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-navy-950/60 rounded-lg text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
          {(stage === 'unlock' || (stage === 'error' && !text)) && (
            <div className="space-y-3">
              <label className="label">Password to decrypt this document</label>
              <input type="password" className="input font-mono" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              {error && <div className="flex items-center gap-2 text-rose-400 text-xs bg-error/15 border border-error/30 rounded-lg px-3 py-2"><AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" /> {error}</div>}
              <button onClick={open} disabled={!password} className="btn-primary w-full justify-center py-2.5 disabled:opacity-50">
                <Lock className="w-4 h-4" /> Open in Browser
              </button>
            </div>
          )}

          {(stage === 'editing' || stage === 'saving' || (stage === 'error' && text)) && (
            <div className="space-y-3">
              <p className="text-xs text-text-secondary">
                Edits are made locally in your browser. Saving creates v{version + 1} with a fresh hash.
                {sourceFormat === 'docx' ? ' Word files are saved as edited text copies.' : ''}
              </p>
              <textarea
                ref={taRef}
                className="input font-mono text-xs leading-relaxed min-h-[380px] bg-navy-950 text-text-primary border-gold-500/20"
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
              />
              {error && <div className="flex items-center gap-2 text-rose-400 text-xs bg-error/15 border border-error/30 rounded-lg px-3 py-2"><AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" /> {error}</div>}
            </div>
          )}

          {stage === 'done' && (
            <div className="flex items-center gap-2 text-sm text-emerald-400 py-6 justify-center bg-success/15 border border-success/30 rounded-xl">
              <CheckCircle className="w-5 h-5 text-emerald-500" /> New document version saved.
            </div>
          )}
        </div>

        {(stage === 'editing' || stage === 'saving' || (stage === 'error' && text)) && (
          <div className="flex gap-3 p-5 pt-0 bg-navy-950/20">
            <button onClick={onClose} className="flex-1 btn-secondary py-2.5">Cancel</button>
            <button onClick={save} disabled={stage === 'saving' || text === originalText} className="flex-1 btn-primary py-2.5 justify-center disabled:opacity-50">
              {stage === 'saving' ? <><Loader2 className="w-4 h-4 animate-spin text-navy-950" /> Saving...</> : <><Save className="w-4 h-4" /> Save v{version + 1}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
