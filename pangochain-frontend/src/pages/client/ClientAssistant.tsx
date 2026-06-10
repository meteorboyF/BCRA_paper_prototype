import { useEffect, useRef, useState } from 'react'
import { Loader2, MessageCircle, Scale, Send, Sparkles, UserRound } from 'lucide-react'
import api from '../../lib/api'
import { useAiAvailable } from '../../lib/useAiAvailable'
import { AiUnavailableBanner } from '../../components/ui/AiUnavailableBanner'
import { AiMarkdown } from '../../components/ui/AiMarkdown'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const suggestions = [
  'What is my next hearing?',
  'Where does my case stand?',
  'What documents do I need to prepare?',
  'What should I expect next?',
  'Explain my latest document',
]

export default function ClientAssistant() {
  const aiAvailable = useAiAvailable()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi, I can help explain your case status in plain English. Ask me what is coming next or what you may need to prepare.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text = input) {
    const question = text.trim()
    if (!question || loading) return
    setInput('')
    setError('')
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: question }])
    setLoading(true)
    try {
      const { data } = await api.post('/ai/client/chat', { question })
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: data.answer }])
    } catch (err: any) {
      setError(err?.response?.status === 503
        ? 'AI features are not configured in this environment yet.'
        : err?.response?.data?.message ?? err?.message ?? 'I could not answer that right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-3 text-text-primary">
      {!aiAvailable && <AiUnavailableBanner />}
      <div className="glass-panel flex h-[calc(100vh-12rem)] flex-col border-gold-500/15 bg-navy-900/70">
        <div className="border-b border-gold-500/10 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-500/25 bg-gold-500/10 shadow-gold-sm">
                <MessageCircle className="h-5 w-5 text-gold-300" />
              </div>
              <div>
                <h1 className="font-serif text-lg font-bold text-gold-200">AI Case Assistant</h1>
                <p className="text-sm text-text-secondary">These responses explain your case. For legal advice, speak with your lawyer.</p>
              </div>
            </div>
            <span className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider sm:inline-flex ${
              aiAvailable
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-gold-500/30 bg-gold-500/10 text-gold-300'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${aiAvailable ? 'animate-pulse bg-emerald-400' : 'bg-gold-400'}`} />
              {aiAvailable ? 'Assistant online' : 'AI offline'}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/20 bg-gold-500/5 px-3 py-1.5 text-xs font-medium text-gold-300 transition hover:border-gold-500/40 hover:bg-gold-500/10 disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3" />
                {s}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-4 rounded-lg border border-gold-500/30 bg-gold-500/10 px-4 py-3 text-sm text-gold-200">
            {error === "I don't see any active cases for your account. Please contact your lawyer."
              ? "It looks like you don't have an active case yet. Please contact your law firm."
              : error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin">
          <div className="space-y-5">
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-500/30 bg-gradient-to-br from-gold-500/20 to-gold-600/5">
                    <Scale className="h-4 w-4 text-gold-300" />
                  </div>
                )}
                <div className={`max-w-[78%] rounded-2xl border px-4 py-3 ${
                  m.role === 'user'
                    ? 'rounded-tr-sm border-gold-500/30 bg-gold-500/10'
                    : 'rounded-tl-sm border-gold-500/15 bg-navy-950/60'
                }`}>
                  {m.role === 'assistant'
                    ? <AiMarkdown content={m.content} />
                    : <p className="whitespace-pre-wrap text-sm leading-relaxed text-gold-100">{m.content}</p>}
                </div>
                {m.role === 'user' && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-500/20 bg-navy-800 text-gold-200">
                    <UserRound className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-500/30 bg-gradient-to-br from-gold-500/20 to-gold-600/5">
                  <Scale className="h-4 w-4 text-gold-300" />
                </div>
                <div className="rounded-2xl rounded-tl-sm border border-gold-500/15 bg-navy-950/60 px-4 py-3 text-sm text-gold-300">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Checking your case…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-gold-500/10 p-4">
          <div className="flex gap-2">
            <input
              className="input min-w-0 flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send() }}
              placeholder="Ask a question about your case..."
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="btn-primary px-4"
              aria-label="Send message"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
