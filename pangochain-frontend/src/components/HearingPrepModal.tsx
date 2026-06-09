import { Loader2, Printer, X } from 'lucide-react'

interface Brief {
  caseBackground: string
  hearingObjective: string
  keyFacts: string[]
  documentsToReview: string[]
  suggestedArguments: string[]
  anticipatedCounterArguments: string[]
  questionsToAddress: string[]
  actionItemsBeforeHearing: string[]
}

interface Props {
  title: string
  brief: Brief | null
  loading: boolean
  error?: string
  onClose: () => void
}

export function HearingPrepModal({ title, brief, loading, error, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="card max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-gold-500/20 bg-navy-900 p-0">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gold-500/10 bg-navy-900/95 px-5 py-4">
          <div>
            <h2 className="font-serif text-lg font-bold text-gold-300">Hearing Preparation Brief</h2>
            <p className="text-xs text-text-secondary">{title}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="btn-secondary text-xs"><Printer className="h-4 w-4" /> Print</button>
            <button onClick={onClose} className="rounded-lg p-2 text-text-secondary hover:bg-white/5 hover:text-gold-300"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="p-5">
          {loading && <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />)}</div>}
          {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
          {brief && !loading && (
            <div className="grid gap-4 md:grid-cols-2">
              <TextBlock title="Case Background" text={brief.caseBackground} />
              <TextBlock title="Hearing Objective" text={brief.hearingObjective} />
              <ListBlock title="Key Facts" items={brief.keyFacts} />
              <ListBlock title="Documents to Review" items={brief.documentsToReview} />
              <ListBlock title="Suggested Arguments" items={brief.suggestedArguments} />
              <ListBlock title="Anticipated Counterarguments" items={brief.anticipatedCounterArguments} />
              <ListBlock title="Questions to Address" items={brief.questionsToAddress} />
              <ListBlock title="Action Items" items={brief.actionItemsBeforeHearing} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TextBlock({ title, text }: { title: string; text?: string }) {
  return (
    <section className="rounded-xl border border-gold-500/10 bg-navy-950/50 p-4">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-gold-400">{title}</h3>
      <p className="text-sm leading-relaxed text-text-secondary">{text}</p>
    </section>
  )
}

function ListBlock({ title, items }: { title: string; items?: string[] }) {
  return (
    <section className="rounded-xl border border-gold-500/10 bg-navy-950/50 p-4">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-gold-400">{title}</h3>
      <ul className="space-y-2 text-sm text-text-secondary">
        {(items ?? []).map((item) => <li key={item} className="leading-relaxed">• {item}</li>)}
      </ul>
    </section>
  )
}
