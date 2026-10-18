import type { Socket } from 'socket.io-client'

let socket: Socket | null = null
// protege contra corrida: se desconectarmos enquanto o import ainda carrega, a conexão antiga é descartada
let generation = 0

// uma conexão por sessão. Token null = visitante (recebe só eventos públicos)
export async function connectSocket(token: string | null): Promise<Socket | null> {
  disconnectSocket()
  const mine = generation

  // import dinâmico: o socket.io-client guarda o WebSocket global quando é carregado,
  // então ele precisa ser carregado DEPOIS de o MSW substituir o WebSocket (startMocks).
  const { io } = await import('socket.io-client')
  if (mine !== generation) return null // alguém desconectou enquanto carregava

  const s = io('wss://realtime.nft.local', {
    transports: ['websocket'], // simulação: só WebSocket (sem long-polling)
    reconnectionDelay: 500,
  })
  // reautentica a cada conexão, inclusive nas reconexões
  s.on('connect', () => {
    if (token) s.emit('auth', token)
  })
  socket = s
  return s
}

export function disconnectSocket() {
  generation++
  socket?.removeAllListeners()
  socket?.disconnect()
  socket = null
}