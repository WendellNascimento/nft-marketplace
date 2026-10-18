import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { RealtimeEvent } from '@/types/api'
import { getDb } from './db'

// "servidor" Socket.IO simulado: só WebSocket, vive nesta aba
// regex: o cliente conecta em /socket.io/?EIO=4&...
const realtime = ws.link(/^wss?:\/\/realtime\.nft\.local\/.*/)

interface Conn {
  userId: string | null // preenchido pelo evento 'auth'
  emit: (event: string, payload: unknown) => void
}
const connections = new Set<Conn>()

export const realtimeHandlers = [
  realtime.addEventListener('connection', (connection) => {
    const io = toSocketIo(connection)
    const conn: Conn = {
      userId: null,
      emit: (event, payload) => io.client.emit(event, payload),
    }
    connections.add(conn)

    // o cliente se identifica com o token da sessão (visitante não envia)
    // o 1º parâmetro é o MessageEvent; os dados vêm depois
    io.client.on('auth', (_event, token: string) => {
      const entry = getDb().tokens[token]
      conn.userId = entry ? entry.userId : null
    })

    connection.client.addEventListener('close', () => connections.delete(conn))
  }),
]

let seq = 0

// evento com identidade estável, recurso e versão
export function makeEvent<T>(
  type: string,
  resourceId: string,
  version: number,
  data: T,
): RealtimeEvent<T> {
  return {
    id: `evt-${Date.now()}-${++seq}`,
    type,
    resourceId,
    version,
    occurredAt: new Date().toISOString(),
    data,
  }
}

export function emitToAll(event: string, payload: unknown) {
  connections.forEach((c) => c.emit(event, payload))
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  connections.forEach((c) => {
    if (c.userId === userId) c.emit(event, payload)
  })
}