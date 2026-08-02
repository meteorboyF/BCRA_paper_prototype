import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FileText, History, KeyRound, Loader2, Lock, MessageSquarePlus, RefreshCcw, Scale, Send, Sparkles, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { AiMarkdown } from '../components/ui/AiMarkdown'
import { bytesToTextIfPrintable, decryptDocumentToBytes } from '../lib/decryptDoc'
import { loadWrappedPrivateKey, unwrapPrivateKey } from '../lib/crypto'
import { useAuthStore } from '../store/authStore'
import { useAiAvailable } from '../lib/useAiAvailable'
import { AiUnavailableBanner } from '../components/ui/AiUnavailableBanner'

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

interface ChatSession {
  sessionId: string
  title: string
  updatedAt: string
  messageCount: number
}

interface DecryptedDocument {
  documentId: string
  fileName: string
  text: string
  isDecrypting: boolean
}

const safeTruncate = (text: string, maxChars = 12000) =>
  text.length > maxChars ? text.slice(0, maxChars) + '\n[truncated for AI analysis]' : text

const QUICK_PROMPTS = [
  'Summarize the key facts of this matter',
  'What does the selected document prove?',
  'What evidence is missing from this case?',
  'List the deadlines and obligations I should watch',
]

const READABLE_EXTENSIONS = ['.md', '.txt', '.doc']

const isReadableForAi = (fileName: string) => {
  const lower = fileName.toLowerCase()
  return READABLE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function AssistantAvatar() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-500/30 bg-gradient-to-br from-gold-500/20 to-gold-600/5 shadow-gold-sm">
      <Scale className="h-4 w-4 text-gold-300" />
    </div>
  )
}

function UserAvatar({ name }: { name?: string }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-500/20 bg-navy-800 text-xs font-bold text-gold-200">
      {(name ?? 'You').slice(0, 1).toUpperCase()}
    </div>
  )
}

export default function AiAssistant() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const aiAvailable = useAiAvailable()
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [currentSessionId, setCurrentSessionId] = useState('')
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [decryptedDocs, setDecryptedDocs] = useState<Record<string, DecryptedDocument>>({})
  const [password, setPassword] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
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

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['ai-chat-sessions', selectedCaseId],
    enabled: !!selectedCaseId,
    queryFn: async () => {
      const { data } = await api.get<ChatSession[]>(`/ai/cases/${selectedCaseId}/chat-sessions`)
      return data ?? []
    },
  })

  useEffect(() => {
    if (!selectedCaseId || !currentSessionId) {
      setMessages([])
      return
    }
    api.get(`/ai/cases/${selectedCaseId}/chat-history`, { params: { sessionId: currentSessionId } })
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
  }, [selectedCaseId, currentSessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const selectedCase = useMemo(() => cases.find((c) => c.id === selectedCaseId), [cases, selectedCaseId])

  async function decryptDocWithStoredKey(doc: DocumentDto, stored: ReturnType<typeof loadWrappedPrivateKey>) {
    if (!stored) throw new Error('No private key found on this device. Log in again to provision your keys.')
    if (!password) throw new Error('Enter your account password to unlock your private key before selecting documents.')

    const privateKey = await unwrapPrivateKey(password, stored.saltB64, stored.ivB64, stored.encryptedB64)
    const bytes = await decryptDocumentToBytes(doc.id, privateKey, doc.documentHashSha256 ?? doc.documentHash, user?.id)
    const text = bytesToTextIfPrintable(bytes)
    if (!text) throw new Error('This file is not readable text. Use Markdown or text documents for AI chat.')
    return { documentId: doc.id, fileName: doc.fileName, text, isDecrypting: false }
  }

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
      const decrypted = await decryptDocWithStoredKey(doc, stored)
      setDecryptedDocs((prev) => ({
        ...prev,
        [doc.id]: decrypted,
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

  async function useCaseDocuments() {
    if (!user?.id) {
      setError('You must be signed in to decrypt case documents.')
      return
    }
    const stored = loadWrappedPrivateKey(user.id)
    if (!stored) {
      setError('No private key found on this device. Log in again to provision your keys.')
      return
    }
    if (!password) {
      setError('Enter your account password, then click "Use case documents" to decrypt readable case files.')
      return
    }

    const candidates = docs.filter((doc) => isReadableForAi(doc.fileName)).slice(0, 10)
    if (candidates.length === 0) {
      setError('No readable Markdown/text/.doc documents were found for this case.')
      return
    }

    setBulkLoading(true)
    setError('')
    const loaded: Record<string, DecryptedDocument> = {}
    const loadedIds: string[] = []
    const skipped: string[] = []

    for (const doc of candidates) {
      setDecryptedDocs((prev) => ({
        ...prev,
        [doc.id]: { documentId: doc.id, fileName: doc.fileName, text: prev[doc.id]?.text ?? '', isDecrypting: true },
      }))
      try {
        const decrypted = await decryptDocWithStoredKey(doc, stored)
        loaded[doc.id] = decrypted
        loadedIds.push(doc.id)
        setDecryptedDocs((prev) => ({ ...prev, [doc.id]: decrypted }))
      } catch {
        skipped.push(doc.fileName)
        setDecryptedDocs((prev) => {
          const next = { ...prev }
          delete next[doc.id]
          return next
        })
      }
    }

    setSelectedDocIds(loadedIds)
    setBulkLoading(false)
    if (loadedIds.length === 0) {
      setError('None of the readable case documents could be decrypted with this key/password.')
    } else if (skipped.length > 0) {
      setError(`Loaded ${loadedIds.length} readable case document(s). Skipped ${skipped.length} file(s) that could not be decrypted or read as text.`)
    }
  }

  function startNewChat() {
    setCurrentSessionId('')
    setMessages([])
    setInput('')
    setError('')
  }

  async function send(text = input) {
    const question = text.trim()
    if (!question || !selectedCaseId || sending) return
    setError('')
    const documents = selectedDocIds
      .map((id) => decryptedDocs[id])
      .filter((d): d is DecryptedDocument => !!d?.text)
      .map((d) => ({ documentId: d.documentId, fileName: d.fileName, text: safeTruncate(d.text) }))
    if (documents.length === 0) {
      setError('Select at least one document or click "Use case documents" first. The assistant only answers from decrypted case context.')
      return
    }
    const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', content: question, timestamp: new Date() }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setSending(true)
    try {
      const sessionId = currentSessionId || crypto.randomUUID()
      const { data } = await api.post('/ai/chat', { caseId: selectedCaseId, sessionId, question, documents })
      setCurrentSessionId(data.sessionId ?? sessionId)
      queryClient.invalidateQueries({ queryKey: ['ai-chat-sessions', selectedCaseId] })
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
    <div className="space-y-3 text-text-primary">
      {!aiAvailable && <AiUnavailableBanner />}
      <div className="grid h-[calc(100vh-11rem)] grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
      <aside className="card flex min-h-0 flex-col gap-4 border-gold-500/10 bg-navy-900/70 p-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gold-400">Matter</p>
          <select
            className="input mt-2 w-full"
            value={selectedCaseId}
            onChange={(e) => { setSelectedCaseId(e.target.value); setCurrentSessionId(''); setMessages([]); setSelectedDocIds([]); setDecryptedDocs({}) }}
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

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gold-400">
              <History className="h-3.5 w-3.5" /> Chats
            </p>
            {sessionsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gold-400" />}
          </div>
          <button
            type="button"
            onClick={startNewChat}
            className={`mb-2 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
              !currentSessionId
                ? 'border-gold-500/40 bg-gold-500/10 text-gold-100'
                : 'border-gold-500/15 bg-navy-950/35 text-text-secondary hover:border-gold-500/30 hover:text-gold-200'
            }`}
          >
            <MessageSquarePlus className="h-3.5 w-3.5 text-gold-300" />
            New chat
          </button>
          <div className="max-h-36 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
            {sessions.map((session) => (
              <button
                key={session.sessionId}
                type="button"
                onClick={() => { setCurrentSessionId(session.sessionId); setError('') }}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  currentSessionId === session.sessionId
                    ? 'border-gold-500/40 bg-gold-500/10'
                    : 'border-gold-500/10 bg-navy-950/35 hover:border-gold-500/25'
                }`}
              >
                <p className="truncate text-xs font-semibold text-gold-100">{session.title}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-text-muted">
                  {session.messageCount} messages · {new Date(session.updatedAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gold-400">Document Context</p>
            {docsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gold-400" />}
          </div>
          <button
            type="button"
            onClick={useCaseDocuments}
            disabled={bulkLoading || docsLoading || !docs.length}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gold-500/25 bg-gold-500/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gold-200 transition hover:bg-gold-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            Use case documents
          </button>
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
                      {dec?.text && <span className="mt-2 inline-flex items-center gap-1 text-[10px] text-emerald-300"><CheckCircle2 className="h-3 w-3" /> decrypted · in chat context</span>}
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold-500/25 bg-gold-500/10 shadow-gold-sm">
              <Sparkles className="h-5 w-5 text-gold-300" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold text-gold-200">AI Legal Chat</h1>
              <p className="text-xs text-text-secondary">{selectedCase?.title ?? 'Select a matter'} · document text stays in memory only</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider sm:inline-flex ${
              aiAvailable
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-gold-500/30 bg-gold-500/10 text-gold-300'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${aiAvailable ? 'animate-pulse bg-emerald-400' : 'bg-gold-400'}`} />
              {aiAvailable ? 'GPT-4o online' : 'AI offline'}
            </span>
            <button onClick={() => setMessages([])} className="btn-ghost text-xs">
              <Trash2 className="h-4 w-4" /> Clear
            </button>
            <button onClick={startNewChat} className="btn-secondary text-xs">
              <MessageSquarePlus className="h-4 w-4" /> New Chat
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
          {messages.length === 0 && (
            <div className="mx-auto mt-12 max-w-xl text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold-500/25 bg-gold-500/5 shadow-gold-sm">
                <Scale className="h-7 w-7 text-gold-400" />
              </div>
              <h2 className="mt-5 font-serif text-2xl font-bold text-gold-200">Ask this matter a question</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
                Select documents on the left to give the assistant decrypted context for this chat only.
              </p>
              <div className="mt-7 grid gap-2 sm:grid-cols-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    disabled={sending || !selectedCaseId}
                    className="rounded-xl border border-gold-500/15 bg-navy-900/50 px-4 py-3 text-left text-xs text-text-secondary transition hover:border-gold-500/40 hover:bg-gold-500/5 hover:text-gold-200 disabled:opacity-50"
                  >
                    <Sparkles className="mb-1.5 h-3.5 w-3.5 text-gold-400" />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-5">
            {messages.map((m) => (
              <div key={m.id} className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {m.role === 'user' ? <UserAvatar name={user?.fullName ?? user?.email} /> : <AssistantAvatar />}
                <div className={`max-w-[80%] rounded-2xl border px-4 py-3 ${
                  m.role === 'user'
                    ? 'rounded-tr-sm border-gold-500/30 bg-gold-500/10'
                    : 'rounded-tl-sm border-gold-500/15 bg-navy-900/80'
                }`}>
                  {m.role === 'assistant'
                    ? <AiMarkdown content={m.content} />
                    : <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gold-100">{m.content}</p>}
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-gold-500/10 pt-2.5">
                      {m.citations.map((c) => (
                        <span key={c} className="inline-flex items-center gap-1 rounded-full border border-gold-500/20 bg-gold-500/5 px-2 py-0.5 text-[10px] text-gold-300">
                          <Lock className="h-2.5 w-2.5" /> {c}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[10px] text-text-muted">{m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-start gap-3">
                <AssistantAvatar />
                <div className="rounded-2xl rounded-tl-sm border border-gold-500/15 bg-navy-900/80 px-4 py-3.5">
                  <span className="flex items-center gap-1.5">
                    {[0, 150, 300].map((delay) => (
                      <span key={delay} className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold-400" style={{ animationDelay: `${delay}ms` }} />
                    ))}
                    <span className="ml-2 text-xs text-gold-300/80">Reviewing the matter…</span>
                  </span>
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
          <div className="flex items-end gap-2">
            <textarea
              className="input max-h-32 flex-1 resize-none scrollbar-thin"
              rows={Math.min(4, Math.max(1, input.split('\n').length))}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Ask what the documents prove, what evidence is missing, or what to review next... (Shift+Enter for a new line)"
            />
            <button onClick={() => send()} disabled={!input.trim() || sending || !selectedCaseId} className="btn-primary px-4 py-3" aria-label="Send message">
              {sending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </main>
      </div>
    </div>
  )
}
