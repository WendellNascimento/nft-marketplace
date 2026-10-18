import { Decimal } from 'decimal.js'
import { getDb, resetDb, saveDb } from './db'
import { resetCounters } from './scenarios'
import { emitToAll, makeEvent } from './socket'

interface NftChange {
  price?: string
  available?: number
  editionId?: string // padrão: a primeira edição (Padrão)
}

export interface MockControl {
  reset: () => Promise<void>
  setScenario: (scenario: string) => void
  expireSession: () => void
  changeNft: (id: string, change: NftChange) => void
  emitRaw: (event: string, payload: unknown) => void
}

declare global {
  interface Window {
    __mock?: MockControl
  }
}

function changeNft(id: string, change: NftChange) {
  const nft = getDb().nfts.find((n) => n.id === id)
  if (!nft) throw new Error(`NFT ${id} não existe`)

  const edition = nft.editions.find((e) => e.id === change.editionId) ?? nft.editions[0]
  if (change.price !== undefined) edition.price = new Decimal(change.price).toFixed(6)
  if (change.available !== undefined) edition.available = Math.max(0, Math.trunc(change.available))

  // campos derivados do NFT: menor preço e soma do estoque
  nft.price = nft.editions.reduce(
    (min, e) => (new Decimal(e.price).lt(min) ? e.price : min),
    nft.editions[0].price,
  )
  nft.available = nft.editions.reduce((sum, e) => sum + e.available, 0)
  nft.version += 1
  saveDb()

  // REST e evento mostram o MESMO dado, porque os dois leem do banco
  emitToAll(
    'nft.updated',
    makeEvent('nft.updated', nft.id, nft.version, {
      name: nft.name,
      price: nft.price,
      available: nft.available,
    }),
  )
}

export function installMockControl() {
  window.__mock = {
    // volta ao estado inicial; recarrega a página (a sessão antiga deixa de valer)
    async reset() {
      await resetDb()
      resetCounters()
      sessionStorage.clear()
      location.reload()
    },
    // o cenário é lido da URL (?scenario=) e salvo, então recarregamos com ele
    setScenario(scenario) {
      const url = new URL(location.href)
      url.searchParams.set('scenario', scenario)
      location.assign(url)
    },
    // vence todos os tokens: a próxima chamada autenticada recebe SESSION_EXPIRED
    expireSession() {
      const past = new Date(0).toISOString()
      for (const t of Object.values(getDb().tokens)) t.expiresAt = past
      saveDb()
    },
    changeNft,
    // envia um evento "cru" (para testar duplicados e antigos)
    emitRaw(event, payload) {
      emitToAll(event, payload)
    },
  }
}