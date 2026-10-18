// PONTO 1: imports (novos: useNavigate, toast, useCartMutations)
import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { toast } from 'sonner'
import { nftQuery } from '@/api/nfts'
import { useCartMutations } from '@/api/cart'
import { DetailSkeleton } from '@/components/DetailSkeleton'
import { FavoriteButton } from '@/components/FavoriteButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatEth } from '@/lib/money'

export const Route = createFileRoute('/nft/$nftId')({
  component: NftDetail,
})

function NftDetail() {
  const { nftId } = Route.useParams()
  const { data: nft, isPending, error, refetch } = useQuery(nftQuery(nftId))

  // PONTO 2: hooks novos (precisam ficar ANTES dos "return" abaixo)
  const navigate = useNavigate()
  const { add } = useCartMutations()

  const [editionId, setEditionId] = useState<string>()
  const [imageIndex, setImageIndex] = useState(0)
  const [qty, setQty] = useState(1)

  if (isPending) return <DetailSkeleton />

  if (axios.isAxiosError(error) && error.response?.status === 404) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-2xl font-bold">NFT não encontrado</h1>
        <p className="mt-2">Esse NFT não existe ou foi removido.</p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Voltar ao catálogo
        </Link>
      </div>
    )
  }

  if (error || !nft) {
    return (
      <div role="alert" className="mx-auto max-w-xl p-8 text-center">
        <p className="font-semibold">Não foi possível carregar o NFT.</p>
        <Button className="mt-3" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  // edição escolhida; se nenhuma foi escolhida, usa a primeira com estoque
  const edition =
    nft.editions.find((e) => e.id === editionId) ??
    nft.editions.find((e) => e.available > 0) ??
    nft.editions[0]

  const soldOut = edition.available === 0
  // a quantidade nunca passa do estoque da edição
  const safeQty = soldOut ? 1 : Math.min(Math.max(1, qty), edition.available)

  // PONTO 3: envia o item ao carrinho
  const addToCart = (goToCart: boolean) => {
    add.mutate(
      { nftId: nft.id, editionId: edition.id, quantity: safeQty },
      {
        onSuccess: () => {
          if (goToCart) navigate({ to: '/checkout' })
          else toast.success('Adicionado ao carrinho.')
        },
      },
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <Link to="/" className="text-sm underline">
        ← Voltar ao catálogo
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        {/* Galeria */}
        <section aria-label="Galeria de imagens" className="rounded-lg bg-card p-4">
          <img
            src={nft.images[imageIndex]}
            alt={`${nft.name}, imagem ${imageIndex + 1} de ${nft.images.length}`}
            width={600}
            height={600}
            className="aspect-square w-full rounded-lg"
          />
          <ul className="mt-3 flex gap-2">
            {nft.images.map((src, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setImageIndex(i)}
                  aria-label={`Ver imagem ${i + 1}`}
                  aria-pressed={i === imageIndex}
                  className={`overflow-hidden rounded-md border-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                    i === imageIndex ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <img src={src} alt="" width={64} height={64} className="size-16" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Informações */}
        <section aria-label="Informações do NFT">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold">{nft.name}</h1>
            <FavoriteButton nftId={nft.id} nftName={nft.name} className="shrink-0 border" />
          </div>
          <p className="mt-1 text-sm">
            Coleção {nft.collection} · por {nft.creator}
          </p>
          <p className="mt-4">{nft.description}</p>

          <fieldset className="mt-6">
            <legend className="font-semibold">Edição</legend>
            <div className="mt-2 grid gap-2">
              {nft.editions.map((e) => (
                <label
                  key={e.id}
                  className="flex cursor-pointer items-center justify-between rounded-md border p-3 has-[:checked]:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="edition"
                      value={e.id}
                      checked={e.id === edition.id}
                      onChange={() => setEditionId(e.id)}
                    />
                    {e.label}
                    {e.available === 0 && <Badge variant="secondary">Esgotada</Badge>}
                  </span>
                  <span>{formatEth(e.price)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className="mt-6 text-2xl font-semibold text-primary">{formatEth(edition.price)}</p>

          <div className="mt-4 max-w-40">
            <Label htmlFor="qty">Quantidade</Label>
            <Input
              id="qty"
              type="number"
              min={1}
              max={Math.max(1, edition.available)}
              step={1}
              value={safeQty}
              disabled={soldOut}
              onChange={(e) => setQty(Math.floor(Number(e.target.value)) || 1)}
              aria-describedby="qty-help"
            />
          </div>
          <p id="qty-help" className="mt-1 text-sm">
            {soldOut
              ? 'Edição indisponível no momento.'
              : `Máximo disponível: ${edition.available}`}
          </p>

          {/* PONTO 4: botões de compra */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button disabled={soldOut || add.isPending} onClick={() => addToCart(false)}>
              Adicionar ao carrinho
            </Button>
            <Button
              variant="outline"
              disabled={soldOut || add.isPending}
              onClick={() => addToCart(true)}
            >
              Comprar agora
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
