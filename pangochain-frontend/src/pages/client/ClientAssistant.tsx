import { useEffect, useRef, useState } from 'react'
import { Bot, Loader2, MessageCircle, Send, UserRound } from 'lucide-react'
import api from '../../lib/api'
import { useAiAvailable } from '../../lib/useAiAvailable'
import { AiUnavailableBanner } from '../../components/ui/AiUnavailableBanner'

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
    <div className="mx-auto max-w-4xl space-y-3">
      {!aiAvailable && <AiUnavailableBanner />}
      <div className="flex h-[calc(100vh-12rem)] flex-col rounded-2xl border border-[#1d6464]/15 bg-white/90 shadow-sm">
      <div className="border-b border-[#1d6464]/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1d6464]/10 text-[#1d6464]">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">AI Case Assistant</h1>
            <p className="text-sm text-slate-600">These responses explain your case. For legal advice, speak with your lawyer.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={loading}
              className="rounded-full border border-[#1d6464]/20 bg-[#1d6464]/5 px-3 py-1.5 text-xs font-medium text-[#1d6464] transition hover:bg-[#1d6464]/10 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error === "I don't see any active cases for your account. Please contact your lawyer."
            ? "It looks like you don't have an active case yet. Please contact your law firm."
            : error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1d6464]/10 text-[#1d6464]">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-[#1d6464] text-white' : 'bg-slate-100 text-slate-800'}`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
              {m.role === 'user' && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                  <UserRound className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex justify-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1d6464]/10 text-[#1d6464]">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Checking your case...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-[#1d6464]/10 p-4">
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none ring-[#1d6464]/20 transition placeholder:text-slate-400 focus:border-[#1d6464] focus:ring-4"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send() }}
            placeholder="Ask a question about your case..."
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1d6464] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#174f4f] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}
