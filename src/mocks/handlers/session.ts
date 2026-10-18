import { http, HttpResponse } from 'msw'
import { authUser, publicUser } from '../auth'
import { getDb, hashPassword, saveDb } from '../db'
import { apiError, simulateNetwork } from '../scenarios'

const EMAIL = /^\S+@\S+\.\S+$/
const SESSION_MINUTES = 30

export const sessionHandlers = [
  // cadastro
  http.post('/api/session/register', async ({ request }) => {
    const failure = await simulateNetwork('register')
    if (failure) return failure

    const body = (await request.json()) as { name?: string; email?: string; password?: string }
    const name = body.name?.trim() ?? ''
    const email = body.email?.trim().toLowerCase() ?? ''
    const password = body.password ?? ''

    const fields: Record<string, string> = {}
    if (!name) fields.name = 'Informe seu nome.'
    if (!EMAIL.test(email)) fields.email = 'Informe um e-mail válido.'
    if (password.length < 8) fields.password = 'A senha precisa ter pelo menos 8 caracteres.'
    if (Object.keys(fields).length) {
      return apiError(422, 'VALIDATION_ERROR', 'Confira os campos.', { fields })
    }

    const db = getDb()
    if (db.users.some((u) => u.email === email)) {
      return apiError(409, 'CONFLICT', 'Este e-mail já está cadastrado.', {
        fields: { email: 'Este e-mail já está cadastrado.' },
      })
    }

    db.users.push({
      id: crypto.randomUUID(),
      name,
      email,
      avatarUrl: null,
      passwordHash: await hashPassword(password), // só o hash é guardado
    })
    saveDb()
    return HttpResponse.json({ ok: true }, { status: 201 })
  }),

  // login
  http.post('/api/session/login', async ({ request }) => {
    const failure = await simulateNetwork('login')
    if (failure) return failure

    const body = (await request.json()) as { email?: string; password?: string }
    const email = body.email?.trim().toLowerCase() ?? ''
    const db = getDb()
    const user = db.users.find((u) => u.email === email)

    if (!user || user.passwordHash !== (await hashPassword(body.password ?? ''))) {
      return apiError(401, 'UNAUTHENTICATED', 'E-mail ou senha inválidos.', {
        fields: { password: 'E-mail ou senha inválidos.' },
      })
    }

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + SESSION_MINUTES * 60_000).toISOString()
    db.tokens[token] = { userId: user.id, expiresAt }
    saveDb()
    return HttpResponse.json({ token, expiresAt, user: publicUser(user) })
  }),

  // consulta da sessão (usada para revalidar o token ao abrir o app)
  http.get('/api/session', async ({ request }) => {
    const failure = await simulateNetwork('session')
    if (failure) return failure

    const auth = authUser(request)
    if ('error' in auth) return auth.error
    return HttpResponse.json({
      token: auth.token,
      expiresAt: getDb().tokens[auth.token].expiresAt,
      user: publicUser(auth.user),
    })
  }),

  // logout
  http.post('/api/session/logout', async ({ request }) => {
    const failure = await simulateNetwork('logout')
    if (failure) return failure

    const auth = authUser(request)
    if (!('error' in auth)) {
      delete getDb().tokens[auth.token]
      saveDb()
    }
    return new HttpResponse(null, { status: 204 })
  }),
]