import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, RefreshCcw, Search, TrendingUp } from 'lucide-react'
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

  async function runTimeline() {
    if (!selectedCaseId) return
    setError('')
    setTimelineLoading(true)
    try {
      const { data } = await api.get<TimelineResult>(`/ai/cases/${selectedCaseId}/timeline-check`)
      setTimeline(data)
      setTimelineAt(new Date())
    } catch (err: any) {
      setError(err?.response?.status === 503 ? 'AI features are not configured. Set OPENAI_API_KEY on the backend.' : err?.message ?? 'Timeline check failed.')
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
      setError(err?.response?.status === 503 ? 'AI features are not configured. Set OPENAI_API_KEY on the backend.' : err?.message ?? 'Evidence gap analysis failed.')
    } finally {
      setEvidenceLoading(false)
    }
  }

  return (
    <div className="space-y-6 text-text-primary">
      <PageHero
        eyebrow="AI Case Intelligence"
        title="Case Insights"
        description="Run GPT-powered forensic checks over case metadata, document inventories, hearings, and milestones."
        icon={TrendingUp}
      />
      {!aiAvailable && <AiUnavailableBanner />}

      <div className="card flex flex-col gap-3 border-gold-500/10 bg-navy-900/70 p-4 md:flex-row md:items-center">
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gold-400">Selected Matter</p>
          <select
            className="input mt-2 w-full"
            value={selectedCaseId}
            disabled={casesLoading}
            onChange={(e) => { setSelectedCaseId(e.target.value); setTimeline(null); setEvidence(null) }}
          >
            {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div className="rounded-xl border border-gold-500/10 bg-navy-950/50 px-4 py-3 text-xs text-text-secondary">
          <span className="font-semibold text-gold-300">{selectedCase?.caseType ?? 'Case'}</span>
          <span className="mx-2 text-text-muted">/</span>
          {selectedCase?.status ?? 'Select a matter'}
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="card border-gold-500/10 bg-navy-900/60 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-serif text-xl font-bold text-gold-200">
                <Search className="h-5 w-5 text-gold-400" /> Timeline Contradiction Check
              </h2>
              <p className="mt-1 text-sm text-text-secondary">Find date conflicts, suspicious gaps, and event inconsistencies.</p>
            </div>
            <button onClick={runTimeline} disabled={!selectedCaseId || timelineLoading} className="btn-primary text-xs">
              {timelineLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              {timeline ? 'Regenerate' : 'Check Timeline'}
            </button>
          </div>

          {timelineLoading && <SkeletonRows />}

          {timeline && !timelineLoading && (
            <div className="mt-5 space-y-4">
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${assessmentStyles[timeline.overallAssessment]}`}>
                {timeline.overallAssessment.replaceAll('_', ' ')}
              </div>
              <p className="text-sm leading-relaxed text-text-secondary">{timeline.summary}</p>
              {timeline.contradictions?.length ? (
                <div className="space-y-3">
                  {timeline.contradictions.map((c, i) => (
                    <details key={`${c.description}-${i}`} className="rounded-xl border border-gold-500/10 bg-navy-950/50 p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-gold-100">
                        <span className={`mr-2 rounded-full border px-2 py-0.5 text-[10px] ${priorityStyles[c.severity]}`}>{c.severity}</span>
                        {c.description}
                      </summary>
                      <div className="mt-3 grid gap-3 text-xs text-text-secondary">
                        <p><span className="text-gold-300">Event 1:</span> {c.event1}</p>
                        <p><span className="text-gold-300">Event 2:</span> {c.event2}</p>
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> Timeline looks clean. No inconsistencies detected.
                </div>
              )}
              {timelineAt && <p className="text-[10px] uppercase tracking-widest text-text-muted">Last generated: {timelineAt.toLocaleTimeString()}</p>}
            </div>
          )}
        </section>

        <section className="card border-gold-500/10 bg-navy-900/60 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-serif text-xl font-bold text-gold-200">
                <ClipboardList className="h-5 w-5 text-gold-400" /> Evidence Gap Analysis
              </h2>
              <p className="mt-1 text-sm text-text-secondary">Surface missing proof, strategic gaps, and the next best evidence step.</p>
            </div>
            <button onClick={runEvidence} disabled={!selectedCaseId || evidenceLoading} className="btn-primary text-xs">
              {evidenceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              {evidence ? 'Regenerate' : 'Analyze Evidence Gaps'}
            </button>
          </div>

          {evidenceLoading && <SkeletonRows />}

          {evidence && !evidenceLoading && (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-gold-500/25 bg-gold-500/5 px-4 py-3 text-sm text-text-primary">
                <span className="font-serif font-semibold text-gold-300">Case theory:</span> {evidence.caseTheory}
              </div>
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gold-400">Available Evidence</p>
                <div className="flex flex-wrap gap-2">
                  {evidence.availableEvidence?.map((e) => <span key={e} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">{e}</span>)}
                </div>
              </div>
              <div className="space-y-3">
                {evidence.gaps?.map((gap, i) => (
                  <div key={`${gap.evidenceNeeded}-${i}`} className="rounded-xl border border-gold-500/10 bg-navy-950/50 p-4">
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
              {evidenceAt && <p className="text-[10px] uppercase tracking-widest text-text-muted">Last generated: {evidenceAt.toLocaleTimeString()}</p>}
            </div>
          )}
        </section>
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
