import { delay, http, HttpResponse } from 'msw'
import { z } from 'zod'
import type { Quote } from '@/types/api'
import { authUser } from '../auth'
import { cartOwner, getCart } from '../cartStore'
import { getDb, hashPassword, saveDb } from '../db'
import {
  findOrder,
  scheduleSettle,
  SETTLE_MS,
  settleIfDue,
  toPublicOrder,
  type StoredOrder,
} from '../orderEngine'
import { buildQuote } from '../quote'
import { apiError, getScenario, simulateNetwork } from '../scenarios'

const bodySchema = z.object({
  quoteId: z.string().min(1),
  walletId: z.string().min(1),
  network: z.enum(['ethereum', 'polygon', 'base']),
  billing: z.object({
    name: z.string().trim().min(1),
    email: z.email(),
  }),
})

export const orderHandlers = [
  http.post('/api/orders', async ({ request }) => {
    const failure = await simulateNetwork('orders')
    if (failure) return failure
    const auth = authUser(request)
    if ('error' in auth) return auth.error
    const owner = cartOwner(request)
    if ('error' in owner) return owner.error

    // 1) a chave de idempotência é obrigatória
    const idemKey = request.headers.get('Idempotency-Key')
    if (!idemKey) {
      return apiError(422, 'VALIDATION_ERROR', 'O cabeçalho Idempotency-Key é obrigatório.')
    }

    // 2) valida o corpo
    const raw = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      const fields: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const k = issue.path.join('.')
        if (k && !fields[k]) fields[k] = 'Valor inválido.'
      }
      return apiError(422, 'VALIDATION_ERROR', 'Verifique os campos informados.', { fields })
    }
    const body = parsed.data

    // 3) idempotência: mesma chave + mesmo corpo = mesmo pedido; corpo diferente = conflito
    const db = getDb()
    const storeKey = `${auth.user.id}:${idemKey}`
    const bodyHash = await hashPassword(
      JSON.stringify([body.quoteId, body.walletId, body.network, body.billing.name, body.billing.email]),
    )
    const existing = db.idempotency[storeKey]
    if (existing) {
      if (existing.bodyHash !== bodyHash) {
        return apiError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave já foi usada com outro conteúdo.')
      }
      const previous = findOrder(existing.orderId)
      if (previous) {
        settleIfDue(previous)
        return HttpResponse.json(toPublicOrder(previous)) // sem atraso: é a recuperação
      }
    }

    // 4) a carteira precisa ser do usuário
    const wallet = (db.wallets[auth.user.id] ?? []).find((w) => w.id === body.walletId)
    if (!wallet) {
      return apiError(422, 'VALIDATION_ERROR', 'Carteira inválida.', {
        fields: { walletId: 'Escolha uma das suas carteiras.' },
      })
    }

    // 5) recalcula a cotação no servidor: ela é a referência
    const quote: Quote = await buildQuote(getCart(owner.key))
    if (quote.items.length === 0) {
      return apiError(409, 'CONFLICT', 'Seu carrinho está vazio.', { quote })
    }
    if (quote.issues.some((i) => i.code === 'OUT_OF_STOCK')) {
      return apiError(409, 'OUT_OF_STOCK', 'Há itens indisponíveis no carrinho.', { quote })
    }
    if (quote.id !== body.quoteId) {
      return apiError(409, 'QUOTE_STALE', 'Os valores mudaram. Revise e aceite a nova cotação.', { quote })
    }

    // 6) cria o pedido com snapshot dos itens e valores
    const order: StoredOrder = {
      id: 'o' + crypto.randomUUID().slice(0, 8),
      status: 'pending',
      version: 1,
      items: quote.items,
      subtotal: quote.subtotal,
      discount: quote.discount,
      networkFee: quote.networkFee,
      total: quote.total,
      walletId: wallet.id,
      network: body.network,
      txHash: null,
      createdAt: new Date().toISOString(),
      userId: auth.user.id,
      settleAt: Date.now() + SETTLE_MS,
      willRefuse: getScenario() === 'payment-declined',
      cartKey: owner.key,
    }
    db.orders.push(order)
    db.idempotency[storeKey] = { bodyHash, orderId: order.id }
    saveDb()
    scheduleSettle(order.id)

    // cenário: o pedido foi criado, mas a resposta demora mais que o timeout do axios (8 s)
    if (getScenario() === 'order-timeout') await delay(12000)

    return HttpResponse.json(toPublicOrder(order), { status: 201 })
  }),

  http.get('/api/orders/:id', async ({ request, params }) => {
    const failure = await simulateNetwork('orders')
    if (failure) return failure
    const auth = authUser(request)
    if ('error' in auth) return auth.error

    const order = findOrder(String(params.id))
    if (!order) return apiError(404, 'NOT_FOUND', 'Pedido não encontrado.')
    if (order.userId !== auth.user.id) {
      return apiError(403, 'FORBIDDEN', 'Você não tem acesso a este pedido.')
    }
    settleIfDue(order) // resolve "preguiçosamente" se o prazo já passou
    return HttpResponse.json(toPublicOrder(order))
  }),
]