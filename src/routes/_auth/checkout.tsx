import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { z } from 'zod'
import { quoteKey, useOwnerKey, useQuote } from '@/api/cart'
import { getApiError } from '@/api/client'
import { useCreateOrder, type CreateOrderPayload } from '@/api/orders'
import { NETWORKS, useWallets } from '@/api/wallets'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { zodFieldErrors } from '@/lib/forms'
import { formatEth } from '@/lib/money'
import { useSession } from '@/lib/useSession'
import { useWalletConnection } from '@/lib/useWalletConnection'

export const Route = createFileRoute('/_auth/checkout')({
  component: CheckoutPage,
})

const billingSchema = z.object({
  name: z.string().trim().min(1, 'Informe seu nome.'),
  email: z.email('Informe um e-mail válido.'),
})

// rascunho do formulário: só dados não sensíveis, sobrevive à expiração da sessão
const draftKey = (owner: string) => `checkout-draft:${owner}`
function loadDraft(owner: string): Partial<{ name: string; email: string; walletId: string; network: string }> {
  try {
    return JSON.parse(sessionStorage.getItem(draftKey(owner)) ?? '{}')
  } catch {
    return {}
  }
}

const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

const statusText = {
  disconnected: 'Carteira desconectada',
  connecting: 'Conectando carteira...',
  connected: 'Carteira conectada',
  rejected: 'A carteira recusou a conexão',
} as const

const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm'

function CheckoutPage() {
  const owner = useOwnerKey()
  const session = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const quote = useQuote()
  const wallets = useWallets()
  const createOrder = useCreateOrder()

  const draft = useRef(loadDraft(owner)).current
  const [name, setName] = useState(draft.name ?? session?.user.name ?? '')
  const [email, setEmail] = useState(draft.email ?? session?.user.email ?? '')
  const [walletId, setWalletId] = useState(draft.walletId ?? '')
  const [network, setNetwork] = useState(draft.network ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submitting = useRef(false) // guarda contra clique repetido
  const lastPayload = useRef<CreateOrderPayload | null>(null) // CORRIGIDO: payload original, para o retry

  // carteira efetiva: a escolhida, senão a principal, senão a primeira
  const list = wallets.data ?? []
  const wallet = list.find((w) => w.id === walletId) ?? list.find((w) => w.isPrimary) ?? list[0]
  const effNetwork = network || wallet?.network || 'ethereum'
  const { status, connect, disconnect } = useWalletConnection(wallet?.id)

  // salva o rascunho a cada mudança
  useEffect(() => {
    sessionStorage.setItem(
      draftKey(owner),
      JSON.stringify({ name, email, walletId: wallet?.id ?? '', network: effNetwork }),
    )
  }, [owner, name, email, wallet?.id, effNetwork])

  // cotação aceita: a 1ª carregada vale; se o id mudar depois, ela está desatualizada
  const [acceptedId, setAcceptedId] = useState<string | null>(null)
  useEffect(() => {
    if (quote.data && acceptedId === null) setAcceptedId(quote.data.id)
  }, [quote.data, acceptedId])
  const stale = !!quote.data && acceptedId !== null && quote.data.id !== acceptedId
  const blocked = !!quote.data?.issues.some((i) => i.code === 'OUT_OF_STOCK')
  const reduced = !!quote.data?.issues.some((i) => i.code === 'QUANTITY_REDUCED')

  const canConfirm =
    !!quote.data &&
    quote.data.items.length > 0 &&
    !blocked &&
    !stale &&
    !!wallet &&
    status === 'connected'

  // CORRIGIDO: envia um payload já montado (usado pelo "Confirmar" e pelo "Tentar novamente")
  const submit = (payload: CreateOrderPayload) => {
    if (submitting.current) return
    setSubmitError(null)
    submitting.current = true
    createOrder.mutate(payload, {
      onSuccess: (order) => {
        sessionStorage.removeItem(draftKey(owner))
        navigate({ to: '/order/$orderId', params: { orderId: order.id } })
      },
      onError: (error) => {
        if (isAxiosError(error) && error.code === 'ECONNABORTED') {
          setSubmitError(
            'Não recebemos resposta do servidor. Seu pedido pode ter sido criado. Toque em "Tentar novamente": você não será cobrado duas vezes.',
          )
          return
        }
        const apiError = getApiError(error)
        // cotação nova vem na resposta: entra no cache SEM ser aceita automaticamente
        if (apiError?.quote) queryClient.setQueryData(quoteKey(owner), apiError.quote)
        setSubmitError(apiError?.message ?? 'Não foi possível concluir o pedido. Tente novamente.')
      },
      onSettled: () => {
        submitting.current = false
      },
    })
  }

  const confirm = () => {
    if (submitting.current || !quote.data || !wallet) return
    const parsed = billingSchema.safeParse({ name, email })
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error))
      return
    }
    setErrors({})

    // mesmo conteúdo = mesma Idempotency-Key (ver api/orders.ts)
    const payload: CreateOrderPayload = {
      quoteId: quote.data.id,
      walletId: wallet.id,
      network: effNetwork,
      billing: parsed.data,
    }
    lastPayload.current = payload // CORRIGIDO: guarda para repetir igualzinho
    submit(payload)
  }

  // CORRIGIDO: repete o MESMO payload (mesma chave de idempotência), sem remontar a partir do carrinho
  const retry = () => {
    if (lastPayload.current) submit(lastPayload.current)
  }

  // ---------- telas alternativas ----------
  if (quote.isPending || wallets.isPending) {
    return (
      <p role="status" className="p-8 text-sm text-muted-foreground">
        Carregando checkout...
      </p>
    )
  }
  if (quote.isError || wallets.isError) {
    return (
      <div role="alert" className="mx-auto max-w-md p-8">
        <p className="text-sm text-destructive">Não foi possível carregar o checkout.</p>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => {
            quote.refetch()
            wallets.refetch()
          }}
        >
          Tentar novamente
        </Button>
      </div>
    )
  }
  // CORRIGIDO: só mostra "carrinho vazio" se NÃO houver um aviso de envio pendente
  if (quote.data.items.length === 0 && !submitError) {
    return (
      <div className="mx-auto max-w-md p-8">
        <h1 className="text-2xl font-bold">Checkout</h1>
        <p className="mt-3 text-sm">Seu carrinho está vazio.</p>
        <Link to="/" className="mt-3 inline-block underline">
          Ver catálogo
        </Link>
      </div>
    )
  }

  // ---------- tela principal ----------
  const q = quote.data
  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <h1 className="text-2xl font-bold">Pagamento</h1>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_22rem]">
        <div className="grid gap-6">
          <section aria-labelledby="sec-billing" className="grid gap-4 rounded-lg border bg-card p-4">
            <h2 id="sec-billing" className="text-lg font-semibold">
              Dados do colecionador
            </h2>
            <FormField
              id="name"
              label="Nome"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
            />
            <FormField
              id="email"
              label="E-mail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
          </section>

          <section aria-labelledby="sec-wallet" className="grid gap-4 rounded-lg border bg-card p-4">
            <h2 id="sec-wallet" className="text-lg font-semibold">
              Carteira e rede
            </h2>

            {list.length === 0 ? (
              <p className="text-sm">
                Você ainda não tem carteiras.{' '}
                <Link to="/wallets" className="underline">
                  Cadastrar carteira
                </Link>
              </p>
            ) : (
              <>
                <div>
                  <Label htmlFor="wallet">Carteira</Label>
                  <select
                    id="wallet"
                    className={selectClass}
                    value={wallet?.id ?? ''}
                    onChange={(e) => {
                      const next = list.find((w) => w.id === e.target.value)
                      setWalletId(e.target.value)
                      setNetwork(next?.network ?? '')
                    }}
                  >
                    {list.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label} — {shortAddress(w.address)}
                        {w.isPrimary ? ' (principal)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="network">Rede</Label>
                  <select
                    id="network"
                    className={selectClass}
                    value={effNetwork}
                    onChange={(e) => setNetwork(e.target.value)}
                  >
                    {NETWORKS.map((n) => (
                      <option key={n.value} value={n.value}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <p role="status" className="text-sm">
                    {statusText[status]}
                  </p>
                  {status === 'connected' ? (
                    <Button variant="outline" size="sm" onClick={disconnect}>
                      Desconectar
                    </Button>
                  ) : (
                    <Button size="sm" onClick={connect} disabled={status === 'connecting'}>
                      {status === 'rejected' ? 'Tentar conectar de novo' : 'Conectar carteira'}
                    </Button>
                  )}
                </div>
                {status === 'rejected' && (
                  <p role="alert" className="text-sm text-destructive">
                    A conexão foi recusada pela carteira. Tente novamente.
                  </p>
                )}
              </>
            )}
          </section>
        </div>

        <aside aria-labelledby="sec-summary" className="h-fit rounded-lg border bg-card p-4">
          <h2 id="sec-summary" className="text-lg font-semibold">
            Resumo
          </h2>

          <ul className="mt-3 grid gap-2 text-sm">
            {q.items.map((item) => (
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
              <dd>{formatEth(q.subtotal)}</dd>
            </div>
            {q.couponCode && (
              <div className="flex justify-between">
                <dt>Desconto ({q.couponCode})</dt>
                <dd>-{formatEth(q.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>Taxa de rede</dt>
              <dd>{formatEth(q.networkFee)}</dd>
            </div>
            <div className="flex justify-between text-base font-semibold text-primary">
              <dt>Total</dt>
              <dd>{formatEth(q.total)}</dd>
            </div>
          </dl>

          {reduced && (
            <p className="mt-3 text-sm">Algumas quantidades foram reduzidas ao estoque disponível.</p>
          )}
          {blocked && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              Há itens indisponíveis. <Link to="/cart" className="underline">Voltar ao carrinho</Link>
            </p>
          )}
          {stale && (
            <div role="alert" className="mt-3 grid gap-2 rounded-md border border-destructive p-3 text-sm">
              <p className="font-medium">Os valores mudaram.</p>
              <p>Revise o resumo acima e aceite a nova cotação para continuar.</p>
              <Button size="sm" onClick={() => setAcceptedId(q.id)}>
                Aceitar nova cotação
              </Button>
            </div>
          )}
          {submitError && (
            <div role="alert" className="mt-3 grid gap-2 text-sm text-destructive">
              <p>{submitError}</p>
              {submitError.startsWith('Não recebemos') && (
                <div>
                  <Button size="sm" variant="outline" onClick={retry} disabled={createOrder.isPending}>
                    Tentar novamente
                  </Button>
                </div>
              )}
            </div>
          )}

          <Button className="mt-4 w-full" onClick={confirm} disabled={!canConfirm || createOrder.isPending}>
            {createOrder.isPending ? 'Enviando pedido...' : 'Confirmar pedido'}
          </Button>
          {!canConfirm && !blocked && !stale && (
            <p className="mt-2 text-xs text-muted-foreground">
              {!wallet
                ? 'Cadastre uma carteira para continuar.'
                : 'Conecte a carteira para confirmar o pedido.'}
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
