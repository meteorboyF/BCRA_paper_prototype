import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bot, CheckCircle2, FileText, KeyRound, Loader2, Lock, RefreshCcw, Send, Sparkles, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { bytesToTextIfPrintable, decryptDocumentToBytes } from '../lib/decryptDoc'
import { loadWrappedPrivateKey, unwrapPrivateKey } from '../lib/crypto'
import { useAuthStore } from '../store/authStore'

interface CaseDto {
  id: string
  title: string
  caseType: string
  status: string
}

interface Page<T> {
  content: T[]
}

interface DocumentDto {
  id: string
  fileName: string
  documentHash?: string
  documentHashSha256?: string
  category?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: string[]
  timestamp: Date
}

interface DecryptedDocument {
  documentId: string
  fileName: string
  text: string
  isDecrypting: boolean
}

const safeTruncate = (text: string, maxChars = 12000) =>
  text.length > maxChars ? text.slice(0, maxChars) + '\n[truncated for AI analysis]' : text

export default function AiAssistant() {
  const { user } = useAuthStore()
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [decryptedDocs, setDecryptedDocs] = useState<Record<string, DecryptedDocument>>({})
  const [password, setPassword] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: cases = [], isLoading: casesLoading } = useQuery({
    queryKey: ['ai-cases'],
    queryFn: async () => {
      const { data } = await api.get<Page<CaseDto>>('/cases', { params: { status: 'ACTIVE', size: 100 } })
      return data.content ?? []
    },
  })

  useEffect(() => {
    if (!selectedCaseId && cases.length > 0) setSelectedCaseId(cases[0].id)
  }, [cases, selectedCaseId])

  const { data: docs = [], isLoading: docsLoading } = useQuery({
    queryKey: ['ai-case-documents', selectedCaseId],
    enabled: !!selectedCaseId,
    queryFn: async () => {
      const { data } = await api.get<DocumentDto[]>(`/documents/by-case/${selectedCaseId}`)
      return data
    },
  })

  useEffect(() => {
    if (!selectedCaseId) return
    api.get(`/ai/cases/${selectedCaseId}/chat-history`)
      .then(({ data }) => {
        setMessages((data ?? []).map((m: any, index: number) => ({
          id: `${m.createdAt ?? Date.now()}-${index}`,
          role: m.role,
          content: m.content,
          timestamp: m.createdAt ? new Date(m.createdAt) : new Date(),
        })))
      })
      .catch((err) => {
        if (err?.response?.status === 503) setError('AI features are not configured. Contact your administrator.')
      })
  }, [selectedCaseId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const selectedCase = useMemo(() => cases.find((c) => c.id === selectedCaseId), [cases, selectedCaseId])

  async function decryptDoc(doc: DocumentDto) {
    if (!user?.id) {
      setError('You must be signed in to decrypt documents.')
      return
    }
    const stored = loadWrappedPrivateKey(user.id)
    if (!stored) {
      setError('No private key found on this device. Log in again to provision your keys.')
      return
    }
    if (!password) {
      setError('Enter your account password to unlock your private key before selecting documents.')
      return
    }

    setError('')
    setDecryptedDocs((prev) => ({
      ...prev,
      [doc.id]: { documentId: doc.id, fileName: doc.fileName, text: prev[doc.id]?.text ?? '', isDecrypting: true },
    }))
    try {
      const privateKey = await unwrapPrivateKey(password, stored.saltB64, stored.ivB64, stored.encryptedB64)
      const bytes = await decryptDocumentToBytes(doc.id, privateKey, doc.documentHashSha256 ?? doc.documentHash)
      const text = bytesToTextIfPrintable(bytes)
      if (!text) throw new Error('This file is not readable text. Use Markdown or text documents for AI chat.')
      setDecryptedDocs((prev) => ({
        ...prev,
        [doc.id]: { documentId: doc.id, fileName: doc.fileName, text, isDecrypting: false },
      }))
    } catch (err: any) {
      setSelectedDocIds((prev) => prev.filter((id) => id !== doc.id))
      setDecryptedDocs((prev) => {
        const next = { ...prev }
        delete next[doc.id]
        return next
      })
      setError(err?.message ?? 'Document decryption failed.')
    }
  }

  async function toggleDoc(doc: DocumentDto) {
    if (selectedDocIds.includes(doc.id)) {
      setSelectedDocIds((prev) => prev.filter((id) => id !== doc.id))
      setDecryptedDocs((prev) => {
        const next = { ...prev }
        delete next[doc.id]
        return next
      })
      return
    }
    setSelectedDocIds((prev) => [...prev, doc.id])
    await decryptDoc(doc)
  }

  async function send(text = input) {
    const question = text.trim()
    if (!question || !selectedCaseId || sending) return
    setError('')
    const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', content: question, timestamp: new Date() }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setSending(true)
    try {
      const documents = selectedDocIds
        .map((id) => decryptedDocs[id])
        .filter((d): d is DecryptedDocument => !!d?.text)
        .map((d) => ({ documentId: d.documentId, fileName: d.fileName, text: safeTruncate(d.text) }))
      const { data } = await api.post('/ai/chat', { caseId: selectedCaseId, question, documents })
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        citations: data.citations ?? [],
        timestamp: new Date(),
      }])
    } catch (err: any) {
      setError(err?.response?.status === 503
        ? 'AI features are not configured. Contact your administrator.'
        : err?.response?.data?.message ?? err?.message ?? 'AI chat failed.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-1 gap-4 text-text-primary lg:grid-cols-[20rem_1fr]">
      <aside className="card flex min-h-0 flex-col gap-4 border-gold-500/10 bg-navy-900/70 p-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gold-400">Matter</p>
          <select
            className="input mt-2 w-full"
            value={selectedCaseId}
            onChange={(e) => { setSelectedCaseId(e.target.value); setSelectedDocIds([]); setDecryptedDocs({}) }}
            disabled={casesLoading}
          >
            {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gold-400">
            <KeyRound className="h-3.5 w-3.5" /> Private Key Password
          </label>
          <input
            className="input w-full"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Required to decrypt selected docs"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gold-400">Document Context</p>
            {docsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gold-400" />}
          </div>
          <div className="space-y-2">
            {docs.map((doc) => {
              const dec = decryptedDocs[doc.id]
              const checked = selectedDocIds.includes(doc.id)
              return (
                <button
                  key={doc.id}
                  onClick={() => toggleDoc(doc)}
                  className={`w-full rounded-lg border p-3 text-left transition ${checked ? 'border-gold-500/40 bg-gold-500/10' : 'border-gold-500/10 bg-navy-950/40 hover:border-gold-500/25'}`}
                >
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={checked} readOnly className="mt-1 accent-gold-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-gold-100">{doc.fileName}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-text-muted">{doc.category ?? 'GENERAL'}</p>
                      {dec?.isDecrypting && <span className="mt-2 inline-flex items-center gap-1 text-[10px] text-gold-300"><Loader2 className="h-3 w-3 animate-spin" /> decrypting</span>}
                      {dec?.text && <span className="mt-2 inline-flex items-center gap-1 text-[10px] text-emerald-300"><CheckCircle2 className="h-3 w-3" /> encrypted to decrypted</span>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </aside>

      <main className="card flex min-h-0 flex-col border-gold-500/10 bg-navy-950/60">
        <div className="flex items-center justify-between border-b border-gold-500/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold-500/25 bg-gold-500/10">
              <Sparkles className="h-5 w-5 text-gold-300" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold text-gold-200">AI Legal Chat</h1>
              <p className="text-xs text-text-secondary">{selectedCase?.title ?? 'Select a matter'} · document text stays in memory only</p>
            </div>
          </div>
          <button onClick={() => setMessages([])} className="btn-ghost text-xs">
            <Trash2 className="h-4 w-4" /> Clear
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="mx-auto mt-16 max-w-lg text-center">
              <Bot className="mx-auto h-10 w-10 text-gold-400" />
              <h2 className="mt-4 font-serif text-xl font-bold text-gold-200">Ask this matter a question</h2>
              <p className="mt-2 text-sm text-text-secondary">Select documents on the left to give the assistant decrypted context for this chat only.</p>
            </div>
          )}
          <div className="space-y-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] rounded-2xl border px-4 py-3 ${m.role === 'user' ? 'border-[#1d6464]/40 bg-[#1d6464]/30' : 'border-gold-500/15 bg-navy-900/80'}`}>
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">{m.content}</pre>
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.citations.map((c) => <span key={c} className="rounded-full border border-gold-500/20 px-2 py-0.5 text-[10px] text-gold-300">{c}</span>)}
                    </div>
                  )}
                  <p className="mt-2 text-[10px] text-text-muted">{m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-gold-500/15 bg-navy-900/80 px-4 py-3 text-sm text-gold-300">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-gold-500/10 p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-text-muted">
            <Lock className="h-3.5 w-3.5 text-gold-400" />
            Document text is decrypted in browser memory and sent only when you ask.
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send() }}
              placeholder="Ask what the documents prove, what evidence is missing, or what to review next..."
            />
            <button onClick={() => send()} disabled={!input.trim() || sending || !selectedCaseId} className="btn-primary px-4">
              {sending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
