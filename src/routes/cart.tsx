import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { getApiError } from '@/api/client'
import { useCartMutations, useQuote } from '@/api/cart'
import { CartSkeleton } from '@/components/CartSkeleton'
import { FormField } from '@/components/FormField'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatEth, gt } from '@/lib/money'
import type { Quote, QuoteItem } from '@/types/api'

export const Route = createFileRoute('/cart')({
  component: CartPage,
})

const issueText = (issue: Quote['issues'][number], name: string) => {
  if (issue.code === 'OUT_OF_STOCK') return `${name} está indisponível. Remova o item para continuar.`
  if (issue.code === 'QUANTITY_REDUCED') return `A quantidade de ${name} foi ajustada ao estoque disponível.`
  return `O preço de ${name} mudou.`
}

function CartPage() {
  const { data: quote, isPending, isError, isFetching, refetch } = useQuote()
  const { setQuantity, remove, applyCoupon, removeCoupon } = useCartMutations()
  const [couponMessage, setCouponMessage] = useState('')

  const onCouponSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const code = String(new FormData(e.currentTarget).get('coupon') ?? '').trim()
    if (!code) {
      setCouponMessage('Informe o código do cupom.')
      return
    }
    setCouponMessage('')
    applyCoupon.mutate(code)
  }

  const apiCouponError = getApiError(applyCoupon.error)
  const couponError = couponMessage || apiCouponError?.fields?.coupon || apiCouponError?.message

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <h1 className="text-3xl font-bold">Carrinho</h1>

      <div className="mt-6" aria-busy={isFetching}>
        {isPending && <CartSkeleton />}

        {isError && (
          <div role="alert" className="rounded-lg border p-6">
            <p className="font-semibold">Não foi possível carregar o carrinho.</p>
            <Button className="mt-3" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}

        {quote && quote.items.length === 0 && (
          <div className="rounded-lg border p-6">
            <p>Seu carrinho está vazio.</p>
            <Link to="/" className="mt-3 inline-block underline">
              Ver o catálogo
            </Link>
          </div>
        )}

        {quote && quote.items.length > 0 && (
          <div className="grid gap-8 md:grid-cols-[1fr_320px]">
            <section aria-label="Itens do carrinho">
              {quote.issues.length > 0 && (
                <div role="status" className="mb-4 grid gap-1 rounded-lg border p-4 text-sm">
                  {quote.issues.map((issue) => {
                    const item = quote.items.find(
                      (i) => i.nftId === issue.nftId && i.editionId === issue.editionId,
                    )
                    return (
                      <p key={`${issue.nftId}-${issue.editionId}-${issue.code}`}>
                        {issueText(issue, item?.name ?? 'Item')}
                      </p>
                    )
                  })}
                </div>
              )}

              <ul className="grid gap-4">
                {quote.items.map((item) => (
                  <CartRow
                    key={`${item.nftId}-${item.editionId}`}
                    item={item}
                    onQuantity={(quantity) =>
                      setQuantity.mutate({ nftId: item.nftId, editionId: item.editionId, quantity })
                    }
                    onRemove={() => remove.mutate({ nftId: item.nftId, editionId: item.editionId })}
                  />
                ))}
              </ul>
            </section>

            <aside aria-label="Resumo do pedido" className="h-fit rounded-lg border p-4">
              <h2 className="text-lg font-semibold">Resumo</h2>

              {quote.couponCode ? (
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span>Cupom {quote.couponCode} aplicado</span>
                  <Button variant="ghost" size="sm" onClick={() => removeCoupon.mutate()}>
                    Remover cupom
                  </Button>
                </div>
              ) : (
                <form onSubmit={onCouponSubmit} noValidate className="mt-4 flex items-end gap-2">
                  <div className="flex-1">
                    <FormField id="coupon" label="Cupom de desconto" error={couponError} />
                  </div>
                  <Button type="submit" variant="outline" disabled={applyCoupon.isPending}>
                    Aplicar
                  </Button>
                </form>
              )}

              <dl className="mt-4 grid gap-2 text-sm">
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd>{formatEth(quote.subtotal)}</dd>
                </div>
                {gt(quote.discount, '0') && (
                  <div className="flex justify-between">
                    <dt>Desconto</dt>
                    <dd>− {formatEth(quote.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt>Taxa de rede</dt>
                  <dd>{formatEth(quote.networkFee)}</dd>
                </div>
                <div className="flex justify-between border-t pt-2 text-base font-semibold">
                  <dt>Total</dt>
                  <dd>{formatEth(quote.total)}</dd>
                </div>
              </dl>

              <FinishButton quote={quote} />
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}

function FinishButton({ quote }: { quote: Quote }) {
  const blocked = quote.issues.some((i) => i.code === 'OUT_OF_STOCK')

  if (blocked) {
    return (
      <>
        <Button disabled className="mt-4 w-full">
          Finalizar compra
        </Button>
        <p className="mt-2 text-sm">Remova os itens indisponíveis para continuar.</p>
      </>
    )
  }
  return (
    <Link
      to="/checkout"
      className="mt-4 block rounded-md bg-primary px-4 py-2 text-center text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      Finalizar compra
    </Link>
  )
}

interface RowProps {
  item: QuoteItem
  onQuantity: (quantity: number) => void
  onRemove: () => void
}

function CartRow({ item, onQuantity, onRemove }: RowProps) {
  const soldOut = item.available === 0
  const inputId = `qty-${item.nftId}-${item.editionId}`

  // ao sair do campo (ou apertar Enter), ajusta ao limite e só então chama a API
  const commit = (input: HTMLInputElement) => {
    const typed = Math.floor(Number(input.value))
    const next = Math.min(Math.max(1, Number.isFinite(typed) ? typed : 1), item.available)
    input.value = String(next)
    if (next !== item.quantity) onQuantity(next)
  }

  return (
    <li className="flex gap-4 rounded-lg border p-4">
      <img
        src={item.image}
        alt={item.name}
        width={96}
        height={96}
        className="size-24 shrink-0 rounded-md"
      />
      <div className="grid flex-1 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="font-semibold underline-offset-4 hover:underline">
            {item.name}
          </Link>
          <span className="text-sm">Edição {item.editionLabel}</span>
          {soldOut && <Badge variant="secondary">Indisponível</Badge>}
        </div>
        <p className="text-sm">{formatEth(item.unitPrice)} cada</p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-24">
            <Label htmlFor={inputId} className="sr-only">
              Quantidade de {item.name}
            </Label>
            <Input
              id={inputId}
              key={item.quantity}
              type="number"
              min={1}
              max={Math.max(1, item.available)}
              step={1}
              defaultValue={item.quantity}
              disabled={soldOut}
              onBlur={(e) => commit(e.currentTarget)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit(e.currentTarget)
              }}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={onRemove} aria-label={`Remover ${item.name} do carrinho`}>
            Remover
          </Button>
          <p className="ml-auto font-semibold">{formatEth(item.lineTotal)}</p>
        </div>
      </div>
    </li>
  )
}