import { QueryClient } from '@tanstack/react-query'
import { isTransient } from '@/api/client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // dado considerado "fresco" por 30s
      gcTime: 5 * 60_000, // fica 5min no cache depois de sair da tela
      retry: (count, error) => count < 2 && isTransient(error),
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false }, // nunca repetir uma mutation sozinho, para não duplicar operações
  },
})