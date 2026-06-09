import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, FolderOpen, FileText, Clock, Shield, Plus,
  Download, Users, Lock, Gavel, Activity,
  Calendar, Loader2, AlertCircle, Share2, GitBranch, Milestone, Receipt, FileStack, Scale, MessageCircle, PenTool, Eraser, Eye, Hash,
} from 'lucide-react'
import { DocumentUploadDropzone } from '../components/DocumentUploadDropzone'
import { CourtBundleModal } from '../components/CourtBundleModal'
import { AnnotationModal } from '../components/AnnotationModal'
import { SignatureWorkflowModal } from '../components/SignatureWorkflowModal'
import { RedactionModal } from '../components/RedactionModal'
import { SecureDownloadModal } from '../components/SecureDownloadModal'
import { DocumentEditorModal } from '../components/DocumentEditorModal'
import { TeamAccessPanel } from '../components/TeamAccessPanel'
import { MilestoneTimeline } from '../components/MilestoneTimeline'
import { CaseDeadlinesPanel } from '../components/CaseDeadlinesPanel'
import { BillingPanel } from '../components/BillingPanel'
import { SettlementOffersPanel } from '../components/SettlementOffersPanel'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { WaxSealSvg } from '../components/ui/SvgAssets'
import { Tooltip } from '../components/ui/Tooltip'
import { useAuthStore } from '../store/authStore'

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:   'text-emerald-400 bg-success/10 border border-success/30',
  CLOSED:   'text-rose-400 bg-error/10 border border-error/30',
  ARCHIVED: 'text-gold-300 bg-gold-500/10 border border-gold-500/30',
}

const HEARING_TYPES = [
  'COURT_HEARING', 'PRETRIAL_CONFERENCE', 'MEDIATION', 'ARBITRATION',
  'DEPOSITION', 'MOTION_HEARING', 'STATUS_CONFERENCE', 'SENTENCING', 'APPEAL', 'OTHER',
]

interface CaseDto {
  id: string
  title: string
  caseType: string
  status: string
  description?: string
  createdAt?: string
  firmName?: string
  createdByName?: string
}

interface DocItem {
  id: string
  fileName: string
  ipfsCid?: string
  documentHash?: string
  documentHashSha256?: string
  fabricTxId?: string
  ownerEmail?: string
  version?: number
  status?: string
  createdAt?: string
  category?: string
  confidential?: boolean
}

interface Hearing {
  id: string
  title: string
  hearingDate: string
  location?: string
  courtName?: string
  hearingType: string
  notes?: string
}

type Tab = 'documents' | 'hearings' | 'team' | 'timeline' | 'progress' | 'billing' | 'settlement'

const docHash = (doc: DocItem) => doc.documentHashSha256 ?? doc.documentHash
const shortHash = (hash?: string) => hash ? `${hash.slice(0, 10)}...${hash.slice(-6)}` : ''

const HEARING_CREATE_ROLES = ['MANAGING_PARTNER', 'PARTNER_SENIOR', 'PARTNER_JUNIOR', 'ASSOCIATE_SENIOR', 'ASSOCIATE_JUNIOR']

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const canScheduleHearings = user ? HEARING_CREATE_ROLES.includes(user.role) : false
  const [legalCase, setLegalCase] = useState<CaseDto | null>(null)
  const [documents, setDocuments] = useState<DocItem[]>([])
  const [hearings, setHearings] = useState<Hearing[]>([])
  const [showUpload, setShowUpload] = useState(false)
  const [downloadTarget, setDownloadTarget] = useState<DocItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('documents')
  const [teamDocId, setTeamDocId] = useState<string | null>(null)
  const [showBundle, setShowBundle] = useState(false)
  const [annotateTarget, setAnnotateTarget] = useState<DocItem | null>(null)
  const [signTarget, setSignTarget] = useState<DocItem | null>(null)
  const [redactTarget, setRedactTarget] = useState<DocItem | null>(null)
  const [editTarget, setEditTarget] = useState<DocItem | null>(null)
  const [teamMembers, setTeamMembers] = useState<Array<{ userId: string; fullName: string; roleInCase: string }>>([])

  // Hearing form state
  const [showHearingForm, setShowHearingForm] = useState(false)
  const [hearingTitle, setHearingTitle] = useState('')
  const [hearingDate, setHearingDate] = useState('')
  const [hearingTime, setHearingTime] = useState('09:00')
  const [hearingLocation, setHearingLocation] = useState('')
  const [hearingCourt, setHearingCourt] = useState('')
  const [hearingType, setHearingType] = useState('COURT_HEARING')
  const [hearingNotes, setHearingNotes] = useState('')
  const [submittingHearing, setSubmittingHearing] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [caseRes, docsRes, hearingsRes, membersRes] = await Promise.allSettled([
        api.get(`/cases/${id}`),
        api.get(`/documents/by-case/${id}`),
        api.get(`/hearings/by-case/${id}`),
        api.get(`/cases/${id}/members`),
      ])
      if (caseRes.status === 'fulfilled') setLegalCase(caseRes.value.data)
      if (docsRes.status === 'fulfilled') setDocuments(docsRes.value.data ?? [])
      if (hearingsRes.status === 'fulfilled') setHearings(hearingsRes.value.data ?? [])
      if (membersRes.status === 'fulfilled') setTeamMembers(membersRes.value.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  const handleAddHearing = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hearingTitle || !hearingDate || !hearingTime) return
    setSubmittingHearing(true)
    try {
      const { data } = await api.post('/hearings', {
        caseId: id,
        title: hearingTitle,
        hearingDate: new Date(`${hearingDate}T${hearingTime}`).toISOString(),
        location: hearingLocation || null,
        courtName: hearingCourt || null,
        hearingType,
        notes: hearingNotes || null,
      })
      setHearings((prev) => [...prev, data])
      toast.success('Hearing scheduled')
      setShowHearingForm(false)
      setHearingTitle(''); setHearingDate(''); setHearingTime('09:00'); setHearingLocation(''); setHearingCourt(''); setHearingNotes('')
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Failed to schedule hearing')
    } finally {
      setSubmittingHearing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gold-300">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (!legalCase) {
    return (
      <div className="card text-center py-20 max-w-lg mx-auto border-gold-500/10 bg-navy-900/60">
        <FolderOpen className="w-12 h-12 text-gold-500/30 mx-auto mb-4" />
        <p className="font-serif text-lg font-bold text-gold-300">Case matter ledger not found</p>
        <Link to="/cases" className="text-gold-400 text-xs font-bold uppercase tracking-wider mt-4 inline-block hover:text-gold-300">
          ← Back to Matters
        </Link>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" />, count: documents.length },
    { id: 'hearings', label: 'Hearings', icon: <Gavel className="w-4 h-4" />, count: hearings.length },
    { id: 'team', label: 'Team Access', icon: <Users className="w-4 h-4" /> },
    { id: 'progress', label: 'Milestones', icon: <Milestone className="w-4 h-4" /> },
    { id: 'billing', label: 'Ledger Billing', icon: <Receipt className="w-4 h-4" /> },
    { id: 'settlement', label: 'Offers', icon: <Scale className="w-4 h-4" /> },
    { id: 'timeline', label: 'Events Feed', icon: <Activity className="w-4 h-4" /> },
  ]

  const getWaxSealStatus = (s: string) => {
    if (s === 'ACTIVE') return 'verified'
    if (s === 'CLOSED') return 'rejected'
    return 'pending'
  }

  return (
    <div className="space-y-8 animate-fade-in text-text-primary">
      {/* Back button and case details Hero Band */}
      <div className="card bg-navy-900/60 p-6 border-gold-500/10 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[radial-gradient(circle_at_top_right,rgba(201,168,76,0.06),transparent_12rem)]" />
        
        <div className="flex items-start gap-4 min-w-0">
          <Link to="/cases" className="mt-1 p-2 rounded-xl border border-gold-500/10 hover:border-gold-500/30 text-gold-400 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-serif text-3xl font-bold tracking-wide text-gold-300 truncate max-w-xl">
                {legalCase.title}
              </h1>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${STATUS_COLORS[legalCase.status] || ''}`}>
                {legalCase.status}
              </span>
            </div>
            
            <p className="text-xs text-text-secondary flex items-center gap-2 flex-wrap font-mono">
              <span className="text-gold-400 font-bold uppercase">{legalCase.caseType}</span>
              <span className="opacity-40">|</span>
              <span>Lead: {legalCase.createdByName || 'Sarah Sterling'}</span>
              <span className="opacity-40">|</span>
              <span className="text-text-muted">{legalCase.firmName}</span>
            </p>

            {/* Assigned Team Avatars — from /cases/:id/members */}
            {teamMembers.length > 0 && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-text-secondary">Team:</span>
                <div className="flex -space-x-2.5">
                  {teamMembers.slice(0, 5).map((m) => (
                    <Tooltip key={m.userId} content={`${m.fullName} · ${m.roleInCase}`} side="bottom">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold-600 to-navy-900 ring-2 ring-gold-500/40 text-[9px] font-bold text-gold-300 flex items-center justify-center shadow-gold-sm">
                        {m.fullName.charAt(0).toUpperCase()}
                      </div>
                    </Tooltip>
                  ))}
                  {teamMembers.length > 5 && (
                    <div className="w-7 h-7 rounded-full bg-navy-800 ring-2 ring-gold-500/20 text-[9px] font-bold text-text-secondary flex items-center justify-center">
                      +{teamMembers.length - 5}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Panel */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end md:self-auto z-10">
          <Link to={`/cases/${id}/journey`} className="btn-secondary text-[10px] uppercase tracking-wider font-bold py-2 px-3">
            <GitBranch className="w-3.5 h-3.5 text-gold-400" /> Case Journey
          </Link>
          <Link to={`/cases/${id}/distribute`} className="btn-secondary text-[10px] uppercase tracking-wider font-bold py-2 px-3">
            <Share2 className="w-3.5 h-3.5 text-gold-400" /> Share Access
          </Link>
          <button onClick={() => setShowBundle(true)} className="btn-secondary text-[10px] uppercase tracking-wider font-bold py-2 px-3">
            <FileStack className="w-3.5 h-3.5 text-gold-400" /> Court Bundle
          </button>
          <button onClick={() => setShowUpload(true)} className="btn-primary text-[10px] uppercase tracking-wider font-bold py-2.5 px-4">
            <Plus className="w-3.5 h-3.5" /> Ingest Doc
          </button>
        </div>
      </div>

      {/* Case brief details */}
      {legalCase.description && (
        <div className="card bg-navy-900/40 border-gold-500/10">
          <p className="text-text-secondary text-sm leading-relaxed">{legalCase.description}</p>
        </div>
      )}

      {/* Dynamic sliding-underline Tab Navigation (Framer Motion) */}
      <div className="border-b border-gold-500/10">
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
          {tabs.map((t) => {
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`relative flex items-center gap-2 px-5 py-3.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                  active ? 'text-gold-300' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-gold-500/20 text-gold-300' : 'bg-navy-900 text-text-secondary'
                  }`}>{t.count}</span>
                )}
                {active && (
                  <motion.div
                    layoutId="activeTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-500"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Contents with Transitions */}
      <div className="min-h-[350px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
          >
            {/* Tab: Documents */}
            {activeTab === 'documents' && (
              <div className="card bg-navy-900/40 border-gold-500/10">
                <div className="flex items-center justify-between mb-6 pb-2 border-b border-gold-500/5">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-gold-300">Evidentiary Repositories</h2>
                    <p className="text-text-secondary text-xs mt-0.5">{documents.length} files encrypted client-side.</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gold-300 font-semibold bg-gold-500/10 px-2.5 py-1 rounded-lg border border-gold-500/20">
                    <Lock className="w-3 h-3 text-gold-400" /> AES-256-GCM + Fabric Ledger
                  </div>
                </div>

                {documents.length === 0 ? (
                  <div className="text-center py-14 border border-dashed border-gold-500/15 rounded-xl bg-navy-950/20">
                    <FileText className="w-8 h-8 text-gold-500/20 mx-auto mb-3" />
                    <p className="text-text-secondary text-sm">No files uploaded yet.</p>
                    <button onClick={() => setShowUpload(true)} className="btn-primary text-xs uppercase tracking-wider font-bold mt-4">
                      <Plus className="w-3.5 h-3.5" /> Ingest First Document
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gold-500/5">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex flex-col py-4 group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                              doc.confidential ? 'bg-red-950/20 border-red-500/20' : 'bg-gold-500/5 border-gold-500/15'
                            }`}>
                              {doc.confidential
                                ? <Shield className="w-4 h-4 text-rose-400" />
                                : <FileText className="w-4 h-4 text-gold-400" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-serif font-bold text-sm text-gold-300 group-hover:text-gold-100 transition-colors truncate">{doc.fileName}</p>
                                {doc.confidential && <span className="text-[9px] bg-red-950 text-rose-400 border border-red-500/20 font-bold px-1.5 py-0.5 rounded">CONFIDENTIAL</span>}
                                {doc.category && doc.category !== 'GENERAL' && (
                                  <span className="text-[8px] bg-gold-500/10 text-gold-300 border border-gold-500/25 font-bold px-1.5 py-0.5 rounded uppercase">{doc.category}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-text-secondary mt-1 font-mono">
                                <span>{doc.ownerEmail}</span>
                                <span className="opacity-30">•</span>
                                {doc.createdAt && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-gold-500/40" />
                                    {new Date(doc.createdAt).toLocaleDateString()}
                                  </span>
                                )}
                                {docHash(doc) && (
                                  <>
                                    <span className="opacity-30">•</span>
                                    <span className="flex items-center gap-1 text-gold-400" title={docHash(doc)}>
                                      <Hash className="w-3 h-3 text-gold-500/50" />
                                      {shortHash(docHash(doc))}
                                    </span>
                                  </>
                                )}
                                <span className="opacity-30">•</span>
                                {doc.fabricTxId && (
                                  <span className="text-gold-400">tx: {doc.fabricTxId.slice(0, 8)}…</span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0 ml-4">
                            <button
                              onClick={() => setTeamDocId(teamDocId === doc.id ? null : doc.id)}
                              className="p-2 rounded-lg border border-gold-500/5 bg-navy-950/60 hover:bg-gold-500/10 text-text-secondary hover:text-gold-300 transition-all"
                              title="Access List"
                            >
                              <Users className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditTarget(doc)}
                              className="p-2 rounded-lg border border-gold-500/5 bg-navy-950/60 hover:bg-gold-500/10 text-text-secondary hover:text-gold-300 transition-all"
                              title="Open in Browser"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setAnnotateTarget(doc)}
                              className="p-2 rounded-lg border border-gold-500/5 bg-navy-950/60 hover:bg-gold-500/10 text-text-secondary hover:text-gold-300 transition-all"
                              title="Annotate"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setSignTarget(doc)}
                              className="p-2 rounded-lg border border-gold-500/5 bg-navy-950/60 hover:bg-gold-500/10 text-text-secondary hover:text-gold-300 transition-all"
                              title="Sign Workflow"
                            >
                              <PenTool className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setRedactTarget(doc)}
                              className="p-2 rounded-lg border border-gold-500/5 bg-navy-950/60 hover:bg-gold-500/10 text-text-secondary hover:text-gold-300 transition-all"
                              title="Redact"
                            >
                              <Eraser className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDownloadTarget(doc)}
                              className="p-2 rounded-lg border border-gold-500/10 bg-gold-500/5 hover:bg-gold-500/10 text-gold-300 transition-all"
                              title="Download Decrypted"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Dropdown team panel */}
                        {teamDocId === doc.id && (
                          <div className="w-full mt-4 pt-4 border-t border-gold-500/5 animate-fade-in">
                            <TeamAccessPanel docId={doc.id} docName={doc.fileName} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Hearings */}
            {activeTab === 'hearings' && (
              <div className="card bg-navy-900/40 border-gold-500/10 space-y-6">
                <div className="flex items-center justify-between pb-2 border-b border-gold-500/5">
                  <h2 className="font-serif text-xl font-bold text-gold-300">Case Hearings</h2>
                  {canScheduleHearings && (
                    <button onClick={() => setShowHearingForm(!showHearingForm)} className="btn-primary text-xs uppercase tracking-wider font-bold">
                      <Plus className="w-4 h-4" /> Schedule Docket
                    </button>
                  )}
                </div>

                {showHearingForm && (
                  <form onSubmit={handleAddHearing} className="bg-navy-950/60 border border-gold-500/15 rounded-xl p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Hearing Title *</label>
                        <input className="input" placeholder="e.g. Pre-Trial Conference" value={hearingTitle} onChange={(e) => setHearingTitle(e.target.value)} required />
                      </div>
                      <div>
                        <label className="label">Hearing Type</label>
                        <select className="input" value={hearingType} onChange={(e) => setHearingType(e.target.value)}>
                          {HEARING_TYPES.map((t) => <option key={t} value={t} className="bg-navy-950">{t.replace(/_/g, ' ')}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label">Date *</label>
                        <input type="date" className="input" value={hearingDate} onChange={(e) => setHearingDate(e.target.value)} required />
                      </div>
                      <div>
                        <label className="label">Time *</label>
                        <input type="time" className="input" value={hearingTime} onChange={(e) => setHearingTime(e.target.value)} required />
                      </div>
                      <div>
                        <label className="label">Court Name</label>
                        <input className="input" placeholder="e.g. County Courthouse" value={hearingCourt} onChange={(e) => setHearingCourt(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="label">Location / Chambers</label>
                      <input className="input" placeholder="e.g. Room 402" value={hearingLocation} onChange={(e) => setHearingLocation(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Attending Notes</label>
                      <textarea className="input min-h-[60px] resize-y" placeholder="Advisory instructions..." value={hearingNotes} onChange={(e) => setHearingNotes(e.target.value)} />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setShowHearingForm(false)} className="btn-secondary text-xs uppercase tracking-wider py-2 px-4">Cancel</button>
                      <button type="submit" disabled={submittingHearing} className="btn-primary text-xs uppercase tracking-wider font-bold py-2.5 px-4 disabled:opacity-50">
                        {submittingHearing ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Docketing...</> : 'Schedule Docket'}
                      </button>
                    </div>
                  </form>
                )}

                {hearings.length === 0 ? (
                  <div className="text-center py-10">
                    <Gavel className="w-8 h-8 text-gold-500/20 mx-auto mb-3" />
                    <p className="text-text-secondary text-sm">No scheduled hearings docketed.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {hearings.map((h) => {
                      const date = new Date(h.hearingDate)
                      const isPast = date < new Date()
                      return (
                        <div key={h.id} className={`rounded-xl border p-4 flex gap-4 ${
                          isPast ? 'border-gold-500/5 bg-navy-950/20 opacity-60' : 'border-gold-500/10 bg-navy-950/40 hover:border-gold-500/20 transition-all duration-300'
                        }`}>
                          <div className={`w-12 h-12 rounded-xl flex-shrink-0 flex flex-col items-center justify-center border border-gold-500/10 ${isPast ? 'bg-navy-950 text-text-secondary' : 'bg-gold-500/5 text-gold-300'}`}>
                            <span className="text-[8px] font-bold uppercase tracking-wider">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
                            <span className="text-xl font-serif font-bold leading-none">{date.getDate()}</span>
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="font-serif font-bold text-sm text-gold-300 truncate">{h.title}</p>
                            <p className="text-xs text-text-secondary font-mono">{h.hearingType?.replace(/_/g, ' ')} · {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            {h.courtName && <p className="text-xs text-text-muted">{h.courtName}{h.location && ` · ${h.location}`}</p>}
                            {h.notes && <p className="text-xs text-text-secondary italic mt-2 border-t border-gold-500/5 pt-2">{h.notes}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Team Access */}
            {activeTab === 'team' && (
              <div className="card bg-navy-900/40 border-gold-500/10">
                {documents.length === 0 ? (
                  <p className="text-sm text-text-secondary text-center py-8">No documents loaded.</p>
                ) : (
                  <div className="space-y-6">
                    {documents.map((doc) => (
                      <div key={doc.id} className="border-b border-gold-500/5 pb-6 last:border-0 last:pb-0">
                        <TeamAccessPanel docId={doc.id} docName={doc.fileName} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Progress */}
            {activeTab === 'progress' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card bg-navy-900/40 border-gold-500/10"><MilestoneTimeline caseId={id!} canEdit /></div>
                <div className="card bg-navy-900/40 border-gold-500/10"><CaseDeadlinesPanel caseId={id!} canEdit /></div>
              </div>
            )}

            {/* Tab: Billing */}
            {activeTab === 'billing' && (
              <div className="card bg-navy-900/40 border-gold-500/10">
                <BillingPanel caseId={id!} canEdit />
              </div>
            )}

            {/* Tab: Settlement */}
            {activeTab === 'settlement' && (
              <SettlementOffersPanel caseId={id!} canManage />
            )}

            {/* Tab: Timeline */}
            {activeTab === 'timeline' && (
              <CaseTimeline caseId={id!} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Modals & workflows */}
      {showUpload && (
        <DocumentUploadDropzone
          caseId={id!}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); loadData() }}
        />
      )}
      {downloadTarget && (
        <SecureDownloadModal
          docId={downloadTarget.id}
          fileName={downloadTarget.fileName}
          expectedHash={docHash(downloadTarget)}
          onClose={() => setDownloadTarget(null)}
        />
      )}
      {showBundle && (
        <CourtBundleModal
          caseId={id!}
          documents={documents}
          onClose={() => setShowBundle(false)}
        />
      )}
      {annotateTarget && (
        <AnnotationModal
          docId={annotateTarget.id}
          fileName={annotateTarget.fileName}
          versionHash={docHash(annotateTarget)}
          onClose={() => setAnnotateTarget(null)}
        />
      )}
      {signTarget && (
        <SignatureWorkflowModal
          docId={signTarget.id}
          caseId={id!}
          fileName={signTarget.fileName}
          onClose={() => setSignTarget(null)}
        />
      )}
      {redactTarget && (
        <RedactionModal
          docId={redactTarget.id}
          caseId={id!}
          fileName={redactTarget.fileName}
          category={redactTarget.category}
          version={redactTarget.version}
          ipfsCid={redactTarget.ipfsCid}
          documentHashSha256={docHash(redactTarget)}
          onClose={() => setRedactTarget(null)}
          onRedacted={() => { setRedactTarget(null); loadData() }}
        />
      )}
      {editTarget && (
        <DocumentEditorModal
          docId={editTarget.id}
          caseId={id!}
          fileName={editTarget.fileName}
          category={editTarget.category}
          version={editTarget.version}
          documentHashSha256={docHash(editTarget)}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); loadData() }}
        />
      )}
    </div>
  )
}

function CaseTimeline({ caseId }: { caseId: string }) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/case-events/by-case/${caseId}`)
      .then(({ data }) => setEvents(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [caseId])

  if (loading) return <div className="flex justify-center py-8 text-gold-300"><Loader2 className="w-6 h-6 animate-spin" /></div>

  return (
    <div className="card bg-navy-900/40 border-gold-500/10">
      <h2 className="font-serif text-xl font-bold text-gold-300 mb-6 flex items-center gap-2 pb-2 border-b border-gold-500/5">
        <Activity className="w-4 h-4 text-gold-400" /> Case Ledger Provenance
        <span className="text-[9px] bg-gold-500/10 border border-gold-500/20 text-gold-300 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">Blockchain Anchor</span>
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-text-secondary text-center py-8 font-serif">No transaction audit events recorded.</p>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-gold-500/30 to-transparent" />
          <div className="space-y-5">
            {events.map((e) => (
              <div key={e.id} className="relative group">
                <div className="absolute left-[-23px] top-1.5 w-3.5 h-3.5 rounded-full border border-gold-500 bg-navy-950 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold-400" />
                </div>
                <div className="space-y-1">
                  <p className="font-serif font-bold text-sm text-gold-300">{e.title}</p>
                  {e.description && <p className="text-xs text-text-secondary leading-relaxed">{e.description}</p>}
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-text-muted mt-2 font-mono">
                    <span>Actor: {e.actorName}</span>
                    <span className="opacity-30">•</span>
                    <span>{new Date(e.createdAt).toLocaleString()}</span>
                  </div>
                  {e.fabricTxId && (
                    <p className="text-[9px] font-mono text-gold-400 mt-1">Fabric TX: <code className="bg-navy-950 px-1 py-0.5 rounded border border-gold-500/10">{e.fabricTxId}</code></p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
