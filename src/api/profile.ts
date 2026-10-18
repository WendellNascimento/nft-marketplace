import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { sessionStore } from '@/lib/session'
import type { User } from '@/types/api'
import { api, getApiError } from './client'

// chave por usuário: trocar de conta nunca mostra o perfil do anterior
export const profileKey = (userId: string) => ['profile', userId] as const

export function useProfile() {
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get)
  return useQuery({
    queryKey: profileKey(session?.user.id ?? 'anon'),
    queryFn: async () => (await api.get<User>('/profile')).data,
    enabled: !!session,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; email: string; avatarUrl: string | null }) =>
      (await api.patch<User>('/profile', input)).data,
    onSuccess: (user) => {
      // atualiza a sessão guardada: o cabeçalho e o refresh passam a mostrar os dados novos
      const session = sessionStore.get()
      if (session) sessionStore.set({ ...session, user })
      queryClient.setQueryData(profileKey(user.id), user)
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: { currentPassword: string; newPassword: string }) => {
      await api.post('/profile/password', input)
    },
  })
}

// lê { message, fields } do erro da API (422/409) para mostrar nos campos
export function readFieldErrors(error: unknown) {
  const apiError = getApiError(error) as unknown as {
    message?: string
    fields?: Record<string, string>
  } | null
  return {
    message: apiError?.message ?? 'Não foi possível concluir. Tente novamente.',
    fields: apiError?.fields ?? {},
  }
}