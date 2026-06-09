import { useEffect, useState } from 'react'
import { Receipt, Plus, Loader2, Trash2, FileText, Clock, DollarSign, Download, CreditCard, CheckCircle2 } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'

interface TimeEntry {
  id: string; description: string; minutes: number; rateCents: number
  amountCents: number; userEmail: string; entryDate: string; invoiced: boolean
}
interface Invoice {
  id: string; invoiceNumber: string; status: string; amountCents: number; minutesTotal: number; issuedAt: string
}
interface Summary {
  caseId: string; totalMinutes: number; totalAmountCents: number; unbilledAmountCents: number
  entries: TimeEntry[]; invoices: Invoice[]
}

const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const hrs = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`

interface Props { caseId: string; canEdit?: boolean }

export function BillingPanel({ caseId, canEdit = false }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [description, setDescription] = useState('')
  const [minutes, setMinutes] = useState('')
  const [rate, setRate] = useState('')
  const [saving, setSaving] = useState(false)
  const [invoicing, setInvoicing] = useState(false)
  const [payingInvoice, setPayingInvoice] = useState<string | null>(null)
  const [paidInvoices, setPaidInvoices] = useState<Set<string>>(new Set())

  const load = () => {
    setLoading(true)
    api.get<Summary>(`/cases/${caseId}/billing`)
      .then((r) => setSummary(r.data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false))
  }
  useEffect(load, [caseId])

  const addEntry = async () => {
    if (!description.trim() || !minutes) return
    setSaving(true)
    try {
      await api.post(`/cases/${caseId}/billing/time-entries`, {
        description: description.trim(),
        minutes: Number(minutes),
        rateCents: Math.round(Number(rate || '0') * 100),
      })
      setDescription(''); setMinutes(''); setRate(''); setShowAdd(false)
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Could not add time entry')
    } finally {
      setSaving(false)
    }
  }

  const deleteEntry = async (id: string) => {
    try { await api.delete(`/cases/${caseId}/billing/time-entries/${id}`); load() }
    catch (e: any) { toast.error(e.response?.data?.detail ?? 'Could not delete') }
  }

  const generateInvoice = async () => {
    setInvoicing(true)
    try {
      const { data } = await api.post<Invoice>(`/cases/${caseId}/billing/invoices`)
      toast.success(`Invoice ${data.invoiceNumber} generated (${money(data.amountCents)})`)
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Could not generate invoice')
    } finally {
      setInvoicing(false)
    }
  }

  const invoiceStatus = (inv: Invoice) => {
    if (paidInvoices.has(inv.id)) return 'PAID'
    return (inv.status || 'UNPAID').toUpperCase()
  }

  const downloadInvoice = (inv: Invoice) => {
    const lines = [
      'PangoChain Invoice',
      `Invoice: ${inv.invoiceNumber}`,
      `Case: ${caseId}`,
      `Issued: ${new Date(inv.issuedAt).toLocaleString()}`,
      `Status: ${invoiceStatus(inv)}`,
      `Time: ${hrs(inv.minutesTotal)}`,
      `Amount: ${money(inv.amountCents)}`,
      '',
      'This client-side invoice file is generated from the billing API response.',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${inv.invoiceNumber}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const mockPay = async (inv: Invoice) => {
    setPayingInvoice(inv.id)
    await new Promise((resolve) => setTimeout(resolve, 900))
    setPaidInvoices((prev) => new Set(prev).add(inv.id))
    setPayingInvoice(null)
    toast.success(`Mock payment completed for ${inv.invoiceNumber}`)
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#1d6464]" /></div>
  if (!summary) return <p className="text-sm text-text-muted">Billing unavailable.</p>

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gold-500/15 bg-navy-950/30 p-3">
          <p className="text-xs text-text-muted flex items-center gap-1"><Clock className="w-3 h-3" /> Time logged</p>
          <p className="font-heading font-bold text-text-primary text-lg">{hrs(summary.totalMinutes)}</p>
        </div>
        <div className="rounded-xl border border-gold-500/15 bg-navy-950/30 p-3">
          <p className="text-xs text-text-muted flex items-center gap-1"><DollarSign className="w-3 h-3" /> Total billable</p>
          <p className="font-heading font-bold text-text-primary text-lg">{money(summary.totalAmountCents)}</p>
        </div>
        <div className="rounded-xl border border-gold-500/25 bg-gold-500/10 p-3">
          <p className="text-xs text-gold-300">Unbilled</p>
          <p className="font-heading font-bold text-gold-300 text-lg">{money(summary.unbilledAmountCents)}</p>
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdd((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-[#1d6464] hover:bg-[#1d6464]/10 rounded-lg px-2.5 py-1.5">
            <Plus className="w-3.5 h-3.5" /> Log time
          </button>
          <button onClick={generateInvoice} disabled={invoicing || summary.unbilledAmountCents === 0}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#1d6464] border border-[#1d6464]/40 hover:bg-[#1d6464]/10 rounded-lg px-2.5 py-1.5 disabled:opacity-50">
            {invoicing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Receipt className="w-3.5 h-3.5" />} Generate invoice
          </button>
        </div>
      )}

      {canEdit && showAdd && (
        <div className="rounded-xl border border-border bg-surface-muted/50 p-3 space-y-2">
          <input className="input" placeholder="Description (e.g. Drafted statement of defence)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex items-center gap-2">
            <input className="input flex-1" type="number" min={1} placeholder="Minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            <input className="input flex-1" type="number" min={0} step="0.01" placeholder="Hourly rate ($)" value={rate} onChange={(e) => setRate(e.target.value)} />
            <button onClick={addEntry} disabled={saving || !description.trim() || !minutes} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Time entries */}
      <div>
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Time entries</p>
        {summary.entries.length === 0 ? (
          <p className="text-sm text-text-muted">No time logged yet.</p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
            {summary.entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary truncate">{e.description}</p>
                  <p className="text-xs text-text-muted">{hrs(e.minutes)} @ {money(e.rateCents)}/h · {e.userEmail} · {new Date(e.entryDate).toLocaleDateString()}{e.invoiced && ' · invoiced'}</p>
                </div>
                <span className="font-medium text-text-primary">{money(e.amountCents)}</span>
                {canEdit && !e.invoiced && (
                  <button onClick={() => deleteEntry(e.id)} className="p-1 text-text-muted hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Invoices */}
      {summary.invoices.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Invoices</p>
          <ul className="space-y-1.5">
            {summary.invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-2 text-sm rounded-lg border border-gold-500/15 bg-navy-950/30 px-3 py-2">
                <FileText className="w-4 h-4 text-[#1d6464]" />
                <span className="font-medium text-text-primary">{inv.invoiceNumber}</span>
                <span className="text-xs text-text-muted">{hrs(inv.minutesTotal)} · {new Date(inv.issuedAt).toLocaleDateString()}</span>
                <span className="ml-auto font-semibold text-text-primary">{money(inv.amountCents)}</span>
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                  invoiceStatus(inv) === 'PAID'
                    ? 'bg-success/15 text-emerald-400 border-success/30'
                    : invoiceStatus(inv) === 'PENDING'
                      ? 'bg-gold-500/10 text-gold-300 border-gold-500/20'
                      : 'bg-error/10 text-rose-400 border-error/30'
                }`}>{invoiceStatus(inv)}</span>
                <button onClick={() => downloadInvoice(inv)} className="inline-flex items-center gap-1 rounded-lg border border-gold-500/15 px-2 py-1 text-[10px] text-gold-300 hover:bg-gold-500/10">
                  <Download className="w-3 h-3" /> Download
                </button>
                {!canEdit && invoiceStatus(inv) !== 'PAID' && (
                  <button onClick={() => mockPay(inv)} disabled={payingInvoice === inv.id} className="inline-flex items-center gap-1 rounded-lg bg-gold-500 px-2 py-1 text-[10px] font-bold text-navy-950 disabled:opacity-60">
                    {payingInvoice === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />}
                    Mock Pay
                  </button>
                )}
                {!canEdit && invoiceStatus(inv) === 'PAID' && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> Receipt ready
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
