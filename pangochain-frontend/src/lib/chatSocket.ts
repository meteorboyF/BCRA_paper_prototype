import { Client, type IMessage } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

/**
 * Thin STOMP-over-SockJS client for real-time chat. The JWT is sent on the STOMP
 * CONNECT frame (validated server-side by StompAuthChannelInterceptor). Auto-reconnects.
 */
export function createChatClient(
  token: string,
  handlers: { onConnect?: () => void; onDisconnect?: () => void; onError?: (msg: string) => void } = {},
): Client {
  const client = new Client({
    // SockJS gives us a transport that works through the Vite/Nginx proxy.
    webSocketFactory: () => new SockJS('/ws') as unknown as WebSocket,
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 4000,
    heartbeatIncoming: 10_000,
    heartbeatOutgoing: 10_000,
    onConnect: () => handlers.onConnect?.(),
    onWebSocketClose: () => handlers.onDisconnect?.(),
    onStompError: (frame) => handlers.onError?.(frame.headers['message'] ?? 'STOMP error'),
  })
  client.activate()
  return client
}

export type { IMessage }
