import { http, HttpResponse } from 'msw'
import { authUser } from '../auth'
import { getDb, saveDb } from '../db'
import { apiError, getScenario, simulateNetwork } from '../scenarios'

export const favoriteHandlers = [
  // lista de ids favoritados pelo usuário logado
  http.get('/api/favorites', async ({ request }) => {
    const failure = await simulateNetwork('favorites')
    if (failure) return failure

    const auth = authUser(request)
    if ('error' in auth) return auth.error
    return HttpResponse.json(getDb().favorites[auth.user.id] ?? [])
  }),

  // adicionar (pode repetir sem duplicar)
  http.put('/api/favorites/:nftId', async ({ request, params }) => {
    const failure = await simulateNetwork('favorites')
    if (failure) return failure

    const auth = authUser(request)
    if ('error' in auth) return auth.error

    // cenário de teste: só as mutations falham, a consulta continua funcionando
    if (getScenario() === 'favorite-fail') {
      return apiError(500, 'TRANSIENT', 'Falha temporária ao salvar o favorito.')
    }

    const db = getDb()
    const nftId = String(params.nftId)
    if (!db.nfts.some((n) => n.id === nftId)) {
      return apiError(404, 'NOT_FOUND', 'NFT não encontrado')
    }
    const current = db.favorites[auth.user.id] ?? []
    db.favorites[auth.user.id] = [...new Set([...current, nftId])]
    saveDb()
    return new HttpResponse(null, { status: 204 })
  }),

  // remover
  http.delete('/api/favorites/:nftId', async ({ request, params }) => {
    const failure = await simulateNetwork('favorites')
    if (failure) return failure

    const auth = authUser(request)
    if ('error' in auth) return auth.error

    if (getScenario() === 'favorite-fail') {
      return apiError(500, 'TRANSIENT', 'Falha temporária ao remover o favorito.')
    }

    const db = getDb()
    const current = db.favorites[auth.user.id] ?? []
    db.favorites[auth.user.id] = current.filter((id) => id !== String(params.nftId))
    saveDb()
    return new HttpResponse(null, { status: 204 })
  }),
]