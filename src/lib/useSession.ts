import { useSyncExternalStore } from 'react'
import { sessionStore } from './session'

// Permite que os componentes React acompanhem a sessão.
export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, () => null)
}