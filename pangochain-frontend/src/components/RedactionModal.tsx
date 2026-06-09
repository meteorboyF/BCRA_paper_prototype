import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Eraser, Loader2, Lock, CheckCircle, AlertCircle, ShieldCheck, Highlighter } from 'lucide-react'
import JSZip from 'jszip'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import {
  loadWrappedPrivateKey, unwrapPrivateKey, encryptDocument, eciesWrapKey, verifyIntegrity,
} from '../lib/crypto'
import { decryptDocumentToBytes, bytesToTextIfPrintable } from '../lib/decryptDoc'
import toast from 'react-hot-toast'

interface Props {
  docId: string
  caseId: string
  fileName: string
  category?: string
  version?: number
  ipfsCid?: string
  documentHashSha256?: string
  onClose: () => void
  onRedacted?: () => void
}

type Stage = 'unlock' | 'editing' | 'saving' | 'done' | 'error'
export type SourceFormat = 'text' | 'docx'

const BLOCK = '█'
const isDemoDoc = (ipfsCid?: string) => !!ipfsCid?.startsWith('QmDemo')
const WORD_EXT_RE = /\.docx$/i
const LEGACY_WORD_EXT_RE = /\.doc$/i

function demoRedactionText(fileName: string) {
  return [
    `PangoChain demo redaction worksheet for ${fileName}`,
    '',
    'Client: Marcus Chen',
    'Opposing party: Meridian Holdings Ltd.',
    'Privileged note: settlement authority currently ranges from $410,000 to $445,000.',
    'Sensitive identifier: MC-LEASE-2021-7784.',
    'Attorney work product: lead with notice defect, then payment cure, then business disruption.',
    '',
    'Select any sensitive phrase and click Redact selection. The saved copy will be encrypted as a new document version and linked to the original redaction record.',
  ].join('\n')
}

function decodeXmlEntities(value: string) {
  const doc = new DOMParser().parseFromString(`<root>${value}</root>`, 'application/xml')
  return doc.documentElement.textContent ?? value
}

export function normalizeRedactedName(fileName: string, nextVersion: number, format: SourceFormat) {
  const withoutRedactionSuffix = fileName
    .replace(/\s*\(redacted\)/ig, '')
    .replace(/\s+v\d+\s+redacted/ig, '')
  const base = withoutRedactionSuffix.replace(/\.[^.]+$/, '')
  const ext = format === 'docx' ? '.txt' : (withoutRedactionSuffix.match(/(\.[^.]+)$/)?.[1] ?? '.txt')
  return `${base} v${nextVersion} redacted${ext}`
}

async function extractDocxText(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer)
  const main = zip.file('word/document.xml')
  if (!main) throw new Error('This Word document has no editable document body.')
  const xml = await main.async('text')
  const paragraphs = xml
    .split(/<\/w:p>/i)
    .map((paragraph) => {
      const textRuns = [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gi)]
      return textRuns.map((match) => decodeXmlEntities(match[1])).join('')
    })
    .filter((line) => line.trim().length > 0)
  return paragraphs.join('\n')
}

export async function extractEditableText(buffer: ArrayBuffer, fileName: string): Promise<{ text: string; format: SourceFormat }> {
  if (WORD_EXT_RE.test(fileName)) {
    return { text: await extractDocxText(buffer), format: 'docx' }
  }
  if (LEGACY_WORD_EXT_RE.test(fileName)) {
    throw new Error('Legacy .doc files cannot be safely redacted in-browser. Convert the file to .docx, .txt, or .md first.')
  }
  const asText = bytesToTextIfPrintable(buffer)
  if (asText == null) {
    throw new Error('This document is not readable text. The redaction editor supports .txt, .md, and .docx documents.')
  }
  return { text: asText, format: 'text' }
}

export function RedactionModal({ docId, caseId, fileName, category, version = 1, ipfsCid, documentHashSha256, onClose, onRedacted }: Props) {
  const { user } = useAuthStore()
  const demoMode = isDemoDoc(ipfsCid)
  const [password, setPassword] = useState('')
  const [stage, setStage] = useState<Stage>(demoMode ? 'editing' : 'unlock')
  const [text, setText] = useState(demoMode ? demoRedactionText(fileName) : '')
  const [sourceFormat, setSourceFormat] = useState<SourceFormat>('text')
  const [redactions, setRedactions] = useState(0)
  const [error, setError] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)

  const unlock = async () => {
    setError('')
    if (demoMode) {
      setText((t) => t || demoRedactionText(fileName))
      setStage('editing')
      return
    }
    try {
      const stored = loadWrappedPrivateKey(user!.id)
      if (!stored) { setError('No private key on this device — log in again to provision your keys.'); return }
      let privateKey: CryptoKey
      try {
        privateKey = await unwrapPrivateKey(password, stored.saltB64, stored.ivB64, stored.encryptedB64)
      } catch {
        setError('Incorrect password — your private key could not be unlocked.'); return
      }
      const bytes = await decryptDocumentToBytes(docId, privateKey, documentHashSha256)
      const extracted = await extractEditableText(bytes, fileName)
      setText(extracted.text)
      setSourceFormat(extracted.format)
      setRedactions(0)
      setStage('editing')
    } catch (e: any) {
      setError(e.message === 'INTEGRITY_FAILED'
        ? 'Document failed integrity verification against the ledger.'
        : (e.response?.data?.detail ?? e.message ?? 'Failed to open document'))
    }
  }

  const redactSelection = () => {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    if (end <= start) { toast('Select the text to redact first', { icon: '✏️' }); return }
    const replaced = BLOCK.repeat(end - start)
    setText((t) => t.slice(0, start) + replaced + t.slice(end))
    setRedactions((n) => n + 1)
  }

  const save = async () => {
    if (demoMode) { setError('Demo records do not contain the original encrypted file, so they cannot be saved as redacted versions.'); return }
    if (redactions === 0) { setError('Make at least one redaction before saving.'); return }
    setStage('saving')
    setError('')
    try {
      // Encrypt the redacted plaintext with a FRESH key (never reuse the original document key)
      const buffer = new TextEncoder().encode(text).buffer as ArrayBuffer
      const encrypted = await encryptDocument(buffer)
      if (documentHashSha256 && await verifyIntegrity(buffer, documentHashSha256)) {
        setStage('editing')
        setError('The redacted copy has the same hash as the original. Change the document before saving v2.')
        return
      }

      let wrappedKeyToken = encrypted.keyB64
      try {
        const pkRes = await api.get(`/users/${user!.id}/public-key`)
        const ownerPubKeyJwk: JsonWebKey = JSON.parse(pkRes.data.publicKeyJwk)
        wrappedKeyToken = await eciesWrapKey(ownerPubKeyJwk, encrypted.keyB64)
      } catch { /* demo-mode raw key fallback */ }

      const redactedName = normalizeRedactedName(fileName, version + 1, sourceFormat)
      const { data: newDoc } = await api.post('/documents/upload', {
        caseId,
        fileName: redactedName,
        ciphertextBase64: encrypted.ciphertextB64,
        ivBase64: encrypted.ivB64,
        documentHashSha256: encrypted.hashB64,
        wrappedKeyTokenForOwner: wrappedKeyToken,
        previousVersionId: docId,
        category: category ?? 'GENERAL',
      })

      await api.post(`/documents/${docId}/redactions`, { redactedDocId: newDoc.id, redactionCount: redactions })

      setStage('done')
      toast.success('Redacted copy created and linked on the ledger')
      onRedacted?.()
    } catch (e: any) {
      setStage('error')
      setError(e.response?.data?.detail ?? e.message ?? 'Failed to save redacted copy')
    }
  }

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col p-0 border border-gold-500/20 shadow-gold-md overflow-hidden bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gold-500/10">
          <div className="flex items-center gap-2 min-w-0">
            <Eraser className="w-5 h-5 text-gold-500 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-serif font-semibold text-lg text-gold-300 truncate">Redaction Editor</h2>
              <p className="text-xs text-text-secondary truncate">{fileName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-navy-950/60 rounded-lg text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
          <div className="flex items-start gap-1.5 text-[11px] text-text-secondary leading-relaxed">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gold-400" />
            {demoMode
              ? 'Demo records do not contain retrievable encrypted payloads. Real documents must decrypt successfully before a redacted copy can be saved.'
              : 'The document is decrypted and redacted in your browser. The saved copy is re-encrypted with a fresh key, gets a new hash, and is uploaded as the next document version.'}
          </div>

          {(stage === 'unlock' || stage === 'error') && (
            <div className="space-y-3">
              <div>
                <label className="label">Password (to unlock your key and decrypt the document)</label>
                <input type="password" className="input font-mono" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              {error && <div className="flex items-center gap-2 text-rose-400 text-xs bg-error/15 border border-error/30 rounded-lg px-3 py-2"><AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" /> {error}</div>}
              <button onClick={unlock} disabled={!password} className="btn-primary w-full justify-center py-2.5 disabled:opacity-50">
                <Lock className="w-4 h-4" /> Open for Redaction
              </button>
            </div>
          )}

          {(stage === 'editing' || stage === 'saving') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-secondary">
                  Browser view: select sensitive text, then click <strong>Redact selection</strong>.
                  {sourceFormat === 'docx' && !demoMode ? ' Word files are saved as redacted text copies.' : ''}
                </p>
                <span className="text-[11px] font-bold text-gold-400">{redactions} redaction(s)</span>
              </div>
              <textarea
                ref={taRef}
                className="input font-mono text-xs leading-relaxed min-h-[280px] bg-navy-950 text-text-primary border-gold-500/20"
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
              />
              <button onClick={redactSelection} disabled={stage === 'saving'} className="btn-secondary w-full justify-center py-2 flex gap-2">
                <Highlighter className="w-4 h-4" /> Redact selection
              </button>
              {error && <div className="flex items-center gap-2 text-rose-400 text-xs bg-error/15 border border-error/30 rounded-lg px-3 py-2"><AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" /> {error}</div>}
            </div>
          )}

          {stage === 'done' && (
            <div className="flex items-center gap-2 text-sm text-emerald-400 py-6 justify-center bg-success/15 border border-success/30 rounded-xl">
              <CheckCircle className="w-5 h-5 text-emerald-500" /> Redacted copy created and linked.
            </div>
          )}
        </div>

        {(stage === 'editing' || stage === 'saving') && (
          <div className="flex gap-3 p-5 pt-0 bg-navy-950/20">
            <button onClick={onClose} className="flex-1 btn-secondary py-2.5">Cancel</button>
            <button onClick={save} disabled={stage === 'saving' || redactions === 0} className="flex-1 btn-primary py-2.5 justify-center disabled:opacity-50">
              {stage === 'saving' ? <><Loader2 className="w-4 h-4 animate-spin text-navy-950" /> Saving…</> : <><Lock className="w-4 h-4" /> Encrypt & Save Redacted Copy</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
