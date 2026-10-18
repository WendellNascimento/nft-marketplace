import { useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { getApiError } from '@/api/client'
import { useOrder } from '@/api/orders'
import { Button } from '@/components/ui/button'
import { formatEth } from '@/lib/money'

export const Route = createFileRoute('/_auth/order/$orderId')({
  component: OrderPage,
})

function OrderPage() {
  const { orderId } = Route.useParams()
  const order = useOrder(orderId)
  const queryClient = useQueryClient()
  const status = order.data?.status

  // pedido confirmado: o servidor já tirou os itens comprados do carrinho
  useEffect(() => {
    if (status === 'confirmed') {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      queryClient.invalidateQueries({ queryKey: ['quote'] })
    }
  }, [status, queryClient])

  if (order.isPending) {
    return (
      <p role="status" className="p-8 text-sm text-muted-foreground">
        Carregando pedido...
      </p>
    )
  }

  if (order.isError) {
    const apiError = getApiError(order.error)
    return (
      <div role="alert" className="mx-auto max-w-md p-8">
        <p className="text-sm text-destructive">
          {apiError?.message ?? 'Não foi possível carregar o pedido.'}
        </p>
        <div className="mt-3 flex gap-2">
          {!apiError && (
            <Button variant="outline" onClick={() => order.refetch()}>
              Tentar novamente
            </Button>
          )}
          <Link to="/" className="self-center text-sm underline">
            Ir para o catálogo
          </Link>
        </div>
      </div>
    )
  }

  // tudo abaixo vem do SNAPSHOT do pedido, nunca do catálogo
  const o = order.data
  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      {o.status === 'pending' && (
        <div role="status" className="rounded-lg border p-4">
          <h1 className="text-2xl font-bold">Aguardando confirmação</h1>
          <p className="mt-2 text-sm">
            Estamos confirmando o pagamento do pedido {o.id}. Você pode recarregar esta página sem
            risco de comprar duas vezes.
          </p>
        </div>
      )}

      {o.status === 'refused' && (
        <div role="alert" className="rounded-lg border border-destructive p-4">
          <h1 className="text-2xl font-bold">Pedido recusado</h1>
          <p className="mt-2 text-sm">{o.reason ?? 'O pagamento não foi aprovado.'}</p>
          <p className="mt-2 text-sm">Seus itens continuam no carrinho.</p>
          <Link to="/cart" className="mt-3 inline-block underline">
            Voltar ao carrinho
          </Link>
        </div>
      )}

      {o.status === 'confirmed' && (
        <>
          <h1 className="text-2xl font-bold">Pedido confirmado</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pedido {o.id}</p>
        </>
      )}

      {o.status !== 'refused' && (
        <section aria-labelledby="receipt" className="mt-6 rounded-lg border p-4">
          <h2 id="receipt" className="text-lg font-semibold">
            Recibo
          </h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {o.items.map((item) => (
              <li key={`${item.nftId}-${item.editionId}`} className="flex justify-between gap-2">
                <span>
                  {item.name} ({item.editionLabel}) × {item.quantity}
                </span>
                <span>{formatEth(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid gap-1 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatEth(o.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Desconto</dt>
              <dd>-{formatEth(o.discount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Taxa de rede</dt>
              <dd>{formatEth(o.networkFee)}</dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatEth(o.total)}</dd>
            </div>
          </dl>
          {o.txHash && (
            <p className="mt-4 text-xs">
              Transação: <span className="font-mono break-all">{o.txHash}</span>
            </p>
          )}
        </section>
      )}

      {o.status === 'confirmed' && (
        <Link to="/" className="mt-4 inline-block underline">
          Continuar comprando
        </Link>
      )}
    </div>
  )
}