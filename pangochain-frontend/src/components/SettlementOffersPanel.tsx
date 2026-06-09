import { useEffect, useState } from 'react'
import { Scale, Plus, Check, X, Loader2, AlertCircle, CheckCircle, Ban } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'

interface Offer {
  id: string
  caseId: string
  title: string
  monetaryValueCents: number
  currency: string
  nonMonetaryTerms?: string
  analysis?: string
  status: 'PROPOSED' | 'ACCEPTED' | 'REJECTED'
  respondedAt?: string
}

interface Props {
  caseId: string
  /** Lawyer/staff: can add offers. */
  canManage?: boolean
  /** Client: can accept/reject proposed offers. */
  canRespond?: boolean
}

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
  } catch {
    return `${currency} ${(cents / 100).toLocaleString()}`
  }
}

export function SettlementOffersPanel({ caseId, canManage, canRespond }: Props) {
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [acting, setActing] = useState<string | null>(null)

  // New-offer form
  const [title, setTitle] = useState('')
  const [value, setValue] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [terms, setTerms] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    try {
      const { data } = await api.get<Offer[]>(`/cases/${caseId}/settlement-offers`)
      setOffers(data)
    } catch {
      setError('Failed to load settlement offers')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [caseId])

  const addOffer = async () => {
    if (!title.trim()) return
    setSubmitting(true)
    try {
      await api.post(`/cases/${caseId}/settlement-offers`, {
        title,
        monetaryValueCents: Math.round((parseFloat(value) || 0) * 100),
        currency,
        nonMonetaryTerms: terms,
        analysis,
      })
      setTitle(''); setValue(''); setTerms(''); setAnalysis(''); setShowForm(false)
      toast.success('Offer added')
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Failed to add offer')
    } finally {
      setSubmitting(false)
    }
  }

  const respond = async (id: string, response: 'ACCEPTED' | 'REJECTED') => {
    setActing(id)
    try {
      await api.post(`/settlement-offers/${id}/respond`, { response })
      toast.success(`Offer ${response.toLowerCase()}`)
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Failed to record response')
    } finally {
      setActing(null)
    }
  }

  const proposed = offers.filter((o) => o.status === 'PROPOSED')

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-[#1d6464]" />
          <h2 className="font-heading font-semibold text-text-primary">Settlement Offers</h2>
        </div>
        {canManage && (
          <button onClick={() => setShowForm((s) => !s)} className="btn-primary text-sm py-1.5">
            <Plus className="w-4 h-4" /> Add Offer
          </button>
        )}
      </div>

      {canRespond && proposed.length > 1 && (
        <p className="text-xs text-text-muted mb-3">Compare the {proposed.length} open offers below side by side, then accept or reject.</p>
      )}

      {showForm && canManage && (
        <div className="border border-border rounded-xl p-4 mb-4 space-y-3 bg-surface-muted/40">
          <div>
            <label className="label">Offer title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Full & final settlement — Tranche A" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label">Monetary value</label>
              <input type="number" className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Currency</label>
              <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
            </div>
          </div>
          <div>
            <label className="label">Non-monetary terms</label>
            <textarea className="input min-h-[60px]" value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="e.g. mutual NDA, no admission of liability…" />
          </div>
          <div>
            <label className="label">Analysis / pros & cons (shown to client)</label>
            <textarea className="input min-h-[60px]" value={analysis} onChange={(e) => setAnalysis(e.target.value)} placeholder="Counsel's assessment of this offer." />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="btn border border-border text-text-secondary py-2 flex-1">Cancel</button>
            <button onClick={addOffer} disabled={submitting || !title.trim()} className="btn-primary py-2 flex-1 justify-center disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Offer'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#1d6464]" /></div>
      ) : error ? (
        <div className="flex items-center gap-2 text-error text-sm"><AlertCircle className="w-4 h-4" /> {error}</div>
      ) : offers.length === 0 ? (
        <p className="text-text-muted text-sm text-center py-6">No settlement offers yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {offers.map((o) => (
            <div key={o.id} className={`border rounded-xl p-4 ${
              o.status === 'ACCEPTED' ? 'border-success/40 bg-success/5'
                : o.status === 'REJECTED' ? 'border-border bg-surface-muted/40 opacity-70'
                : 'border-[#1d6464]/30'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-text-primary text-sm">{o.title}</p>
                {o.status === 'ACCEPTED' && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success"><CheckCircle className="w-3 h-3" /> ACCEPTED</span>}
                {o.status === 'REJECTED' && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-text-muted"><Ban className="w-3 h-3" /> REJECTED</span>}
              </div>
              <p className="text-2xl font-bold text-[#1d6464] mt-1">{money(o.monetaryValueCents, o.currency)}</p>
              {o.nonMonetaryTerms && (
                <div className="mt-2">
                  <p className="text-[10px] font-bold text-text-muted uppercase">Non-monetary terms</p>
                  <p className="text-xs text-text-secondary whitespace-pre-wrap">{o.nonMonetaryTerms}</p>
                </div>
              )}
              {o.analysis && (
                <div className="mt-2">
                  <p className="text-[10px] font-bold text-text-muted uppercase">Analysis</p>
                  <p className="text-xs text-text-secondary whitespace-pre-wrap">{o.analysis}</p>
                </div>
              )}
              {canRespond && o.status === 'PROPOSED' && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => respond(o.id, 'ACCEPTED')} disabled={acting === o.id}
                    className="flex-1 btn-primary py-1.5 text-sm justify-center disabled:opacity-50">
                    {acting === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Accept</>}
                  </button>
                  <button onClick={() => respond(o.id, 'REJECTED')} disabled={acting === o.id}
                    className="flex-1 btn border border-error/40 text-error hover:bg-red-50 py-1.5 text-sm justify-center disabled:opacity-50">
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
