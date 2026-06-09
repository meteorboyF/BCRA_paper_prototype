import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Search, Shield, Filter, Loader2, AlertCircle, Check, Calendar, User as UserIcon } from 'lucide-react'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import { useAuthStore, canViewGlobalAudit } from '../store/authStore'
import { ChainLinkSvg } from '../components/ui/SvgAssets'

interface AuditLog {
  id: number
  eventType: string
  actorId: string | null
  actorName: string | null
  actorEmail: string | null
  resourceType: string
  resourceId: string
  resourceName: string | null
  fabricTxId: string | null
  timestamp: string
  metadataJson: string | null
}

interface Page<T> { content: T[]; totalElements: number; totalPages: number }

const EVENT_LABEL: Record<string, string> = {
  DOC_REGISTERED:      'Doc Registered',
  DOC_VERSION_CREATED: 'Doc Version Created',
  DOC_VERSION_RESTORED:'Doc Version Restored',
  DOC_METADATA_UPDATED:'Doc Metadata Updated',
  ACCESS_GRANTED:      'Access Granted',
  ACCESS_REVOKED:      'Access Revoked',
  DOC_VIEWED:          'Doc Viewed',
  RECORD_REDACTION:    'Redaction Saved',
  MFA_VERIFY_SUCCESS:  'MFA Verified',
  RECOVERY_CODES_GENERATED: 'Recovery Codes Generated',
  CASE_REGISTERED:     'Case Created',
  USER_REGISTERED:     'User Registered',
  USER_LOGIN:          'User Login',
  CASE_CLOSED:         'Case Closed',
  ACL_FABRIC_FALLBACK: 'ACL Fabric Fallback',
}

const EVENT_TYPES = [
  'ALL',
  'DOC_REGISTERED',
  'DOC_VERSION_CREATED',
  'RECORD_REDACTION',
  'DOC_VIEWED',
  'ACCESS_GRANTED',
  'ACCESS_REVOKED',
  'CASE_REGISTERED',
  'ACL_FABRIC_FALLBACK',
]

function actorLabel(entry: AuditLog) {
  if (entry.actorName && entry.actorEmail) return `${entry.actorName} (${entry.actorEmail})`
  return entry.actorName || entry.actorEmail || entry.actorId || 'system-node'
}

export default function AuditTrail() {
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(0)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const allowed = user ? canViewGlobalAudit(user.role) : false

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), search ? 300 : 0)
    return () => clearTimeout(t)
  }, [search])

  const { data: page, isLoading: loading, isError } = useQuery({
    queryKey: queryKeys.audit({ typeFilter, resourceId: debouncedSearch, currentPage }),
    queryFn: async () => {
      const params: Record<string, string> = { page: String(currentPage), size: '25' }
      if (typeFilter !== 'ALL') params.eventType = typeFilter
      if (debouncedSearch) params.resourceId = debouncedSearch
      const { data } = await api.get<Page<AuditLog>>('/audit', { params })
      return data
    },
    placeholderData: (prev) => prev,
    enabled: allowed,
  })
  const error = isError ? 'Failed to load audit log' : ''
  const entries = page?.content ?? []

  if (!allowed) {
    return (
      <div className="space-y-6 animate-fade-in text-text-primary">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-wide text-gold-300">Audit Registry</h1>
          <p className="text-text-secondary text-xs mt-1">Restricted Administrative Audit Console</p>
        </div>
        <div className="card border-error/20 bg-error/5 p-6 rounded-2xl">
          <div className="flex items-start gap-4">
            <Shield className="mt-0.5 h-6 w-6 shrink-0 text-rose-400" />
            <div className="space-y-2">
              <p className="font-serif text-lg font-bold text-gold-300">Access Privileges Required</p>
              <p className="text-xs text-text-secondary leading-relaxed">
                Global audit telemetry is reserved for Managing Partners, IT Administrators, and Regulatory auditors. 
                Provenance data remains locked through Fabric access validation keys.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in text-text-primary selection:bg-gold-500/20 selection:text-gold-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gold-500/10 pb-6">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-wide text-gold-300">Blockchain Audit Ledger</h1>
          {!loading && page && (
            <p className="text-xs text-text-secondary mt-1">{page.totalElements} block transactions anchored in Hyperledger Fabric.</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gold-300 font-semibold bg-gold-500/10 border border-gold-500/20 px-3 py-1.5 rounded-xl">
          <Shield className="w-4 h-4 text-gold-400" />
          Node: legal-channel
        </div>
      </div>

      {/* Filter panel */}
      <div className="card p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            className="input pl-9"
            placeholder="Search by resource transaction block..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(0) }}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-text-secondary" />
          <select
            className="input py-2 text-xs font-bold uppercase tracking-wider bg-navy-950"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(0) }}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t} className="bg-navy-950">{t === 'ALL' ? 'All Events' : (EVENT_LABEL[t] ?? t)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="flex justify-center py-20 text-gold-300">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-3 bg-error/10 border border-error/30 rounded-xl px-4 py-3 text-xs text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="card text-center py-16 max-w-md mx-auto">
          <Activity className="w-12 h-12 text-gold-500/20 mx-auto mb-4" />
          <p className="font-serif text-lg font-bold text-gold-300">No events logged</p>
          <p className="text-text-secondary text-xs mt-1">Audit log is currently empty.</p>
        </div>
      )}

      {/* Blockchain Blocks List */}
      {!loading && !error && entries.length > 0 && (
        <div className="space-y-6 relative max-w-3xl mx-auto">
          {/* Vertical gold connecting line */}
          <div className="absolute left-[24px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-gold-500/40 via-gold-500/15 to-transparent" />

          {entries.map((e, index) => {
            const isFallback = e.eventType === 'ACL_FABRIC_FALLBACK'
            return (
              <div key={e.id} className="relative flex gap-6 items-start group">
                
                {/* Node icon with ChainLink */}
                <div className="w-12 h-12 rounded-xl border border-gold-500/20 bg-navy-950 flex items-center justify-center shrink-0 z-10 shadow-gold-sm transition-transform group-hover:scale-105 duration-300">
                  <ChainLinkSvg className="w-5 h-5 text-gold-500" />
                </div>

                {/* Block Card */}
                <div className={`card flex-1 bg-navy-900/60 p-5 border-gold-500/10 hover:border-gold-500/20 shadow-card transition-all duration-300 ${
                  isFallback ? 'border-amber-500/30' : ''
                }`}>
                  <div className="flex justify-between items-start flex-wrap gap-2 pb-3 border-b border-gold-500/5 mb-3">
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono font-bold tracking-widest text-gold-400 bg-gold-500/10 border border-gold-500/20 px-2 py-0.5 rounded uppercase">
                        {EVENT_LABEL[e.eventType] ?? e.eventType}
                      </span>
                      <p className="text-[10px] font-mono text-text-muted mt-1">RESOURCE: {e.resourceType}</p>
                    </div>

                    {/* Verified checkmark status with glow */}
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-success/10 border border-success/30 px-2 py-0.5 rounded-lg shadow-gold-sm">
                      <Check className="w-3.5 h-3.5" />
                      <span>Ledger Verified</span>
                    </div>
                  </div>

                  {/* Hash / ID block in monospace gold */}
                  <div className="space-y-2">
                    {(e.resourceName || e.actorName || e.actorEmail) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3">
                        <div className="rounded-lg border border-gold-500/10 bg-navy-950/70 px-3 py-2">
                          <p className="text-[9px] font-bold text-text-secondary uppercase tracking-widest">Document</p>
                          <p className="text-xs text-gold-300 truncate mt-1" title={e.resourceName || e.resourceId}>
                            {e.resourceName || e.resourceId}
                          </p>
                        </div>
                        <div className="rounded-lg border border-gold-500/10 bg-navy-950/70 px-3 py-2">
                          <p className="text-[9px] font-bold text-text-secondary uppercase tracking-widest">Changed By</p>
                          <p className="text-xs text-gold-300 truncate mt-1" title={actorLabel(e)}>
                            {actorLabel(e)}
                          </p>
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Resource Node Hash</p>
                    <code className="block text-xs font-mono text-gold-300 bg-navy-950 p-2.5 rounded-lg border border-gold-500/10 break-all select-all">
                      {e.resourceId}
                    </code>
                  </div>

                  {/* telemetery details */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-4 mt-4 border-t border-gold-500/5 text-xs text-text-secondary">
                    <div className="flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-gold-500/50" />
                      <span>Actor: {actorLabel(e)}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[10px]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gold-500/50" />
                        {new Date(e.timestamp).toLocaleDateString()} · {new Date(e.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {/* Fabric Tx */}
                  {e.fabricTxId && (
                    <div className="mt-3 pt-2 border-t border-gold-500/5 flex items-center justify-between text-[9px] font-mono text-text-muted">
                      <span>Fabric Block ID:</span>
                      <code className="text-gold-500/60 truncate max-w-xs">{e.fabricTxId}</code>
                    </div>
                  )}
                </div>

              </div>
            )
          })}

          {/* Pagination */}
          {(page?.totalPages ?? 0) > 1 && (
            <div className="flex items-center justify-center gap-3 pt-6 z-10 relative">
              <button
                disabled={currentPage === 0}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="btn-secondary text-xs uppercase tracking-wider font-bold py-2 px-4 disabled:opacity-40"
              >
                Previous Block
              </button>
              <span className="text-xs font-mono text-text-secondary">Page {currentPage + 1} of {page?.totalPages}</span>
              <button
                disabled={currentPage + 1 >= (page?.totalPages ?? 1)}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="btn-secondary text-xs uppercase tracking-wider font-bold py-2 px-4 disabled:opacity-40"
              >
                Next Block
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
