import type { Cart } from '@/types/api'
import { authUser } from './auth'
import { getDb } from './db'
import { apiError } from './scenarios'

// dono do carrinho: usuário logado (userId) ou visitante ("guest:<id>")
export function cartOwner(request: Request) {
  // se veio token, ele precisa ser válido (assim a expiração de sessão também é tratada aqui)
  if (request.headers.get('Authorization')) {
    const auth = authUser(request)
    if ('error' in auth) return { error: auth.error }
    return { key: auth.user.id, userId: auth.user.id as string | null }
  }

  const guest = request.headers.get('X-Guest-Id')
  if (!guest) {
    return { error: apiError(401, 'UNAUTHENTICATED', 'Identificação ausente.') }
  }
  return { key: `guest:${guest}`, userId: null as string | null }
}

export function getCart(key: string): Cart {
  const db = getDb()
  if (!db.carts[key]) db.carts[key] = { items: [], couponCode: null }
  return db.carts[key]
}