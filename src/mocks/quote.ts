import { add, mulQty, percentOf, sub } from '@/lib/money'
import type { Cart, Quote, QuoteItem } from '@/types/api'
import { getDb } from './db'

const simpleHash = (text: string) => {
  let hash = 5381
  for (const char of text) hash = ((hash << 5) + hash + char.charCodeAt(0)) | 0
  return (hash >>> 0).toString(36)
}

export function buildQuote(cart: Cart): Quote {
  const db = getDb()
  const issues: Quote['issues'] = []
  const items: QuoteItem[] = []

  for (const item of cart.items) {
    const nft = db.nfts.find((n) => n.id === item.nftId)
    const edition = nft?.editions.find((e) => e.id === item.editionId)
    if (!nft || !edition) continue

    const base = {
      nftId: item.nftId,
      editionId: item.editionId,
      name: nft.name,
      image: nft.images[0],
      editionLabel: edition.label,
      unitPrice: edition.price,
      available: edition.available,
    }

    if (edition.available === 0) {
      issues.push({ nftId: item.nftId, editionId: item.editionId, code: 'OUT_OF_STOCK' })
      items.push({ ...base, quantity: item.quantity, lineTotal: '0.000000' })
      continue
    }

    let quantity = item.quantity
    if (quantity > edition.available) {
      quantity = edition.available
      issues.push({ nftId: item.nftId, editionId: item.editionId, code: 'QUANTITY_REDUCED' })
    }
    items.push({ ...base, quantity, lineTotal: mulQty(edition.price, quantity) })
  }

  const subtotal = items.reduce((sum, i) => add(sum, i.lineTotal), '0.000000')
  const discount = cart.couponCode === 'PROMO10' ? percentOf(subtotal, 10) : '0.000000'
  const hasPayableItem = items.some((i) => i.available > 0)
  const networkFee = hasPayableItem ? '0.002500' : '0.000000'
  const total = add(sub(subtotal, discount), networkFee)

  const id = 'q_' + simpleHash(JSON.stringify({ items, discount, networkFee, total }))
  return { id, items, subtotal, discount, networkFee, total, couponCode: cart.couponCode, issues }
}