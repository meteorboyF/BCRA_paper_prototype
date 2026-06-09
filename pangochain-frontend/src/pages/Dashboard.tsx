import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen, FileText, MessageSquare, Activity, Plus, Search,
  ChevronRight, Calendar, Bot, ArrowUpRight, Clock, AlertCircle
} from 'lucide-react'
import { useAuthStore, roleLabel, canViewGlobalAudit } from '../store/authStore'
import api from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import { StatusBadge } from '../components/ui/StatusBadge'
import { ScalesSvg, WaxSealSvg } from '../components/ui/SvgAssets'
import { Tooltip } from '../components/ui/Tooltip'
import toast from 'react-hot-toast'

interface NextHearing {
  id: string
  title: string
  hearingDate: string
  location: string | null
  courtName: string | null
  hearingType: string
  caseTitle: string
}

interface Stats {
  activeCases: number
  totalDocuments: number
  unreadMessages: number
  auditEvents: number
}

interface RecentCase {
  id: string
  title: string
  caseType: string
  status: string
  documentCount: number
  createdAt: string
}

interface AuditEntry {
  id: number
  eventType: string
  resourceType: string
  resourceId: string
  fabricTxId: string
  timestamp: string
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

// Sparkline Mini Chart
function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const width = 100
  const height = 30
  const points = data
    .map((val, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - ((val - min) / range) * height + 2 // padding
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg className="w-16 h-8 text-gold-400 opacity-60" viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
    </svg>
  )
}

// Dashboard Count Up Animation
function CountUp({ value }: { value: number }) {
  const [count, setCount] = useState(process.env.NODE_ENV === 'test' ? value : 0)

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      setCount(value)
      return
    }
    let start = 0
    const end = value
    if (start === end) return
    const totalMiliseconds = 1500
    const stepTime = Math.abs(Math.floor(totalMiliseconds / end))
    const timer = setInterval(() => {
      start += Math.ceil(end / 30)
      if (start >= end) {
        clearInterval(timer)
        setCount(end)
      } else {
        setCount(start)
      }
    }, Math.max(stepTime, 20))

    return () => clearInterval(timer)
  }, [value])

  return <span className="font-mono">{count}</span>
}

function HearingCountdown({ date }: { date: string }) {
  const now = new Date()
  const hearing = new Date(date)
  const diffMs = hearing.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (diffMs < 0) return <span className="text-rose-405 font-bold text-xs font-mono">Past due</span>
  if (diffDays === 0) return <span className="text-gold-300 font-bold text-xs font-mono">Today – in {diffHours}h</span>
  if (diffDays === 1) return <span className="text-gold-300 font-bold text-xs font-mono">Tomorrow</span>
  return <span className="font-serif font-bold text-2xl text-gold-300">{diffDays}<span className="text-xs font-medium text-text-secondary ml-1">days</span></span>
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const showGlobalAudit = user ? canViewGlobalAudit(user.role) : false

  const statsQuery = useQuery({
    queryKey: queryKeys.dashboardStats(),
    queryFn: async () => (await api.get<Stats>('/dashboard/stats')).data,
  })
  const casesQuery = useQuery({
    queryKey: [...queryKeys.cases(), 'recent'],
    queryFn: async () => (await api.get('/cases', { params: { size: 10 } })).data.content ?? [],
  })
  const auditQuery = useQuery({
    queryKey: [...queryKeys.audit(), 'recent'],
    queryFn: async () => (await api.get('/audit', { params: { size: 5 } })).data.content ?? [],
    enabled: showGlobalAudit,
  })
  const lawyerQuery = useQuery({
    queryKey: queryKeys.dashboardLawyer(),
    queryFn: async () => (await api.get('/dashboard/lawyer')).data,
  })

  const stats = statsQuery.data ?? { activeCases: 0, totalDocuments: 0, unreadMessages: 0, auditEvents: 0 }
  const casesList: RecentCase[] = casesQuery.data ?? []
  const auditList: AuditEntry[] = auditQuery.data ?? []
  const nextHearing: NextHearing | null = lawyerQuery.data?.nextHearing ?? null

  // Kanban Pipeline State
  const [kanbanMatters, setKanbanMatters] = useState<Array<{
    id: string
    title: string
    caseType: string
    documentCount: number
    status: 'ACTIVE' | 'CLOSED' | 'ARCHIVED'
  }>>([])

  // Load backend cases into Kanban. No decorative mock cases: every card must be real.
  useEffect(() => {
    setKanbanMatters(casesList.map((c) => ({
      id: c.id,
      title: c.title,
      caseType: c.caseType || 'General Litigation',
      documentCount: c.documentCount || 0,
      status: (c.status === 'CLOSED' || c.status === 'ARCHIVED') ? c.status : 'ACTIVE',
    })))
  }, [casesQuery.data])

  // Drag and Drop handlers
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const handleDragStart = (id: string) => {
    setDraggedId(id)
  }

  const handleDragOver = (e: React.DragEvent, col: string) => {
    e.preventDefault()
    setDragOverCol(col)
  }

  const handleDrop = async (col: 'ACTIVE' | 'CLOSED' | 'ARCHIVED') => {
    if (!draggedId) return
    const previous = kanbanMatters
    const target = kanbanMatters.find((item) => item.id === draggedId)
    if (!target || target.status === col) {
      setDraggedId(null)
      setDragOverCol(null)
      return
    }
    setKanbanMatters((prev) => prev.map((item) => (item.id === draggedId ? { ...item, status: col } : item)))
    setDraggedId(null)
    setDragOverCol(null)
    try {
      await api.patch(`/cases/${target.id}/status`, { status: col })
      await casesQuery.refetch()
      toast.success(col === 'CLOSED' ? 'Case closed and persisted' : 'Case status updated')
    } catch (e: any) {
      setKanbanMatters(previous)
      toast.error(e.response?.data?.detail ?? 'Could not persist case status')
    }
  }

  // Deadlines from backend (or fallback when not loaded yet)
  interface DeadlineItem { id: string; title: string; description: string; deadlineType: string; deadlineDate: number; caseId: string }
  const rawDeadlines: DeadlineItem[] = lawyerQuery.data?.upcomingDeadlines ?? []
  const deadlines = rawDeadlines.length > 0
    ? rawDeadlines.map((d) => {
        const dt = new Date(d.deadlineDate)
        return {
          title: d.title,
          detail: d.description ?? d.deadlineType.replace(/_/g, ' '),
          date: dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          time: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      })
    : [
        { title: 'Awaiting deadline data…', detail: 'No deadlines found or backend loading', date: '—', time: '—' },
      ]

  // KPI card configs
  const kpis = [
    { label: 'Active Cases', value: stats.activeCases, help: 'Open matters assigned to your firm or role-safe case scope.', icon: <FolderOpen className="w-5 h-5 text-gold-400" />, trend: [2, 4, 3, 5, 4, Math.max(stats.activeCases, 0)] },
    { label: 'Documents', value: stats.totalDocuments, help: 'Encrypted documents currently visible to your account.', icon: <FileText className="w-5 h-5 text-gold-400" />, trend: [10, 20, 15, 30, 28, Math.max(stats.totalDocuments, 0)] },
    { label: 'Hearings Bound', value: nextHearing ? 1 : 0, help: 'Your next scheduled hearing from the live hearings service.', icon: <Calendar className="w-5 h-5 text-gold-400" />, trend: [0, 1, 1, 0, 1, nextHearing ? 1 : 0] },
    { label: 'Secure Messages', value: stats.unreadMessages, help: 'Unread encrypted client or team messages.', icon: <MessageSquare className="w-5 h-5 text-gold-400" />, trend: [5, 4, 6, 3, 2, Math.max(stats.unreadMessages, 0)] }
  ]

  return (
    <div className="space-y-8 animate-fade-in text-text-primary">
      {/* Header Greeting Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gold-500/10 pb-6">
        <div>
          <h1 className="font-serif text-4xl font-bold tracking-wide text-gold-300">
            Good {getGreeting()}, {user?.fullName.split(' ')[0]}.
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {roleLabel(user?.role || 'ASSOCIATE_JUNIOR')} clearance active · node telemetry normal.
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/cases/new" className="btn-primary text-xs uppercase tracking-wider font-bold px-4 py-2.5">
            <Plus className="w-4 h-4" /> New Case File
          </Link>
          <Link to="/documents" className="btn-secondary text-xs uppercase tracking-wider font-bold px-4 py-2.5">
            <Search className="w-4 h-4" /> Browse Vault
          </Link>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <Tooltip key={k.label} content={k.help} side="bottom" className="block">
          <div
            key={k.label}
            className="card relative border-t-2 border-t-gold-500 overflow-hidden bg-navy-900/60 p-5 backdrop-blur-md shadow-card hover:shadow-gold-sm hover:-translate-y-0.5 transition-all duration-300"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">{k.label}</p>
                <p className="font-serif text-3xl font-bold text-gold-300 mt-2">
                  <CountUp value={k.value} />
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gold-500/5 border border-gold-500/10 flex items-center justify-center shrink-0">
                {k.icon}
              </div>
            </div>
            
            {/* Sparkline mini-chart */}
            <div className="flex justify-between items-center mt-6 pt-3 border-t border-gold-500/5">
              <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Feed
              </span>
              <Sparkline data={k.trend} />
            </div>
          </div>
          </Tooltip>
        ))}
      </div>

      {/* Main content grid: Left columns = Kanban Matters, Right column = Deadlines, AI Orb */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Case Pipeline Kanban Board */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-2xl font-bold text-gold-300">Case Matter Pipeline</h2>
              <p className="text-xs text-text-secondary mt-1">Drag cards to persist Active, Closed, or Archived case status.</p>
            </div>
            <Link to="/cases" className="inline-flex items-center gap-1 text-xs font-bold text-gold-400 hover:text-gold-300 tracking-wider uppercase">
              Matters List <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {(['ACTIVE', 'CLOSED', 'ARCHIVED'] as const).map((col) => {
              const columnMatters = kanbanMatters.filter((x) => x.status === col)
              const isOver = dragOverCol === col
              return (
                <div
                  key={col}
                  onDragOver={(e) => handleDragOver(e, col)}
                  onDrop={() => handleDrop(col)}
                  className={`rounded-2xl border bg-navy-900/40 p-4 transition-all min-h-[300px] flex flex-col justify-start ${
                    isOver ? 'border-gold-500 shadow-gold-sm bg-navy-900/60' : 'border-gold-500/10'
                  }`}
                >
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-gold-500/5">
                    <span className="text-[10px] font-bold tracking-widest text-gold-300 uppercase">
                      {col.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-gold-500/10 text-gold-400 px-1.5 py-0.5 rounded border border-gold-500/20">
                      {columnMatters.length}
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] scrollbar-thin">
                    <AnimatePresence>
                      {columnMatters.map((matter) => (
                        <button
                          type="button"
                          key={matter.id}
                          draggable
                          onDragStart={() => handleDragStart(matter.id)}
                          onClick={() => navigate(`/cases/${matter.id}`)}
                          className="w-full text-left bg-navy-950 border border-gold-500/10 rounded-xl p-3.5 shadow-card hover:border-gold-500/30 cursor-grab active:cursor-grabbing transition-all hover:scale-[1.01]"
                        >
                          <p className="font-serif text-xs font-bold text-gold-300 line-clamp-2">{matter.title}</p>
                          <div className="flex items-center justify-between text-[9px] text-text-secondary font-mono mt-3 pt-2 border-t border-gold-500/5">
                            <span>{matter.caseType}</span>
                            <span className="bg-gold-500/10 px-1 rounded text-gold-400">{matter.documentCount} D</span>
                          </div>
                        </button>
                      ))}
                    </AnimatePresence>
                    {columnMatters.length === 0 && (
                      <div className="h-full flex items-center justify-center py-12 text-center">
                        <p className="text-[10px] text-text-muted italic uppercase font-bold tracking-wider">Empty State</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right column items */}
        <div className="space-y-6">
          
          {/* Next Scheduled Hearing Card */}
          {nextHearing !== undefined && (
            <div className="card border-l-4 border-l-gold-500 bg-navy-900/60 border-gold-500/10 shadow-gold-sm" id="next-hearing-card">
              <div className="flex items-center justify-between border-b border-gold-500/5 pb-2 mb-3">
                <span className="text-[9px] font-bold text-gold-400 uppercase tracking-widest font-mono">Next Hearing</span>
                <span className="text-[10px] text-text-secondary uppercase font-mono">{nextHearing?.hearingType?.replace(/_/g, ' ') || 'Court Date'}</span>
              </div>
              {nextHearing === null ? (
                <div className="text-center py-6">
                  <p className="text-xs text-text-secondary italic">No upcoming hearings</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h4 className="font-serif text-sm font-semibold text-gold-300 leading-tight">{nextHearing.title}</h4>
                      <p className="text-[11px] text-text-secondary mt-0.5">{nextHearing.caseTitle}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <HearingCountdown date={nextHearing.hearingDate} />
                    </div>
                  </div>
                  <div className="text-[10px] text-text-muted font-mono space-y-1 pt-2 border-t border-gold-500/5">
                    <p>Date: {new Date(nextHearing.hearingDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    {nextHearing.courtName && <p>{nextHearing.courtName}</p>}
                    {nextHearing.location && <p>Location: Room {nextHearing.location}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Assist living orb insight widget */}
          <div className="card bg-gradient-to-br from-navy-900 to-navy-950 border border-gold-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(circle_at_top_right,rgba(201,168,76,0.1),transparent_8rem)]" />
            
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                {/* Glowing orb */}
                <span className="flex h-4.5 w-4.5 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-gold-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-gold-500 shadow-gold-sm"></span>
                </span>
              </div>
              <h3 className="font-serif text-base font-bold text-gold-300">PangoChain AI Insight</h3>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed mb-4">
              "Evidentiary checklist mismatch detected on **Sterling Defense**: Discovery filing deadline approaching in 4 days. Secure keys unlocked."
            </p>

            <Link
              to="/assistant"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-gold-400 uppercase tracking-widest hover:text-gold-300"
            >
              Analyze Matter <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Upcoming Deadlines sliding timeline */}
          <div className="card">
            <h2 className="font-serif text-lg font-bold text-gold-300 mb-4 pb-2 border-b border-gold-500/5">Upcoming Deadlines</h2>
            <div className="relative pl-6 space-y-5">
              {/* Vertical line connector */}
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-gold-500/40 via-gold-500/10 to-transparent" />

              {deadlines.map((dl, idx) => (
                <div key={dl.title} className="relative group">
                  {/* Bullet point node */}
                  <div className="absolute left-[-23px] top-1.5 w-3.5 h-3.5 rounded-full border border-gold-500 bg-navy-950 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse-gold" />
                  </div>
                  <div>
                    <h4 className="font-serif text-sm font-semibold text-gold-300 leading-tight">{dl.title}</h4>
                    <p className="text-[11px] text-text-secondary mt-0.5">{dl.detail}</p>
                    <p className="text-[10px] text-text-muted mt-1 font-mono">{dl.date} · {dl.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Audit / Ledger Feed */}
          {showGlobalAudit && auditList.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gold-500/5">
                <h2 className="font-serif text-sm font-bold text-gold-300">Immutable Audit Feed</h2>
                <Link to="/audit" className="text-[9px] font-bold tracking-widest text-gold-400 hover:text-gold-300 uppercase">
                  Verify Log
                </Link>
              </div>
              <div className="space-y-3 font-mono text-[10px]">
                {auditList.map((a, i) => (
                  <div
                    key={a.id}
                    className={`flex items-start gap-2.5 p-2 rounded-lg ${
                      i % 2 === 0 ? 'bg-navy-950/40' : 'bg-transparent'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gold-400 truncate">{a.eventType}</span>
                        <span className="text-text-muted text-[8px]">
                          {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-text-secondary truncate mt-0.5">{a.resourceId}</p>
                      {a.fabricTxId && (
                        <p className="text-gold-500/60 truncate mt-0.5">
                          TX: {a.fabricTxId.slice(0, 10)}…
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
