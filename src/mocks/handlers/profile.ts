import { http, HttpResponse } from 'msw'
import { authUser, publicUser } from '../auth'
import { getDb, hashPassword, saveDb } from '../db'
import { apiError, simulateNetwork } from '../scenarios'

const EMAIL = /^\S+@\S+\.\S+$/
// ~200 KB de imagem viram ~270 mil caracteres em base64 (data URL)
const MAX_AVATAR_CHARS = 300_000

export const profileHandlers = [
  // dados do perfil
  http.get('/api/profile', async ({ request }) => {
    const failure = await simulateNetwork('profile')
    if (failure) return failure
    const auth = authUser(request)
    if ('error' in auth) return auth.error
    return HttpResponse.json(publicUser(auth.user))
  }),

  // altera nome, e-mail e/ou avatar (avatarUrl: null remove a foto)
  http.patch('/api/profile', async ({ request }) => {
    const failure = await simulateNetwork('profile-update')
    if (failure) return failure
    const auth = authUser(request)
    if ('error' in auth) return auth.error

    const body = (await request.json()) as {
      name?: string
      email?: string
      avatarUrl?: string | null
    }
    const name = body.name === undefined ? auth.user.name : body.name.trim()
    const email = body.email === undefined ? auth.user.email : body.email.trim().toLowerCase()
    const avatar = body.avatarUrl

    const fields: Record<string, string> = {}
    if (!name) fields.name = 'Informe seu nome.'
    if (!EMAIL.test(email)) fields.email = 'Informe um e-mail válido.'
    if (avatar !== undefined && avatar !== null) {
      if (!avatar.startsWith('data:image/')) fields.avatar = 'O arquivo precisa ser uma imagem.'
      else if (avatar.length > MAX_AVATAR_CHARS) fields.avatar = 'A imagem é grande demais (máximo 200 KB).'
    }
    if (Object.keys(fields).length) {
      return apiError(422, 'VALIDATION_ERROR', 'Confira os campos.', { fields })
    }

    const db = getDb()
    if (db.users.some((u) => u.id !== auth.user.id && u.email === email)) {
      return apiError(409, 'CONFLICT', 'Este e-mail já está cadastrado.', {
        fields: { email: 'Este e-mail já está cadastrado.' },
      })
    }

    auth.user.name = name
    auth.user.email = email
    if (avatar !== undefined) auth.user.avatarUrl = avatar
    saveDb()
    return HttpResponse.json(publicUser(auth.user))
  }),

  // troca de senha
  http.post('/api/profile/password', async ({ request }) => {
    const failure = await simulateNetwork('profile-password')
    if (failure) return failure
    const auth = authUser(request)
    if ('error' in auth) return auth.error

    const body = (await request.json()) as { currentPassword?: string; newPassword?: string }
    const current = body.currentPassword ?? ''
    const next = body.newPassword ?? ''

    const fields: Record<string, string> = {}
    // 422 (e não 401): 401 faria o front achar que a sessão expirou
    if (auth.user.passwordHash !== (await hashPassword(current))) {
      fields.currentPassword = 'Senha atual incorreta.'
    }
    if (next.length < 8) fields.newPassword = 'A nova senha precisa ter pelo menos 8 caracteres.'
    else if (next === current) fields.newPassword = 'A nova senha deve ser diferente da atual.'
    if (Object.keys(fields).length) {
      return apiError(422, 'VALIDATION_ERROR', 'Confira os campos.', { fields })
    }

    const db = getDb()
    auth.user.passwordHash = await hashPassword(next) // só o hash é guardado
    // encerra as outras sessões deste usuário, mantém a atual
    for (const [token, entry] of Object.entries(db.tokens)) {
      if (entry.userId === auth.user.id && token !== auth.token) delete db.tokens[token]
    }
    saveDb()
    return new HttpResponse(null, { status: 204 })
  }),
]