import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Scale, Gavel, FileText, Calendar, Users, Clock,
  CheckCircle, AlertCircle, Loader2, Lock, ChevronRight,
  Activity, Shield, Archive,
} from 'lucide-react'
import api from '../../lib/api'
import { queryKeys } from '../../lib/queryKeys'
import { MilestoneTimeline } from '../../components/MilestoneTimeline'
import { BillingPanel } from '../../components/BillingPanel'
import { SettlementOffersPanel } from '../../components/SettlementOffersPanel'
import { CaseArchiveModal } from '../../components/CaseArchiveModal'

interface Hearing {
  id: string
  title: string
  hearingDate: string
  location: string
  courtName: string
  hearingType: string
  notes: string
  caseId: string
  caseTitle: string
}

interface CaseEvent {
  id: string
  eventType: string
  title: string
  description: string
  fabricTxId: string
  actorName: string
  createdAt: string
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  CASE_REGISTERED: <Scale className="w-4 h-4" />,
  DOC_UPLOADED: <FileText className="w-4 h-4" />,
  ACCESS_GRANTED: <CheckCircle className="w-4 h-4" />,
  ACCESS_REVOKED: <Shield className="w-4 h-4" />,
  HEARING_SCHEDULED: <Gavel className="w-4 h-4" />,
  DOC_VIEWED: <Activity className="w-4 h-4" />,
  GENERAL: <Clock className="w-4 h-4" />,
}

const EVENT_COLORS: Record<string, string> = {
  CASE_REGISTERED: 'bg-gold-500/10 text-gold-300 border-gold-500/20',
  DOC_UPLOADED: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  ACCESS_GRANTED: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  ACCESS_REVOKED: 'bg-red-500/10 text-rose-300 border-red-500/20',
  HEARING_SCHEDULED: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  DOC_VIEWED: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  GENERAL: 'bg-slate-500/10 text-slate-300 border-slate-700/25',
}

interface CaseInfo {
  id: string
  title: string
  description: string
  caseType: string
  status: string
  createdAt: string
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { ease: 'easeOut' as const, duration: 0.4 } }
}

export default function ClientCase() {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [showArchive, setShowArchive] = useState(false)

  // Three independent queries — each tolerates its own failure (mirrors the old allSettled).
  const hearingsQuery = useQuery({
    queryKey: queryKeys.hearingsUpcoming(),
    queryFn: async () => ((await api.get('/hearings/upcoming')).data as Hearing[]) ?? [],
  })
  const eventsQuery = useQuery({
    queryKey: ['case-events', selectedCaseId, 'client-case'],
    enabled: !!selectedCaseId,
    queryFn: async () => {
      const items = (await api.get(`/case-events/by-case/${selectedCaseId}`)).data ?? []
      return items.slice(0, 15).map((a: any): CaseEvent => ({
        id: a.id,
        eventType: a.eventType ?? 'GENERAL',
        title: a.title ?? (a.eventType ?? 'GENERAL').replace(/_/g, ' '),
        description: a.description ?? '',
        fabricTxId: a.fabricTxId ?? '',
        actorName: a.actorName ?? 'System',
        createdAt: a.createdAt,
      }))
    },
  })
  const casesQuery = useQuery({
    queryKey: [...queryKeys.cases(), 'my-cases'],
    queryFn: async () => ((await api.get('/cases/my-cases')).data as CaseInfo[]) ?? [],
  })

  const hearings: Hearing[] = hearingsQuery.data ?? []
  const events: CaseEvent[] = eventsQuery.data ?? []
  const cases: CaseInfo[] = casesQuery.data ?? []
  
  // Show the page once the primary (cases) query settles; the rest fill in as they resolve.
  const loading = casesQuery.isLoading
  const error = casesQuery.isError ? 'Failed to load case information' : ''

  // Default the case selector to the first case once they load.
  if (selectedCaseId === null && cases.length > 0) {
    setSelectedCaseId(cases[0].id)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-32" id="client-case-loader">
        <Loader2 className="w-8 h-8 animate-spin text-gold-300" />
      </div>
    )
  }

  const selectedCase = cases.find((c) => c.id === selectedCaseId)

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 text-text-primary selection:bg-gold-500/20 selection:text-gold-300 max-w-4xl"
      id="client-case-page"
    >
      <motion.div variants={itemVariants} className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gold-300 tracking-wide">My Case</h1>
          <p className="text-text-secondary text-sm mt-1">Hearings, timeline, and blockchain audit trail</p>
        </div>
        {selectedCaseId && (
          <button
            id="archive-download-btn"
            onClick={() => setShowArchive(true)}
            className="btn-secondary text-xs font-mono py-2 px-4 shrink-0 flex items-center gap-2"
          >
            <Archive className="w-4 h-4 text-gold-400" /> Download Archive
          </button>
        )}
      </motion.div>

      {/* Case selector if client has multiple cases */}
      {cases.length > 0 && (
        <motion.div variants={itemVariants} className="card bg-navy-900/60 border-gold-500/10 p-5 shadow-gold-sm" id="client-case-selector">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-gold-500/5 border border-gold-500/20 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5 text-gold-400" />
            </div>
            <div className="flex-1 min-w-0">
              {cases.length === 1 ? (
                <div>
                  <p className="font-serif font-bold text-gold-200 text-lg leading-snug">{cases[0].title}</p>
                  {cases[0].caseType && <p className="text-xs text-text-secondary font-mono">{cases[0].caseType}</p>}
                </div>
              ) : (
                <select
                  id="case-select-dropdown"
                  className="input py-2 text-sm bg-navy-950 font-serif font-bold text-gold-300 border-gold-500/20 focus:border-gold-500"
                  value={selectedCaseId ?? ''}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id} className="bg-navy-950 text-text-primary">{c.title}</option>
                  ))}
                </select>
              )}
            </div>
            <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase font-mono tracking-wider ${
              cases.find(c => c.id === selectedCaseId)?.status === 'ACTIVE'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-slate-800 text-slate-450 border border-slate-700/50'
            }`}>
              {cases.find(c => c.id === selectedCaseId)?.status ?? 'ACTIVE'}
            </span>
          </div>
        </motion.div>
      )}

      {error && (
        <motion.div variants={itemVariants} className="flex items-center gap-3 bg-red-950/40 border border-error/30 rounded-xl px-4 py-3 text-sm text-rose-400" id="client-case-error">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </motion.div>
      )}

      {/* ── Case progress milestones (read-only for clients) ─────────────────────── */}
      {selectedCaseId && (
        <motion.div variants={itemVariants} className="card bg-navy-900/60 border-gold-500/10 shadow-gold-sm" id="client-case-milestones">
          <h2 className="font-serif font-bold text-xl text-gold-300 flex items-center gap-2 mb-4 border-b border-gold-500/5 pb-3">
            <Activity className="w-5 h-5 text-gold-450" /> Milestone Journey
          </h2>
          <MilestoneTimeline caseId={selectedCaseId} canEdit={false} />
        </motion.div>
      )}

      {/* ── Settlement offers — compare side by side, accept or reject ────────────── */}
      {selectedCaseId && (
        <motion.div variants={itemVariants} id="client-case-settlement-panel">
          <SettlementOffersPanel caseId={selectedCaseId} canRespond />
        </motion.div>
      )}

      {/* ── Billing transparency (read-only itemised time + invoices) ────────────── */}
      {selectedCaseId && (
        <motion.div variants={itemVariants} className="card bg-navy-900/60 border-gold-500/10 shadow-gold-sm" id="client-case-billing">
          <h2 className="font-serif font-bold text-xl text-gold-300 flex items-center gap-2 mb-4 border-b border-gold-500/5 pb-3">
            <Scale className="w-5 h-5 text-gold-450" /> Billing &amp; Invoices
          </h2>
          <BillingPanel caseId={selectedCaseId} canEdit={false} />
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="client-case-details-grid">

        {/* ── Upcoming Hearings ─────────────────────────────────────────────────── */}
        <motion.div variants={itemVariants} className="card bg-navy-900/60 border-gold-500/10 space-y-4 shadow-gold-sm" id="client-case-hearings-card">
          <h2 className="font-serif font-bold text-lg text-gold-300 flex items-center gap-2 border-b border-gold-500/5 pb-2">
            <Gavel className="w-5 h-5 text-gold-450" /> Upcoming Hearings
          </h2>

          {hearings.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-10 h-10 text-gold-500/20 mx-auto mb-3" />
              <p className="text-sm text-text-secondary italic">No upcoming hearings scheduled.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {hearings.map((h) => {
                const date = new Date(h.hearingDate)
                const isPast = date < new Date()
                const isToday = date.toDateString() === new Date().toDateString()
                return (
                  <div key={h.id} className={`rounded-xl border px-4 py-3 transition-all duration-300 ${
                    isPast ? 'bg-navy-950/40 border-slate-700/30 opacity-60' :
                    isToday ? 'bg-amber-500/5 border-amber-500/30 shadow-gold-sm' :
                    'bg-navy-950/60 border-gold-500/10 hover:border-gold-500/20'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-serif font-bold text-gold-200 text-sm leading-snug">{h.title}</p>
                        {h.courtName && (
                          <p className="text-xs text-text-secondary mt-1 flex items-center gap-1 font-mono">
                            <Scale className="w-3.5 h-3.5 text-gold-500/50" /> {h.courtName}
                          </p>
                        )}
                        {h.location && (
                          <p className="text-xs text-text-muted mt-0.5 font-mono">Room: {h.location}</p>
                        )}
                        {h.notes && (
                          <p className="text-xs text-text-secondary mt-2 italic border-l border-gold-500/20 pl-2 leading-relaxed">{h.notes}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        <p className="text-xs font-bold text-gold-400">
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                        <p className="text-xs text-text-muted">
                          {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {isToday && (
                          <span className="text-[9px] bg-amber-500/10 border border-amber-500/30 text-gold-300 font-bold px-1.5 py-0.5 rounded mt-1.5 block">TODAY</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>

        {/* ── Blockchain Privacy Notice & Encryption Status ─────────────────────── */}
        <motion.div variants={itemVariants} className="space-y-6" id="client-case-security-card">
          <div className="card bg-navy-900/60 border-gold-500/10 space-y-4 shadow-gold-sm">
            <h2 className="font-serif font-bold text-lg text-gold-300 flex items-center gap-2 border-b border-gold-500/5 pb-2">
              <Shield className="w-5 h-5 text-gold-450" /> Your Privacy Rights
            </h2>
            <ul className="space-y-3 text-xs text-text-secondary">
              {[
                'All documents are encrypted before leaving your device',
                'Your lawyer team access is controlled by you and anchored on blockchain',
                'Every document access is permanently recorded and cannot be altered',
                'You can revoke access to your documents at any time',
                'Encrypted messages are only readable by intended recipients',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-450 mt-0.5 flex-shrink-0" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card bg-navy-900/60 border-gold-500/10 shadow-gold-sm">
            <h2 className="font-serif font-bold text-lg text-gold-300 flex items-center gap-2 mb-3 border-b border-gold-500/5 pb-2">
              <Lock className="w-5 h-5 text-gold-450" /> Encryption Status
            </h2>
            <div className="space-y-3">
              {[
                { label: 'Document Encryption', status: 'AES-256-GCM', ok: true },
                { label: 'Key Exchange', status: 'ECIES P-256', ok: true },
                { label: 'Message Encryption', status: 'AES-256-GCM + ECIES', ok: true },
                { label: 'Blockchain Ledger', status: 'Hyperledger Fabric 2.4', ok: true },
                { label: 'Key Derivation', status: 'PBKDF2 600,000 iterations', ok: true },
              ].map(({ label, status, ok }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-gold-500/5 last:border-0">
                  <p className="text-xs text-text-secondary">{label}</p>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono tracking-wider ${
                    ok 
                      ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' 
                      : 'bg-red-500/10 text-rose-400 border border-red-500/20'
                  }`}>
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Case Timeline ─────────────────────────────────────────────────────── */}
      {selectedCaseId && (
        <motion.div variants={itemVariants} className="card bg-navy-900/60 border-gold-500/10 shadow-gold-sm" id="client-case-audit-trail">
          <h2 className="font-serif font-bold text-xl text-gold-300 flex items-center gap-2 mb-5 border-b border-gold-500/5 pb-3">
            <Activity className="w-5 h-5 text-gold-450" /> Blockchain Audit Trail
            <span className="text-[9px] bg-gold-500/10 border border-gold-500/20 text-gold-300 px-2.5 py-0.5 rounded font-normal font-mono ml-2">
              Immutable · Tamper-proof
            </span>
          </h2>

          {events.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-12 italic">No audit events yet</p>
          ) : (
            <div className="relative">
              <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-gold-500/10" />
              <div className="space-y-4">
                {events.map((e) => {
                  const color = EVENT_COLORS[e.eventType] ?? EVENT_COLORS.GENERAL
                  const icon = EVENT_ICONS[e.eventType] ?? EVENT_ICONS.GENERAL
                  return (
                    <div key={e.id} className="relative flex gap-4 transition-all duration-300 hover:translate-x-1">
                      <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 z-10 ${color}`}>
                        {icon}
                      </div>
                      <div className="flex-1 pb-4 min-w-0 border-b border-gold-500/5">
                        <div className="flex justify-between items-start gap-2 flex-wrap">
                          <p className="font-serif font-bold text-gold-200 text-sm">{e.title}</p>
                          <span className="text-[10px] text-text-muted font-mono">
                            {new Date(e.createdAt).toLocaleString('en-US', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary mt-1">{e.actorName}</p>
                        {e.fabricTxId && (
                          <p className="text-[9px] font-mono text-gold-400/80 mt-1 truncate max-w-xl bg-navy-950/40 py-0.5 px-1.5 rounded inline-block">
                            tx: {e.fabricTxId}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {showArchive && selectedCaseId && (
        <CaseArchiveModal
          caseId={selectedCaseId}
          caseTitle={selectedCase?.title ?? 'Case'}
          onClose={() => setShowArchive(false)}
        />
      )}
    </motion.div>
  )
}
