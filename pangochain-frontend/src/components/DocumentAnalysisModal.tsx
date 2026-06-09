import { X } from 'lucide-react'

interface Analysis {
  summary: string
  keyParties: string[]
  keyDates: string[]
  obligations: string[]
  riskFlags: { clause: string; concern: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' }[]
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

interface Props {
  fileName: string
  analysis: Analysis | null
  loading: boolean
  error?: string
  onClose: () => void
}

const riskStyle: Record<string, string> = {
  LOW: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  MEDIUM: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  HIGH: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  CRITICAL: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
}

export function DocumentAnalysisModal({ fileName, analysis, loading, error, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="card max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-gold-500/20 bg-navy-900 p-0">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gold-500/10 bg-navy-900/95 px-5 py-4">
          <div>
            <h2 className="font-serif text-lg font-bold text-gold-300">AI Document Analysis</h2>
            <p className="text-xs text-text-secondary">{fileName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-text-secondary hover:bg-white/5 hover:text-gold-300"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-5 p-5">
          {loading && <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />)}</div>}
          {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
          {analysis && !loading && (
            <>
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${riskStyle[analysis.overallRiskLevel]}`}>
                {analysis.overallRiskLevel} RISK
              </div>
              <p className="text-sm leading-relaxed text-text-secondary">{analysis.summary}</p>
              <Pills title="Key Parties" items={analysis.keyParties} />
              <Pills title="Key Dates" items={analysis.keyDates} />
              <List title="Obligations" items={analysis.obligations} />
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-gold-400">Risk Flags</h3>
                <div className="overflow-hidden rounded-xl border border-gold-500/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-navy-950 text-gold-300">
                      <tr><th className="p-3">Clause</th><th className="p-3">Concern</th><th className="p-3">Severity</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gold-500/10">
                      {(analysis.riskFlags ?? []).map((r, i) => (
                        <tr key={`${r.clause}-${i}`}>
                          <td className="p-3 text-text-secondary">{r.clause}</td>
                          <td className="p-3 text-text-primary">{r.concern}</td>
                          <td className="p-3"><span className={`rounded-full border px-2 py-0.5 ${riskStyle[r.severity]}`}>{r.severity}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Pills({ title, items }: { title: string; items?: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-gold-400">{title}</h3>
      <div className="flex flex-wrap gap-2">{(items ?? []).map((item) => <span key={item} className="rounded-full border border-gold-500/20 px-2.5 py-1 text-xs text-gold-200">{item}</span>)}</div>
    </div>
  )
}

function List({ title, items }: { title: string; items?: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-gold-400">{title}</h3>
      <ul className="space-y-2 text-sm text-text-secondary">{(items ?? []).map((item) => <li key={item}>• {item}</li>)}</ul>
    </div>
  )
}
