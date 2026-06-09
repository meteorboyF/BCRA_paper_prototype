export function AiUnavailableBanner() {
  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
      AI features are not configured in this environment. Set <code className="font-mono">OPENAI_API_KEY</code> and restart the backend to enable them.
    </div>
  )
}
