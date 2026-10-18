import type { User } from '@/types/api'
import { getDb } from './db'
import { apiError } from './scenarios'

export function authUser(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  const entry = token ? getDb().tokens[token] : undefined

  if (!token || !entry) {
    return { error: apiError(401, 'UNAUTHENTICATED', 'Faça login para continuar.') }
  }
  if (new Date(entry.expiresAt).getTime() < Date.now()) {
    return { error: apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.') }
  }
  const user = getDb().users.find((u) => u.id === entry.userId)
  if (!user) {
    return { error: apiError(401, 'UNAUTHENTICATED', 'Faça login para continuar.') }
  }
  return { user, token }
}

// nunca devolvemos o hash da senha para o front
export const publicUser = (user: User): User => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
})