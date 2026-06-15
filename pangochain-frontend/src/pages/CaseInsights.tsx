import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Flag,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import api from '../lib/api'
import { PageHero } from '../components/ui/PageChrome'
import { useAiAvailable } from '../lib/useAiAvailable'
import { AiUnavailableBanner } from '../components/ui/AiUnavailableBanner'

interface CaseDto {
  id: string
  title: string
  caseType: string
  status: string
}

interface Page<T> { content: T[] }

interface TimelineResult {
  summary: string
  overallAssessment: 'CLEAN' | 'MINOR_ISSUES' | 'SIGNIFICANT_ISSUES' | 'CRITICAL_ISSUES'
  contradictions: { description: string; event1: string; event2: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' }[]
}

interface EvidenceGapResult {
  caseTheory: string
  availableEvidence: string[]
  gaps: { evidenceNeeded: string; reason: string; priority: 'HIGH' | 'MEDIUM' | 'LOW' }[]
  priorityRecommendation: string
}

const assessmentStyles: Record<string, string> = {
  CLEAN: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  MINOR_ISSUES: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
  SIGNIFICANT_ISSUES: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  CRITICAL_ISSUES: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
}

const priorityStyles: Record<string, string> = {
  HIGH: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  MEDIUM: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
  LOW: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
}

const seededTimelineFallback: TimelineResult = {
  overallAssessment: 'SIGNIFICANT_ISSUES',
  summary: 'The Chen matter has a strong notice contradiction: Meridian denies pre-February 7 notice even though the case record contains January 18, January 24, and February 3 notice signals before the February 10 termination.',
  contradictions: [
    {
      severity: 'HIGH',
      description: 'Meridian denies receiving repair notice before February 7, 2024, but the case record shows earlier notice events.',
      event1: 'January 18 and January 24 repair notices, plus February 3 witness confirmation.',
      event2: 'Meridian termination position says it first learned of repair complaints on February 7 before issuing the February 10 termination notice.',
    },
    {
      severity: 'MEDIUM',
      description: 'The lockout appears to precede full acknowledgment of the cure and mitigation packet.',
      event1: 'February 12 access credential lockout.',
      event2: 'Rent cure packet, invoices, and mitigation documents still require confirmation and preservation.',
    },
  ],
}

const seededEvidenceFallback: EvidenceGapResult = {
  caseTheory: 'Marcus Chen argues Meridian wrongfully terminated the commercial lease after receiving repeated repair notices and before properly resolving cure, access, and mitigation issues.',
  availableEvidence: [
    'Repair Notice Email Thread.doc',
    'Witness Statement - Maintenance Notice.md',
    'Meridian Termination Notice.md',
    'Rent Payment Ledger Q1-Q4.md',
    'Damages and Mitigation Ledger.md',
    'Chen Lease Agreement - Executed.md',
  ],
  gaps: [
    {
      priority: 'HIGH',
      evidenceNeeded: 'Property portal export',
      reason: 'Needed to prove when Meridian received and logged maintenance requests.',
    },
    {
      priority: 'HIGH',
      evidenceNeeded: 'Original email headers and metadata photos',
      reason: 'Needed to authenticate notice dates and show the condition of the premises before termination.',
    },
    {
      priority: 'MEDIUM',
      evidenceNeeded: 'Invoices, receipts, and maintenance technician records',
      reason: 'Needed to support damages, mitigation, and Meridian control over repairs.',
    },
  ],
  priorityRecommendation: 'First obtain the portal export and native email headers, then pair them with the witness statement for the preliminary injunction record.',
}

export default function CaseInsights() {
  const aiAvailable = useAiAvailable()
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [timeline, setTimeline] = useState<TimelineResult | null>(null)
  const [evidence, setEvidence] = useState<EvidenceGapResult | null>(null)
  const [timelineAt, setTimelineAt] = useState<Date | null>(null)
  const [evidenceAt, setEvidenceAt] = useState<Date | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [evidenceLoading, setEvidenceLoading] = useState(false)
  const [error, setError] = useState('')

  const { data: cases = [], isLoading: casesLoading } = useQuery({
    queryKey: ['case-insights-cases'],
    queryFn: async () => {
      const { data } = await api.get<Page<CaseDto>>('/cases', { params: { status: 'ACTIVE', size: 100 } })
      return data.content ?? []
    },
  })

  useEffect(() => {
    if (!selectedCaseId && cases.length > 0) setSelectedCaseId(cases[0].id)
  }, [cases, selectedCaseId])

  const selectedCase = useMemo(() => cases.find((c) => c.id === selectedCaseId), [cases, selectedCaseId])
  const running = timelineLoading || evidenceLoading
  const issueCount = timeline?.contradictions?.length ?? 0
  const highGapCount = evidence?.gaps?.filter((gap) => gap.priority === 'HIGH').length ?? 0
  const evidenceCount = evidence?.availableEvidence?.length ?? 0

  async function runTimeline() {
    if (!selectedCaseId) return
    setError('')
    setTimelineLoading(true)
    try {
      const { data } = await api.get<TimelineResult>(`/ai/cases/${selectedCaseId}/timeline-check`)
      setTimeline(data)
      setTimelineAt(new Date())
    } catch (err: any) {
      if (err?.response?.status === 429) {
        setTimeline(seededTimelineFallback)
        setTimelineAt(new Date())
        setError('OpenAI is rate-limiting right now, so PangoChain is showing the seeded Chen case insight for demo continuity.')
      } else {
        setError(err?.response?.status === 503 ? 'AI features are not configured. Set OPENAI_API_KEY on the backend.' : err?.message ?? 'Timeline check failed.')
      }
    } finally {
      setTimelineLoading(false)
    }
  }

  async function runEvidence() {
    if (!selectedCaseId) return
    setError('')
    setEvidenceLoading(true)
    try {
      const { data } = await api.get<EvidenceGapResult>(`/ai/cases/${selectedCaseId}/evidence-gaps`)
      setEvidence(data)
      setEvidenceAt(new Date())
    } catch (err: any) {
      if (err?.response?.status === 429) {
        setEvidence(seededEvidenceFallback)
        setEvidenceAt(new Date())
        setError('OpenAI is rate-limiting right now, so PangoChain is showing the seeded Chen case insight for demo continuity.')
      } else {
        setError(err?.response?.status === 503 ? 'AI features are not configured. Set OPENAI_API_KEY on the backend.' : err?.message ?? 'Evidence gap analysis failed.')
      }
    } finally {
      setEvidenceLoading(false)
    }
  }

  async function runFullScan() {
    if (!selectedCaseId || running) return
    await runTimeline()
    await new Promise((resolve) => setTimeout(resolve, 700))
    await runEvidence()
  }

  return (
    <div className="space-y-6 text-text-primary">
      <PageHero
        eyebrow="AI Case Intelligence"
        title="Case Insights"
        description="Run GPT-powered forensic checks over case metadata, document inventories, hearings, deadlines, and milestones."
        icon={TrendingUp}
      />
      {!aiAvailable && <AiUnavailableBanner />}

      <section className="card border-gold-500/10 bg-navy-900/75 p-4">
        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gold-400">Selected Matter</p>
            <select
              className="input mt-2 w-full"
              value={selectedCaseId}
              disabled={casesLoading}
              onChange={(e) => { setSelectedCaseId(e.target.value); setTimeline(null); setEvidence(null); setError('') }}
            >
              {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <MatterBadge icon={ShieldCheck} label={selectedCase?.caseType ?? 'Case'} value={selectedCase?.status ?? 'Select matter'} />
            <button onClick={runFullScan} disabled={!selectedCaseId || running} className="btn-primary min-w-[160px] text-xs">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Run Full Scan
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <InsightMetric icon={CalendarClock} label="Timeline Status" value={timeline ? timeline.overallAssessment.replaceAll('_', ' ') : 'Not scanned'} tone={timeline ? timeline.overallAssessment : 'CLEAN'} />
        <InsightMetric icon={Flag} label="Timeline Flags" value={timeline ? String(issueCount) : '-'} tone={issueCount > 0 ? 'SIGNIFICANT_ISSUES' : 'CLEAN'} />
        <InsightMetric icon={FileText} label="Evidence Reviewed" value={evidence ? String(evidenceCount) : '-'} tone="CLEAN" />
        <InsightMetric icon={AlertTriangle} label="High Priority Gaps" value={evidence ? String(highGapCount) : '-'} tone={highGapCount > 0 ? 'CRITICAL_ISSUES' : 'CLEAN'} />
      </section>

      {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="card flex min-h-[420px] flex-col border-gold-500/10 bg-navy-900/65 p-5">
          <PanelHeader
            icon={Search}
            title="Timeline Contradiction Check"
            description="Checks chronology, notice dates, hearing pressure, milestone order, and suspicious gaps."
            buttonLabel={timeline ? 'Regenerate' : 'Check Timeline'}
            loading={timelineLoading}
            disabled={!selectedCaseId || timelineLoading}
            onClick={runTimeline}
          />

          {timelineLoading && <SkeletonRows />}

          {!timeline && !timelineLoading && (
            <EmptyState
              icon={CalendarClock}
              title="Ready to inspect the case chronology"
              description="Run this before a hearing to catch contradictions between notices, events, deadlines, and filings."
            />
          )}

          {timeline && !timelineLoading && (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${assessmentStyles[timeline.overallAssessment]}`}>
                  {timeline.overallAssessment.replaceAll('_', ' ')}
                </div>
                {timelineAt && <p className="text-[10px] uppercase tracking-widest text-text-muted">Generated {timelineAt.toLocaleTimeString()}</p>}
              </div>
              <p className="rounded-xl border border-gold-500/10 bg-navy-950/40 px-4 py-3 text-sm leading-relaxed text-text-secondary">{timeline.summary}</p>
              {timeline.contradictions?.length ? (
                <div className="space-y-3">
                  {timeline.contradictions.map((c, i) => (
                    <details key={`${c.description}-${i}`} open={i === 0} className="rounded-xl border border-gold-500/10 bg-navy-950/55 p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-gold-100">
                        <span className={`mr-2 rounded-full border px-2 py-0.5 text-[10px] ${priorityStyles[c.severity]}`}>{c.severity}</span>
                        {c.description}
                      </summary>
                      <div className="mt-3 grid gap-3 text-xs leading-relaxed text-text-secondary">
                        <p><span className="text-gold-300">First signal:</span> {c.event1}</p>
                        <p><span className="text-gold-300">Conflicting signal:</span> {c.event2}</p>
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> Timeline looks clean. No inconsistencies detected.
                </div>
              )}
            </div>
          )}
        </section>

        <section className="card flex min-h-[420px] flex-col border-gold-500/10 bg-navy-900/65 p-5">
          <PanelHeader
            icon={ClipboardList}
            title="Evidence Gap Analysis"
            description="Maps available proof to the case theory and prioritizes missing evidence."
            buttonLabel={evidence ? 'Regenerate' : 'Analyze Gaps'}
            loading={evidenceLoading}
            disabled={!selectedCaseId || evidenceLoading}
            onClick={runEvidence}
          />

          {evidenceLoading && <SkeletonRows />}

          {!evidence && !evidenceLoading && (
            <EmptyState
              icon={FileText}
              title="Ready to review the evidence posture"
              description="Run this to show what proof exists, what is missing, and which next evidence step matters most."
            />
          )}

          {evidence && !evidenceLoading && (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-gold-500/25 bg-gold-500/5 px-4 py-3 text-sm text-text-primary">
                <span className="font-serif font-semibold text-gold-300">Case theory:</span> {evidence.caseTheory}
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gold-400">Available Evidence</p>
                  {evidenceAt && <p className="text-[10px] uppercase tracking-widest text-text-muted">Generated {evidenceAt.toLocaleTimeString()}</p>}
                </div>
                <div className="max-h-36 overflow-auto rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-3">
                  <div className="flex flex-wrap gap-2">
                    {evidence.availableEvidence?.map((e) => <span key={e} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">{e}</span>)}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {evidence.gaps?.map((gap, i) => (
                  <div key={`${gap.evidenceNeeded}-${i}`} className="rounded-xl border border-gold-500/10 bg-navy-950/55 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-gold-100">{gap.evidenceNeeded}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${priorityStyles[gap.priority]}`}>{gap.priority}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-text-secondary">{gap.reason}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-gold-500/25 bg-gold-500/10 px-4 py-3 text-sm text-gold-200">
                <AlertTriangle className="mr-2 inline h-4 w-4" />
                {evidence.priorityRecommendation}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function MatterBadge({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gold-500/10 bg-navy-950/50 px-4 py-3 text-xs text-text-secondary">
      <Icon className="h-4 w-4 text-gold-400" />
      <span className="font-semibold text-gold-300">{label}</span>
      <span className="text-text-muted">/</span>
      <span>{value}</span>
    </div>
  )
}

function InsightMetric({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: string }) {
  return (
    <div className="card border-gold-500/10 bg-navy-900/60 p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-gold-500/20 bg-navy-950/50">
          <Icon className="h-4 w-4 text-gold-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</p>
          <p className={`mt-1 truncate text-sm font-semibold ${tone === 'CLEAN' ? 'text-emerald-300' : tone === 'CRITICAL_ISSUES' ? 'text-rose-300' : 'text-yellow-300'}`}>{value}</p>
        </div>
      </div>
    </div>
  )
}

function PanelHeader({
  icon: Icon,
  title,
  description,
  buttonLabel,
  loading,
  disabled,
  onClick,
}: {
  icon: LucideIcon
  title: string
  description: string
  buttonLabel: string
  loading: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h2 className="flex items-center gap-2 font-serif text-xl font-bold text-gold-200">
          <Icon className="h-5 w-5 text-gold-400" /> {title}
        </h2>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-text-secondary">{description}</p>
      </div>
      <button onClick={onClick} disabled={disabled} className="btn-primary shrink-0 text-xs">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
        {buttonLabel}
      </button>
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="mt-5 flex flex-1 items-center justify-center rounded-xl border border-dashed border-gold-500/15 bg-navy-950/30 p-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-gold-500/20 bg-gold-500/10">
          <Icon className="h-5 w-5 text-gold-300" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-gold-100">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">{description}</p>
      </div>
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="mt-5 space-y-3">
      {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />)}
    </div>
  )
}
