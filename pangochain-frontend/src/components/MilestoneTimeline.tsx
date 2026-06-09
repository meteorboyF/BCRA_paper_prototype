import { useEffect, useState } from 'react'
import { Milestone as MilestoneIcon, Plus, Loader2, Check, CircleDot, Circle, X, Trash2, Calendar } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'

interface Milestone {
  id: string
  caseId: string
  title: string
  description: string | null
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  targetDate: string | null
  completedAt: string | null
  sortOrder: number
  createdAt: string
}

interface Props {
  caseId: string
  canEdit?: boolean
}

const SUGGESTED = ['Intake', 'Discovery', 'Pre-Trial Motions', 'Hearing', 'Resolution']
const NEXT_STATUS: Record<Milestone['status'], Milestone['status']> = {
  PENDING: 'IN_PROGRESS', IN_PROGRESS: 'COMPLETED', COMPLETED: 'PENDING',
}

export function MilestoneTimeline({ caseId, canEdit = false }: Props) {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    api.get<Milestone[]>(`/cases/${caseId}/milestones`)
      .then((r) => setMilestones(r.data))
      .catch(() => setMilestones([]))
      .finally(() => setLoading(false))
  }
  useEffect(load, [caseId])

  const addMilestone = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await api.post(`/cases/${caseId}/milestones`, {
        title: title.trim(),
        description: description.trim() || null,
        status: 'PENDING',
        targetDateEpochMs: targetDate ? new Date(targetDate).getTime() : null,
        sortOrder: milestones.length,
      })
      setTitle(''); setDescription(''); setTargetDate(''); setShowAdd(false)
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Could not add milestone')
    } finally {
      setSaving(false)
    }
  }

  const cycleStatus = async (m: Milestone) => {
    const next = NEXT_STATUS[m.status]
    try {
      await api.put(`/cases/${caseId}/milestones/${m.id}`, { status: next })
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Could not update milestone')
    }
  }

  const remove = async (m: Milestone) => {
    try {
      await api.delete(`/cases/${caseId}/milestones/${m.id}`)
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Could not delete milestone')
    }
  }

  const dot = (s: Milestone['status']) =>
    s === 'COMPLETED' ? <Check className="w-3.5 h-3.5 text-white" />
      : s === 'IN_PROGRESS' ? <CircleDot className="w-3.5 h-3.5 text-white" />
      : <Circle className="w-3 h-3 text-white" />
  const dotBg = (s: Milestone['status']) =>
    s === 'COMPLETED' ? 'bg-emerald-500' : s === 'IN_PROGRESS' ? 'bg-amber-500' : 'bg-slate-300'

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading font-semibold text-text-primary flex items-center gap-2">
          <MilestoneIcon className="w-4 h-4 text-[#1d6464]" /> Case Progress
        </h2>
        {canEdit && (
          <button onClick={() => setShowAdd((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-[#1d6464] hover:bg-[#1d6464]/10 rounded-lg px-2 py-1">
            <Plus className="w-3.5 h-3.5" /> Add milestone
          </button>
        )}
      </div>

      {canEdit && showAdd && (
        <div className="mb-4 rounded-xl border border-border bg-surface-muted/50 p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED.map((s) => (
              <button key={s} onClick={() => setTitle(s)} className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-white hover:border-[#1d6464]/40 text-text-secondary">{s}</button>
            ))}
          </div>
          <input className="input" placeholder="Milestone title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="input" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex items-center gap-2">
            <input type="date" className="input flex-1" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            <button onClick={addMilestone} disabled={saving || !title.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
            </button>
            <button onClick={() => setShowAdd(false)} className="p-2 text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#1d6464]" /></div>
      ) : milestones.length === 0 ? (
        <p className="text-sm text-text-muted py-4">No milestones yet{canEdit ? ' — add the first to give your client a progress view.' : '.'}</p>
      ) : (
        <ol className="relative border-l-2 border-border ml-2 space-y-4">
          {milestones.map((m) => (
            <li key={m.id} className="ml-5">
              <span className={`absolute -left-[11px] w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-white ${dotBg(m.status)} ${m.status === 'IN_PROGRESS' ? 'animate-pulse' : ''}`}>
                {dot(m.status)}
              </span>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`font-medium text-sm ${m.status === 'COMPLETED' ? 'text-text-muted line-through' : 'text-text-primary'}`}>{m.title}</p>
                  {m.description && <p className="text-xs text-text-muted mt-0.5">{m.description}</p>}
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-text-muted">
                    <span className={`font-semibold uppercase tracking-wide ${
                      m.status === 'COMPLETED' ? 'text-emerald-600' : m.status === 'IN_PROGRESS' ? 'text-amber-600' : 'text-slate-400'
                    }`}>{m.status.replace('_', ' ')}</span>
                    {m.targetDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(m.targetDate).toLocaleDateString()}</span>}
                    {m.completedAt && <span className="text-emerald-600">✓ {new Date(m.completedAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => cycleStatus(m)} className="text-[11px] text-[#1d6464] hover:bg-[#1d6464]/10 rounded px-1.5 py-1" title="Advance status">advance</button>
                    <button onClick={() => remove(m)} className="p-1 text-text-muted hover:text-error" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
