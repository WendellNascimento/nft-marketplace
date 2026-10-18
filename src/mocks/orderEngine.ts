import type { Order } from '@/types/api'
import { getDb, saveDb, type DbOrder } from './db'
import { emitToUser, makeEvent } from './socket' // NOVO

// guardamos a chave do carrinho no pedido para saber de onde remover os itens comprados
export type StoredOrder = DbOrder & { cartKey: string }

export const SETTLE_MS = 3000

function randomHex(bytes: number) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes))
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const findOrder = (id: string) =>
  getDb().orders.find((o) => o.id === id) as StoredOrder | undefined

// o cliente nunca vê os campos internos do mock
export function toPublicOrder(o: StoredOrder): Order {
  return {
    id: o.id,
    status: o.status,
    version: o.version,
    items: o.items,
    subtotal: o.subtotal,
    discount: o.discount,
    networkFee: o.networkFee,
    total: o.total,
    walletId: o.walletId,
    network: o.network,
    txHash: o.txHash,
    reason: o.reason,
    createdAt: o.createdAt,
  }
}

// remove do carrinho só o que foi comprado (quantidade a quantidade)
function removePurchased(order: StoredOrder) {
  const cart = getDb().carts[order.cartKey]
  if (!cart) return
  for (const bought of order.items) {
    const line = cart.items.find(
      (i) => i.nftId === bought.nftId && i.editionId === bought.editionId,
    )
    if (line) line.quantity -= bought.quantity
  }
  cart.items = cart.items.filter((i) => i.quantity > 0)
  if (cart.items.length === 0) cart.couponCode = null
}

// resolve o pedido quando o prazo passou. Estados finais nunca mudam.
export function settleIfDue(order: StoredOrder) {
  if (order.status !== 'pending' || Date.now() < order.settleAt) return
  if (order.willRefuse) {
    order.status = 'refused'
    order.reason = 'Pagamento recusado pela carteira.'
  } else {
    order.status = 'confirmed'
    order.txHash = '0x' + randomHex(32)
    removePurchased(order)
  }
  order.version += 1
  saveDb()

  // NOVO: avisa só o dono do pedido
  emitToUser(
    order.userId,
    'order.updated',
    makeEvent('order.updated', order.id, order.version, {
      userId: order.userId,
      status: order.status,
    }),
  )
}

export function scheduleSettle(id: string) {
  const order = findOrder(id)
  if (!order) return
  const wait = Math.max(0, order.settleAt - Date.now()) + 50
  setTimeout(() => {
    const current = findOrder(id)
    if (current) settleIfDue(current)
  }, wait)
}

// os timers morrem no refresh: ao iniciar, reagendamos os pendentes
export function resumePendingOrders() {
  for (const o of getDb().orders) {
    if (o.status === 'pending') scheduleSettle(o.id)
  }
}