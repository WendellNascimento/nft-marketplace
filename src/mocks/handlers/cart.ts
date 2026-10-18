import { http, HttpResponse } from 'msw'
import type { CartItem } from '@/types/api'
import { cartOwner, getCart } from '../cartStore'
import { getDb, saveDb } from '../db'
import { apiError, simulateNetwork } from '../scenarios'

const findEdition = (nftId: string, editionId: string) =>
  getDb().nfts.find((n) => n.id === nftId)?.editions.find((e) => e.id === editionId)

const isValidQuantity = (q: unknown): q is number =>
  typeof q === 'number' && Number.isInteger(q) && q >= 1

export const cartHandlers = [
  // consultar o carrinho
  http.get('/api/cart', async ({ request }) => {
    const failure = await simulateNetwork('cart')
    if (failure) return failure
    const owner = cartOwner(request)
    if ('error' in owner) return owner.error
    return HttpResponse.json(getCart(owner.key))
  }),

  // adicionar item (soma se já existir)
  http.post('/api/cart/items', async ({ request }) => {
    const failure = await simulateNetwork('cart')
    if (failure) return failure
    const owner = cartOwner(request)
    if ('error' in owner) return owner.error

    const { nftId, editionId, quantity } = (await request.json()) as Partial<CartItem>
    if (!nftId || !editionId || !isValidQuantity(quantity)) {
      return apiError(422, 'VALIDATION_ERROR', 'Quantidade inválida.')
    }
    const edition = findEdition(nftId, editionId)
    if (!edition) return apiError(404, 'NOT_FOUND', 'NFT ou edição não encontrados.')
    if (edition.available === 0) {
      return apiError(409, 'OUT_OF_STOCK', 'Esta edição está esgotada.')
    }

    const cart = getCart(owner.key)
    const existing = cart.items.find((i) => i.nftId === nftId && i.editionId === editionId)
    const newQuantity = (existing?.quantity ?? 0) + quantity
    if (newQuantity > edition.available) {
      return apiError(
        409,
        'OUT_OF_STOCK',
        `Só há ${edition.available} unidade(s) disponível(is) desta edição.`,
      )
    }

    if (existing) existing.quantity = newQuantity
    else cart.items.push({ nftId, editionId, quantity })
    saveDb()
    return HttpResponse.json(cart, { status: 201 })
  }),

  // alterar a quantidade
  http.patch('/api/cart/items/:nftId/:editionId', async ({ request, params }) => {
    const failure = await simulateNetwork('cart')
    if (failure) return failure
    const owner = cartOwner(request)
    if ('error' in owner) return owner.error

    const { quantity } = (await request.json()) as { quantity?: unknown }
    if (!isValidQuantity(quantity)) {
      return apiError(422, 'VALIDATION_ERROR', 'Quantidade inválida.')
    }

    const nftId = String(params.nftId)
    const editionId = String(params.editionId)
    const cart = getCart(owner.key)
    const item = cart.items.find((i) => i.nftId === nftId && i.editionId === editionId)
    if (!item) return apiError(404, 'NOT_FOUND', 'Item não está no carrinho.')

    const edition = findEdition(nftId, editionId)
    if (!edition || edition.available === 0) {
      return apiError(409, 'OUT_OF_STOCK', 'Esta edição está esgotada.')
    }
    if (quantity > edition.available) {
      return apiError(
        409,
        'OUT_OF_STOCK',
        `Só há ${edition.available} unidade(s) disponível(is) desta edição.`,
      )
    }

    item.quantity = quantity
    saveDb()
    return HttpResponse.json(cart)
  }),

  // remover item
  http.delete('/api/cart/items/:nftId/:editionId', async ({ request, params }) => {
    const failure = await simulateNetwork('cart')
    if (failure) return failure
    const owner = cartOwner(request)
    if ('error' in owner) return owner.error

    const cart = getCart(owner.key)
    cart.items = cart.items.filter(
      (i) => !(i.nftId === String(params.nftId) && i.editionId === String(params.editionId)),
    )
    saveDb()
    return new HttpResponse(null, { status: 204 })
  }),

  // aplicar cupom
  http.put('/api/cart/coupon', async ({ request }) => {
    const failure = await simulateNetwork('cart')
    if (failure) return failure
    const owner = cartOwner(request)
    if ('error' in owner) return owner.error

    const { code } = (await request.json()) as { code?: string }
    const normalized = (code ?? '').trim().toUpperCase()

    if (normalized === 'EXPIRED') {
      return apiError(422, 'VALIDATION_ERROR', 'Cupom expirado.', {
        fields: { coupon: 'Cupom expirado.' },
      })
    }
    if (normalized !== 'PROMO10') {
      return apiError(422, 'VALIDATION_ERROR', 'Cupom inválido.', {
        fields: { coupon: 'Cupom inválido.' },
      })
    }

    const cart = getCart(owner.key)
    cart.couponCode = normalized
    saveDb()
    return HttpResponse.json(cart)
  }),

  // remover cupom
  http.delete('/api/cart/coupon', async ({ request }) => {
    const failure = await simulateNetwork('cart')
    if (failure) return failure
    const owner = cartOwner(request)
    if ('error' in owner) return owner.error

    getCart(owner.key).couponCode = null
    saveDb()
    return new HttpResponse(null, { status: 204 })
  }),

  // juntar o carrinho do visitante ao do usuário (chamado logo após o login)
  http.post('/api/cart/merge', async ({ request }) => {
    const failure = await simulateNetwork('cart')
    if (failure) return failure
    const owner = cartOwner(request)
    if ('error' in owner) return owner.error
    if (!owner.userId) return apiError(401, 'UNAUTHENTICATED', 'Faça login para continuar.')

    const { guestId } = (await request.json()) as { guestId?: string }
    const db = getDb()
    const guestKey = `guest:${guestId}`
    const guestCart = db.carts[guestKey]
    const cart = getCart(owner.key)

    if (guestCart) {
      for (const item of guestCart.items) {
        const existing = cart.items.find(
          (i) => i.nftId === item.nftId && i.editionId === item.editionId,
        )
        if (existing) existing.quantity += item.quantity // a cotação ajusta ao estoque depois
        else cart.items.push({ ...item })
      }
      cart.couponCode = cart.couponCode ?? guestCart.couponCode
      delete db.carts[guestKey]
      saveDb()
    }
    return HttpResponse.json(cart)
  }),
]