import { useEffect, useState } from 'react'
import { ShieldCheck, Loader2, Check, X, Eye } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'

interface AdminRequest {
  id: string; userId: string; userEmail: string; status: string
  reason: string | null; resolution: string | null; createdAt: string
}

const STATUS_CLS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  IN_REVIEW: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  DENIED: 'bg-red-50 text-red-700',
}

export function DeletionRequestsAdminPanel() {
  const [requests, setRequests] = useState<AdminRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api.get<AdminRequest[]>('/privacy/deletion-requests')
      .then((r) => setRequests(r.data))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const process = async (id: string, status: string, resolution: string) => {
    setBusy(id)
    try {
      await api.post(`/privacy/deletion-requests/${id}/process`, { status, resolution })
      toast.success(`Request ${status.toLowerCase()}`)
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Could not update request')
    } finally {
      setBusy(null)
    }
  }

  const open = requests.filter((r) => r.status === 'PENDING' || r.status === 'IN_REVIEW')

  return (
    <div className="card">
      <h2 className="font-heading font-semibold text-text-primary flex items-center gap-2 mb-4">
        <ShieldCheck className="w-4 h-4 text-[#1d6464]" /> GDPR Erasure Requests
        {open.length > 0 && <span className="text-[10px] font-bold bg-amber-500 text-white rounded-full px-2 py-0.5">{open.length}</span>}
      </h2>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#1d6464]" /></div>
      ) : requests.length === 0 ? (
        <p className="text-sm text-text-muted">No erasure requests.</p>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li key={r.id} className="rounded-xl border border-border px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{r.userEmail}</p>
                  {r.reason && <p className="text-xs text-text-muted">{r.reason}</p>}
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0 ${STATUS_CLS[r.status] ?? 'bg-slate-100'}`}>{r.status.replace('_', ' ')}</span>
              </div>
              {(r.status === 'PENDING' || r.status === 'IN_REVIEW') && (
                <div className="flex items-center gap-2 mt-2">
                  {r.status === 'PENDING' && (
                    <button disabled={busy === r.id} onClick={() => process(r.id, 'IN_REVIEW', 'Under review')}
                      className="text-xs text-blue-700 hover:bg-blue-50 rounded px-2 py-1 inline-flex items-center gap-1"><Eye className="w-3 h-3" /> Review</button>
                  )}
                  <button disabled={busy === r.id} onClick={() => process(r.id, 'COMPLETED', 'Non-ledger data erased; immutable records retained as disclosed.')}
                    className="text-xs text-emerald-700 hover:bg-emerald-50 rounded px-2 py-1 inline-flex items-center gap-1"><Check className="w-3 h-3" /> Complete</button>
                  <button disabled={busy === r.id} onClick={() => process(r.id, 'DENIED', 'Request denied — legal retention obligation applies.')}
                    className="text-xs text-red-700 hover:bg-red-50 rounded px-2 py-1 inline-flex items-center gap-1"><X className="w-3 h-3" /> Deny</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
