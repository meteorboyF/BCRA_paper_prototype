import { useEffect, useState } from 'react'
import { Network, X, Loader2, Upload, Eye, Share2, PenTool, GitBranch, KeyRound, Dot } from 'lucide-react'
import api from '../lib/api'

interface CustodyEvent {
  category: string
  eventType: string
  actorEmail: string
  timestamp: string
  fabricTxId: string | null
  detail: string | null
}
interface CustodyGraph {
  docId: string
  fileName: string
  events: CustodyEvent[]
}

interface Props { docId: string; fileName: string; onClose: () => void }

const CAT: Record<string, { color: string; ring: string; Icon: typeof Upload }> = {
  UPLOAD:   { color: 'bg-gold-500 text-navy-950', ring: 'ring-gold-500/20', Icon: Upload },
  ACCESS:   { color: 'bg-emerald-600 text-white', ring: 'ring-emerald-600/20', Icon: Eye },
  SHARE:    { color: 'bg-blue-600 text-white', ring: 'ring-blue-600/20', Icon: Share2 },
  SIGN:     { color: 'bg-gold-600 text-navy-950', ring: 'ring-gold-600/20', Icon: PenTool },
  VERSION:  { color: 'bg-indigo-600 text-white', ring: 'ring-indigo-600/20', Icon: GitBranch },
  ROTATION: { color: 'bg-rose-950 text-rose-300 border border-rose-500/30', ring: 'ring-rose-500/10', Icon: KeyRound },
  OTHER:    { color: 'bg-slate-750 text-text-secondary', ring: 'ring-slate-700/20', Icon: Dot },
}

export function ChainOfCustodyModal({ docId, fileName, onClose }: Props) {
  const [graph, setGraph] = useState<CustodyGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CustodyEvent | null>(null)

  useEffect(() => {
    api.get<CustodyGraph>(`/documents/${docId}/custody`)
      .then((r) => setGraph(r.data))
      .catch(() => setGraph(null))
      .finally(() => setLoading(false))
  }, [docId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl max-h-[85vh] flex flex-col p-0 border border-gold-500/20 shadow-gold-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gold-500/10">
          <div className="flex items-center gap-2 min-w-0">
            <Network className="w-5 h-5 text-gold-500 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-serif font-semibold text-lg text-gold-300 truncate">Chain of Custody</h2>
              <p className="text-xs text-text-secondary truncate">{fileName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-navy-950/60 rounded-lg text-text-secondary hover:text-text-primary transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 overflow-y-auto scrollbar-thin flex-1">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gold-500" /></div>
          ) : !graph || graph.events.length === 0 ? (
            <p className="text-sm text-text-secondary py-6 text-center">No custody events recorded yet.</p>
          ) : (
            <div className="flex flex-col md:flex-row gap-5 items-stretch">
              <ol className="relative border-l border-gold-500/10 ml-3.5 space-y-4 flex-1">
                {graph.events.map((e, i) => {
                  const c = CAT[e.category] ?? CAT.OTHER
                  const Icon = c.Icon
                  return (
                    <li key={i} className="ml-5 relative">
                      <span className={`absolute -left-[27px] top-1.5 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-navy-900 ${c.color}`}>
                        <Icon className="w-3 h-3" />
                      </span>
                      <button onClick={() => setSelected(e)}
                        className={`text-left w-full rounded-xl border p-3 transition-all hover:border-gold-500/30 bg-navy-950/20 ${
                          selected === e 
                            ? 'border-gold-500/50 bg-gold-500/5 shadow-gold-sm' 
                            : 'border-gold-500/10'
                        }`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-text-primary">{e.eventType.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] text-text-muted font-mono">{new Date(e.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-text-secondary mt-1">{e.actorEmail}{e.fabricTxId && <span className="ml-2 font-mono text-gold-400">tx {e.fabricTxId.slice(0, 10)}…</span>}</p>
                      </button>
                    </li>
                  )
                })}
              </ol>
              {selected && (
                <div className="w-full md:w-64 shrink-0 rounded-xl border border-gold-500/15 bg-navy-950/40 p-4 self-start space-y-3.5">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gold-500/60">{selected.category}</p>
                    <p className="font-serif font-bold text-gold-300 text-sm mt-0.5">{selected.eventType.replace(/_/g, ' ')}</p>
                  </div>
                  <div className="space-y-1.5 text-xs text-text-secondary">
                    <p className="truncate"><strong className="text-[10px] text-text-muted uppercase block">Actor</strong>{selected.actorEmail}</p>
                    <p><strong className="text-[10px] text-text-muted uppercase block">Timestamp</strong>{new Date(selected.timestamp).toLocaleString()}</p>
                    {selected.fabricTxId && (
                      <p className="break-all font-mono text-[10px] text-gold-400">
                        <strong className="text-[10px] text-text-muted uppercase block font-sans">Fabric TxID</strong>
                        {selected.fabricTxId}
                      </p>
                    )}
                  </div>
                  {selected.detail && (
                    <pre className="text-[10px] text-text-secondary whitespace-pre-wrap break-all bg-navy-950 border border-gold-500/10 rounded-lg p-2.5 font-mono max-h-40 overflow-y-auto scrollbar-thin">
                      {selected.detail}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
