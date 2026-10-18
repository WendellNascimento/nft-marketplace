import { http, HttpResponse } from 'msw'
import { cartOwner, getCart } from '../cartStore'
import { buildQuote } from '../quote'
import { simulateNetwork } from '../scenarios'

export const quoteHandlers = [
  // cotação do carrinho do dono da requisição
  http.post('/api/quote', async ({ request }) => {
    const failure = await simulateNetwork('quote')
    if (failure) return failure
    const owner = cartOwner(request)
    if ('error' in owner) return owner.error
    return HttpResponse.json(buildQuote(getCart(owner.key)))
  }),
]