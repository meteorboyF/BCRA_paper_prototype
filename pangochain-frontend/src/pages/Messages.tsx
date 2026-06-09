import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Send, Lock, Loader2, AlertCircle, Eye, Key, CheckCircle, ChevronDown, User as UserIcon } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { encryptDocument, eciesWrapKey, eciesUnwrapKey, bytesToBase64, base64ToBytes, loadWrappedPrivateKey, unwrapPrivateKey } from '../lib/crypto'
import api from '../lib/api'
import toast from 'react-hot-toast'

interface MessageDto {
  id: string
  senderId: string
  senderEmail: string
  senderName: string
  recipientId: string
  recipientEmail: string
  encryptedPayload: string
  wrappedKeyToken: string
  readAt: string | null
  createdAt: string
}

interface DecryptedState {
  [id: string]: { text: string; loading: boolean; error: string }
}

export default function Messages() {
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<MessageDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [composeTo, setComposeTo] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [sending, setSending] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [decrypted, setDecrypted] = useState<DecryptedState>({})
  const [password, setPassword] = useState('')
  const [passwordUnlocked, setPasswordUnlocked] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [showPasswordPanel, setShowPasswordPanel] = useState(false)
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchMessages(silent: boolean) {
      try {
        const { data } = await api.get('/messages')
        if (!cancelled) setMessages(data.content ?? [])
      } catch (err: any) {
        if (!cancelled && !silent) setError(err.response?.data?.detail ?? err.message ?? 'Failed to load messages')
      } finally {
        if (!cancelled && !silent) setLoading(false)
      }
    }

    fetchMessages(false)
    api.post('/messages/mark-read').catch(() => {})

    const POLL_MS = 10_000
    const timer = setInterval(() => fetchMessages(true), POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  const handleUnlockKey = async () => {
    if (!password || !user) return
    setUnlocking(true)
    try {
      const stored = loadWrappedPrivateKey(user.id)
      if (!stored) throw new Error('No private key found — please re-register or re-login')
      const key = await unwrapPrivateKey(password, stored.saltB64, stored.ivB64, stored.encryptedB64)
      setPrivateKey(key)
      setPasswordUnlocked(true)
      setShowPasswordPanel(false)
      toast.success('Private key unlocked — messages can now be decrypted')
    } catch (e) {
      toast.error('Wrong password or corrupted key')
    } finally {
      setUnlocking(false)
    }
  }

  const handleDecrypt = async (msg: MessageDto) => {
    if (!privateKey) {
      setShowPasswordPanel(true)
      return
    }
    setDecrypted((d) => ({ ...d, [msg.id]: { text: '', loading: true, error: '' } }))
    try {
      const docKeyB64 = await eciesUnwrapKey(privateKey, msg.wrappedKeyToken)
      const fullBytes = base64ToBytes(msg.encryptedPayload)
      const iv = fullBytes.slice(0, 12)
      const ciphertext = fullBytes.slice(12)
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw', base64ToBytes(docKeyB64).buffer as ArrayBuffer,
        { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
      )
      const plainBuf = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
        cryptoKey,
        ciphertext.buffer as ArrayBuffer,
      )
      const text = new TextDecoder().decode(plainBuf)
      setDecrypted((d) => ({ ...d, [msg.id]: { text, loading: false, error: '' } }))
    } catch (err: any) {
      setDecrypted((d) => ({ ...d, [msg.id]: { text: '', loading: false, error: 'Decryption failed — message not addressed to you?' } }))
    }
  }

  const handleSend = async () => {
    if (!composeTo.trim() || !composeBody.trim()) return
    setSending(true)
    try {
      const recipientRes = await api.get('/users/by-email', { params: { email: composeTo.trim() } })
      const recipient = recipientRes.data
      if (!recipient.hasPublicKey) {
        toast.error('Recipient has no public key — they must log in once first')
        return
      }

      const enc = new TextEncoder()
      const plainBytes = enc.encode(composeBody.trim()).buffer as ArrayBuffer
      const encrypted = await encryptDocument(plainBytes)

      const pkRes = await api.get(`/users/${recipient.id}/public-key`)
      const recipientPubKey: JsonWebKey = JSON.parse(pkRes.data.publicKeyJwk)
      const wrappedKeyToken = await eciesWrapKey(recipientPubKey, encrypted.keyB64)

      const ivBytes = Array.from(base64ToBytes(encrypted.ivB64))
      const ctBytes = Array.from(base64ToBytes(encrypted.ciphertextB64))
      const combined = new Uint8Array([...ivBytes, ...ctBytes])
      const encryptedPayload = bytesToBase64(combined)

      await api.post('/messages', { recipientId: recipient.id, encryptedPayload, wrappedKeyToken })

      // Reload messages
      const { data } = await api.get('/messages')
      setMessages(data.content ?? [])

      toast.success('Encrypted message sent')
      setComposeTo('')
      setComposeBody('')
      setShowCompose(false)
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? err.message ?? 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const grouped = messages.reduce<Record<string, MessageDto[]>>((acc, m) => {
    const other = m.senderId === user?.id ? m.recipientEmail : m.senderEmail
    if (!acc[other]) acc[other] = []
    acc[other].push(m)
    return acc
  }, {})

  const conversationsList = Object.entries(grouped).sort(
    ([, a], [, b]) => new Date(b[b.length - 1].createdAt).getTime() - new Date(a[a.length - 1].createdAt).getTime()
  )

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto text-text-primary selection:bg-gold-500/20 selection:text-gold-300">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gold-500/10 pb-6 shrink-0">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-wide text-gold-300">Encrypted Mailbox</h1>
          <p className="text-xs text-text-secondary mt-0.5">End-to-end encrypted (AES-256-GCM + ECIES P-256 envelops).</p>
        </div>
        
        <div className="flex items-center gap-3">
          {!passwordUnlocked ? (
            <button
              onClick={() => setShowPasswordPanel(!showPasswordPanel)}
              className="btn border border-gold-500/30 text-gold-300 bg-gold-500/5 hover:bg-gold-500/10 py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300"
            >
              <Key className="w-4 h-4 mr-1 text-gold-400" /> Unlock Key
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-success/15 border border-success/30 px-3 py-2 rounded-xl font-bold font-mono">
              <CheckCircle className="w-4 h-4 text-emerald-500" /> Key Unlocked
            </div>
          )}
          <button onClick={() => setShowCompose(!showCompose)} className="btn-primary text-xs uppercase tracking-wider font-bold py-2 px-4">
            <MessageSquare className="w-4 h-4" /> Compose
          </button>
        </div>
      </div>

      {/* Private Key Unlock Panel */}
      {showPasswordPanel && !passwordUnlocked && (
        <div className="card border-gold-500/30 bg-gold-500/5 p-6 rounded-2xl relative overflow-hidden">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-gold-400 animate-pulse" />
            <p className="font-serif font-bold text-sm text-gold-300">Enter secure password to derive E2E key ring</p>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              className="input flex-1 focus:border-gold-500"
              placeholder="Your account passkey"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlockKey()}
            />
            <button
              onClick={handleUnlockKey}
              disabled={unlocking || !password}
              className="btn-primary py-3 px-6 uppercase tracking-wider text-xs font-bold disabled:opacity-50"
            >
              {unlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Decrypt Ring'}
            </button>
          </div>
          <p className="text-[10px] text-text-muted mt-2 font-mono leading-relaxed">
            * Derivation is computed client-side. The key digests are stored in session memory and never transmitted over network protocols.
          </p>
        </div>
      )}

      {/* Compose Form */}
      {showCompose && (
        <div className="card border-gold-500/25 bg-navy-900/60 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-gold-500/5 pb-3">
            <Lock className="w-4 h-4 text-gold-400" />
            <p className="font-serif font-bold text-sm text-gold-300">Compose E2E Encrypted Mail</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Recipient E-Mail</label>
              <input
                className="input"
                placeholder="recipient@firm.com"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Encrypted Message Payload</label>
              <textarea
                className="input min-h-[140px] resize-y"
                placeholder="Write secure body..."
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] text-text-secondary bg-navy-950/40 rounded-xl px-4 py-3 border border-gold-500/5 font-mono">
              <Lock className="w-4 h-4 text-gold-500/40 shrink-0" />
              Payload is encrypted in this session sandbox before network transmit.
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-gold-500/5">
              <button onClick={() => setShowCompose(false)} className="btn-secondary text-xs uppercase tracking-wider py-2 px-4">Cancel</button>
              <button
                onClick={handleSend}
                disabled={sending || !composeTo.trim() || !composeBody.trim()}
                className="btn-primary text-xs uppercase tracking-wider font-bold py-2.5 px-4 disabled:opacity-50"
              >
                {sending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Encrypting...</>
                ) : (
                  <><Send className="w-4 h-4" /> Send Encrypted</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading & error states */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-gold-300">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      )}
      {error && !loading && (
        <div className="flex items-center gap-3 bg-error/10 border border-error/30 rounded-xl px-4 py-3 text-xs text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {!loading && !error && messages.length === 0 && (
        <div className="card text-center py-16 max-w-md mx-auto">
          <Lock className="w-12 h-12 text-gold-500/20 mx-auto mb-4" />
          <p className="font-serif text-lg font-bold text-gold-300">No decrypted records</p>
          <p className="text-text-secondary text-xs mt-1">Start secure message threads with other council members.</p>
        </div>
      )}

      {/* Conversation Thread Folders list */}
      {!loading && !error && conversationsList.length > 0 && (
        <div className="space-y-4">
          {conversationsList.map(([otherEmail, msgs]) => {
            const unread = msgs.filter((m) => m.senderId !== user?.id && !m.readAt).length
            const latest = msgs[msgs.length - 1]
            const isExpanded = expandedId === otherEmail

            return (
              <div key={otherEmail} className="card bg-navy-900/60 border-gold-500/10 hover:border-gold-500/20 transition-all duration-300">
                {/* Accordion trigger */}
                <button
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => setExpandedId(isExpanded ? null : otherEmail)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gold-500/5 border border-gold-500/10 flex items-center justify-center text-gold-400 font-bold shrink-0 shadow-inner">
                      {otherEmail[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-serif font-bold text-sm text-gold-300 truncate">{otherEmail}</p>
                        {unread > 0 && (
                          <span className="text-[10px] bg-gold-500 text-navy-950 font-bold px-2 py-0.5 rounded-full shadow-gold-sm">{unread} UNREAD</span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-text-secondary mt-1">{msgs.length} transactions · Last: {new Date(latest.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-gold-400 bg-gold-500/10 border border-gold-500/20 px-2 py-0.5 rounded">
                      <Lock className="w-2.5 h-2.5" /> E2E SECURE
                    </span>
                    <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform duration-300 ${isExpanded ? 'rotate-180 text-gold-400' : ''}`} />
                  </div>
                </button>

                {/* Expanded Messages list */}
                {isExpanded && (
                  <div className="mt-5 space-y-4 border-t border-gold-500/10 pt-5">
                    {msgs.map((m) => {
                      const isOwn = m.senderId === user?.id
                      const dec = decrypted[m.id]
                      return (
                        <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-2xl p-4 shadow-glass ${
                            isOwn ? 'bg-gradient-to-br from-gold-600 to-gold-500 text-navy-950 rounded-tr-none' : 'bg-slate-750 text-text-primary rounded-tl-none border border-gold-500/5'
                          }`}>
                            <div className="flex items-center gap-3 mb-2 font-mono text-[9px]">
                              <span className={`font-bold ${isOwn ? 'text-navy-950/70' : 'text-gold-400'}`}>
                                {isOwn ? 'OWN NODE' : m.senderName || m.senderEmail}
                              </span>
                              <span className={isOwn ? 'text-navy-950/50' : 'text-text-muted'}>
                                {new Date(m.createdAt).toLocaleTimeString()}
                              </span>
                            </div>

                            {dec?.loading && (
                              <div className="flex items-center gap-2 text-xs">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Decrypting payload...
                              </div>
                            )}
                            {dec?.text && (
                              <p className="text-xs whitespace-pre-wrap leading-relaxed">{dec.text}</p>
                            )}
                            {dec?.error && (
                              <p className="text-xs text-rose-400 font-mono">{dec.error}</p>
                            )}
                            {!dec && (
                              <div className="space-y-2">
                                <p className={`font-mono text-[9px] break-all opacity-55`}>
                                  CIPHER: {m.encryptedPayload.slice(0, 60)}…
                                </p>
                                <button
                                  onClick={() => handleDecrypt(m)}
                                  className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-all ${
                                    isOwn
                                      ? 'bg-navy-950/30 border-navy-950/20 text-navy-950 hover:bg-navy-950/50'
                                      : 'bg-gold-500/10 border-gold-500/20 text-gold-300 hover:bg-gold-500/20'
                                  }`}
                                >
                                  {passwordUnlocked ? <Eye className="w-3.5 h-3.5" /> : <Key className="w-3.5 h-3.5" />}
                                  {passwordUnlocked ? 'Decrypt Payload' : 'Unlock private key ring'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {/* Fast Reply Input */}
                    <div className="pt-4 border-t border-gold-500/5 flex gap-2">
                      <input
                        className="input flex-1 text-xs py-2 bg-navy-950"
                        placeholder={`Compose quick reply to ${otherEmail}...`}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            setComposeTo(otherEmail)
                            setComposeBody((e.target as HTMLInputElement).value)
                            ;(e.target as HTMLInputElement).value = ''
                            setShowCompose(true)
                          }
                        }}
                      />
                      <button
                        onClick={() => { setComposeTo(otherEmail); setShowCompose(true) }}
                        className="btn-primary p-2.5 rounded-xl text-xs uppercase font-bold"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}
