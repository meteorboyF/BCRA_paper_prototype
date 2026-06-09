import { useEffect, useState } from 'react'
import { AlarmClock, Plus, Loader2, Check, Trash2, X, CalendarClock } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'

interface Deadline {
  id: string
  caseId: string
  title: string
  description: string | null
  deadlineType: string
  deadlineDate: string
  completed: boolean
  completedAt: string | null
  createdAt: string
}

interface Props {
  caseId: string
  canEdit?: boolean
}

const TYPES = ['CUSTOM', 'STATUTE_OF_LIMITATIONS', 'FILING', 'COURT', 'DISCOVERY']
const TYPE_LABEL: Record<string, string> = {
  CUSTOM: 'Custom', STATUTE_OF_LIMITATIONS: 'Statute of Limitations', FILING: 'Filing', COURT: 'Court', DISCOVERY: 'Discovery',
}

const DAY = 86_400_000

/** Colour band by urgency: <7d red, <30d amber, else green; completed/past handled separately. */
function urgency(date: string, completed: boolean) {
  if (completed) return { band: 'done', cls: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-700' }
  const diff = new Date(date).getTime() - Date.now()
  if (diff < 0) return { band: 'overdue', cls: 'border-red-300 bg-red-50', text: 'text-red-700' }
  if (diff < 7 * DAY) return { band: 'soon', cls: 'border-red-200 bg-red-50/60', text: 'text-red-600' }
  if (diff < 30 * DAY) return { band: 'near', cls: 'border-amber-200 bg-amber-50/60', text: 'text-amber-700' }
  return { band: 'later', cls: 'border-emerald-200 bg-emerald-50/40', text: 'text-emerald-700' }
}

function relative(date: string) {
  const diff = new Date(date).getTime() - Date.now()
  const days = Math.round(Math.abs(diff) / DAY)
  if (diff < 0) return `${days} day${days !== 1 ? 's' : ''} overdue`
  if (days === 0) return 'due today'
  return `in ${days} day${days !== 1 ? 's' : ''}`
}

export function CaseDeadlinesPanel({ caseId, canEdit = false }: Props) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [deadlineType, setDeadlineType] = useState('CUSTOM')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    api.get<Deadline[]>(`/cases/${caseId}/deadlines`)
      .then((r) => setDeadlines(r.data))
      .catch(() => setDeadlines([]))
      .finally(() => setLoading(false))
  }
  useEffect(load, [caseId])

  const add = async () => {
    if (!title.trim() || !date) return
    setSaving(true)
    try {
      await api.post(`/cases/${caseId}/deadlines`, {
        title: title.trim(), deadlineType, deadlineDateEpochMs: new Date(date).getTime(),
      })
      setTitle(''); setDate(''); setDeadlineType('CUSTOM'); setShowAdd(false)
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Could not add deadline')
    } finally {
      setSaving(false)
    }
  }

  const toggleComplete = async (d: Deadline) => {
    try {
      await api.put(`/cases/${caseId}/deadlines/${d.id}`, { completed: !d.completed })
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Could not update deadline')
    }
  }

  const remove = async (d: Deadline) => {
    try {
      await api.delete(`/cases/${caseId}/deadlines/${d.id}`)
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Could not delete deadline')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading font-semibold text-text-primary flex items-center gap-2">
          <AlarmClock className="w-4 h-4 text-[#1d6464]" /> Deadlines &amp; Limitations
        </h2>
        {canEdit && (
          <button onClick={() => setShowAdd((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-[#1d6464] hover:bg-[#1d6464]/10 rounded-lg px-2 py-1">
            <Plus className="w-3.5 h-3.5" /> Add deadline
          </button>
        )}
      </div>

      {canEdit && showAdd && (
        <div className="mb-4 rounded-xl border border-border bg-surface-muted/50 p-3 space-y-2">
          <input className="input" placeholder="Deadline title (e.g. File statement of defence)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex items-center gap-2">
            <select className="input flex-1" value={deadlineType} onChange={(e) => setDeadlineType(e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <input type="date" className="input flex-1" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="p-2 text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
            <button onClick={add} disabled={saving || !title.trim() || !date} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#1d6464]" /></div>
      ) : deadlines.length === 0 ? (
        <p className="text-sm text-text-muted py-4">No deadlines tracked{canEdit ? ' — add court dates and limitation periods to stay ahead.' : '.'}</p>
      ) : (
        <ul className="space-y-2">
          {deadlines.map((d) => {
            const u = urgency(d.deadlineDate, d.completed)
            return (
              <li key={d.id} className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 ${u.cls}`}>
                <CalendarClock className={`w-4 h-4 shrink-0 ${u.text}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${d.completed ? 'text-text-muted line-through' : 'text-text-primary'}`}>{d.title}</p>
                  <p className="text-xs text-text-muted">
                    <span className="uppercase tracking-wide">{TYPE_LABEL[d.deadlineType] ?? d.deadlineType}</span>
                    {' · '}{new Date(d.deadlineDate).toLocaleDateString()}
                    {!d.completed && <span className={`ml-1 font-semibold ${u.text}`}>· {relative(d.deadlineDate)}</span>}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleComplete(d)} className={`p-1 rounded ${d.completed ? 'text-emerald-600' : 'text-text-muted hover:text-emerald-600'}`} title={d.completed ? 'Mark incomplete' : 'Mark done'}>
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(d)} className="p-1 text-text-muted hover:text-error" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
