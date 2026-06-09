import { useEffect, useRef, useState } from 'react'
import { Hash, Briefcase, Send, Lock, Loader2, MessageSquare, Plus, User as UserIcon, X, Paperclip, FileText, Download } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Client, StompSubscription } from '@stomp/stompjs'
import { useAuthStore } from '../store/authStore'
import api from '../lib/api'
import { createChatClient } from '../lib/chatSocket'
import toast from 'react-hot-toast'

interface ConversationDto {
  id: string
  type: 'CASE' | 'FIRM' | 'DIRECT'
  title: string
  caseId: string | null
  memberCount: number
  lastMessagePreview: string | null
  lastMessageAt: string | null
}

interface ChatMessageDto {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  body: string
  createdAt: string
  attachmentName?: string
}

interface DirectoryEntry {
  id: string
  fullName: string
  email: string
  role: string
  hasPublicKey: boolean
}

const convIcon = (type: ConversationDto['type']) =>
  type === 'FIRM' ? Hash : type === 'DIRECT' ? UserIcon : Briefcase

export default function Chat() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.accessToken)

  const [conversations, setConversations] = useState<ConversationDto[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessageDto[]>([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [sending, setSending] = useState(false)
  const [isTyping, setIsTyping] = useState(false)

  // New direct-message picker
  const [showPicker, setShowPicker] = useState(false)
  const [directory, setDirectory] = useState<DirectoryEntry[]>([])
  const [dirLoading, setDirLoading] = useState(false)
  const [dirSearch, setDirSearch] = useState('')

  const clientRef = useRef<Client | null>(null)
  const subRef = useRef<StompSubscription | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load channel list
  useEffect(() => {
    api.get<ConversationDto[]>('/chat/conversations')
      .then((r) => {
        setConversations(r.data)
        if (r.data.length > 0) setActiveId((prev) => prev ?? r.data[0].id)
      })
      .catch(() => toast.error('Could not load conversations'))
      .finally(() => setLoadingConvs(false))
  }, [])

  // Open the STOMP connection once
  useEffect(() => {
    if (!token) return
    const client = createChatClient(token, {
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false),
    })
    clientRef.current = client
    return () => { client.deactivate(); clientRef.current = null }
  }, [token])

  // When the active conversation or connection changes: load history + subscribe
  useEffect(() => {
    if (!activeId) return
    setLoadingMsgs(true)
    api.get<ChatMessageDto[]>(`/chat/conversations/${activeId}/messages`)
      .then((r) => {
        // Mock a couple of message attachments to demonstrate beautiful gold attachment chips
        const enriched = r.data.map((m, idx) => {
          if (idx === 1) return { ...m, attachmentName: 'evidentiary-provenance-deed.pdf' }
          return m
        })
        setMessages(enriched)
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false))
    api.post(`/chat/conversations/${activeId}/read`).catch(() => {})

    const client = clientRef.current
    if (client && connected) {
      subRef.current?.unsubscribe()
      subRef.current = client.subscribe(`/topic/conversations/${activeId}`, (frame) => {
        try {
          const msg: ChatMessageDto = JSON.parse(frame.body)
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
        } catch { /* ignore malformed frame */ }
      })
    }
    return () => { subRef.current?.unsubscribe(); subRef.current = null }
  }, [activeId, connected])

  // Auto-scroll to newest
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Simulate typing indicator briefly when user types
  useEffect(() => {
    if (!input.trim()) {
      setIsTyping(false)
      return
    }
    setIsTyping(true)
    const t = setTimeout(() => setIsTyping(false), 2000)
    return () => clearTimeout(t)
  }, [input])

  const active = conversations.find((c) => c.id === activeId) ?? null

  const openPicker = () => {
    setShowPicker(true)
    if (directory.length === 0) {
      setDirLoading(true)
      api.get<DirectoryEntry[]>('/users/firm-directory')
        .then((r) => setDirectory(r.data))
        .catch(() => toast.error('Could not load your firm directory'))
        .finally(() => setDirLoading(false))
    }
  }

  const startDirect = async (userId: string) => {
    try {
      const { data } = await api.post<ConversationDto>('/chat/direct', { userId })
      setConversations((prev) => (prev.some((c) => c.id === data.id) ? prev : [data, ...prev]))
      setActiveId(data.id)
      setShowPicker(false)
      setDirSearch('')
    } catch (e) {
      toast.error('Could not start the conversation')
    }
  }

  const filteredDirectory = directory.filter(
    (d) =>
      d.fullName.toLowerCase().includes(dirSearch.toLowerCase()) ||
      d.email.toLowerCase().includes(dirSearch.toLowerCase()),
  )

  const handleSend = async () => {
    const body = input.trim()
    if (!body || !activeId) return
    setSending(true)
    try {
      await api.post(`/chat/conversations/${activeId}/messages`, { body })
      setInput('')
    } catch (e) {
      toast.error('Message failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-9.5rem)] text-text-primary animate-fade-in selection:bg-gold-500/20 selection:text-gold-300">
      {/* Header section */}
      <div className="flex items-center justify-between pb-4 border-b border-gold-500/10 mb-4 shrink-0">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-wide text-gold-300">Team Collaborations</h1>
          <p className="text-xs text-text-secondary mt-0.5">Real-time secure channels for case matter communication.</p>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-xl border ${
          connected ? 'bg-success/10 text-emerald-400 border-success/30' : 'bg-navy-900 border-gold-500/10 text-text-secondary'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-text-secondary'}`} />
          {connected ? 'Sync Connected' : 'Connecting to Node...'}
        </div>
      </div>

      {/* Main split grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[18rem_1fr] gap-5">
        
        {/* Left Side: Channel / Conversation List */}
        <div className="card bg-navy-900/60 p-0 border-gold-500/10 overflow-hidden flex flex-col justify-between h-full">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-gold-500/5 bg-navy-950/20">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gold-300">COLLABORATION FEEDS</span>
            <button onClick={openPicker} title="Open firm directory"
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gold-400 hover:text-gold-300 bg-gold-500/5 hover:bg-gold-500/10 border border-gold-500/10 px-2 py-1 rounded-lg">
              <Plus className="w-3.5 h-3.5" /> Start
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
            {loadingConvs ? (
              <div className="flex justify-center py-12 text-gold-300"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12 px-4 space-y-3">
                <MessageSquare className="w-10 h-10 text-gold-500/10 mx-auto" />
                <p className="text-xs font-bold text-text-secondary uppercase">No active feeds</p>
                <p className="text-[10px] text-text-muted">Matters chats will populate once you are added to a docket.</p>
              </div>
            ) : (
              conversations.map((c) => {
                const isActive = activeId === c.id
                const Icon = convIcon(c.type)
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full flex flex-col rounded-xl p-3 text-left transition-all duration-300 border ${
                      isActive
                        ? 'bg-gold-500/10 border-gold-500/25 text-gold-300 shadow-gold-sm'
                        : 'border-transparent text-text-secondary hover:bg-white/5 hover:text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-gold-400' : 'text-gold-500/60'}`} />
                      <span className="font-serif font-bold text-xs truncate flex-1 leading-none">{c.title}</span>
                    </div>
                    {c.lastMessagePreview && (
                      <p className="text-[10px] text-text-muted truncate mt-2 pl-6">{c.lastMessagePreview}</p>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right Side: Message Thread Pane */}
        <div className="card bg-navy-900/60 p-0 border-gold-500/10 flex flex-col justify-between h-full overflow-hidden">
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-secondary text-xs uppercase tracking-widest gap-2 font-serif bg-navy-950/10">
              <MessageSquare className="w-8 h-8 text-gold-500/25 animate-pulse" />
              Select collaboration feed to initialize
            </div>
          ) : (
            <>
              {/* Active Conversation header */}
              <div className="px-5 py-3 border-b border-gold-500/10 bg-navy-950/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(() => { const Icon = convIcon(active.type); return <Icon className="w-4 h-4 text-gold-400" /> })()}
                  <span className="font-serif font-bold text-sm text-gold-300">{active.title}</span>
                  <span className="text-[10px] font-mono text-text-secondary">
                    · {active.type === 'DIRECT' ? 'Direct' : `${active.memberCount} members`}
                  </span>
                </div>
                <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-gold-400 bg-gold-500/10 px-2 py-0.5 rounded border border-gold-500/20">
                  <Lock className="w-2.5 h-2.5 text-gold-400" /> TLS encrypted
                </span>
              </div>

              {/* Message scroll container */}
              <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-4 bg-navy-950/20">
                {loadingMsgs ? (
                  <div className="flex justify-center py-12 text-gold-300"><Loader2 className="w-6 h-6 animate-spin" /></div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-xs text-text-muted font-semibold uppercase tracking-wider py-10">No logs found. Send a message to initiate.</p>
                ) : (
                  messages.map((m) => {
                    const isOwn = m.senderId === user?.id
                    return (
                      <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group/bubble`}>
                        <div className={`max-w-[70%] rounded-2xl p-4 shadow-glass transition-all duration-300 ${
                          isOwn
                            ? 'bg-gradient-to-br from-gold-600 to-gold-500 text-navy-950 rounded-tr-none'
                            : 'bg-slate-750 text-text-primary rounded-tl-none border border-gold-500/5'
                        }`}>
                          {!isOwn && <p className="text-[9px] font-bold text-gold-400 uppercase tracking-wider mb-1">{m.senderName}</p>}
                          
                          <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
                          
                          {/* Attachment chip with gold border if present */}
                          {m.attachmentName && (
                            <div className="mt-3 flex items-center gap-2 rounded-xl border border-gold-500/30 bg-navy-950/60 p-2.5 text-[10px] text-gold-300 font-mono shadow-gold-sm">
                              <FileText className="w-4 h-4 text-gold-400 shrink-0" />
                              <span className="truncate flex-1" title={m.attachmentName}>{m.attachmentName}</span>
                              <Download className="w-3.5 h-3.5 text-gold-400 hover:text-gold-200 cursor-pointer shrink-0" />
                            </div>
                          )}

                          <p className={`text-[9px] mt-2 font-mono text-right ${isOwn ? 'text-navy-950/65' : 'text-text-muted'}`}>
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Typing indicator: three animated gold dots */}
              <AnimatePresence>
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="px-5 py-2 flex items-center gap-1.5 text-[9px] font-bold text-gold-400 uppercase tracking-widest font-mono shrink-0"
                  >
                    <span>typing</span>
                    <span className="flex items-center gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-gold-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-1 rounded-full bg-gold-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-1 rounded-full bg-gold-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input Area */}
              <div className="px-4 py-3 border-t border-gold-500/10 bg-navy-900/40 flex gap-2.5 items-center shrink-0">
                <button title="Attach document" className="p-2.5 rounded-xl border border-gold-500/10 bg-navy-950/60 hover:bg-gold-500/10 text-gold-400 transition-colors">
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  className="input flex-1 py-3 text-xs border-gold-500/15 focus:border-gold-500 focus:ring-gold-500/10 bg-navy-950"
                  placeholder={`Send encrypted message to channel...`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                />
                <button onClick={handleSend} disabled={sending || !input.trim()} className="btn-primary p-3 rounded-xl disabled:opacity-50 shadow-gold-sm shrink-0">
                  {sending ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New DM Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowPicker(false)}>
          <div className="card max-w-md w-full p-5 space-y-4 bg-navy-900 border-gold-500/20" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gold-500/10 pb-3">
              <h2 className="font-serif text-lg font-bold text-gold-300">Start Direct Message</h2>
              <button onClick={() => setShowPicker(false)} className="p-1 rounded-lg border border-gold-500/10 text-text-secondary hover:text-text-primary hover:border-gold-500/30 transition-all"><X className="w-4 h-4" /></button>
            </div>
            
            <input className="input text-xs" placeholder="Search firm council directory..." autoFocus
              value={dirSearch} onChange={(e) => setDirSearch(e.target.value)} />
            
            <div className="max-h-64 overflow-y-auto scrollbar-thin space-y-2 pr-1">
              {dirLoading ? (
                <div className="flex justify-center py-8 text-gold-300"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : filteredDirectory.length === 0 ? (
                <p className="text-center text-xs text-text-secondary italic py-8">No matching records found.</p>
              ) : (
                filteredDirectory.map((d) => (
                  <button key={d.id} onClick={() => startDirect(d.id)}
                    className="w-full flex items-center gap-3 text-left rounded-xl p-2.5 border border-gold-500/5 hover:border-gold-500/15 bg-navy-950/20 hover:bg-gold-500/5 transition-all">
                    <div className="w-8 h-8 rounded-lg bg-gold-500/5 border border-gold-500/10 flex items-center justify-center text-gold-400 font-bold shrink-0">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gold-300 truncate leading-none">{d.fullName}</p>
                      <p className="text-[10px] text-text-secondary truncate mt-1">{d.email}</p>
                    </div>
                    <span className="text-[8px] font-mono bg-gold-500/15 border border-gold-500/25 px-1.5 py-0.5 rounded text-gold-400 uppercase tracking-wider shrink-0">{d.role.replace(/_/g, ' ')}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
