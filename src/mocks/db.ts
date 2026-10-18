import type { CartItem, Nft, Order, User, Wallet } from '@/types/api'
import { buildSeedNfts } from './fixtures'

export type DbOrder = Order & {
  userId: string
  settleAt: number
  willRefuse: boolean
}

export interface Db {
  users: (User & { passwordHash: string })[]
  tokens: Record<string, { userId: string; expiresAt: string }>
  nfts: Nft[]
  favorites: Record<string, string[]> // userId -> ids de NFTs
  carts: Record<string, { items: CartItem[]; couponCode: string | null }>
  wallets: Record<string, Wallet[]>
  orders: DbOrder[]
  idempotency: Record<string, { bodyHash: string; orderId: string }>
}

const KEY = 'mock-db-v1'
let db: Db

// nunca guardamos senha em texto puro: só o hash SHA-256
export async function hashPassword(password: string) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(password),
  )
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function seed(): Promise<Db> {
  const hash = await hashPassword('Senha@123')
  return {
    users: [
      { id: 'u1', name: 'Ana Souza', email: 'ana@example.com', avatarUrl: null, passwordHash: hash },
      { id: 'u2', name: 'Bruno Lima', email: 'bruno@example.com', avatarUrl: null, passwordHash: hash },
    ],
    tokens: {},
    nfts: buildSeedNfts(),
    favorites: {},
    carts: {},
    wallets: {
      u1: [
        {
          id: 'w1',
          label: 'Principal',
          address: '0x' + 'a'.repeat(40),
          network: 'ethereum',
          isPrimary: true,
        },
      ],
      u2: [],
    },
    orders: [],
    idempotency: {},
  }
}

export async function initDb() {
  const saved = localStorage.getItem(KEY)
  db = saved ? (JSON.parse(saved) as Db) : await seed()
}

export const getDb = () => db
export const saveDb = () => localStorage.setItem(KEY, JSON.stringify(db))

export async function resetDb() {
  localStorage.removeItem(KEY)
  db = await seed()
  saveDb()
}