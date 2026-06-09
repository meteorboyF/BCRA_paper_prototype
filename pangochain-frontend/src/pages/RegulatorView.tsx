import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Filter, ChevronDown, ChevronRight, Shield, AlertCircle, Loader2 } from 'lucide-react'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import { useAuthStore } from '../store/authStore'
import { Navigate } from 'react-router-dom'

interface AuditEntry {
  id: number
  eventType: string
  actorId: string
  actorRole: string
  resourceType: string
  resourceId: string
  fabricTxId: string | null
  timestamp: string
  metadataJson: string | null
  ipAddress: string | null
}

interface PagedResponse {
  content: AuditEntry[]
  totalElements: number
  totalPages: number
  number: number
}

const EVENT_TYPES = [
  'DOC_REGISTERED', 'DOC_VIEWED', 'ACCESS_GRANTED', 'ACCESS_REVOKED',
  'DOCUMENT_SIGNED', 'KEY_ROTATION_TRIGGERED', 'KEY_ROTATION_COMPLETED',
  'USER_LOGIN', 'USER_REGISTERED', 'ACL_FABRIC_FALLBACK',
]

export default function RegulatorView() {
  const { user } = useAuthStore()

  // Guard: only REGULATOR role
  if (user?.role !== 'REGULATOR') return <Navigate to="/dashboard" replace />

  const [page, setPage] = useState(0)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [resourceId, setResourceId] = useState('')
  const [eventType, setEventType] = useState('')
  const [applied, setApplied] = useState<{ resourceId: string; eventType: string }>({ resourceId: '', eventType: '' })

  const { data, isLoading: loading, isError } = useQuery({
    queryKey: [...queryKeys.audit({ ...applied, scope: 'regulator' }), page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, size: 50 }
      if (applied.resourceId.trim()) params.resourceId = applied.resourceId.trim()
      if (applied.eventType) params.eventType = applied.eventType
      return (await api.get<PagedResponse>('/audit/regulator', { params })).data
    },
    placeholderData: (prev) => prev,
  })
  const entries: AuditEntry[] = data?.content ?? []
  const total: number = data?.totalElements ?? 0
  const error = isError ? 'Failed to load audit trail' : ''

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(0)
    setApplied({ resourceId, eventType })
  }

  const eventBadgeColor = (type: string) => {
    if (type.includes('REVOK') || type.includes('FALLBACK')) return 'bg-error/10 text-rose-400 border border-error/20'
    if (type.includes('SIGNED') || type.includes('ROTATION_COMPLETED')) return 'bg-success/15 text-emerald-400 border border-success/30'
    if (type.includes('GRANT') || type.includes('REGISTER')) return 'bg-blue-950/40 text-blue-400 border border-blue-500/20'
    if (type.includes('LOGIN')) return 'bg-indigo-950/40 text-indigo-400 border border-indigo-500/25'
    return 'bg-slate-800/40 text-slate-400 border border-slate-700/25'
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-gold-500" />
        <div>
          <h1 className="font-serif font-bold text-2xl text-gold-300">Regulatory Audit View</h1>
          <p className="text-text-secondary text-sm">Cross-firm audit trail — read-only visibility, no document content access</p>
        </div>
      </div>

      <div className="bg-gold-500/10 border border-gold-500/20 rounded-xl px-4 py-3 flex items-start gap-2.5 text-sm text-gold-300">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-gold-400" />
        <span>
          <strong>Regulator access:</strong> You can view audit metadata and blockchain transaction IDs
          for all firms. Document ciphertext and encryption key tokens are NOT accessible to this role.
        </span>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Resource ID (case ID, document ID, user ID…)"
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <select
            className="input pl-9 pr-8 appearance-none min-w-[200px] bg-navy-950 text-text-primary"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          >
            <option value="">All Event Types</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary px-5 py-2 justify-center">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-400 bg-error/15 border border-error/30 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          {error}
        </div>
      )}

      <div className="text-sm text-text-secondary font-mono">
        {total > 0 ? `${total.toLocaleString()} audit events` : 'No results'}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden border border-gold-500/10">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold-500/15 bg-navy-950/60">
                <th className="text-left px-4 py-3.5 text-gold-400 font-serif font-bold text-xs uppercase tracking-wider w-8"></th>
                <th className="text-left px-4 py-3.5 text-gold-400 font-serif font-bold text-xs uppercase tracking-wider">Event</th>
                <th className="text-left px-4 py-3.5 text-gold-400 font-serif font-bold text-xs uppercase tracking-wider">Resource</th>
                <th className="text-left px-4 py-3.5 text-gold-400 font-serif font-bold text-xs uppercase tracking-wider">Actor Role</th>
                <th className="text-left px-4 py-3.5 text-gold-400 font-serif font-bold text-xs uppercase tracking-wider">Timestamp</th>
                <th className="text-left px-4 py-3.5 text-gold-400 font-serif font-bold text-xs uppercase tracking-wider">Fabric TxID</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-text-muted">
                    <Loader2 className="w-6 h-6 animate-spin inline-block text-gold-500" />
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-text-secondary text-sm">No audit events found</td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <React.Fragment key={entry.id}>
                    <tr
                      className="border-b border-gold-500/10 hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    >
                      <td className="px-4 py-3">
                        {expandedId === entry.id
                          ? <ChevronDown className="w-4 h-4 text-gold-400" />
                          : <ChevronRight className="w-4 h-4 text-gold-400" />}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${eventBadgeColor(entry.eventType)}`}>
                          {entry.eventType}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-secondary max-w-[180px] truncate">
                        {entry.resourceId ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary font-medium">{entry.actorRole ?? '—'}</td>
                      <td className="px-4 py-3 text-text-secondary text-xs">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gold-500/60 max-w-[140px] truncate">
                        {entry.fabricTxId ?? '—'}
                      </td>
                    </tr>
                    {expandedId === entry.id && (
                      <tr className="bg-navy-950/40">
                        <td />
                        <td colSpan={5} className="px-6 py-4 border-b border-gold-500/10">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <p className="text-gold-400/70 font-semibold mb-1 uppercase tracking-wider text-[10px]">Actor ID</p>
                              <code className="font-mono text-text-secondary break-all bg-navy-950/60 px-2 py-1 rounded border border-gold-500/10">{entry.actorId ?? '—'}</code>
                            </div>
                            <div>
                              <p className="text-gold-400/70 font-semibold mb-1 uppercase tracking-wider text-[10px]">Fabric TxID (full)</p>
                              <code className="font-mono text-text-secondary break-all bg-navy-950/60 px-2 py-1 rounded border border-gold-500/10">{entry.fabricTxId ?? '—'}</code>
                            </div>
                            {entry.metadataJson && (
                              <div className="col-span-2 mt-2">
                                <p className="text-gold-400/70 font-semibold mb-1 uppercase tracking-wider text-[10px]">Metadata</p>
                                <pre className="bg-navy-950 border border-gold-500/15 rounded-lg p-3 text-text-secondary overflow-x-auto font-mono text-[11px] leading-relaxed">
                                  {JSON.stringify(JSON.parse(entry.metadataJson), null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 50 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-gold-500/10 bg-navy-950/20">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="btn-secondary py-1 px-3 text-xs disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-text-secondary font-mono">Page {page + 1} of {Math.ceil(total / 50)}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / 50) - 1 || loading}
              className="btn-secondary py-1 px-3 text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
