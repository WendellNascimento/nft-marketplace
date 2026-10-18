import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useSession } from '@/lib/useSession'
import { api } from './client'

// o id do usuário faz parte da chave: favoritos de um usuário nunca se misturam com os de outro
export const favoritesKey = (userId: string) => ['favorites', userId] as const

export function useFavorites() {
  const session = useSession()
  const userId = session?.user.id

  return useQuery({
    queryKey: favoritesKey(userId ?? 'none'),
    queryFn: async () => (await api.get<string[]>('/favorites')).data,
    enabled: !!userId, // visitante não tem favoritos: nem faz a chamada
  })
}

export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const session = useSession()
  const key = favoritesKey(session?.user.id ?? 'none')

  return useMutation({
    mutationFn: async ({ nftId, favorite }: { nftId: string; favorite: boolean }) => {
      if (favorite) await api.put(`/favorites/${nftId}`)
      else await api.delete(`/favorites/${nftId}`)
    },

    // 1) roda ANTES da API responder: muda a tela na hora
    onMutate: async ({ nftId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key }) // evita um refetch antigo sobrescrever a mudança
      const previous = queryClient.getQueryData<string[]>(key) // guarda o estado anterior para o rollback
      queryClient.setQueryData<string[]>(key, (old = []) =>
        favorite ? [...new Set([...old, nftId])] : old.filter((id) => id !== nftId),
      )
      return { previous }
    },

    // 2) se a API falhar: volta ao estado anterior e avisa
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(key, context?.previous)
      toast.error('Não foi possível atualizar o favorito. Tente novamente.')
    },

    // 3) sempre no final: confere com o servidor qual é a verdade
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}