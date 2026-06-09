import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSignature, Lock, Loader2, CheckCircle, AlertCircle, ShieldCheck, PenTool, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import { useAuthStore } from '../store/authStore'
import { encryptDocument, eciesWrapKey, bufferToHex } from '../lib/crypto'
import toast from 'react-hot-toast'

interface TemplateField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'date'
}

interface TemplateDto {
  id: string
  templateKey: string
  name: string
  category: string
  version: number
  description: string
  fieldsJson: string
  body: string
}

interface CaseDto {
  id: string
  title: string
  status: string
}

interface Page<T> { content: T[] }

type Stage = 'idle' | 'encrypting' | 'wrapping' | 'uploading' | 'anchoring' | 'done' | 'error'

function render(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => values[key]?.trim() || `[${key}]`)
}

// Function to highlight {{variables}} in gold
function highlightSyntax(body: string) {
  const parts = body.split(/(\{\{\s*[a-zA-Z0-9_]+\s*\}\})/g)
  return parts.map((part, index) => {
    if (part.startsWith('{{') && part.endsWith('}}')) {
      return (
        <span key={index} className="text-gold-400 font-bold border-b border-dashed border-gold-400/50">
          {part}
        </span>
      )
    }
    return part
  })
}

export default function TemplateEngine() {
  const { user } = useAuthStore()
  const [selectedId, setSelectedId] = useState<string>('')
  const [caseId, setCaseId] = useState<string>('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [stage, setStage] = useState<Stage>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [quillAnimating, setQuillAnimating] = useState(false)
  const [documentName, setDocumentName] = useState('')
  const [editableBody, setEditableBody] = useState('')

  const { data: templates, isLoading: tLoading, isError: tError } = useQuery({
    queryKey: queryKeys.templates(),
    queryFn: async () => (await api.get<TemplateDto[]>('/templates')).data,
  })

  const { data: cases } = useQuery({
    queryKey: queryKeys.cases({ status: 'ACTIVE', for: 'templates' }),
    queryFn: async () => (await api.get<Page<CaseDto>>('/cases', { params: { status: 'ACTIVE', size: '100' } })).data.content,
  })

  const selected = useMemo(() => templates?.find((t) => t.id === selectedId), [templates, selectedId])

  const fields: TemplateField[] = useMemo(() => {
    if (!selected) return []
    try { return JSON.parse(selected.fieldsJson) } catch { return [] }
  }, [selected])

  const preview = useMemo(() => (selected ? render(editableBody || selected.body, values) : ''), [selected, editableBody, values])

  const pickTemplate = (id: string) => {
    setSelectedId(id)
    const t = templates?.find((candidate) => candidate.id === id)
    setDocumentName(t ? `${t.name}.txt` : '')
    setEditableBody(t?.body ?? '')
    setValues({})
    setStage('idle')
    setErrorMsg('')
  }

  const allFilled = fields.length > 0 && fields.every((f) => (values[f.name] ?? '').trim().length > 0)

  const handleGenerate = async () => {
    if (!selected || !caseId) return
    setErrorMsg('')
    setQuillAnimating(true)
    try {
      // 1. Build the plaintext instrument
      const plaintext = render(editableBody || selected.body, values)
      const buffer = new TextEncoder().encode(plaintext).buffer

      // 2. Encrypt
      setStage('encrypting')
      const encrypted = await encryptDocument(buffer as ArrayBuffer)

      // 3. Wrap
      setStage('wrapping')
      let wrappedKeyToken = encrypted.keyB64
      try {
        const pkRes = await api.get(`/users/${user!.id}/public-key`)
        const ownerPubKeyJwk: JsonWebKey = JSON.parse(pkRes.data.publicKeyJwk)
        wrappedKeyToken = await eciesWrapKey(ownerPubKeyJwk, encrypted.keyB64)
      } catch { /* demo mode fallback */ }

      // 4. Upload
      setStage('uploading')
      const fileName = documentName.trim() || `${selected.name}.txt`
      const { data: doc } = await api.post('/documents/upload', {
        caseId,
        fileName,
        ciphertextBase64: encrypted.ciphertextB64,
        ivBase64: encrypted.ivB64,
        documentHashSha256: encrypted.hashB64,
        wrappedKeyTokenForOwner: wrappedKeyToken,
        previousVersionId: null,
        category: selected.category,
      })

      // 5. Anchor
      setStage('anchoring')
      const paramHash = bufferToHex(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(values, Object.keys(values).sort()))),
      )
      await api.post('/templates/record-generation', {
        templateId: selected.id,
        caseId,
        documentId: doc.id,
        paramHash,
      })

      setStage('done')
      toast.success(`${selected.name} generated, encrypted & anchored on the ledger`)
    } catch (err: any) {
      setStage('error')
      setErrorMsg(err.response?.data?.detail ?? err.message ?? 'Generation failed')
    } finally {
      setTimeout(() => setQuillAnimating(false), 1200)
    }
  }

  const busy = ['encrypting', 'wrapping', 'uploading', 'anchoring'].includes(stage)
  const stageLabel: Record<Stage, string> = {
    idle: '', encrypting: 'Encrypting with AES-256-GCM…', wrapping: 'Wrapping key with ECIES P-256…',
    uploading: 'Uploading ciphertext to IPFS…', anchoring: 'Anchoring template version on Fabric…',
    done: 'Generated & anchored ✓', error: errorMsg,
  }

  return (
    <div className="space-y-6 animate-fade-in text-text-primary selection:bg-gold-500/20 selection:text-gold-300">
      
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gold-500/10 pb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 border border-gold-500/20 shadow-gold-sm">
            <FileSignature className="w-5 h-5 text-gold-400" />
          </div>
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-wide text-gold-300">Deed Template Engine</h1>
            <p className="text-xs text-text-secondary mt-0.5">Generate standardized legal drafts client-side, encrypted and anchored on the ledger.</p>
          </div>
        </div>
      </div>

      {tError && (
        <div className="flex items-center gap-2 text-rose-400 text-xs bg-error/10 border border-error/30 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4" /> Failed to load templates.
        </div>
      )}

      {/* Grid: 3 columns (Template Library list, Editor Console, Live Document Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Col 1: Template library lists */}
        <div className="space-y-4">
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest px-1">Deed Templates</p>
          {tLoading && <div className="text-gold-300 text-xs py-4 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading Library...</div>}
          <div className="space-y-3">
            {templates?.map((t) => (
              <button
                key={t.id}
                onClick={() => pickTemplate(t.id)}
                className={`w-full text-left border rounded-xl p-4 transition-all duration-300 ${
                  selectedId === t.id
                    ? 'border-gold-500 bg-gold-500/10 shadow-gold-sm text-gold-300'
                    : 'border-gold-500/10 bg-navy-900/40 text-text-secondary hover:border-gold-500/20 hover:text-text-primary'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-serif font-bold text-sm">{t.name}</p>
                  <span className="text-[9px] font-mono text-text-secondary bg-navy-950 px-1.5 py-0.5 rounded border border-gold-500/10">v{t.version}</span>
                </div>
                <p className="text-text-secondary text-xs mt-2 leading-relaxed">{t.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Col 2: Guided parameters and Editor preview */}
        <div className="space-y-4">
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest px-1">Parameters & Editor</p>
          {!selected ? (
            <div className="text-text-secondary text-xs border border-dashed border-gold-500/15 rounded-xl p-8 text-center bg-navy-950/20">
              Select a deed template to initialize the compiler.
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Form card */}
              <div className="card bg-navy-900/60 p-5 border-gold-500/10 space-y-4">
                <div>
                  <label className="label">Target Matter Case *</label>
                  <select className="input bg-navy-950 text-xs" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                    <option value="" className="bg-navy-950">Select Case Dockets...</option>
                    {cases?.map((c) => <option key={c.id} value={c.id} className="bg-navy-950">{c.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Generated Document Name *</label>
                  <input
                    className="input bg-navy-950 text-xs"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    placeholder="e.g. Chen settlement draft v1.txt"
                  />
                </div>
                
                {fields.map((f) => (
                  <div key={f.name}>
                    <label className="label">{f.label} *</label>
                    {f.type === 'textarea' ? (
                      <textarea
                        className="input bg-navy-950 text-xs min-h-[72px]"
                        value={values[f.name] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      />
                    ) : (
                      <input
                        type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                        className="input bg-navy-950 text-xs"
                        value={values[f.name] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}

                {stage !== 'idle' && (
                  <div className="flex items-center gap-2 text-xs py-1">
                    {stage === 'done' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                    {stage === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 animate-pulse" />}
                    {busy && <Loader2 className="w-4 h-4 animate-spin text-gold-500" />}
                    <span className={stage === 'error' ? 'text-rose-400 font-mono' : stage === 'done' ? 'text-emerald-400 font-bold' : 'text-text-secondary'}>
                      {stageLabel[stage]}
                    </span>
                  </div>
                )}

                {/* Generate button with Quill animations */}
                <button
                  onClick={handleGenerate}
                  disabled={!allFilled || !caseId || !documentName.trim() || busy || stage === 'done'}
                  className="btn-primary w-full justify-center py-3 text-xs uppercase tracking-wider font-bold relative overflow-hidden"
                >
                  <motion.span
                    animate={quillAnimating ? { rotate: [0, -15, 15, -15, 15, 0], x: [0, 4, -4, 4, -4, 0] } : {}}
                    transition={{ duration: 1 }}
                    className="inline-block mr-1.5 shrink-0"
                  >
                    <PenTool className="w-4 h-4 text-navy-950" />
                  </motion.span>
                  <span>{busy ? 'Anchoring...' : 'Generate, Encrypt & Anchor'}</span>
                </button>
              </div>

              {/* Code editor preview panel */}
              <div className="card bg-navy-950/80 p-5 border-gold-500/10 space-y-2">
                <p className="text-[9px] font-mono font-bold text-gold-500 uppercase tracking-widest">Template Source Editor</p>
                <textarea
                  className="input min-h-[220px] bg-navy-950 text-xs font-mono leading-relaxed"
                  value={editableBody}
                  onChange={(e) => setEditableBody(e.target.value)}
                />
                <div className="text-[11px] leading-relaxed whitespace-pre-wrap font-mono text-text-secondary max-h-[18vh] overflow-y-auto pr-1 border-t border-gold-500/10 pt-3">
                  {highlightSyntax(editableBody)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Col 3: Parchment Document Live Preview */}
        <div className="space-y-4">
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest px-1">Document Registry Preview</p>
          {selected ? (
            <div className="relative rounded-2xl bg-navy-900 border border-gold-500/10 p-6 min-h-[50vh] max-h-[70vh] overflow-y-auto shadow-card flex flex-col justify-between">
              
              {/* Paper Watermark Pattern overlay */}
              <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,1),transparent)]" />
              
              <div className="space-y-6 relative z-10">
                {/* Header of Preview */}
                <div className="flex justify-between items-center pb-4 border-b border-gold-500/20">
                  <div className="flex items-center gap-2">
                    <img src="/logo-mark.png" alt="PangoChain Logo" className="w-6 h-6 filter-gold opacity-60" />
                    <span className="font-serif font-bold text-xs text-gold-500/80">PangoChain Deed Seal</span>
                  </div>
                  <span className="text-[8px] font-mono text-text-secondary uppercase">Draft preview</span>
                </div>

                {/* Preformatted preview body */}
                <div className="text-xs text-text-primary leading-relaxed font-serif whitespace-pre-wrap font-normal italic">
                  {preview}
                </div>
              </div>

              {/* Verified seal mark at bottom of preview */}
              <div className="border-t border-gold-500/20 pt-4 mt-8 flex justify-between items-center text-[9px] font-mono text-gold-500/50 uppercase tracking-widest relative z-10">
                <span>Fabric 2.4 channel</span>
                <span className="flex items-center gap-1.5 font-bold text-gold-400">
                  <Lock className="w-3.5 h-3.5" /> SECURE DEED
                </span>
              </div>

            </div>
          ) : (
            <div className="text-text-secondary text-xs border border-dashed border-gold-500/15 rounded-xl p-8 text-center bg-navy-950/20">
              The compiled document preview will render here.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
