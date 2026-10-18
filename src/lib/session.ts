import type { Session } from '@/types/api'

const KEY = 'session'
const GUEST_KEY = 'guest-id'

function read(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Session | null
  } catch {
    return null
  }
}

// a sessão fica guardada aqui; get() devolve sempre o MESMO objeto até algo mudar
let current: Session | null = read()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

export const sessionStore = {
  get: () => current,

  set(session: Session) {
    current = session
    localStorage.setItem(KEY, JSON.stringify(session))
    notify()
  },

  clear() {
    current = null
    localStorage.removeItem(KEY)
    notify()
  },

  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  // identificador do visitante (carrinho antes do login)
  guestId() {
    let id = localStorage.getItem(GUEST_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(GUEST_KEY, id)
    }
    return id
  },
}