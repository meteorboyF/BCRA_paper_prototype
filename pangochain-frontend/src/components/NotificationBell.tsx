import { useEffect, useRef, useState } from 'react'
import { Bell, Check, Loader2, X } from 'lucide-react'
import type { Client, StompSubscription } from '@stomp/stompjs'
import { useAuthStore } from '../store/authStore'
import api from '../lib/api'
import { createChatClient } from '../lib/chatSocket'

interface NotificationDto {
  id: string
  type: string
  message: string
  read: boolean
  createdAt: string
}

export function NotificationBell() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.accessToken)

  const [items, setItems] = useState<NotificationDto[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const clientRef = useRef<Client | null>(null)
  const subRef = useRef<StompSubscription | null>(null)

  // Initial load + browser-notification permission.
  useEffect(() => {
    if (!user) return
    setLoading(true)
    api.get('/notifications', { params: { size: 20 } })
      .then((r) => { setItems(r.data?.content ?? []); setUnread(r.data?.unread ?? 0) })
      .catch(() => { /* non-fatal */ })
      .finally(() => setLoading(false))
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [user])

  // Live subscription to this user's notification topic.
  useEffect(() => {
    if (!token || !user) return
    const client = createChatClient(token, {
      onConnect: () => {
        subRef.current?.unsubscribe()
        subRef.current = client.subscribe(`/topic/users/${user.id}/notifications`, (frame) => {
          try {
            const n: NotificationDto = JSON.parse(frame.body)
            setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev].slice(0, 50)))
            setUnread((c) => c + 1)
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('PangoChain', { body: n.message })
            }
          } catch { /* ignore malformed frame */ }
        })
      },
    })
    clientRef.current = client
    return () => { subRef.current?.unsubscribe(); subRef.current = null; client.deactivate(); clientRef.current = null }
  }, [token, user])

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all')
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnread(0)
    } catch { /* non-fatal */ }
  }

  if (!user) return null

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((v) => !v); if (!open && unread > 0) markAllRead() }}
        className="relative p-2 rounded-xl text-text-secondary hover:text-gold-400 transition-colors duration-200"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-gold-500 text-navy-950 text-[9px] font-bold flex items-center justify-center shadow-gold-sm">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-3 w-80 max-h-96 overflow-y-auto scrollbar-thin bg-navy-900 border border-gold-500/20 rounded-2xl shadow-gold-md z-40 p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gold-500/10 sticky top-0 bg-navy-900/95 backdrop-blur-md z-10">
              <span className="font-serif font-bold text-sm text-gold-300">Notifications</span>
              <div className="flex items-center gap-3">
                <button onClick={markAllRead} className="text-xs text-gold-400 hover:text-gold-300 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Mark read
                </button>
                <button onClick={() => setOpen(false)} className="text-text-secondary hover:text-text-primary"><X className="w-4 h-4" /></button>
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gold-500" /></div>
            ) : items.length === 0 ? (
              <p className="text-center text-sm text-text-secondary py-10">You're all caught up.</p>
            ) : (
              <ul className="divide-y divide-gold-500/10">
                {items.map((n) => (
                  <li key={n.id} className={`px-4 py-3 transition-colors ${n.read ? 'hover:bg-navy-950/20' : 'bg-gold-500/5 hover:bg-gold-500/10'}`}>
                    <div className="flex items-start gap-2.5">
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-gold-400 mt-2 shrink-0 shadow-gold-sm" />}
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-gold-500/60">{n.type.replace(/_/g, ' ')}</p>
                        <p className="text-sm text-text-primary mt-0.5 leading-relaxed">{n.message}</p>
                        <p className="text-[10px] text-text-secondary font-mono mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
