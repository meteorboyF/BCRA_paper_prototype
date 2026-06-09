import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Gavel, Calendar, Plus, Trash2, Bell, Loader2, AlertCircle,
  Scale, ChevronDown, Send,
} from 'lucide-react'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import toast from 'react-hot-toast'

interface CaseDto { id: string; title: string; status: string }
interface Hearing {
  id: string
  caseId: string
  caseTitle: string
  title: string
  hearingDate: string
  location: string
  courtName: string
  hearingType: string
  notes: string
  createdAt: string
}

const HEARING_TYPES = [
  'COURT_HEARING', 'PRETRIAL_CONFERENCE', 'MEDIATION', 'ARBITRATION',
  'DEPOSITION', 'MOTION_HEARING', 'STATUS_CONFERENCE', 'SENTENCING', 'APPEAL', 'OTHER',
]

export default function HearingManager() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // New hearing form
  const [caseId, setCaseId] = useState('')
  const [title, setTitle] = useState('')
  const [hearingDate, setHearingDate] = useState('')
  const [hearingTime, setHearingTime] = useState('09:00')
  const [location, setLocation] = useState('')
  const [courtName, setCourtName] = useState('')
  const [hearingType, setHearingType] = useState('COURT_HEARING')
  const [notes, setNotes] = useState('')

  // Reminder
  const [reminderHearing, setReminderHearing] = useState<Hearing | null>(null)
  const [reminderRecipient, setReminderRecipient] = useState('')
  const [reminderBody, setReminderBody] = useState('')
  const [sendingReminder, setSendingReminder] = useState(false)

  const hearingsQuery = useQuery({
    queryKey: queryKeys.hearingsUpcoming(),
    queryFn: async () => (await api.get('/hearings/upcoming')).data ?? [],
  })
  const casesQuery = useQuery({
    queryKey: [...queryKeys.cases(), 'all-100'],
    queryFn: async () => (await api.get('/cases', { params: { size: 100 } })).data?.content ?? [],
  })
  const hearings: Hearing[] = hearingsQuery.data ?? []
  const cases: CaseDto[] = casesQuery.data ?? []
  const loading = hearingsQuery.isLoading || casesQuery.isLoading
  const error = hearingsQuery.isError ? 'Failed to load hearings' : ''
  const refreshHearings = () => queryClient.invalidateQueries({ queryKey: queryKeys.hearingsUpcoming() })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!caseId || !title || !hearingDate || !hearingTime) return
    setSubmitting(true)
    try {
      await api.post('/hearings', {
        caseId,
        title,
        hearingDate: new Date(`${hearingDate}T${hearingTime}`).toISOString(),
        location: location || null,
        courtName: courtName || null,
        hearingType,
        notes: notes || null,
      })
      toast.success('Hearing scheduled')
      refreshHearings()
      setShowForm(false)
      setTitle(''); setHearingDate(''); setHearingTime('09:00'); setLocation(''); setCourtName(''); setNotes('')
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Failed to schedule hearing')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    await api.delete(`/hearings/${id}`).catch(() => {})
    refreshHearings()
    toast.success('Hearing removed')
  }

  const handleSendReminder = async () => {
    if (!reminderHearing || !reminderRecipient.trim()) return
    setSendingReminder(true)
    try {
      const recipRes = await api.get('/users/by-email', { params: { email: reminderRecipient.trim() } })
      await api.post('/reminders', {
        recipientId: recipRes.data.id,
        caseId: reminderHearing.caseId,
        title: `Hearing Reminder: ${reminderHearing.title}`,
        body: reminderBody || `You have a hearing scheduled: ${reminderHearing.title} on ${new Date(reminderHearing.hearingDate).toLocaleDateString()}${reminderHearing.courtName ? ` at ${reminderHearing.courtName}` : ''}. ${reminderHearing.notes ?? ''}`,
        dueAt: reminderHearing.hearingDate,
        priority: 'HIGH',
      })
      toast.success('Reminder sent to client')
      setReminderHearing(null)
      setReminderRecipient('')
      setReminderBody('')
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Failed to send reminder')
    } finally {
      setSendingReminder(false)
    }
  }

  const upcoming = hearings.filter((h) => new Date(h.hearingDate) >= new Date())
  const past = hearings.filter((h) => new Date(h.hearingDate) < new Date())

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-gold-300">Hearing Manager</h1>
          <p className="text-text-secondary text-sm mt-0.5">Schedule hearings and send reminders to clients</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus className="w-4 h-4" /> Schedule Hearing
        </button>
      </div>

      {/* ── Create Form ───────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="card border border-gold-500/30 shadow-gold-sm">
          <h2 className="font-serif font-semibold text-gold-300 mb-4 flex items-center gap-2">
            <Gavel className="w-4 h-4 text-gold-500" /> New Hearing
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Case *</label>
                <select className="input bg-navy-950 text-text-primary" value={caseId} onChange={(e) => setCaseId(e.target.value)} required>
                  <option value="">— Select case —</option>
                  {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Hearing Type</label>
                <select className="input bg-navy-950 text-text-primary" value={hearingType} onChange={(e) => setHearingType(e.target.value)}>
                  {HEARING_TYPES.map((t) => <option key={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Title *</label>
              <input className="input" placeholder="e.g. Motion to Dismiss Hearing" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Date *</label>
                <input type="date" className="input text-text-primary" value={hearingDate} onChange={(e) => setHearingDate(e.target.value)} required />
              </div>
              <div>
                <label className="label">Time *</label>
                <input type="time" className="input text-text-primary" value={hearingTime} onChange={(e) => setHearingTime(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Court Name</label>
                <input className="input" placeholder="e.g. Superior Court of California" value={courtName} onChange={(e) => setCourtName(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="label">Location / Courtroom</label>
              <input className="input" placeholder="e.g. Room 302, 210 West Temple Street" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>

            <div>
              <label className="label">Notes for Client</label>
              <textarea className="input min-h-[80px] resize-y" placeholder="Instructions, what to bring, dress code…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn-secondary py-2.5 justify-center">Cancel</button>
              <button type="submit" disabled={submitting || !caseId || !title || !hearingDate} className="flex-1 btn-primary py-2.5 justify-center disabled:opacity-50">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Scheduling…</> : <><Calendar className="w-4 h-4" /> Schedule</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gold-500" /></div>}
      {error && !loading && (
        <div className="flex items-center gap-3 bg-error/15 border border-error/30 rounded-xl px-4 py-3 text-sm text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" /> {error}
        </div>
      )}

      {/* ── Upcoming ──────────────────────────────────────────────────────────── */}
      {!loading && (
        <>
          <div className="space-y-3">
            <h2 className="font-sans font-bold text-xs uppercase tracking-widest text-gold-500/60 mb-2">
              Upcoming ({upcoming.length})
            </h2>
            {upcoming.length === 0 && (
              <p className="text-sm text-text-secondary py-4 text-center">No upcoming hearings scheduled</p>
            )}
            {upcoming.map((h) => (
              <HearingCard
                key={h.id}
                hearing={h}
                onDelete={handleDelete}
                onRemind={() => setReminderHearing(h)}
              />
            ))}
          </div>

          {past.length > 0 && (
            <div className="space-y-3 mt-8">
              <h2 className="font-sans font-bold text-xs uppercase tracking-widest text-text-muted mb-2">
                Past ({past.length})
              </h2>
              {past.slice(0, 5).map((h) => (
                <HearingCard key={h.id} hearing={h} onDelete={handleDelete} past />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Reminder Modal ────────────────────────────────────────────────────── */}
      {reminderHearing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 border border-gold-500/20 shadow-gold-md space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center">
                <Bell className="w-5 h-5 text-gold-400" />
              </div>
              <div>
                <h2 className="font-serif font-bold text-lg text-gold-300">Send Hearing Reminder</h2>
                <p className="text-xs text-text-secondary truncate max-w-[260px]">{reminderHearing.title}</p>
              </div>
            </div>

            <div>
              <label className="label">Client Email</label>
              <input className="input" placeholder="client@example.com" value={reminderRecipient} onChange={(e) => setReminderRecipient(e.target.value)} />
            </div>

            <div>
              <label className="label">Custom Message (optional)</label>
              <textarea
                className="input min-h-[80px] resize-y"
                placeholder="Leave blank to send default hearing details…"
                value={reminderBody}
                onChange={(e) => setReminderBody(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setReminderHearing(null)} className="flex-1 btn-secondary py-2.5 justify-center">Cancel</button>
              <button
                onClick={handleSendReminder}
                disabled={sendingReminder || !reminderRecipient.trim()}
                className="flex-1 btn-primary py-2.5 justify-center disabled:opacity-50"
              >
                {sendingReminder ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send Reminder</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function HearingCard({ hearing, onDelete, onRemind, past }: {
  hearing: Hearing
  onDelete: (id: string) => void
  onRemind?: () => void
  past?: boolean
}) {
  const date = new Date(hearing.hearingDate)
  return (
    <div className={`card ${past ? 'opacity-50' : 'card-glow-hover'}`}>
      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 rounded-xl flex-shrink-0 flex flex-col items-center justify-center text-center border ${
          past 
            ? 'bg-navy-950/40 border-gold-500/10 text-text-secondary' 
            : 'bg-gold-500/10 border-gold-500/20 text-gold-300'
        }`}>
          <span className={`text-[9px] font-bold uppercase ${past ? 'text-text-muted' : 'text-gold-400'}`}>
            {date.toLocaleDateString('en-US', { month: 'short' })}
          </span>
          <span className={`text-base font-bold leading-none ${past ? 'text-text-muted' : 'text-gold-300'}`}>
            {date.getDate()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-text-primary text-sm">{hearing.title}</p>
            <span className="text-[10px] bg-gold-500/10 text-gold-300 border border-gold-500/20 font-semibold px-2 py-0.5 rounded-full">
              {hearing.hearingType.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            {hearing.caseTitle} · {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
          {hearing.courtName && (
            <p className="text-xs text-text-secondary flex items-center gap-1 mt-0.5">
              <Scale className="w-3 h-3 text-gold-500/70" /> {hearing.courtName}
              {hearing.location && ` · ${hearing.location}`}
            </p>
          )}
          {hearing.notes && <p className="text-xs text-text-muted italic mt-1 line-clamp-2">{hearing.notes}</p>}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!past && onRemind && (
            <button
              onClick={onRemind}
              className="p-2 rounded-lg hover:bg-gold-500/10 text-text-secondary hover:text-gold-300 transition-colors"
              title="Send reminder to client"
            >
              <Bell className="w-4.5 h-4.5" />
            </button>
          )}
          <button
            onClick={() => onDelete(hearing.id)}
            className="p-2 rounded-lg hover:bg-rose-500/10 text-text-secondary hover:text-rose-400 transition-colors"
            title="Delete hearing"
          >
            <Trash2 className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
