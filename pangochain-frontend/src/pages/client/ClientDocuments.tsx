import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Upload, Download, Lock, Shield, AlertCircle,
  Loader2, PenTool, AlertTriangle, Search, Sparkles, X, Check
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import api from '../../lib/api'
import { queryKeys } from '../../lib/queryKeys'
import { encryptDocument, eciesWrapKey } from '../../lib/crypto'
import { SecureDownloadModal } from '../../components/SecureDownloadModal'
import { SignDocumentModal } from '../../components/SignDocumentModal'
import { ListSkeleton } from '../../components/ui/Skeleton'
import toast from 'react-hot-toast'

interface DocumentDto {
  id: string
  fileName: string
  ipfsCid: string
  documentHash?: string
  documentHashSha256?: string
  fabricTxId: string | null
  category: string
  confidential: boolean
  createdAt: string
  caseTitle?: string
}

interface CaseInfo {
  id: string
  title: string
  caseType?: string
}

const CATEGORIES = ['ALL', 'GENERAL', 'EVIDENCE', 'CONTRACT', 'CORRESPONDENCE', 'CONFESSION', 'MEDICAL', 'FINANCIAL']

const CATEGORY_COLORS: Record<string, string> = {
  EVIDENCE: 'bg-blue-500/10 text-blue-300 border border-blue-500/20',
  CONTRACT: 'bg-purple-500/10 text-purple-300 border border-purple-500/20',
  CORRESPONDENCE: 'bg-slate-800 text-slate-300 border border-slate-700/50',
  CONFESSION: 'bg-red-500/10 text-rose-350 border border-red-500/20',
  MEDICAL: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
  FINANCIAL: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
  GENERAL: 'bg-slate-800 text-slate-400 border border-slate-700/40',
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { ease: 'easeOut' as const, duration: 0.4 } }
}

export default function ClientDocuments() {
  const { user } = useAuthStore()
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [search, setSearch] = useState('')
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [downloadDoc, setDownloadDoc] = useState<DocumentDto | null>(null)
  const [signDoc, setSignDoc] = useState<DocumentDto | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStage, setUploadStage] = useState('')

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadCategory, setUploadCategory] = useState('GENERAL')
  const [uploadConfidential, setUploadConfidential] = useState(false)
  const [uploadNote, setUploadNote] = useState('')
  const [uploadCaseId, setUploadCaseId] = useState('')
  const [suggestion, setSuggestion] = useState<{ category: string; confidence: number; rationale: string } | null>(null)

  // AI auto-tagging
  const onPickFile = async (file: File | null) => {
    setUploadFile(file)
    setSuggestion(null)
    if (!file) return
    let previewText = ''
    if (/^text\/|json|csv|xml/.test(file.type) || /\.(txt|md|json|csv|xml|log)$/i.test(file.name)) {
      try { previewText = await file.slice(0, 4096).text() } catch { /* ignore */ }
    }
    try {
      const { data } = await api.post('/documents/classify', { fileName: file.name, previewText })
      setSuggestion(data)
      if (data?.category) setUploadCategory(data.category)
    } catch { /* classification is advisory */ }
  }

  const { data: documents = [], isLoading: loading, isError, refetch } = useQuery({
    queryKey: queryKeys.myDocuments(),
    queryFn: async () => {
      const { data } = await api.get('/documents')
      return (Array.isArray(data) ? data : data?.content ?? []) as DocumentDto[]
    },
  })
  const { data: myCases = [], isLoading: casesLoading } = useQuery({
    queryKey: [...queryKeys.cases(), 'client-upload-cases'],
    queryFn: async () => ((await api.get('/cases/my-cases')).data as CaseInfo[]) ?? [],
  })
  const error = isError ? 'Failed to load documents' : ''

  useEffect(() => {
    if (!uploadCaseId && myCases.length > 0) setUploadCaseId(myCases[0].id)
  }, [myCases, uploadCaseId])

  const handleUpload = async () => {
    if (!uploadFile || !user) return
    if (!uploadCaseId) {
      toast.error('No case is available for this upload')
      return
    }
    setUploading(true)
    try {
      setUploadStage('Reading file…')
      const buffer = await uploadFile.arrayBuffer()

      setUploadStage('Encrypting with AES-256-GCM…')
      const { keyB64, ivB64, ciphertextB64, hashB64 } = await encryptDocument(buffer)

      setUploadStage('Fetching your public key…')
      const pkRes = await api.get(`/users/${user.id}/public-key`)
      const pubKey: JsonWebKey = JSON.parse(pkRes.data.publicKeyJwk)

      setUploadStage('Wrapping encryption key with ECIES P-256…')
      const wrappedKeyToken = await eciesWrapKey(pubKey, keyB64)

      setUploadStage('Uploading encrypted ciphertext…')
      await api.post('/documents/upload', {
        caseId: uploadCaseId,
        fileName: uploadFile.name,
        ciphertextBase64: ciphertextB64,
        ivBase64: ivB64,
        documentHashSha256: hashB64,
        wrappedKeyTokenForOwner: wrappedKeyToken,
        category: uploadCategory,
        confidential: uploadConfidential,
      })

      toast.success('Document encrypted and uploaded to IPFS · anchored on blockchain')
      setUploadModalOpen(false)
      setUploadFile(null)
      setUploadNote('')
      setUploadConfidential(false)
      refetch()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? e.message ?? 'Upload failed')
    } finally {
      setUploading(false)
      setUploadStage('')
    }
  }

  const filtered = documents.filter((d) => {
    const matchCat = activeCategory === 'ALL' || d.category === activeCategory
    const matchSearch = !search || d.fileName.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 text-text-primary selection:bg-gold-500/20 selection:text-gold-300 max-w-4xl font-sans"
      id="client-documents-page"
    >
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gold-300 tracking-wide">My Document Vault</h1>
          <p className="text-text-secondary text-sm mt-1">
            End-to-end encrypted · stored on IPFS · anchored on Hyperledger Fabric
          </p>
        </div>
        <button
          id="open-upload-btn"
          onClick={() => setUploadModalOpen(true)}
          className="btn-primary shrink-0 font-semibold"
        >
          <Upload className="w-4 h-4" /> Upload Document
        </button>
      </motion.div>

      {/* Category tabs */}
      <motion.div variants={itemVariants} className="flex gap-2 flex-wrap" id="client-documents-categories">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            id={`category-tab-${cat}`}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all duration-200 border ${
              activeCategory === cat
                ? 'bg-gold-500 border-gold-400 text-navy-950 shadow-gold-sm'
                : 'bg-navy-900/40 border-gold-500/10 text-text-secondary hover:bg-gold-500/10 hover:text-gold-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </motion.div>

      {/* Search */}
      <motion.div variants={itemVariants} className="relative" id="client-documents-search">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          id="search-doc-input"
          className="input pl-10"
          placeholder="Search documents by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </motion.div>

      {loading && (
        <div id="documents-skeleton-loader">
          <ListSkeleton />
        </div>
      )}
      {error && !loading && (
        <motion.div
          variants={itemVariants}
          className="flex items-center gap-3 bg-red-950/40 border border-error/30 rounded-xl px-4 py-3 text-sm text-rose-400"
          id="documents-error-banner"
        >
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </motion.div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <motion.div variants={itemVariants} className="card border-dashed border-gold-500/15 text-center py-20 bg-navy-950/20" id="documents-empty-state">
          <Lock className="w-16 h-16 text-gold-500/20 mx-auto mb-4" />
          <h3 className="font-serif font-bold text-lg text-gold-300">No documents found</h3>
          <p className="text-text-secondary text-sm mt-1 max-w-sm mx-auto leading-relaxed">
            Upload your first document. It will be encrypted and signed before leaving your browser.
          </p>
          <button
            id="empty-state-upload-btn"
            onClick={() => setUploadModalOpen(true)}
            className="btn-primary mt-6 inline-flex font-semibold"
          >
            <Upload className="w-4 h-4" /> Upload First Document
          </button>
        </motion.div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <motion.div variants={itemVariants} className="space-y-3" id="documents-list-container">
          <AnimatePresence mode="popLayout">
            {filtered.map((doc) => (
              <motion.div
                key={doc.id}
                layoutId={`doc-card-${doc.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`card hover:border-gold-500/20 bg-navy-900/60 border border-gold-500/10 shadow-sm relative overflow-hidden group ${
                  doc.confidential ? 'border-red-500/20 bg-red-950/5' : ''
                }`}
              >
                <div className="flex items-center gap-4 relative z-10">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    doc.confidential
                      ? 'bg-red-500/10 border border-red-500/20'
                      : 'bg-gold-500/5 border border-gold-500/10 group-hover:bg-gold-500/10 transition-colors'
                  }`}>
                    {doc.confidential
                      ? <Shield className="w-5 h-5 text-rose-400" />
                      : <FileText className="w-5 h-5 text-gold-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-serif font-bold text-gold-200 text-sm truncate leading-snug">{doc.fileName}</p>
                      {doc.confidential && (
                        <span className="text-[9px] bg-red-500/10 border border-red-500/20 text-rose-450 font-bold font-mono px-2 py-0.5 rounded uppercase tracking-wider">
                          CONFIDENTIAL
                        </span>
                      )}
                      <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${CATEGORY_COLORS[doc.category] ?? 'bg-slate-800 text-slate-400 border-slate-700/50'}`}>
                        {doc.category}
                      </span>
                    </div>
                    <p className="text-text-muted text-[11px] mt-1 font-mono">
                      Uploaded {new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {doc.fabricTxId && (
                        <span className="ml-3 text-gold-500/60 border-l border-gold-500/20 pl-3">
                          Blockchain Block: {doc.fabricTxId.slice(0, 10)}…
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      id={`doc-sign-btn-${doc.id}`}
                      onClick={() => setSignDoc(doc)}
                      className="p-2 rounded-xl border border-gold-500/10 bg-navy-950/40 text-text-secondary hover:text-gold-300 hover:border-gold-500/30 hover:bg-gold-500/5 transition-all duration-200"
                      title="Sign document (ECDSA P-256)"
                    >
                      <PenTool className="w-4 h-4" />
                    </button>
                    <button
                      id={`doc-download-btn-${doc.id}`}
                      onClick={() => setDownloadDoc(doc)}
                      className="p-2 rounded-xl border border-gold-500/10 bg-navy-950/40 text-text-secondary hover:text-gold-300 hover:border-gold-500/30 hover:bg-gold-500/5 transition-all duration-200"
                      title="Decrypt and download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Upload Modal ───────────────────────────────────────────────────────── */}
      {uploadModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" id="upload-document-modal">
          <div className="bg-navy-900/95 border border-gold-500/20 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 text-text-primary backdrop-blur-lg">
            <div className="flex items-center justify-between border-b border-gold-500/5 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold-500/5 border border-gold-500/20 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-gold-400" />
                </div>
                <div>
                  <h2 className="font-serif font-bold text-lg text-gold-300">Secure Document Upload</h2>
                  <p className="text-[10px] text-text-secondary font-mono">Browser-side encryption active</p>
                </div>
              </div>
              <button
                id="close-upload-modal-btn"
                onClick={() => { setUploadModalOpen(false); setUploadFile(null) }}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Case Matter</label>
                <select
                  id="file-case-select"
                  className="input py-2.5 bg-navy-950 border-gold-500/20 focus:border-gold-500"
                  value={uploadCaseId}
                  onChange={(e) => setUploadCaseId(e.target.value)}
                  disabled={casesLoading || myCases.length === 0}
                >
                  {myCases.length === 0 ? (
                    <option value="" className="bg-navy-950 text-text-primary">No linked case available</option>
                  ) : myCases.map((c) => (
                    <option key={c.id} value={c.id} className="bg-navy-950 text-text-primary">{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Select Document File</label>
                <input
                  id="file-upload-input"
                  type="file"
                  className="input cursor-pointer"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div>
                <label className="label">Document Category</label>
                <select
                  id="file-category-select"
                  className="input py-2.5 bg-navy-950 border-gold-500/20 focus:border-gold-500"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                >
                  {CATEGORIES.filter((c) => c !== 'ALL').map((c) => <option key={c} value={c} className="bg-navy-950 text-text-primary">{c}</option>)}
                </select>
                {suggestion && (
                  <div className="mt-2 flex items-start gap-2.5 text-xs text-gold-350 bg-gold-500/5 border border-gold-500/20 rounded-xl p-3">
                    <Sparkles className="w-4 h-4 shrink-0 text-gold-450 mt-0.5 animate-pulse" />
                    <div className="space-y-1">
                      <p className="leading-none">
                        AI suggestion: <strong>{suggestion.category}</strong> ({suggestion.confidence}% confidence)
                        {uploadCategory !== suggestion.category && (
                          <button
                            type="button"
                            onClick={() => setUploadCategory(suggestion.category)}
                            className="ml-2 text-[10px] uppercase font-mono tracking-widest text-gold-400 hover:text-gold-250 underline font-bold"
                          >
                            apply suggestion
                          </button>
                        )}
                      </p>
                      <p className="text-[10px] text-text-secondary leading-relaxed">{suggestion.rationale}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 bg-red-950/20 border border-red-500/25 rounded-xl px-4 py-3">
                <input
                  type="checkbox"
                  id="confidential"
                  checked={uploadConfidential}
                  onChange={(e) => setUploadConfidential(e.target.checked)}
                  className="w-4 h-4 accent-red-650 cursor-pointer rounded border-red-500/20 bg-navy-950"
                />
                <label htmlFor="confidential" className="text-sm font-semibold text-rose-350 cursor-pointer select-none">
                  Mark as Confidential
                </label>
                <Shield className="w-4 h-4 text-rose-450 ml-auto shrink-0" />
              </div>

              {uploadConfidential && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-amber-300 leading-relaxed">
                    Confidential files undergo multi-recipient key wrapping. Only your legal advisory board 
                    retains delegation rights. An immutable access event will register on the Fabric ledger.
                  </p>
                </div>
              )}

              {uploading && (
                <div className="bg-gold-500/5 border border-gold-500/25 rounded-xl px-4 py-3 flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-gold-450" />
                  <p className="text-xs text-gold-300 font-mono">{uploadStage}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-3">
              <button
                id="upload-cancel-btn"
                onClick={() => { setUploadModalOpen(false); setUploadFile(null) }}
                disabled={uploading}
                className="flex-1 btn-secondary py-2.5 justify-center text-xs"
              >
                Cancel
              </button>
              <button
                id="upload-submit-btn"
                onClick={handleUpload}
                disabled={!uploadFile || uploading || !uploadCaseId}
                className="flex-1 btn-primary py-2.5 justify-center text-xs font-bold disabled:opacity-50"
              >
                {uploading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Encrypting…</>
                  : <><Lock className="w-4 h-4 text-navy-950" /> Encrypt & Upload</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secure Download Modal */}
      {downloadDoc && (
        <SecureDownloadModal
          docId={downloadDoc.id}
          fileName={downloadDoc.fileName}
          expectedHash={downloadDoc.documentHashSha256 ?? downloadDoc.documentHash}
          onClose={() => setDownloadDoc(null)}
        />
      )}

      {/* Sign Document Modal */}
      {signDoc && (
        <SignDocumentModal
          docId={signDoc.id}
          fileName={signDoc.fileName}
          onClose={() => setSignDoc(null)}
        />
      )}
    </motion.div>
  )
}
