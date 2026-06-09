import { useEffect, useState } from 'react'
import { ShieldCheck, Database, Loader2, Trash2, Lock, AlertCircle, Clock } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

interface InventoryItem { category: string; count: number; erasable: boolean; note: string }
interface DeletionRequest { id: string; status: string; reason: string | null; resolution: string | null; processedAt: string | null; createdAt: string }

const STATUS_CLS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  IN_REVIEW: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  DENIED: 'bg-red-50 text-red-700',
}

export default function ClientPrivacy() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [requests, setRequests] = useState<DeletionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get<InventoryItem[]>('/privacy/data-inventory'),
      api.get<DeletionRequest[]>('/privacy/deletion-requests/mine'),
    ])
      .then(([inv, req]) => { setInventory(inv.data); setRequests(req.data) })
      .catch(() => { /* non-fatal */ })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const submit = async () => {
    setSubmitting(true)
    try {
      await api.post('/privacy/deletion-requests', { reason: reason.trim() || null })
      toast.success('Erasure request submitted')
      setReason(''); setShowForm(false); load()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Could not submit request')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex justify-center py-32"><Loader2 className="w-7 h-7 animate-spin text-[#1d6464]" /></div>

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-[#1d6464]" /> Privacy &amp; Data
        </h1>
        <p className="text-text-muted text-sm mt-0.5">Everything the firm holds about you, and your right to erasure (GDPR).</p>
      </div>

      {/* Data inventory */}
      <div className="card">
        <h2 className="font-heading font-semibold text-text-primary flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-[#1d6464]" /> Data we hold about you
        </h2>
        <ul className="divide-y divide-border">
          {inventory.map((it) => (
            <li key={it.category} className="py-2.5 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{it.category}</p>
                <p className="text-xs text-text-muted">{it.note}</p>
              </div>
              <span className="text-sm font-semibold text-text-primary">{it.count}</span>
              {it.erasable ? (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">erasable</span>
              ) : (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> immutable</span>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-start gap-2 text-xs text-text-muted bg-surface-muted rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Blockchain-anchored records (signatures, audit trail) are immutable by design and cannot be erased — this preserves the integrity guarantees that protect you.
        </div>
      </div>

      {/* Erasure requests */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold text-text-primary">Erasure requests</h2>
          <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-[#1d6464] hover:bg-[#1d6464]/10 rounded-lg px-2.5 py-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Request deletion
          </button>
        </div>

        {showForm && (
          <div className="mb-4 rounded-xl border border-border bg-surface-muted/50 p-3 space-y-2">
            <textarea className="input min-h-[70px] resize-y" placeholder="Reason for your request (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="btn border border-border text-text-secondary py-1.5 px-3 text-sm">Cancel</button>
              <button onClick={submit} disabled={submitting} className="btn-primary py-1.5 px-4 text-sm disabled:opacity-50">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit request'}
              </button>
            </div>
          </div>
        )}

        {requests.length === 0 ? (
          <p className="text-sm text-text-muted">No requests submitted.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="rounded-xl border border-border px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${STATUS_CLS[r.status] ?? 'bg-slate-100 text-slate-600'}`}>{r.status.replace('_', ' ')}</span>
                  <span className="text-xs text-text-muted flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                {r.reason && <p className="text-sm text-text-secondary mt-1.5">{r.reason}</p>}
                {r.resolution && <p className="text-xs text-text-muted mt-1">Resolution: {r.resolution}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
