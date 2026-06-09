import { Sparkles, Check, Server } from 'lucide-react'

interface Props {
  icon: React.ReactNode
  title: string
  tagline: string
  /** What the finished feature will do. */
  capabilities: string[]
  /** Existing platform pieces this builds on. */
  dependencies: string[]
  /** External infrastructure required (why it's deferred). */
  infraNote: string
}

/**
 * Placeholder scaffold for a planned (Backlog) feature. These features depend on external
 * infrastructure not yet wired up, so the page documents the intended UX and integration points
 * and reserves the route + navigation slot for the real implementation.
 */
export function FeatureScaffold({ icon, title, tagline, capabilities, dependencies, infraNote }: Props) {
  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#1d6464]/10 flex items-center justify-center shrink-0">{icon}</div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold text-text-primary">{title}</h1>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Planned</span>
          </div>
          <p className="text-text-muted text-sm mt-0.5">{tagline}</p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-heading font-semibold text-text-primary flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-[#1d6464]" /> Planned capabilities
        </h2>
        <ul className="space-y-2">
          {capabilities.map((c) => (
            <li key={c} className="flex items-start gap-2 text-sm text-text-secondary">
              <Check className="w-4 h-4 text-[#1d6464] shrink-0 mt-0.5" /> {c}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Builds on</h3>
          <div className="flex flex-wrap gap-1.5">
            {dependencies.map((d) => (
              <span key={d} className="text-xs bg-[#1d6464]/5 text-[#1d6464] border border-[#1d6464]/20 px-2 py-1 rounded-lg">{d}</span>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5" /> Requires
          </h3>
          <p className="text-xs text-text-secondary">{infraNote}</p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 px-4 py-3 text-center">
        <p className="text-sm text-text-muted">This screen is scaffolding — the route and navigation are reserved. Wire up the backend and replace this component to ship the feature.</p>
      </div>
    </div>
  )
}
