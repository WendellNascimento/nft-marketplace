import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Order } from '@/types/api'
import { api } from './client'

export interface CreateOrderPayload {
  quoteId: string
  walletId: string
  network: string
  billing: { name: string; email: string }
}

export const orderKey = (id: string) => ['order', id] as const

// a chave de idempotência é guardada POR CONTEÚDO: mesmo pedido (mesmo payload)
// = mesma chave, mesmo depois de refresh. Assim o reenvio após timeout não duplica.
const storageKey = (payload: unknown) => 'idem:' + JSON.stringify(payload)

export function getIdemKey(payload: unknown) {
  const k = storageKey(payload)
  let v = sessionStorage.getItem(k)
  if (!v) {
    v = crypto.randomUUID()
    sessionStorage.setItem(k, v)
  }
  return v
}

// depois de um sucesso, a chave é descartada (uma compra futura igual é outro pedido)
const clearIdemKey = (payload: unknown) => sessionStorage.removeItem(storageKey(payload))

export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKey(id),
    queryFn: async ({ signal }) => (await api.get<Order>(`/orders/${id}`, { signal })).data,
    // enquanto pendente, consulta a cada 3 s (na Fase F o socket também avisa)
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 3000 : false),
  })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateOrderPayload) =>
      (
        await api.post<Order>('/orders', payload, {
          headers: { 'Idempotency-Key': getIdemKey(payload) },
        })
      ).data,
    onSuccess: (order, payload) => {
      clearIdemKey(payload)
      queryClient.setQueryData(orderKey(order.id), order)
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      queryClient.invalidateQueries({ queryKey: ['quote'] })
    },
  })
}