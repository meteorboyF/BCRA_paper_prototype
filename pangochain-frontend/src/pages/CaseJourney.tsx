import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitBranch, Plus, Loader2, AlertCircle, ArrowLeft, X, FileText, User as UserIcon, Calendar,
  GitMerge, Check, ChevronDown, ChevronRight, CircleDot,
} from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'

interface Node {
  id: string
  caseId: string
  parentId: string | null
  mergeIntoId: string | null
  authorId: string | null
  authorName: string
  nodeType: string
  title: string
  description: string | null
  linkedDocId: string | null
  nodeDate: string
  createdAt: string
  merged: boolean
  mergedAt: string | null
}

interface Doc { id: string; fileName: string }

const TYPE_STYLE: Record<string, { dot: string; chip: string }> = {
  ROOT:     { dot: '#C9A84C', chip: 'bg-gold-500/10 text-gold-300 border border-gold-500/20' },
  FINDING:  { dot: '#1A5C4A', chip: 'bg-success/10 text-emerald-400 border border-success/30' },
  EVIDENCE: { dot: '#C9A84C', chip: 'bg-gold-500/10 text-gold-300 border border-gold-500/20' },
  RESEARCH: { dot: '#8A9BB0', chip: 'bg-slate-800/50 text-text-secondary border border-gold-500/10' },
  LOOPHOLE: { dot: '#8B1A1A', chip: 'bg-error/10 text-rose-400 border border-error/30' },
  HEARING:  { dot: '#C9A84C', chip: 'bg-gold-500/10 text-gold-300 border border-gold-500/20' },
  FILING:   { dot: '#1A5C4A', chip: 'bg-success/10 text-emerald-400 border border-success/30' },
}

const TYPES = ['FINDING', 'EVIDENCE', 'RESEARCH', 'LOOPHOLE', 'HEARING', 'FILING']

export default function CaseJourney() {
  const { id: caseId } = useParams<{ id: string }>()
  const [nodes, setNodes] = useState<Node[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Node | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd] = useState(false)

  // add-node form
  const [title, setTitle] = useState('')
  const [nodeType, setNodeType] = useState('FINDING')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState('')
  const [mergeIntoId, setMergeIntoId] = useState('')
  const [linkedDocId, setLinkedDocId] = useState('')
  const [saving, setSaving] = useState(false)
  const [merging, setMerging] = useState(false)

  const load = () => {
    if (!caseId) return
    api.get<Node[]>(`/cases/${caseId}/nodes`)
      .then((r) => {
        // Sort chronologically
        const sorted = r.data.sort((a, b) => new Date(a.nodeDate).getTime() - new Date(b.nodeDate).getTime())
        setNodes(sorted)
        setExpandedIds((prev) => {
          const next = new Set(prev)
          sorted.filter((n) => n.nodeType === 'ROOT' || n.parentId === null).forEach((n) => next.add(n.id))
          return next
        })
      })
      .catch((e) => setError(e.response?.data?.detail ?? 'Failed to load journey'))
      .finally(() => setLoading(false))
  }
  
  useEffect(load, [caseId])

  useEffect(() => {
    if (!caseId) return
    api.get<Doc[]>(`/documents/by-case/${caseId}`)
      .then((r) => setDocs(r.data))
      .catch(() => setDocs([]))
  }, [caseId])

  const docName = (id: string | null) => (id ? docs.find((d) => d.id === id)?.fileName ?? 'document' : null)

  const childrenByParent = nodes.reduce<Record<string, Node[]>>((acc, node) => {
    const key = node.parentId ?? 'rootless'
    acc[key] = [...(acc[key] ?? []), node]
    return acc
  }, {})

  for (const key of Object.keys(childrenByParent)) {
    childrenByParent[key].sort((a, b) => new Date(a.nodeDate).getTime() - new Date(b.nodeDate).getTime())
  }

  const rootNode = nodes.find((n) => n.nodeType === 'ROOT') ?? nodes.find((n) => n.parentId === null) ?? null
  const rootChildren = rootNode ? childrenByParent[rootNode.id] ?? [] : nodes.filter((n) => n.parentId === null)

  const toggleNode = (node: Node) => {
    setSelected((current) => current?.id === node.id ? null : node)
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(node.id) && selected?.id === node.id) next.delete(node.id)
      else next.add(node.id)
      return next
    })
  }

  const handleConsolidate = async (target: Node) => {
    setMerging(true)
    try {
      const { data } = await api.post<Node[]>(`/cases/${caseId}/nodes/${target.id}/merge`)
      setNodes(data.sort((a, b) => new Date(a.nodeDate).getTime() - new Date(b.nodeDate).getTime()))
      setSelected(data.find((n) => n.id === target.id) ?? null)
      toast.success('Branch consolidated into ' + target.title)
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Could not consolidate')
    } finally {
      setMerging(false)
    }
  }

  const handleAdd = async () => {
    if (!title.trim() || !caseId) return
    setSaving(true)
    try {
      await api.post(`/cases/${caseId}/nodes`, {
        title: title.trim(),
        nodeType,
        description: description.trim() || null,
        parentId: parentId || null,
        mergeIntoId: mergeIntoId || null,
        linkedDocId: linkedDocId || null,
      })
      toast.success('Added to case journey')
      setShowAdd(false); setTitle(''); setDescription(''); setParentId(''); setMergeIntoId(''); setNodeType('FINDING'); setLinkedDocId('')
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Could not add node')
    } finally {
      setSaving(false)
    }
  }

  const renderNode = (node: Node, depth = 0) => {
    const children = childrenByParent[node.id] ?? []
    const expanded = expandedIds.has(node.id)
    const active = selected?.id === node.id
    const typeStyle = TYPE_STYLE[node.nodeType] || TYPE_STYLE.FINDING
    const mergeTarget = node.mergeIntoId ? nodes.find((n) => n.id === node.mergeIntoId) : null
    const contributors = nodes.filter((n) => n.mergeIntoId === node.id)
    const unmerged = contributors.filter((c) => !c.merged)

    return (
      <div key={node.id} className="relative">
        {depth > 0 && (
          <div className="absolute -left-6 top-0 h-6 w-6 border-l border-b border-gold-500/20 rounded-bl-xl" />
        )}

        <motion.button
          type="button"
          layout
          onClick={() => toggleNode(node)}
          className={`group relative w-full text-left rounded-xl border px-4 py-3 transition-all duration-200 ${
            active
              ? 'bg-gold-500/10 border-gold-500/40 shadow-gold-sm'
              : 'bg-navy-950/50 border-gold-500/10 hover:border-gold-500/30 hover:bg-navy-900/60'
          } ${node.merged ? 'opacity-70' : ''}`}
        >
          <div className="flex items-start gap-3">
            <div
              className="mt-1 h-4 w-4 rounded-full border-2 shrink-0 shadow-sm"
              style={{ borderColor: typeStyle.dot, backgroundColor: active ? typeStyle.dot : 'transparent' }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${typeStyle.chip}`}>
                  {node.nodeType === 'ROOT' ? 'Case Started' : node.nodeType}
                </span>
                {node.merged && (
                  <span className="text-[9px] text-emerald-400 bg-success/15 px-2 py-0.5 rounded border border-success/30 uppercase tracking-wider">
                    consolidated
                  </span>
                )}
                {children.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-text-muted">
                    {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    {children.length}
                  </span>
                )}
              </div>
              <p className="font-serif font-bold text-gold-200 mt-1 truncate group-hover:text-gold-100">{node.title}</p>
              <p className="text-[10px] text-text-secondary font-mono mt-1">
                {new Date(node.nodeDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </div>
            <CircleDot className={`w-4 h-4 mt-1 shrink-0 ${active ? 'text-gold-300' : 'text-text-muted group-hover:text-gold-400'}`} />
          </div>
        </motion.button>

        <AnimatePresence initial={false}>
          {active && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 mb-4 rounded-xl border border-gold-500/15 bg-navy-950/60 p-4 ml-0 md:ml-7">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-gold-300">{node.title}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-text-secondary font-mono">
                      <span className="inline-flex items-center gap-1"><UserIcon className="w-3.5 h-3.5 text-gold-400" /> {node.authorName}</span>
                      <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-gold-400" /> {new Date(node.nodeDate).toLocaleString()}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelected(null) }}
                    className="p-1.5 rounded-lg border border-gold-500/10 text-text-secondary hover:text-text-primary hover:border-gold-500/30"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {node.description ? (
                  <p className="mt-4 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{node.description}</p>
                ) : (
                  <p className="mt-4 text-sm text-text-muted italic">No details recorded yet.</p>
                )}

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {node.linkedDocId && (
                    <Link to="/documents" className="inline-flex items-center gap-2 rounded-lg border border-gold-500/15 bg-navy-900/60 px-3 py-2 text-gold-300 hover:border-gold-500/30">
                      <FileText className="w-4 h-4 text-gold-400" /> {docName(node.linkedDocId)}
                    </Link>
                  )}
                  {mergeTarget && (
                    <button
                      type="button"
                      onClick={() => { setSelected(mergeTarget); setExpandedIds((prev) => new Set(prev).add(mergeTarget.id)) }}
                      className="inline-flex items-center gap-2 rounded-lg border border-gold-500/15 bg-navy-900/60 px-3 py-2 text-text-secondary hover:text-gold-300 hover:border-gold-500/30"
                    >
                      <GitMerge className="w-4 h-4 text-gold-400" /> Converges into {mergeTarget.title}
                    </button>
                  )}
                </div>

                {(node.nodeType === 'HEARING' || node.nodeType === 'FILING') && (
                  <div className="mt-5 rounded-xl border border-gold-500/10 bg-navy-900/50 p-4">
                    <div className="flex items-center justify-between gap-3 border-b border-gold-500/5 pb-3">
                      <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold-300">
                        <GitMerge className="w-4 h-4 text-gold-400" /> Outcome Consolidation
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">{contributors.length} linked branch{contributors.length === 1 ? '' : 'es'}</span>
                    </div>
                    {contributors.length === 0 ? (
                      <p className="pt-3 text-xs text-text-muted italic">No findings or evidence converge into this outcome yet.</p>
                    ) : (
                      <div className="pt-3 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {contributors.map((c) => (
                            <button
                              type="button"
                              key={c.id}
                              onClick={() => { setSelected(c); setExpandedIds((prev) => new Set(prev).add(c.parentId ?? node.id)) }}
                              className="rounded-lg border border-gold-500/10 bg-navy-950/50 px-3 py-2 text-left hover:border-gold-500/30"
                            >
                              <p className="text-xs text-gold-200 truncate">{c.title}</p>
                              <p className="text-[10px] text-text-muted">{c.merged ? 'Consolidated' : 'Pending'}</p>
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => handleConsolidate(node)}
                          disabled={merging || unmerged.length === 0}
                          className="btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                        >
                          {merging ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Consolidating...</>
                          ) : unmerged.length === 0 ? (
                            <><Check className="w-3.5 h-3.5 mr-1" /> Outcome Consolidated</>
                          ) : (
                            <><GitMerge className="w-3.5 h-3.5 mr-1.5" /> Consolidate {unmerged.length} Node{unmerged.length === 1 ? '' : 's'}</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {children.length > 0 && expanded && (
          <div className="relative ml-6 md:ml-9 mt-3 space-y-3 border-l border-gold-500/15 pl-6">
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-gold-300">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 bg-error/10 border border-error/30 rounded-xl px-4 py-3 text-xs text-rose-400">
        <AlertCircle className="w-4 h-4 shrink-0" /> {error}
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in text-text-primary">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gold-500/10 pb-6">
        <div>
          <Link to={`/cases/${caseId}`} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-gold-300 mb-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Return to Matter
          </Link>
          <div className="flex items-center gap-3">
            <GitBranch className="w-6 h-6 text-gold-400" />
            <h1 className="font-serif text-3xl font-bold tracking-wide text-gold-300">Evidentiary Journey</h1>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Milestones are lawyer-authored progress nodes. Hearings can act as merge points; the immutable Events Feed remains the raw audit ledger.
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-xs uppercase tracking-wider font-bold px-4 py-2.5">
          <Plus className="w-4 h-4" /> Add Milestone
        </button>
      </div>

      {/* Main dynamic tree canvas */}
      <div className="card bg-navy-900/60 p-6 border-gold-500/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-56 h-56 bg-[radial-gradient(circle_at_top_right,rgba(201,168,76,0.05),transparent_14rem)]" />
        <div className="relative space-y-3">
          {rootNode ? (
            <>
              <div className="mb-5 flex justify-center">
                <div className="rounded-full border border-gold-500/20 bg-gold-500/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gold-300">
                  Case centerline
                </div>
              </div>
              {renderNode(rootNode)}
              {rootChildren.length === 0 && (
                <div className="ml-9 rounded-xl border border-dashed border-gold-500/15 bg-navy-950/30 px-4 py-6 text-sm text-text-secondary">
                  No branch nodes yet. Add a finding, hearing, filing, or evidence node to begin the journey.
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gold-500/15 bg-navy-950/30 px-4 py-10 text-center text-sm text-text-secondary">
              No journey nodes have been created for this case yet.
            </div>
          )}
        </div>
      </div>

      {/* Add milestone Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg bg-navy-900 border-gold-500/20 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gold-500/10 pb-3">
              <h2 className="font-serif text-xl font-bold text-gold-300">Add Milestone Entry</h2>
              <button
                onClick={() => setShowAdd(false)}
                className="p-1 rounded-lg border border-gold-500/10 text-text-secondary hover:text-text-primary hover:border-gold-500/30 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="label">Milestone Title *</label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Discovered evidence chain breach in server logs" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Milestone Classification</label>
                  <select className="input" value={nodeType} onChange={(e) => setNodeType(e.target.value)}>
                    {TYPES.map((t) => <option key={t} value={t} className="bg-navy-950">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Branch From node</label>
                  <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                    <option value="" className="bg-navy-950">(case root)</option>
                    {nodes.map((n) => <option key={n.id} value={n.id} className="bg-navy-950">{n.title}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Merge Into target (optional)</label>
                  <select className="input" value={mergeIntoId} onChange={(e) => setMergeIntoId(e.target.value)}>
                    <option value="" className="bg-navy-950">(none)</option>
                    {nodes.filter((n) => n.nodeType === 'HEARING' || n.nodeType === 'FILING').map((n) => (
                      <option key={n.id} value={n.id} className="bg-navy-950">{n.title} ({n.nodeType})</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-text-muted">Use this to converge evidence or research into a hearing or filing, then continue the case tree afterward.</p>
                </div>
                <div>
                  <label className="label">Evidentiary doc link (optional)</label>
                  <select className="input" value={linkedDocId} onChange={(e) => setLinkedDocId(e.target.value)}>
                    <option value="" className="bg-navy-950">(none)</option>
                    {docs.map((d) => <option key={d.id} value={d.id} className="bg-navy-950">{d.fileName}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Briefing / Audit Notes</label>
                <textarea className="input min-h-[90px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Record summary of evidence, depositions details..." />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-gold-500/10">
              <button onClick={() => setShowAdd(false)} className="btn-secondary text-xs uppercase tracking-wider py-2 px-4">Cancel</button>
              <button onClick={handleAdd} disabled={saving || !title.trim()} className="btn-primary text-xs uppercase tracking-wider font-bold py-2.5 px-4 disabled:opacity-50">
                {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Submitting...</> : 'Log Milestone'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
