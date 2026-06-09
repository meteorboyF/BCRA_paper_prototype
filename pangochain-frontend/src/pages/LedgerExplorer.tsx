import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity, Search, Filter, Loader2, AlertCircle,
  ExternalLink, Hash, Clock, User, Shield, ChevronDown, ChevronUp,
} from 'lucide-react'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'

interface AuditEntry {
  id: string
  eventType: string
  actorEmail: string
  resourceId: string
  contextJson: string
  fabricTxId: string | null
  timestamp: string
}

const EVENT_COLORS: Record<string, string> = {
  DOC_UPLOADED:      'bg-blue-50 text-blue-700',
  DOC_VIEWED:        'bg-cyan-50 text-cyan-700',
  ACCESS_GRANTED:    'bg-emerald-50 text-emerald-700',
  ACCESS_REVOKED:    'bg-red-50 text-red-700',
  CASE_REGISTERED:   'bg-[#1d6464]/10 text-[#1d6464]',
  HEARING_SCHEDULED: 'bg-purple-50 text-purple-700',
  USER_LOGIN:        'bg-gray-100 text-gray-700',
  DOC_UPDATED:       'bg-amber-50 text-amber-700',
  GENERAL:           'bg-gray-100 text-gray-600',
}

const EVENT_TYPES = [
  '', 'DOC_UPLOADED', 'DOC_VIEWED', 'ACCESS_GRANTED', 'ACCESS_REVOKED',
  'CASE_REGISTERED', 'HEARING_SCHEDULED', 'USER_LOGIN', 'DOC_UPDATED',
]

export default function LedgerExplorer() {
  const [eventType, setEventType] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)

  // page + eventType are reactive (in the key); the free-text resourceId filter is read
  // from the closure and applied when the Filter button calls refetch().
  const { data, isLoading: loading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.ledger(), page, eventType],
    queryFn: async () => {
      const params: Record<string, any> = { page, size: 20 }
      if (eventType) params.eventType = eventType
      if (resourceId.trim()) params.resourceId = resourceId.trim()
      return (await api.get('/audit', { params })).data
    },
    placeholderData: (prev) => prev,
  })
  const entries: AuditEntry[] = data?.content ?? data ?? []
  const totalPages: number = data?.totalPages ?? 1
  const error = isError ? 'Failed to load ledger' : ''
  const load = () => refetch()

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">Ledger Explorer</h1>
          <p className="text-text-muted text-sm mt-0.5">
            Immutable audit trail · anchored on Hyperledger Fabric 2.4
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#1d6464]/10 text-[#1d6464] rounded-lg px-3 py-1.5 text-xs font-semibold">
          <Activity className="w-3.5 h-3.5" /> {entries.length} records
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Event Type</label>
            <select className="input" value={eventType} onChange={(e) => { setEventType(e.target.value); setPage(0) }}>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{t ? t.replace(/_/g, ' ') : '— All events —'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Resource ID</label>
            <input className="input" placeholder="document or case UUID" value={resourceId} onChange={(e) => setResourceId(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button onClick={() => { setPage(0); load() }} className="btn-primary w-full py-2.5 justify-center">
              <Search className="w-4 h-4" /> Search
            </button>
          </div>
        </div>
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#1d6464]" /></div>}
      {error && !loading && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-error">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {!loading && !error && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wide">Event</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wide hidden md:table-cell">Actor</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wide hidden lg:table-cell">Resource</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wide">Time</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wide hidden xl:table-cell">Fabric Tx</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => (
                <>
                  <tr key={e.id} className="hover:bg-surface-muted transition-colors cursor-pointer" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${EVENT_COLORS[e.eventType] ?? EVENT_COLORS.GENERAL}`}>
                        {e.eventType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-xs text-text-secondary truncate max-w-[150px]">{e.actorEmail}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <p className="text-xs font-mono text-text-muted truncate max-w-[120px]">{e.resourceId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-text-muted whitespace-nowrap">
                        {new Date(e.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {e.fabricTxId ? (
                        <p className="text-[10px] font-mono text-[#1d6464] truncate max-w-[100px]">{e.fabricTxId.slice(0, 10)}…</p>
                      ) : (
                        <span className="text-[10px] text-text-muted">DB only</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {expanded === e.id
                        ? <ChevronUp className="w-4 h-4 text-text-muted" />
                        : <ChevronDown className="w-4 h-4 text-text-muted" />}
                    </td>
                  </tr>
                  {expanded === e.id && (
                    <tr key={`${e.id}-detail`} className="bg-surface-muted">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-text-muted font-semibold mb-1">Actor</p>
                            <p className="text-text-primary">{e.actorEmail}</p>
                          </div>
                          <div>
                            <p className="text-text-muted font-semibold mb-1">Resource ID</p>
                            <p className="font-mono text-text-primary break-all">{e.resourceId}</p>
                          </div>
                          {e.fabricTxId && (
                            <div className="md:col-span-2">
                              <p className="text-text-muted font-semibold mb-1">Fabric Transaction ID</p>
                              <p className="font-mono text-[#1d6464] break-all">{e.fabricTxId}</p>
                            </div>
                          )}
                          {e.contextJson && e.contextJson !== '{}' && (
                            <div className="md:col-span-2">
                              <p className="text-text-muted font-semibold mb-1">Context</p>
                              <pre className="bg-white rounded-lg px-3 py-2 text-[10px] overflow-x-auto border border-border">
                                {JSON.stringify(JSON.parse(e.contextJson || '{}'), null, 2)}
                              </pre>
                            </div>
                          )}
                          <div>
                            <p className="text-text-muted font-semibold mb-1">Timestamp</p>
                            <p className="text-text-primary">{new Date(e.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-muted">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="btn border border-border text-text-secondary py-1.5 px-3 text-xs disabled:opacity-40">Previous</button>
              <span className="text-xs text-text-muted">Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn border border-border text-text-secondary py-1.5 px-3 text-xs disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
