import { http, HttpResponse } from 'msw'
import type { Wallet } from '@/types/api'
import { authUser } from '../auth'
import { getDb, saveDb } from '../db'
import { apiError, simulateNetwork } from '../scenarios'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const NETWORKS = ['ethereum', 'polygon', 'base']

// Valida os campos e devolve só os erros (objeto vazio = tudo certo).
// "partial" = no PATCH só validamos o que foi enviado.
function validate(body: Record<string, unknown>, partial: boolean) {
  const fields: Record<string, string> = {}

  if (!partial || 'label' in body) {
    const label = String(body.label ?? '').trim()
    if (!label) fields.label = 'Informe um nome para a carteira.'
    else if (label.length > 30) fields.label = 'Use no máximo 30 caracteres.'
  }
  if (!partial || 'address' in body) {
    if (!ADDRESS_RE.test(String(body.address ?? '').trim())) {
      fields.address = 'Endereço inválido. Use 0x seguido de 40 caracteres hexadecimais.'
    }
  }
  if (!partial || 'network' in body) {
    if (!NETWORKS.includes(String(body.network ?? ''))) {
      fields.network = 'Escolha uma rede válida.'
    }
  }
  return fields
}

const validationError = (fields: Record<string, string>) =>
  apiError(422, 'VALIDATION_ERROR', 'Verifique os campos informados.', { fields })

export const walletHandlers = [
  // Lista as carteiras do usuário logado
  http.get('/api/wallets', async ({ request }) => {
    const failure = await simulateNetwork('wallets')
    if (failure) return failure
    const auth = authUser(request)
    if ('error' in auth) return auth.error

    const db = getDb()
    return HttpResponse.json(db.wallets[auth.user.id] ?? [])
  }),

  // Cadastra uma carteira nova
  http.post('/api/wallets', async ({ request }) => {
    const failure = await simulateNetwork('wallets')
    if (failure) return failure
    const auth = authUser(request)
    if ('error' in auth) return auth.error

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const fields = validate(body, false)
    if (Object.keys(fields).length) return validationError(fields)

    const db = getDb()
    // usuário recém-cadastrado ainda não tem lista no banco
    db.wallets[auth.user.id] ??= []
    const list = db.wallets[auth.user.id]

    const address = String(body.address).trim()
    const network = String(body.network)
    const duplicated = list.some(
      (w) => w.address.toLowerCase() === address.toLowerCase() && w.network === network,
    )
    if (duplicated) {
      return validationError({ address: 'Esta carteira já está cadastrada nesta rede.' })
    }

    const wallet: Wallet = {
      id: 'w' + crypto.randomUUID().slice(0, 8),
      label: String(body.label).trim(),
      address,
      network,
      // a primeira carteira do usuário já nasce como principal
      isPrimary: list.length === 0,
    }
    list.push(wallet)
    saveDb()
    return HttpResponse.json(wallet, { status: 201 })
  }),

  // Edita uma carteira (inclui "Tornar principal")
  http.patch('/api/wallets/:id', async ({ request, params }) => {
    const failure = await simulateNetwork('wallets')
    if (failure) return failure
    const auth = authUser(request)
    if ('error' in auth) return auth.error

    const db = getDb()
    const list = db.wallets[auth.user.id] ?? []
    const wallet = list.find((w) => w.id === String(params.id))
    // carteira de outro usuário também cai aqui: não revelamos que ela existe
    if (!wallet) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const fields = validate(body, true)

    // sempre precisa existir uma principal: não dá para "desmarcar" a atual
    if (body.isPrimary === false && wallet.isPrimary) {
      fields.isPrimary = 'Escolha outra carteira como principal.'
    }
    if (Object.keys(fields).length) return validationError(fields)

    if ('label' in body) wallet.label = String(body.label).trim()
    if ('address' in body) wallet.address = String(body.address).trim()
    if ('network' in body) wallet.network = String(body.network)

    if (body.isPrimary === true) {
      // só uma principal por usuário
      list.forEach((w) => (w.isPrimary = w.id === wallet.id))
    }

    saveDb()
    return HttpResponse.json(wallet)
  }),
]