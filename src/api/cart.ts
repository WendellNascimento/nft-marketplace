import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useSession } from '@/lib/useSession'
import type { Cart, CartItem, Quote } from '@/types/api'
import { api, getApiError } from './client'

// o dono entra na chave: carrinhos de usuários (e do visitante) nunca se misturam no cache
export const useOwnerKey = () => useSession()?.user.id ?? 'guest'
export const cartKey = (owner: string) => ['cart', owner] as const
export const quoteKey = (owner: string) => ['quote', owner] as const

export function useCart() {
  const owner = useOwnerKey()
  return useQuery({
    queryKey: cartKey(owner),
    queryFn: async ({ signal }) => (await api.get<Cart>('/cart', { signal })).data,
  })
}

export function useQuote() {
  const owner = useOwnerKey()
  return useQuery({
    queryKey: quoteKey(owner),
    queryFn: async ({ signal }) => (await api.post<Quote>('/quote', {}, { signal })).data,
  })
}

export function useCartMutations() {
  const queryClient = useQueryClient()
  const owner = useOwnerKey()

  // depois de qualquer mudança, carrinho e cotação são buscados de novo
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: cartKey(owner) }),
      queryClient.invalidateQueries({ queryKey: quoteKey(owner) }),
    ])

  const onError = (error: unknown) =>
    toast.error(getApiError(error)?.message ?? 'Não foi possível atualizar o carrinho.')

  return {
    add: useMutation({
      mutationFn: async (item: CartItem) => (await api.post<Cart>('/cart/items', item)).data,
      onSuccess: refresh,
      onError,
    }),
    setQuantity: useMutation({
      mutationFn: async (item: CartItem) =>
        (await api.patch<Cart>(`/cart/items/${item.nftId}/${item.editionId}`, {
          quantity: item.quantity,
        })).data,
      onSuccess: refresh,
      onError,
    }),
    remove: useMutation({
      mutationFn: async (item: Pick<CartItem, 'nftId' | 'editionId'>) => {
        await api.delete(`/cart/items/${item.nftId}/${item.editionId}`)
      },
      onSuccess: refresh,
      onError,
    }),
    // o erro do cupom aparece no campo do formulário, por isso não tem toast
    applyCoupon: useMutation({
      mutationFn: async (code: string) => (await api.put<Cart>('/cart/coupon', { code })).data,
      onSuccess: refresh,
    }),
    removeCoupon: useMutation({
      mutationFn: async () => {
        await api.delete('/cart/coupon')
      },
      onSuccess: refresh,
      onError,
    }),
  }
}