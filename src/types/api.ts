// Valores em ETH sempre como string decimal, ex: "0.125000"
export type EthString = string

export interface Edition {
  id: string
  label: string
  price: EthString
  available: number
}

export interface Nft {
  id: string
  name: string
  collection: string
  creator: string
  description: string
  images: string[]
  price: EthString // menor preço entre as edições
  available: number // soma do estoque
  editions: Edition[]
  version: number
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface User {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

export interface Session {
  token: string
  expiresAt: string
  user: User
}

export interface CartItem {
  nftId: string
  editionId: string
  quantity: number
}

export interface Cart {
  items: CartItem[]
  couponCode: string | null
}

export interface QuoteItem extends CartItem {
  name: string
  image: string
  editionLabel: string
  unitPrice: EthString
  lineTotal: EthString
  available: number
}

export interface Quote {
  id: string // muda quando preço, estoque ou total mudam
  items: QuoteItem[]
  subtotal: EthString
  discount: EthString
  networkFee: EthString
  total: EthString
  couponCode: string | null
  issues: {
    nftId: string
    editionId: string
    code: 'PRICE_CHANGED' | 'OUT_OF_STOCK' | 'QUANTITY_REDUCED'
  }[]
}

export type OrderStatus = 'pending' | 'confirmed' | 'refused'

export interface Order {
  id: string
  status: OrderStatus
  version: number
  items: QuoteItem[] // snapshot: nunca recalcular a partir do catálogo
  subtotal: EthString
  discount: EthString
  networkFee: EthString
  total: EthString
  walletId: string
  network: string
  txHash: string | null
  reason?: string
  createdAt: string
}

export interface Wallet {
  id: string
  label: string
  address: string
  network: string
  isPrimary: boolean
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'OUT_OF_STOCK'
  | 'QUOTE_STALE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'TRANSIENT'

export interface ApiError {
  code: ApiErrorCode
  message: string
  fields?: Record<string, string>
  quote?: Quote
}

export interface RealtimeEvent<T = unknown> {
  id: string
  type: string
  resourceId: string
  version: number
  occurredAt: string
  data: T
}
