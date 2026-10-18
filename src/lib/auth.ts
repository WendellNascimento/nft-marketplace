import { api } from '@/api/client'
import type { Session } from '@/types/api'
import { queryClient } from './queryClient'
import { sessionStore } from './session'

// chamado depois de um login bem-sucedido
export async function startSession(session: Session) {
  queryClient.clear() // troca de usuário não herda cache do anterior
  sessionStore.set(session)

  try {
    // junta os itens do visitante ao carrinho da conta
    await api.post('/cart/merge', { guestId: sessionStore.guestId() })
  } catch {
    // se falhar, o carrinho do visitante continua guardado e nada é perdido
  }
  // o carrinho já pode ter sido buscado antes do merge: busca de novo
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['cart'] }),
    queryClient.invalidateQueries({ queryKey: ['quote'] }),
  ])
}

// encerra a sessão localmente (logout e expiração usam isso)
export function endSession() {
  sessionStore.clear()
  queryClient.clear()
  // Fase G (Socket.IO): aqui entra o disconnectSocket()
}

export async function logout() {
  try {
    await api.post('/session/logout') // precisa ir ANTES de limpar, porque usa o token
  } catch {
    // se falhar, encerramos localmente do mesmo jeito
  }
  endSession()
}