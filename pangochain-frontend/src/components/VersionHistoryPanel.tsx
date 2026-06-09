import { useEffect, useState } from 'react'
import { History, X, Loader2, RotateCcw, Upload, ShieldCheck, Clock, User as UserIcon, CheckCircle } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { DocumentUploadDropzone } from './DocumentUploadDropzone'

interface DocVersion {
  id: string
  caseId: string
  fileName: string
  documentHash: string
  fabricTxId: string | null
  ownerEmail: string
  version: number
  previousVersionId: string | null
  status: string
  createdAt: string
}

interface Props {
  docId: string
  fileName: string
  onClose: () => void
  /** Called after a restore/new-version so the parent list can refetch. */
  onChanged?: () => void
}

export function VersionHistoryPanel({ docId, fileName, onClose, onChanged }: Props) {
  const [versions, setVersions] = useState<DocVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  const load = () => {
    setLoading(true)
    api.get<DocVersion[]>(`/documents/${docId}/versions`)
      .then((r) => setVersions(r.data))
      .catch((e) => setError(e.response?.data?.detail ?? 'Failed to load version history'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [docId])

  // Newest first for display; the head is the highest version.
  const ordered = [...versions].sort((a, b) => b.version - a.version)
  const head = ordered[0]

  const handleRestore = async (v: DocVersion) => {
    setRestoringId(v.id)
    try {
      await api.post(`/documents/${v.id}/restore`)
      toast.success(`Restored v${v.version} as a new version`)
      load()
      onChanged?.()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Restore failed')
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="card border border-gold-500/20 shadow-gold-md w-full max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gold-500/10">
          <div className="flex items-center gap-2 min-w-0">
            <History className="w-5 h-5 text-gold-500 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-serif font-semibold text-gold-300 truncate text-base">Version History</h2>
              <p className="text-xs text-text-secondary truncate">{fileName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-navy-950/60 rounded-lg text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto scrollbar-thin flex-1">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gold-500" /></div>
          ) : error ? (
            <p className="text-sm text-rose-400">{error}</p>
          ) : (
            <ol className="relative border-l border-gold-500/10 ml-2 space-y-4">
              {ordered.map((v) => {
                const isHead = v.id === head?.id
                // A version is unchanged from its predecessor if the plaintext hash matches.
                const prev = versions.find((p) => p.id === v.previousVersionId)
                const sameAsPrev = prev && prev.documentHash === v.documentHash
                return (
                  <li key={v.id} className="ml-5 relative">
                    <span className={`absolute -left-[25px] top-1.5 w-2.5 h-2.5 rounded-full border ${
                      isHead 
                        ? 'bg-gold-500 border-gold-400 shadow-gold-sm' 
                        : 'bg-navy-950 border-gold-500/30'
                    }`} />
                    <div className={`rounded-xl border p-3.5 ${
                      isHead 
                        ? 'border-gold-500/30 bg-gold-500/5 shadow-gold-sm' 
                        : 'border-gold-500/10 bg-navy-950/40'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text-primary text-sm">Version {v.version}</span>
                          {isHead && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-gold-300 bg-gold-500/10 border border-gold-500/20 px-1.5 py-0.5 rounded">
                              Current
                            </span>
                          )}
                          {sameAsPrev && <span className="text-[10px] text-text-muted">· identical content</span>}
                        </div>
                        {!isHead && (
                          <button 
                            onClick={() => handleRestore(v)} 
                            disabled={restoringId === v.id}
                            className="inline-flex items-center gap-1 text-xs text-gold-400 hover:text-gold-300 bg-gold-500/5 hover:bg-gold-500/10 border border-gold-500/10 rounded-lg px-2 py-1 transition-all disabled:opacity-50"
                          >
                            {restoringId === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Restore
                          </button>
                        )}
                      </div>
                      <div className="mt-2 space-y-0.5 text-xs text-text-secondary">
                        <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gold-500/60" /> {new Date(v.createdAt).toLocaleString()}</p>
                        <p className="flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5 text-gold-500/60" /> {v.ownerEmail}</p>
                        <p className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-gold-500/80" /> <span className="font-mono truncate">SHA-256 {v.documentHash?.slice(0, 16)}…</span></p>
                        {v.fabricTxId && <p className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> <span className="font-mono truncate">tx {v.fabricTxId.slice(0, 14)}…</span></p>}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        <div className="p-5 border-t border-gold-500/10 bg-navy-950/20">
          <button onClick={() => setShowUpload(true)} disabled={!head} className="btn-primary w-full justify-center py-2.5 disabled:opacity-50">
            <Upload className="w-4 h-4" /> Upload New Version
          </button>
        </div>
      </div>

      {showUpload && head && (
        <DocumentUploadDropzone
          caseId={head.caseId}
          previousVersionId={head.id}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); load(); onChanged?.() }}
        />
      )}
    </div>
  )
}
