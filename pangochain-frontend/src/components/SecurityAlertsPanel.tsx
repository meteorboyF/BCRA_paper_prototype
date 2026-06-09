import { useEffect, useState } from 'react'
import { ShieldAlert, Loader2, RefreshCw, Check, Activity } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'

interface SecurityAlert {
  id: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  alertType: string
  description: string
  actorLabel: string | null
  fabricTxId: string | null
  acknowledged: boolean
  detectedAt: string
}

const SEV: Record<SecurityAlert['severity'], string> = {
  HIGH: 'border-red-300 bg-red-50 text-red-700',
  MEDIUM: 'border-amber-300 bg-amber-50 text-amber-700',
  LOW: 'border-slate-200 bg-slate-50 text-slate-600',
}

export function SecurityAlertsPanel() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  const load = () => {
    setLoading(true)
    api.get<SecurityAlert[]>('/security/alerts')
      .then((r) => setAlerts(r.data))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const analyze = async () => {
    setAnalyzing(true)
    try {
      const { data } = await api.post<SecurityAlert[]>('/security/analyze')
      setAlerts(data)
      toast.success(`Analysis complete — ${data.filter((a) => !a.acknowledged).length} open alert(s)`)
    } catch {
      toast.error('Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const ack = async (id: string) => {
    try {
      await api.post(`/security/alerts/${id}/ack`)
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)))
    } catch {
      toast.error('Could not acknowledge')
    }
  }

  const open = alerts.filter((a) => !a.acknowledged)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading font-semibold text-text-primary flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#1d6464]" /> Security Alerts
          {open.length > 0 && (
            <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-2 py-0.5">{open.length}</span>
          )}
        </h2>
        <button onClick={analyze} disabled={analyzing} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1d6464] hover:bg-[#1d6464]/10 rounded-lg px-2.5 py-1.5 disabled:opacity-50">
          {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Run analysis
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#1d6464]" /></div>
      ) : alerts.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-text-muted py-4">
          <Activity className="w-4 h-4" /> No anomalies detected. Run analysis to sweep the audit log now.
        </div>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li key={a.id} className={`rounded-xl border px-3 py-2.5 ${a.acknowledged ? 'border-border bg-surface-muted/40 opacity-60' : SEV[a.severity]}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide">{a.severity}</span>
                    <span className="text-[10px] text-text-muted">{a.alertType.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-sm text-text-primary mt-0.5">{a.description}</p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {new Date(a.detectedAt).toLocaleString()}
                    {a.fabricTxId && <span className="ml-2 font-mono text-[#1d6464]">tx {a.fabricTxId.slice(0, 12)}…</span>}
                  </p>
                </div>
                {!a.acknowledged && (
                  <button onClick={() => ack(a.id)} className="shrink-0 inline-flex items-center gap-1 text-xs text-text-secondary hover:text-[#1d6464] rounded px-1.5 py-1" title="Acknowledge">
                    <Check className="w-3.5 h-3.5" /> Ack
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
