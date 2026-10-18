import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Socket } from 'socket.io-client'
import type { Cart, OrderStatus, RealtimeEvent } from '@/types/api'
import { useSession } from './useSession'
import { connectSocket, disconnectSocket } from './socket'

interface NftEventData {
  name?: string
}
interface OrderEventData {
  userId: string
  status: OrderStatus
}

// última versão vista de cada recurso: duplicados e antigos são ignorados
const lastVersion = new Map<string, number>()
function isNewer(key: string, version: number) {
  if (version <= (lastVersion.get(key) ?? -1)) return false
  lastVersion.set(key, version)
  return true
}

export function useRealtime() {
  const queryClient = useQueryClient()
  const session = useSession()
  const token = session?.token ?? null
  const userId = session?.user.id ?? null

  useEffect(() => {
    lastVersion.clear() // outro usuário = nova história de eventos

    const onNft = (event: RealtimeEvent<NftEventData>) => {
      if (!isNewer(`nft:${event.resourceId}`, event.version)) return

      // só avisa com toast se o NFT está no carrinho de quem está vendo
      const cart = queryClient.getQueryData<Cart>(['cart', userId ?? 'guest'])
      if (cart?.items.some((i) => i.nftId === event.resourceId)) {
        toast.info(
          `${event.data.name ?? 'Um item do seu carrinho'} teve preço ou estoque alterado. Revise os valores.`,
        )
      }
      queryClient.invalidateQueries({ queryKey: ['nfts'] })
      queryClient.invalidateQueries({ queryKey: ['nft', event.resourceId] })
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      queryClient.invalidateQueries({ queryKey: ['quote'] })
    }

    const onOrder = (event: RealtimeEvent<OrderEventData>) => {
      // evento de outro usuário nunca atualiza esta sessão
      if (event.data.userId !== userId) return
      if (!isNewer(`order:${event.resourceId}`, event.version)) return
      queryClient.invalidateQueries({ queryKey: ['order', event.resourceId] })
      if (event.data.status === 'confirmed') {
        queryClient.invalidateQueries({ queryKey: ['cart'] })
        queryClient.invalidateQueries({ queryKey: ['quote'] })
      }
    }

    // depois de uma queda, eventos podem ter se perdido: reconcilia com o REST
    const onReconnect = () => queryClient.invalidateQueries()

    // a conexão é assíncrona (import dinâmico): os listeners entram quando ela fica pronta
    let socket: Socket | null = null
    let cancelled = false
    connectSocket(token).then((s) => {
      if (!s || cancelled) return
      socket = s
      s.on('nft.updated', onNft)
      s.on('order.updated', onOrder)
      s.io.on('reconnect', onReconnect)
    })

    // ao trocar de usuário ou desmontar, solta listeners e fecha a conexão
    return () => {
      cancelled = true
      if (socket) {
        socket.off('nft.updated', onNft)
        socket.off('order.updated', onOrder)
        socket.io.off('reconnect', onReconnect)
      }
      disconnectSocket()
    }
  }, [token, userId, queryClient])
}