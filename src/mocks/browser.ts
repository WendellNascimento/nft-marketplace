import { setupWorker } from 'msw/browser'
import { installMockControl } from './control'
import { initDb } from './db'
import { cartHandlers } from './handlers/cart'
import { favoriteHandlers } from './handlers/favorites'
import { nftHandlers } from './handlers/nfts'
import { orderHandlers } from './handlers/orders'
import { profileHandlers } from './handlers/profile' // NOVO
import { quoteHandlers } from './handlers/quote'
import { sessionHandlers } from './handlers/session'
import { walletHandlers } from './handlers/wallets'
import { resumePendingOrders } from './orderEngine'
import { realtimeHandlers } from './socket'

export async function startMocks() {
  await initDb()
  resumePendingOrders()
  installMockControl()

  const worker = setupWorker(
    ...nftHandlers,
    ...sessionHandlers,
    ...favoriteHandlers,
    ...cartHandlers,
    ...quoteHandlers,
    ...walletHandlers,
    ...orderHandlers,
    ...profileHandlers, // NOVO
    ...realtimeHandlers,
  )

  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
}