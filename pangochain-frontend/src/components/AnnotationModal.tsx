import { useEffect, useMemo, useRef, useState } from 'react'
import { X, MessageCircle, Loader2, Send, CornerDownRight, Circle, CheckCircle2, Wifi, WifiOff } from 'lucide-react'
import { Client } from '@stomp/stompjs'
import { createChatClient } from '../lib/chatSocket'
import { useAuthStore } from '../store/authStore'
import api from '../lib/api'
import toast from 'react-hot-toast'

interface Annotation {
  id: string
  documentId: string
  versionHash?: string
  parentId?: string | null
  page?: number | null
  positionJson?: string | null
  body: string
  authorId?: string
  authorName: string
  status: 'OPEN' | 'RESOLVED'
  createdAt: string
}

interface Props {
  docId: string
  fileName: string
  versionHash?: string
  onClose: () => void
}

export function AnnotationModal({ docId, fileName, versionHash, onClose }: Props) {
  const { accessToken } = useAuthStore()
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<Annotation | null>(null)
  const [sending, setSending] = useState(false)
  const clientRef = useRef<Client | null>(null)

  const upsert = (a: Annotation) =>
    setAnnotations((prev) => {
      const i = prev.findIndex((x) => x.id === a.id)
      if (i === -1) return [...prev, a]
      const next = [...prev]
      next[i] = a
      return next
    })

  useEffect(() => {
    api.get<Annotation[]>(`/documents/${docId}/annotations`)
      .then((r) => setAnnotations(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))

    if (!accessToken) return
    const client = createChatClient(accessToken, {
      onConnect: () => {
        setConnected(true)
        client.subscribe(`/topic/documents/${docId}/annotations`, (msg) => {
          try { upsert(JSON.parse(msg.body) as Annotation) } catch { /* ignore */ }
        })
      },
      onDisconnect: () => setConnected(false),
    })
    clientRef.current = client
    return () => { client.deactivate() }
  }, [docId, accessToken])

  const send = async () => {
    if (!body.trim()) return
    setSending(true)
    try {
      const { data } = await api.post<Annotation>(`/documents/${docId}/annotations`, {
        body, versionHash, parentId: replyTo?.id ?? null,
      })
      upsert(data) // immediate echo; socket message (if any) is idempotent by id
      setBody('')
      setReplyTo(null)
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Failed to post comment')
    } finally {
      setSending(false)
    }
  }

  const resolve = async (id: string) => {
    try {
      const { data } = await api.post<Annotation>(`/documents/${docId}/annotations/${id}/resolve`)
      upsert(data)
    } catch {
      toast.error('Failed to resolve')
    }
  }

  // Top-level comments with their replies grouped underneath.
  const threads = useMemo(() => {
    const tops = annotations.filter((a) => !a.parentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return tops.map((t) => ({
      root: t,
      replies: annotations.filter((a) => a.parentId === t.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    }))
  }, [annotations])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg max-h-[90vh] flex flex-col p-0 border border-gold-500/20 shadow-gold-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gold-500/10">
          <div className="flex items-center gap-2 min-w-0">
            <MessageCircle className="w-5 h-5 text-gold-500 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-serif font-semibold text-lg text-gold-300 truncate">Annotations</h2>
              <p className="text-xs text-text-secondary truncate">{fileName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1 text-[10px] font-semibold ${connected ? 'text-emerald-400' : 'text-text-secondary'}`}>
              {connected ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-text-muted" />}
              {connected ? 'Live' : 'Offline'}
            </span>
            <button onClick={onClose} className="p-1.5 hover:bg-navy-950/60 rounded-lg text-text-secondary hover:text-text-primary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gold-500" /></div>
          ) : threads.length === 0 ? (
            <p className="text-text-secondary text-sm text-center py-6">No annotations yet. Start the discussion below.</p>
          ) : (
            threads.map(({ root, replies }) => (
              <div key={root.id} className={`border rounded-xl p-3.5 transition-all ${
                root.status === 'RESOLVED' 
                  ? 'border-gold-500/10 bg-navy-950/20 opacity-70' 
                  : 'border-gold-500/20 bg-navy-950/40 shadow-gold-sm'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary">{root.authorName}</p>
                    <p className="text-sm text-text-secondary mt-0.5 whitespace-pre-wrap break-words">{root.body}</p>
                  </div>
                  {root.status === 'RESOLVED' ? (
                    <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-success/15 border border-success/30 px-1.5 py-0.5 rounded shrink-0">
                      <CheckCircle2 className="w-3 h-3" /> RESOLVED
                    </span>
                  ) : (
                    <button onClick={() => resolve(root.id)} className="flex items-center gap-1 text-[10px] font-semibold text-text-muted hover:text-emerald-400 transition-colors shrink-0">
                      <Circle className="w-3 h-3" /> Resolve
                    </button>
                  )}
                </div>

                {replies.map((r) => (
                  <div key={r.id} className="mt-2.5 ml-3 pl-3 border-l border-gold-500/10 flex items-start gap-1.5">
                    <CornerDownRight className="w-3.5 h-3.5 text-gold-500/30 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-text-primary">{r.authorName}</p>
                      <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{r.body}</p>
                    </div>
                  </div>
                ))}

                {root.status !== 'RESOLVED' && (
                  <button onClick={() => setReplyTo(root)} className="mt-2 text-[10px] text-gold-400 hover:text-gold-300 font-semibold transition-colors">Reply</button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-gold-500/10 p-4 space-y-2 bg-navy-950/20">
          {replyTo && (
            <div className="flex items-center justify-between text-xs text-text-secondary bg-navy-950 border border-gold-500/10 rounded-lg px-2.5 py-1.5">
              <span className="truncate">Replying to {replyTo.authorName}</span>
              <button onClick={() => setReplyTo(null)} className="text-text-muted hover:text-text-primary"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              className="input flex-1 min-h-[44px] max-h-28"
              placeholder="Add a comment…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }}
            />
            <button onClick={send} disabled={sending || !body.trim()} className="btn-primary px-4 self-end py-3 disabled:opacity-50">
              {sending ? <Loader2 className="w-4 h-4 animate-spin text-navy-950" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[9px] text-text-secondary leading-normal">Comments are anchored to this document version and visible live to the case team.</p>
        </div>
      </div>
    </div>
  )
}
