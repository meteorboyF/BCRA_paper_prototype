import { useEffect, useState } from 'react'
import { FileBarChart, Download, Loader2, AlertCircle } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'

interface ReportType { key: string; label: string }

/** Admin panel widget: pick a report type + date range and download a branded compliance PDF.
 *  The PDF is streamed from the backend (auth header attached by the api client) as a blob. */
export function ComplianceReportsPanel() {
  const [types, setTypes] = useState<ReportType[]>([])
  const [type, setType] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
  const [from, setFrom] = useState(monthAgo)
  const [to, setTo] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<ReportType[]>('/reports/types')
      .then((r) => { setTypes(r.data); setType(r.data[0]?.key ?? '') })
      .catch(() => setError('Failed to load report types'))
  }, [])

  const download = async () => {
    if (!type) return
    setBusy(true)
    setError('')
    try {
      const res = await api.get(`/reports/${type}`, { params: { from, to }, responseType: 'blob' })
      const disposition = res.headers['content-disposition'] as string | undefined
      const fileName = disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? `${type}.pdf`
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Report generation failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <FileBarChart className="w-5 h-5 text-[#1d6464]" />
        <h2 className="font-heading font-semibold text-text-primary">Compliance Reports</h2>
      </div>

      <div className="space-y-3">
        <div>
          <label className="label">Report type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-error text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </div>
        )}

        <button onClick={download} disabled={busy || !type} className="btn-primary w-full justify-center py-2.5 disabled:opacity-50">
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Download className="w-4 h-4" /> Generate PDF</>}
        </button>
        <p className="text-[11px] text-text-muted">Reports aggregate the append-only audit log and are themselves audit-logged. Fabric tx IDs in the report enable independent ledger verification.</p>
      </div>
    </div>
  )
}
