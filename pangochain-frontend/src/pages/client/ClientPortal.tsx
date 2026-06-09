import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, Bell, FileText, MessageSquare, Clock, Shield,
  ChevronRight, Upload, Download, Lock, CheckCircle, Loader2, AlertCircle, Scale, Gavel
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import api from '../../lib/api'
import { queryKeys } from '../../lib/queryKeys'
import { WaxSealSvg } from '../../components/ui/SvgAssets'
import toast from 'react-hot-toast'

interface NextHearing {
  id: string
  title: string
  hearingDate: string
  location: string
  courtName: string
  hearingType: string
  caseTitle: string
}

interface Reminder {
  id: string
  title: string
  body: string
  dueAt: string | null
  priority: string
  read: boolean
  senderName: string
  createdAt: string
}

interface Stats {
  totalDocuments: number
  unreadMessages: number
  unreadReminders: number
  auditEvents: number
  nextHearing: NextHearing | null
}

function HearingCountdown({ date }: { date: string }) {
  const now = new Date()
  const hearing = new Date(date)
  const diffMs = hearing.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (diffMs < 0) return <span className="text-rose-400 text-xs font-bold font-mono">Completed</span>
  if (diffDays === 0) return (
    <span className="text-gold-300 font-bold text-sm">Today (in {diffHours}h)</span>
  )
  if (diffDays === 1) return <span className="text-gold-300 font-bold text-sm">Tomorrow</span>
  return <span className="text-gold-300 font-bold text-xl">{diffDays} days</span>
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { ease: 'easeOut' as const, duration: 0.4 } }
}

export default function ClientPortal() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const statsQuery = useQuery({
    queryKey: queryKeys.dashboardStats(),
    queryFn: async () => (await api.get('/dashboard/stats')).data as Stats,
  })
  const remindersQuery = useQuery({
    queryKey: queryKeys.reminders(),
    queryFn: async () => ((await api.get('/reminders')).data as Reminder[])?.slice(0, 5) ?? [],
  })

  const stats: Stats | null = statsQuery.data ?? null
  const reminders: Reminder[] = remindersQuery.data ?? []
  const loading = statsQuery.isLoading
  const error = statsQuery.isError ? 'Failed to load portal data' : ''

  const markReminderRead = async (id: string) => {
    await api.patch(`/reminders/${id}/read`).catch(() => {})
    queryClient.setQueryData<Reminder[]>(queryKeys.reminders(), (prev) =>
      prev?.map((r) => (r.id === id ? { ...r, read: true } : r)))
    toast.success('Reminder acknowledged')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-gold-300">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8 text-text-primary selection:bg-gold-500/20 selection:text-gold-300 max-w-5xl mx-auto"
      id="client-portal-container"
    >
      
      {/* ── Welcome Hero Card (Warm off-white background, gold accents) ─────────────────── */}
      <motion.div
        variants={itemVariants}
        className="rounded-2xl p-8 bg-[#F5F0E8] text-navy-950 shadow-gold-md border border-gold-400/40 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6"
        id="client-welcome-hero"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-[radial-gradient(circle_at_top_right,rgba(201,168,76,0.2),transparent_12rem)]" />
        
        <div className="relative z-10 space-y-2">
          <span className="text-[9px] font-bold tracking-widest text-gold-700 uppercase block font-mono">SECURE CLIENT PORTAL ACTIVE</span>
          <h1 className="font-serif text-3xl font-bold tracking-wide text-navy-950 mb-1">
            Your Case, Secured.
          </h1>
          <p className="text-navy-900/85 text-sm leading-relaxed max-w-xl font-medium">
            Welcome back, {user?.fullName.split(' ')[0]}. Every record in your vault is protected client-side, 
            backed by decentralized ledger verification.
          </p>
        </div>

        <div className="relative z-10 shrink-0 flex items-center gap-2 bg-navy-950/5 border border-gold-600/30 rounded-xl px-4 py-3 shadow-inner">
          <Lock className="w-5 h-5 text-gold-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-navy-900 font-mono">E2E Secure</span>
        </div>
      </motion.div>

      {error && (
        <motion.div
          variants={itemVariants}
          className="flex items-center gap-3 bg-red-950/40 border border-error/30 rounded-xl px-4 py-3 text-xs text-rose-400"
          id="client-error-banner"
        >
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </motion.div>
      )}

      {/* ── Case Status Progress Card (visual progress bar) ─────────────────── */}
      <motion.div
        variants={itemVariants}
        className="card border-gold-500/10 space-y-4 shadow-gold-sm bg-navy-900/60"
        id="client-progress-card"
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-serif text-lg font-bold text-gold-300">Matter Progress Status</h3>
            <p className="text-xs text-text-secondary">Evidentiary phase progress bar.</p>
          </div>
          <span className="text-[10px] font-bold bg-gold-500/10 border border-gold-500/20 text-gold-300 px-3 py-1 rounded-full uppercase tracking-wider font-mono">
            Active Pleadings Stage
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="h-3 w-full bg-navy-950 rounded-full overflow-hidden border border-gold-500/20 p-0.5">
            <motion.div 
              className="h-full bg-gradient-to-r from-gold-600 via-gold-500 to-gold-400 rounded-full" 
              initial={{ width: 0 }}
              animate={{ width: '65%' }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-text-secondary">
            <span>Matters Intake</span>
            <span className="text-gold-300 font-bold">Discovery & Pleadings (65%)</span>
            <span>Trial Hearings</span>
          </div>
        </div>
      </motion.div>

      {/* ── 3 Large Quick Action Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="client-quick-actions">
        {[
          {
            title: 'Browse Vault',
            desc: 'Access legal dockets, templates, and evidence deeds shared with you.',
            icon: <FileText className="w-7 h-7 text-gold-400" />,
            to: '/client/documents',
            id: 'client-qa-vault'
          },
          {
            title: 'Secure Messages',
            desc: 'Direct encrypted thread with Sarah Sterling and legal advisors.',
            icon: <MessageSquare className="w-7 h-7 text-gold-400" />,
            to: '/messages',
            id: 'client-qa-messages'
          },
          {
            title: 'Next Hearing',
            desc: 'Check court date schedule updates and travel/attendance requirements.',
            icon: <Gavel className="w-7 h-7 text-gold-400" />,
            to: '/client/case',
            id: 'client-qa-hearing'
          }
        ].map((act, idx) => (
          <motion.div
            key={idx}
            variants={itemVariants}
            whileHover={{ y: -4 }}
            className="flex"
          >
            <Link
              id={act.id}
              to={act.to}
              className="card relative overflow-hidden bg-navy-900/60 p-6 border-gold-500/10 hover:border-gold-500/30 hover:shadow-gold-sm transition-all duration-300 flex flex-col justify-between group w-full"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(circle_at_top_right,rgba(201,168,76,0.06),transparent_6rem)]" />
              <div>
                <div className="w-12 h-12 rounded-xl bg-gold-500/5 border border-gold-500/15 flex items-center justify-center mb-6 group-hover:bg-gold-500/10 transition-colors">
                  {act.icon}
                </div>
                <div className="space-y-2">
                  <h4 className="font-serif font-bold text-base text-gold-300 group-hover:text-gold-100 transition-colors">{act.title}</h4>
                  <p className="text-xs text-text-secondary leading-relaxed">{act.desc}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-gold-400 mt-6 group-hover:text-gold-300 transition-colors font-mono">
                Enter Section <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Reminders List */}
        <motion.div
          variants={itemVariants}
          className="card bg-navy-900/60 p-6 border-gold-500/10 space-y-4"
          id="client-advisories-card"
        >
          <div className="flex items-center justify-between border-b border-gold-500/5 pb-3">
            <h3 className="font-serif text-lg font-bold text-gold-300 flex items-center gap-2">
              <Bell className="w-4 h-4 text-gold-400" /> Pending Advisories
            </h3>
            {reminders.filter((r) => !r.read).length > 0 && (
              <span className="text-[9px] bg-gold-500/15 border border-gold-500/30 text-gold-300 font-bold px-2 py-0.5 rounded-full font-mono">
                {reminders.filter((r) => !r.read).length} new
              </span>
            )}
          </div>

          {reminders.length === 0 ? (
            <p className="text-xs text-text-secondary italic py-6 text-center">No outstanding reminders from your council.</p>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {reminders.map((r) => (
                  <motion.div
                    key={r.id}
                    layoutId={r.id}
                    onClick={() => !r.read && markReminderRead(r.id)}
                    className={`rounded-xl p-4 transition-all duration-300 border cursor-pointer ${
                      r.read ? 'border-transparent bg-navy-950/20 opacity-60' : 'border-gold-500/10 bg-navy-950/40 hover:border-gold-500/20'
                    }`}
                    whileHover={{ scale: r.read ? 1 : 1.01 }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {!r.read && <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />}
                          <p className="text-xs font-bold text-gold-300 truncate leading-none">{r.title}</p>
                          {r.priority === 'HIGH' && (
                            <span className="text-[8px] bg-error/15 border border-error/30 text-rose-400 font-bold px-1.5 py-0.5 rounded uppercase font-mono">Urgent</span>
                          )}
                        </div>
                        {r.body && <p className="text-[11px] text-text-secondary leading-relaxed pt-1">{r.body}</p>}
                        <p className="text-[9px] text-text-muted mt-2 font-mono">
                          Lodged by: {r.senderName} {r.dueAt && `· Due ${new Date(r.dueAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      {r.read && <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* Dynamic Countdown */}
        <motion.div variants={itemVariants} id="client-countdown-card">
          {stats?.nextHearing ? (
            <div className="card border-l-4 border-l-gold-500 bg-navy-900/60 p-6 border-gold-500/10 flex flex-col justify-between h-full min-h-[300px]">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gold-500/5">
                  <span className="text-[9px] font-bold text-gold-400 uppercase tracking-widest font-mono">Upcoming Docket</span>
                  <span className="text-[10px] text-text-secondary uppercase font-mono">{stats.nextHearing.hearingType?.replace(/_/g, ' ')}</span>
                </div>
                <h4 className="font-serif text-lg font-bold text-gold-300">{stats.nextHearing.title}</h4>
                <p className="text-xs text-text-secondary leading-relaxed">{stats.nextHearing.caseTitle}</p>
                
                {stats.nextHearing.courtName && (
                  <p className="text-xs text-text-secondary flex items-center gap-1 pt-1 font-mono">
                    <Scale className="w-3.5 h-3.5 text-gold-500/50" /> {stats.nextHearing.courtName}
                    {stats.nextHearing.location && ` · Room: ${stats.nextHearing.location}`}
                  </p>
                )}
              </div>
              
              <div className="border-t border-gold-500/5 pt-4 mt-6 flex justify-between items-center">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-text-secondary font-mono">Time remaining</p>
                  <HearingCountdown date={stats.nextHearing.hearingDate} />
                </div>
                <span className="text-[10px] text-text-secondary font-mono">
                  {new Date(stats.nextHearing.hearingDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          ) : (
            <div className="card border-dashed border-gold-500/15 text-center py-16 flex flex-col justify-center bg-navy-950/20 min-h-[300px]">
              <Calendar className="w-10 h-10 text-gold-500/20 mx-auto mb-3" />
              <p className="text-xs text-text-secondary italic">No hearings currently scheduled on your docket.</p>
            </div>
          )}
        </motion.div>

      </div>
    </motion.div>
  )
}
