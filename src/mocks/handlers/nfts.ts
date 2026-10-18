import { http, HttpResponse } from 'msw'
import Decimal from 'decimal.js'
import { getDb } from '../db'
import { apiError, getScenario, simulateNetwork } from '../scenarios'

export const nftHandlers = [
  // listagem com busca, filtros, ordenação e paginação
  http.get('/api/nfts', async ({ request }) => {
    const failure = await simulateNetwork('nfts')
    if (failure) return failure

    const params = new URL(request.url).searchParams
    const q = (params.get('q') ?? '').toLowerCase()
    const collection = params.get('collection')
    const min = params.get('minPrice')
    const max = params.get('maxPrice')
    const sort = params.get('sort') ?? 'recent'
    const page = Math.max(1, Number(params.get('page') ?? 1))
    const pageSize = 12

    let list = getScenario() === 'empty' ? [] : [...getDb().nfts]

    if (q) {
      list = list.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.collection.toLowerCase().includes(q),
      )
    }
    if (collection) list = list.filter((n) => n.collection === collection)
    if (min) list = list.filter((n) => new Decimal(n.price).gte(min))
    if (max) list = list.filter((n) => new Decimal(n.price).lte(max))

    if (sort === 'price_asc') list.sort((a, b) => new Decimal(a.price).cmp(b.price))
    if (sort === 'price_desc') list.sort((a, b) => new Decimal(b.price).cmp(a.price))
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name))

    const total = list.length
    return HttpResponse.json({
      items: list.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    })
  }),

  // detalhe de um NFT
  http.get('/api/nfts/:id', async ({ params }) => {
    const failure = await simulateNetwork('nft')
    if (failure) return failure

    const nft = getDb().nfts.find((n) => n.id === params.id)
    return nft
      ? HttpResponse.json(nft)
      : apiError(404, 'NOT_FOUND', 'NFT não encontrado')
  }),
]