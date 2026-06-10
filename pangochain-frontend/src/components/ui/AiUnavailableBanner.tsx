import { Sparkles } from 'lucide-react'

export function AiUnavailableBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gold-500/30 bg-gradient-to-r from-gold-500/10 to-transparent px-4 py-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold-500/25 bg-gold-500/10">
        <Sparkles className="h-4 w-4 text-gold-300" />
      </div>
      <div className="text-sm">
        <p className="font-semibold text-gold-200">AI features are not configured in this environment</p>
        <p className="mt-0.5 text-text-secondary">
          Set <code className="rounded bg-navy-950/60 px-1.5 py-0.5 font-mono text-xs text-gold-300">OPENAI_API_KEY</code> and
          restart the backend to enable document analysis, case insights, and the legal chat.
        </p>
      </div>
    </div>
  )
}
