import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Search, Download, Shield, Clock, History, PenTool, Network, AlertCircle, Plus, Folder, Lock, MessageCircle, Eraser, Share2, Eye, Hash } from 'lucide-react'
import { DocumentUploadDropzone } from '../components/DocumentUploadDropzone'
import { SecureDownloadModal } from '../components/SecureDownloadModal'
import { SignDocumentModal } from '../components/SignDocumentModal'
import { VersionHistoryPanel } from '../components/VersionHistoryPanel'
import { ChainOfCustodyModal } from '../components/ChainOfCustodyModal'
import { AnnotationModal } from '../components/AnnotationModal'
import { RedactionModal } from '../components/RedactionModal'
import { DocumentEditorModal } from '../components/DocumentEditorModal'
import { TeamAccessPanel } from '../components/TeamAccessPanel'
import { ListSkeleton } from '../components/ui/Skeleton'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import { PageHero, QuickActionGrid } from '../components/ui/PageChrome'
import { Tooltip } from '../components/ui/Tooltip'
import { DocumentSealSvg } from '../components/ui/SvgAssets'

type DocCategory = 'ALL' | 'GENERAL' | 'CONTRACT' | 'EVIDENCE' | 'PLEADING' | 'CORRESPONDENCE'

const CATEGORIES: { id: DocCategory; label: string; desc: string }[] = [
  { id: 'ALL', label: 'All Matters', desc: 'Every record' },
  { id: 'GENERAL', label: 'General Repository', desc: 'Misc files' },
  { id: 'CONTRACT', label: 'Contracts & Agreements', desc: 'Signed execution deeds' },
  { id: 'EVIDENCE', label: 'Litigation Evidence', desc: 'Court exhibits & affidavits' },
  { id: 'PLEADING', label: 'Pleadings & Motions', desc: 'Case dockets & answers' },
  { id: 'CORRESPONDENCE', label: 'Client Correspondence', desc: 'Privileged communication' }
]

interface DocumentDto {
  id: string
  caseId: string
  fileName: string
  ipfsCid: string
  documentHash: string
  fabricTxId: string
  ownerEmail: string
  version: number
  status: string
  createdAt: string
  category?: string
  confidential?: boolean
}

interface Page<T> { content: T[]; totalElements: number }

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf')  return '📄'
  if (ext === 'docx') return '📝'
  if (ext === 'xlsx') return '📊'
  if (ext === 'zip')  return '🗜️'
  return '📎'
}

function shortHash(hash?: string) {
  return hash ? `${hash.slice(0, 10)}...${hash.slice(-6)}` : ''
}

export default function Documents() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<DocCategory>('ALL')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [downloadTarget, setDownloadTarget] = useState<DocumentDto | null>(null)
  const [historyTarget, setHistoryTarget] = useState<DocumentDto | null>(null)
  const [signTarget, setSignTarget] = useState<DocumentDto | null>(null)
  const [custodyTarget, setCustodyTarget] = useState<DocumentDto | null>(null)
  const [annotateTarget, setAnnotateTarget] = useState<DocumentDto | null>(null)
  const [redactTarget, setRedactTarget] = useState<DocumentDto | null>(null)
  const [editTarget, setEditTarget] = useState<DocumentDto | null>(null)
  const [accessTarget, setAccessTarget] = useState<DocumentDto | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), search ? 300 : 0)
    return () => clearTimeout(t)
  }, [search])

  const { data: page, isLoading: loading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.documents('all', category === 'ALL' ? undefined : category), debouncedSearch],
    queryFn: async () => {
      const params: Record<string, string> = { page: '0', size: '50' }
      if (debouncedSearch) params.q = debouncedSearch
      if (category !== 'ALL') params.category = category
      const { data } = await api.get<Page<DocumentDto>>('/documents', { params })
      return data
    },
    placeholderData: (prev) => prev,
  })

  const error = isError ? 'Failed to load documents' : ''
  const docs = page?.content ?? []

  return (
    <div className="space-y-6 animate-fade-in text-text-primary">
      <PageHero
        eyebrow="Encrypted Evidence & Registry"
        title="Evidentiary Vaults"
        description="Decrypt high-clearance case files, review multi-party signatures, and verify document ledger blocks in real time."
        icon={FileText}
        actions={(
          <>
            <div className="flex items-center gap-2 rounded-xl bg-gold-500/10 border border-gold-500/30 px-3 py-2 text-xs font-semibold text-gold-300">
              <Shield className="w-3.5 h-3.5" /> AES-256-GCM Secure
            </div>
            <button onClick={() => setShowUpload(true)} className="btn-primary text-xs uppercase tracking-wider font-bold">
              <Plus className="w-4 h-4" /> Ingest File
            </button>
          </>
        )}
      >
        <QuickActionGrid
          actions={[
            { label: 'Upload encrypted file', description: 'Add a document, encrypt it client-side, and refresh this vault.', onClick: () => setShowUpload(true), icon: Plus, tone: 'amber' },
            { label: 'Review custody', description: 'Use the custody action on any row to inspect access and provenance.', to: '/audit', icon: Network, tone: 'cyan' },
            { label: 'Version history', description: 'Track document revisions and integrity over time.', to: '/documents', icon: History, tone: 'emerald' },
            { label: 'Secure download', description: 'Decrypt authorized documents through the secure download flow.', to: '/documents', icon: Download, tone: 'amber' },
          ]}
        />
      </PageHero>

      {/* Vault explorer structure */}
      <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-6 items-start">
        
        {/* Left Panel: Explorer folder tree */}
        <div className="card bg-navy-900/60 p-4 border-gold-500/10 space-y-4">
          <div className="flex items-center justify-between px-2 pb-2 border-b border-gold-500/5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gold-300 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-gold-400" /> Vault Hierarchy
            </span>
          </div>

          <div className="space-y-1 relative pl-2">
            {/* Indentation line */}
            <div className="absolute left-[13px] top-4 bottom-4 w-0.5 bg-gold-500/10" />

            {CATEGORIES.map((cat) => {
              const active = category === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-300 relative group ${
                    active
                      ? 'bg-gold-500/10 text-gold-300 font-semibold border-l-2 border-gold-500'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                  }`}
                >
                  <Folder className={`w-4 h-4 mt-0.5 shrink-0 transition-colors ${active ? 'text-gold-400' : 'text-gold-500/60'}`} />
                  <div className="min-w-0">
                    <p className="text-xs truncate">{cat.label}</p>
                    <p className="text-[9px] text-text-muted truncate mt-0.5">{cat.desc}</p>
                  </div>
                </button>
              )}
            )}
          </div>
        </div>

        {/* Right Panel: File Grid & Tools */}
        <div className="space-y-4">
          {/* Action header with search */}
          <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                className="input pl-9"
                placeholder="Search file registries..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-gold-500/80">
              <DocumentSealSvg className="w-5 h-5 text-gold-500/50" />
              <span>IPFS Storage + Fabric ACL Active</span>
            </div>
          </div>

          {/* Loaders */}
          {loading && <ListSkeleton />}

          {error && !loading && (
            <div className="flex items-center gap-3 bg-error/10 border border-error/30 rounded-xl px-4 py-3 text-xs text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && docs.length === 0 && (
            <div className="card text-center py-16">
              <FileText className="w-12 h-12 text-gold-500/20 mx-auto mb-4" />
              <h3 className="font-serif text-lg font-bold text-gold-300 mb-2">No documents indexed</h3>
              <p className="text-text-secondary text-xs max-w-sm mx-auto mb-6">
                No ledger files found matching the category or query filters.
              </p>
              <button onClick={() => setShowUpload(true)} className="btn-primary text-xs uppercase tracking-wider font-bold">
                <Plus className="w-3.5 h-3.5" /> Upload Document
              </button>
            </div>
          )}

          {/* Document Grid Cards */}
          {!loading && !error && docs.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="card relative flex flex-col justify-between overflow-hidden bg-navy-900/60 p-0 border-gold-500/10 hover:border-gold-500/20 hover:shadow-gold-sm transition-all duration-300 min-h-[220px] group"
                >
                  {/* Dark Geometric preview grid */}
                  <div className="h-24 bg-navy-950/80 flex items-center justify-center relative border-b border-gold-500/5 overflow-hidden">
                    {/* Abstract lines decoration */}
                    <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] bg-[size:10px_10px]" />
                    <div className="absolute -left-4 -bottom-4 w-16 h-16 rounded-full border border-gold-500/5" />
                    
                    <span className="text-4xl select-none filter drop-shadow-md">{fileIcon(doc.fileName)}</span>
                    
                    {/* Version label */}
                    <span className="absolute top-2.5 left-2.5 font-mono text-[9px] font-bold bg-navy-900 text-gold-400 border border-gold-500/20 px-1.5 py-0.5 rounded">
                      V{doc.version}
                    </span>

                    {/* Encryption status */}
                    <span className="absolute top-2.5 right-2.5 flex items-center gap-1 font-mono text-[9px] bg-gold-500/10 text-gold-300 border border-gold-500/20 px-1.5 py-0.5 rounded">
                      <Lock className="w-2.5 h-2.5 text-gold-400" /> E2E
                    </span>
                  </div>

                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-serif font-bold text-sm text-gold-300 line-clamp-1 group-hover:text-gold-100 transition-colors" title={doc.fileName}>
                        {doc.fileName}
                      </h4>
                      <p className="text-[9px] text-text-secondary truncate mt-1">
                        BY: {doc.ownerEmail}
                      </p>
                      {doc.category && (
                        <span className="inline-block text-[8px] bg-gold-500/5 border border-gold-500/10 text-gold-400 font-bold px-1.5 py-0.5 rounded uppercase mt-2">
                          {doc.category}
                        </span>
                      )}
                    </div>

                    {/* Actions toolbar */}
                    <div className="flex items-center justify-between pt-3 border-t border-gold-500/5 mt-4">
                      <div className="min-w-0 text-[9px] font-mono text-text-muted space-y-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                        {doc.documentHash && (
                          <span className="flex items-center gap-1 text-gold-400 truncate" title={doc.documentHash}>
                            <Hash className="w-3 h-3 shrink-0 text-gold-500/50" />
                            {shortHash(doc.documentHash)}
                          </span>
                        )}
                      </div>

                      {/* Tooltip action group */}
                      <div className="flex items-center gap-1.5">
                        <Tooltip content="Open in browser" side="top">
                          <button
                            onClick={() => setEditTarget(doc)}
                            className="p-1.5 rounded-lg border border-gold-500/5 bg-navy-950/60 hover:bg-gold-500/10 text-text-secondary hover:text-gold-300 transition-all"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Annotate / comments" side="top">
                          <button
                            onClick={() => setAnnotateTarget(doc)}
                            className="p-1.5 rounded-lg border border-gold-500/5 bg-navy-950/60 hover:bg-gold-500/10 text-text-secondary hover:text-gold-300 transition-all"
                          >
                            <MessageCircle className="w-3 h-3" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Redact in browser" side="top">
                          <button
                            onClick={() => setRedactTarget(doc)}
                            className="p-1.5 rounded-lg border border-gold-500/5 bg-navy-950/60 hover:bg-gold-500/10 text-text-secondary hover:text-gold-300 transition-all"
                          >
                            <Eraser className="w-3 h-3" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Grant document access" side="top">
                          <button
                            onClick={() => setAccessTarget(doc)}
                            className="p-1.5 rounded-lg border border-gold-500/5 bg-navy-950/60 hover:bg-gold-500/10 text-text-secondary hover:text-gold-300 transition-all"
                          >
                            <Share2 className="w-3 h-3" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Sign Verification" side="top">
                          <button
                            onClick={() => setSignTarget(doc)}
                            className="p-1.5 rounded-lg border border-gold-500/5 bg-navy-950/60 hover:bg-gold-500/10 text-text-secondary hover:text-gold-300 transition-all"
                          >
                            <PenTool className="w-3 h-3" />
                          </button>
                        </Tooltip>
                        
                        <Tooltip content="Version History" side="top">
                          <button
                            onClick={() => setHistoryTarget(doc)}
                            className="p-1.5 rounded-lg border border-gold-500/5 bg-navy-950/60 hover:bg-gold-500/10 text-text-secondary hover:text-gold-300 transition-all"
                          >
                            <History className="w-3 h-3" />
                          </button>
                        </Tooltip>

                        <Tooltip content="Custody Log" side="top">
                          <button
                            onClick={() => setCustodyTarget(doc)}
                            className="p-1.5 rounded-lg border border-gold-500/5 bg-navy-950/60 hover:bg-gold-500/10 text-text-secondary hover:text-gold-300 transition-all"
                          >
                            <Network className="w-3 h-3" />
                          </button>
                        </Tooltip>

                        <Tooltip content="Secure Download" side="top">
                          <button
                            onClick={() => setDownloadTarget(doc)}
                            className="p-1.5 rounded-lg border border-gold-500/20 bg-gold-500/5 hover:bg-gold-500/10 text-gold-300 transition-all"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <DocumentUploadDropzone
          caseId=""
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); refetch() }}
        />
      )}
      {downloadTarget && (
        <SecureDownloadModal
          docId={downloadTarget.id}
          fileName={downloadTarget.fileName}
          onClose={() => setDownloadTarget(null)}
        />
      )}
      {historyTarget && (
        <VersionHistoryPanel
          docId={historyTarget.id}
          fileName={historyTarget.fileName}
          onClose={() => setHistoryTarget(null)}
          onChanged={() => refetch()}
        />
      )}
      {signTarget && (
        <SignDocumentModal
          docId={signTarget.id}
          fileName={signTarget.fileName}
          onClose={() => setSignTarget(null)}
        />
      )}
      {custodyTarget && (
        <ChainOfCustodyModal
          docId={custodyTarget.id}
          fileName={custodyTarget.fileName}
          onClose={() => setCustodyTarget(null)}
        />
      )}
      {annotateTarget && (
        <AnnotationModal
          docId={annotateTarget.id}
          fileName={annotateTarget.fileName}
          versionHash={annotateTarget.documentHash}
          onClose={() => setAnnotateTarget(null)}
        />
      )}
      {redactTarget && (
        <RedactionModal
          docId={redactTarget.id}
          caseId={redactTarget.caseId}
          fileName={redactTarget.fileName}
          category={redactTarget.category}
          version={redactTarget.version}
          ipfsCid={redactTarget.ipfsCid}
          documentHashSha256={redactTarget.documentHash}
          onClose={() => setRedactTarget(null)}
          onRedacted={() => { setRedactTarget(null); refetch() }}
        />
      )}
      {editTarget && (
        <DocumentEditorModal
          docId={editTarget.id}
          caseId={editTarget.caseId}
          fileName={editTarget.fileName}
          category={editTarget.category}
          version={editTarget.version}
          documentHashSha256={editTarget.documentHash}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); refetch() }}
        />
      )}
      {accessTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setAccessTarget(null)}>
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gold-500/20 bg-navy-900 p-5" onClick={(e) => e.stopPropagation()}>
            <TeamAccessPanel docId={accessTarget.id} docName={accessTarget.fileName} />
          </div>
        </div>
      )}
    </div>
  )
}
