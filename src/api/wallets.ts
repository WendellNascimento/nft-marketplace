import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Wallet } from '@/types/api'
import { api } from './client'
import { useOwnerKey } from './cart'

// o dono entra na chave: carteiras de usuários diferentes nunca se misturam no cache
export const walletsKey = (owner: string) => ['wallets', owner] as const

// o que o formulário envia ao cadastrar
export type WalletInput = Pick<Wallet, 'label' | 'address' | 'network'>

// redes aceitas pelo mock (a mesma lista do handler)
export const NETWORKS = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'base', label: 'Base' },
] as const

export function useWallets() {
  const owner = useOwnerKey()
  return useQuery({
    queryKey: walletsKey(owner),
    queryFn: async ({ signal }) => (await api.get<Wallet[]>('/wallets', { signal })).data,
    // visitante não tem carteiras: nem faz a chamada
    enabled: owner !== 'guest',
  })
}

export function useWalletMutations() {
  const queryClient = useQueryClient()
  const owner = useOwnerKey()

  // depois de qualquer mudança, a lista é buscada de novo
  // (isso também reflete a troca de "principal" nas outras carteiras)
  const refresh = () => queryClient.invalidateQueries({ queryKey: walletsKey(owner) })

  // sem toast de erro: o formulário mostra os erros de campo vindos da API
  return {
    create: useMutation({
      mutationFn: async (input: WalletInput) => (await api.post<Wallet>('/wallets', input)).data,
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: async ({ id, ...patch }: Partial<Wallet> & { id: string }) =>
        (await api.patch<Wallet>(`/wallets/${id}`, patch)).data,
      onSuccess: refresh,
    }),
  }
}